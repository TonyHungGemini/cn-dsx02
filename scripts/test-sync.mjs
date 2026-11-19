import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../app_script.js', import.meta.url), 'utf8');
function functionSource(name) {
  const match = new RegExp(`(?:async )?function ${name}\\(`).exec(source);
  assert.ok(match, `Missing function ${name}`);
  const end = source.indexOf('\n}', match.index);
  return source.slice(match.index, end + 2);
}

function sandbox() {
  const storage = new Map();
  const logs = [];
  const context = vm.createContext({
    console,
    DATA: [], CFG: { url: 'mock', key: 'mock', user: 'TEST' }, ROLE: 'guest', API_OK: false,
    _lastCloudSig: null, _lastCloudRev: null,
    AUDIT_BASE_KEY: 'audit-base', AUDIT_OWN_KEY: 'audit-own',
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    lookupPhoneFromCache: () => '', lookupPendingPhone: () => '', savePhoneToCache: () => {},
    getPhoneCache: () => ({}), getBaseData: () => [],
    save: () => {}, initFilterOptions: () => {}, render: () => {},
    updateDisciplineBadge: () => {}, applyRole: () => {},
    document: { getElementById: () => null }, window: {}, IMG_OVR: {},
    fetch: () => Promise.reject(new Error('Unexpected network call in test')),
    fetchServerImages: async () => {},
    toast: () => {}, t: value => value, addLog: () => {},
    logAudit: entry => logs.push(entry), auditDescribeWorker: () => '',
    auditUserName: () => 'TEST'
  });
  const names = ['noAccent', 'cleanStr', 'isValidCmnd', 'cleanPhone', 'getPhone',
    'findMatchingRecord', 'dedupeDataset', 'latestServerRows', 'findSyncRecord', 'normServerRec',
    'mergeServerData', 'safeSetStorage', 'enrichRecordForServer', 'acknowledgeChanges',
    'updateSyncBadge', 'getPendImg', 'setPendImg', 'getPendDel', 'setPendDel',
    'auditFieldVal', 'auditSnap', 'auditHash', 'auditDiffParts', 'auditDiffText',
    'auditLoadMap', 'auditSaveMap', 'auditMeaningfulServerRec', 'logIncomingChanges', 'syncNowCore'];
  const fields = source.slice(source.indexOf('const AUDIT_FIELDS = ['), source.indexOf('\n];', source.indexOf('const AUDIT_FIELDS = [')) + 3);
  vm.runInContext(fields + '\n' + names.map(functionSource).join('\n'), context);
  const setQueue = rows => storage.set('cn_queue_v1', JSON.stringify(rows));
  const queue = () => JSON.parse(storage.get('cn_queue_v1') || '[]');
  return { context, setQueue, queue, logs };
}

const old = { id: 95001, cmnd: '990123456', ten_that: 'SYNC TEST', to: 'Tổ 8', phong_o: 'M6', phan_cay: 'OLD', updatedAt: '2026-11-19T02:34:00Z' };
const latest = { ...old, to: 'Tổ 5', phong_o: 'E7', phan_cay: '17-KV5', updatedAt: '2026-11-19T02:37:56Z', updatedBy: 'TEST' };

for (const rows of [[old, old, latest], [latest, old, old], [old, latest, old]]) {
  test('latest duplicate wins regardless of sheet order', () => {
    const { context: c } = sandbox();
    c.DATA = [{ ...old }];
    const result = c.mergeServerData(rows, []);
    assert.equal(result.length, 1);
    assert.equal(result[0].to, 'Tổ 5');
    assert.equal(result[0].phong_o, 'E7');
    assert.equal(result[0].phan_cay, '17-KV5');
    assert.equal(result[0].updatedAt, latest.updatedAt);
    assert.equal(result[0].updatedBy, 'TEST');
  });
}

test('latest tombstone removes only its own stable ID', () => {
  const { context: c } = sandbox();
  c.DATA = [{ id: 11, ten_that: 'TWIN', phong_o: 'A1' }, { id: 12, ten_that: 'TWIN', phong_o: 'A1' }];
  const result = c.mergeServerData([{ id: 11, ten_that: 'TWIN', phong_o: 'A1', deleted: true }], []);
  assert.deepEqual(Array.from(result, r => r.id), [12]);
});

test('rename retains server ID, including when CMND changes', () => {
  const { context: c } = sandbox();
  c.DATA = [{ ...old }];
  const result = c.mergeServerData([{ ...latest, ten_that: 'RENAMED', cmnd: '990987654' }], []);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, old.id);
  assert.equal(result[0].ten_that, 'RENAMED');
});

test('pending personal fields and deletion survive stale pull', () => {
  const { context: c } = sandbox();
  c.DATA = [{ ...latest }];
  const result = c.mergeServerData([old], [latest]);
  assert.equal(result[0].phong_o, 'E7');
  assert.equal(result[0]._edited, true);
  assert.equal(c.mergeServerData([], [latest])[0]._edited, true);
  assert.equal(c.mergeServerData([old], [{ ...latest, deleted: true }]).length, 0);
});

test('remote audit uses newest duplicate once and keeps attribution', () => {
  const { context: c, logs } = sandbox();
  c.DATA = [{ ...old }];
  c.logIncomingChanges([old]);
  c.logIncomingChanges([old, latest, old]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].user, 'TEST');
  assert.match(logs[0].detail, /Tổ 8.*Tổ 5/);
  c.DATA = c.mergeServerData([old, latest], []);
  c.logIncomingChanges([old, latest, old]);
  assert.equal(logs.length, 1);
});

test('ack removes only accepted unchanged snapshots, never rejected or new edits', () => {
  const { context: c, setQueue, queue } = sandbox();
  const sent = [old, { ...old, id: 95002 }, { ...old, id: 95003 }];
  setQueue([latest, sent[1], sent[2], { ...latest, id: 95004 }]);
  c.acknowledgeChanges(sent, { ok: true, accepted: [95001, 95002, 95003], rejected: [{ id: 95003 }] });
  assert.deepEqual(queue().map(r => r.id), [95001, 95003, 95004]);
});

for (const response of [{ ok: false }, { ok: true }, { ok: true, accepted: [] }]) {
  test('unconfirmed push cannot drop queue', () => {
    const { context: c, setQueue, queue } = sandbox();
    setQueue([latest]);
    c.acknowledgeChanges([latest], response);
    assert.equal(queue().length, 1);
  });
}

test('edit made while push is pending remains visible and queued', async () => {
  const { context: c, setQueue, queue } = sandbox();
  setQueue([old]);
  c.DATA = [{ ...old }];
  c.api = async action => {
    if (action === 'push') {
      setQueue([latest]);
      c.DATA = [{ ...latest }];
      return { ok: true, accepted: [old.id] };
    }
    return { ok: true, rev: 1, rows: [old], images: {} };
  };
  await c.syncNowCore(true, true);
  assert.equal(queue()[0].phong_o, 'E7');
  assert.equal(c.DATA[0].phong_o, 'E7');
});

test('failed pull cannot acknowledge a successful push', async () => {
  const { context: c, setQueue, queue } = sandbox();
  setQueue([latest]);
  c.api = async action => action === 'push' ? { ok: true, accepted: [latest.id] } : { ok: false, error: 'offline' };
  await c.syncNowCore(true, true);
  assert.equal(queue().length, 1);
});

test('edit arriving during an empty-queue pull is preserved', async () => {
  const { context: c, setQueue, queue } = sandbox();
  c.DATA = [{ ...old }];
  c.api = async () => {
    setQueue([latest]); c.DATA = [{ ...latest }];
    return { ok: true, rev: 1, rows: [old], images: {} };
  };
  await c.syncNowCore(true, true);
  assert.equal(queue().length, 1);
  assert.equal(c.DATA[0].to, 'Tổ 5');
});
