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
    console, crypto,
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
    auditUserName: () => 'TEST', auditMarkOwn: () => {},
    logRecordChange: (...entry) => logs.push(entry),
    TEMP_NEW_IMGS: {}, editBackRoom: null,
    confirm: () => true, prompt: () => 'QA2',
    closeEdit: () => {}, openRoom: () => {},
    removePhoneFromCache: () => {}, setTimeout: () => {}, syncNow: () => {},
    roomKey: p => p.phong_o || ''
  });
  const names = ['blank', 'saveEdit', 'delRec', 'movePerson', 'queueChange', 'noAccent', 'cleanStr', 'isValidCmnd', 'cleanPhone', 'getPhone',
    'getSkillRating', 'getEthicsRating', 'isDisciplineResolved', 'isDisciplineCase', 'personCardSig',
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
const discipline = { ...old, danh_gia_ky_nang: 3, danh_gia_dao_duc: 3,
  ghi_chu_ky_luat: 'Bỏ cạo - kiểm thử', trang_thai_ky_luat: 'Đang theo dõi' };
const resolved = { ...discipline, trang_thai_ky_luat: 'Đã khắc phục xong (Đạt chuẩn)' };

function editForm(c, values, leader = false) {
  const inputs = Object.entries(values).map(([key, value]) => ({ dataset: { k: key }, value, focus() {} }));
  const sheet = {
    querySelectorAll: () => inputs,
    querySelector: selector => selector === '#ckChu' ? { checked: leader } : inputs.find(i => selector.includes(i.dataset.k))
  };
  c.document.getElementById = id => id === 'sheet' ? sheet : null;
}

function failStorage(c) {
  c.console = { warn() {}, log() {} };
  c.localStorage.setItem = () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); };
}

test('invalid form does not mutate an existing record', () => {
  const { context: c, queue } = sandbox();
  c.DATA = [{ ...old }];
  editForm(c, { ten_that: '', phong_o: 'QA2' });
  c.saveEdit(old.id);
  assert.equal(c.DATA[0].ten_that, old.ten_that);
  assert.equal(c.DATA[0].phong_o, old.phong_o);
  assert.equal(queue().length, 0);
});

test('failed queue persistence cannot delete or modify a worker', () => {
  const { context: c, queue, logs } = sandbox();
  c.DATA = [{ ...old }];
  failStorage(c);
  c.delRec(old.id);
  assert.equal(c.DATA.length, 1);
  assert.equal(c.DATA[0].deleted, undefined);
  editForm(c, { ten_that: 'CHANGED', phong_o: 'QA2' });
  c.saveEdit(old.id);
  assert.equal(c.DATA[0].ten_that, old.ten_that);
  c.movePerson(old.id);
  assert.equal(c.DATA[0].phong_o, old.phong_o);
  assert.equal(queue().length, 0);
  assert.equal(logs.length, 0);
});

test('successful edit applies the draft and queues every room leader change atomically', () => {
  const { context: c, queue } = sandbox();
  c.DATA = [{ ...old }, { ...old, id: 95002, phong_o: 'QA2', chu_phong: true }];
  let queueWrites = 0;
  const write = c.localStorage.setItem;
  c.localStorage.setItem = (key, value) => { if (key === 'cn_queue_v1') queueWrites++; write(key, value); };
  editForm(c, { ten_that: 'CHANGED', phong_o: 'QA2', so_dt: '0123456789' }, true);
  c.saveEdit(old.id);
  assert.equal(c.DATA[0].ten_that, 'CHANGED');
  assert.equal(c.DATA[0].so_dt, '0123456789');
  assert.equal(c.DATA[0].chu_phong, true);
  assert.equal(c.DATA[1].chu_phong, false);
  assert.equal(queueWrites, 1);
  assert.equal(queue().length, 2);
  assert.equal(queue().find(r => r.id === 95002)._editedBy, 'TEST');
});

test('failed leader edit cannot partially change another worker', () => {
  const { context: c, queue } = sandbox();
  c.DATA = [{ ...old }, { ...old, id: 95002, phong_o: 'QA2', chu_phong: true }];
  failStorage(c);
  editForm(c, { ten_that: 'CHANGED', phong_o: 'QA2' }, true);
  c.saveEdit(old.id);
  assert.equal(c.DATA[0].ten_that, old.ten_that);
  assert.equal(c.DATA[0].chu_phong, undefined);
  assert.equal(c.DATA[1].chu_phong, true);
  assert.equal(queue().length, 0);
});

test('new record and temporary images stay unsaved when queue persistence fails', () => {
  const { context: c, queue } = sandbox();
  c.DATA = [{ ...old }];
  c.TEMP_NEW_IMGS = { photo: 'data:image/png;base64,QA' };
  c.setImg = () => assert.fail('Images must not move before the record is queued');
  failStorage(c);
  editForm(c, { ten_that: 'QA NEW', phong_o: 'QA2' });
  c.saveEdit('__new__');
  assert.equal(c.DATA.length, 1);
  assert.equal(queue().length, 0);
  assert.equal(c.TEMP_NEW_IMGS.photo, 'data:image/png;base64,QA');
});

test('successful new record queues its numeric ID before moving temporary images', () => {
  const { context: c, queue } = sandbox();
  c.DATA = [{ ...old }];
  c.TEMP_NEW_IMGS = { photo: 'data:image/png;base64,QA' };
  const images = [];
  c.setImg = (id, type, uri) => { assert.equal(queue()[0].id, id); images.push([id, type, uri]); };
  editForm(c, { ten_that: 'QA NEW', phong_o: 'QA2' });
  c.saveEdit('__new__');
  assert.equal(c.DATA.length, 2);
  assert.equal(c.DATA[0].ten_that, 'QA NEW');
  assert.ok(Number.isSafeInteger(c.DATA[0].id));
  assert.equal(queue()[0].id, c.DATA[0].id);
  assert.equal(images[0][0], c.DATA[0].id);
  assert.equal(Object.keys(c.TEMP_NEW_IMGS).length, 0);
});

test('changing to dependent removes discipline fields from the applied draft', () => {
  const { context: c } = sandbox();
  c.DATA = [{ ...discipline }];
  editForm(c, { ten_that: old.ten_that, loai: 'Gia thuộc' });
  c.saveEdit(old.id);
  assert.equal(c.DATA[0].loai, 'Gia thuộc');
  assert.equal(c.DATA[0].ghi_chu_ky_luat, undefined);
  assert.equal(c.DATA[0].danh_gia_ky_nang, undefined);
});

test('cleared pending phone is not refilled from cache or stale DATA', () => {
  const { context: c, queue } = sandbox();
  c.DATA = [{ ...old, so_dt: '0123456789', sdt: '0123456789' }];
  c.lookupPhoneFromCache = () => '0123456789';
  editForm(c, { ten_that: old.ten_that, so_dt: '' });
  c.saveEdit(old.id);
  assert.equal(queue()[0].so_dt, '');
  c.DATA = [{ ...old, so_dt: '0123456789' }];
  assert.equal(c.mergeServerData([old], queue())[0].so_dt, '');
});

test('successful move and deletion persist and canceled deletion does nothing', () => {
  const { context: c, queue, logs } = sandbox();
  c.DATA = [{ ...old, chu_phong: true }];
  let syncs = 0;
  c.syncNow = () => syncs++;
  c.movePerson(old.id);
  assert.equal(c.DATA[0].phong_o, 'QA2');
  assert.equal(c.DATA[0].chu_phong, false);
  assert.equal(queue()[0].phong_o, 'QA2');
  assert.equal(syncs, 1);
  c.confirm = () => false;
  c.delRec(old.id);
  assert.equal(c.DATA.length, 1);
  assert.equal(logs.length, 1);
  c.confirm = () => true;
  c.delRec(old.id);
  assert.equal(c.DATA.length, 0);
  assert.equal(queue()[0].deleted, true);
  assert.equal(logs.length, 2);
});

test('startup recovers pending addition, edit and deletion without cloud access', () => {
  const { context: c, setQueue } = sandbox();
  c.load = () => [{ ...old }, { ...old, id: 95002 }];
  setQueue([{ ...old, deleted: true }, { ...latest, id: 95002 },
    { ...latest, id: 95003, ten_that: 'QA NEW', cmnd: '990654321' }]);
  const start = source.indexOf('var DATA = load();');
  const end = source.indexOf('window.DATA = DATA;', start) + 'window.DATA = DATA;'.length;
  vm.runInContext(source.slice(start, end), c);
  assert.deepEqual(Array.from(c.DATA, r => r.id).sort(), [95002, 95003]);
  assert.equal(c.DATA.find(r => r.id === 95002).phong_o, latest.phong_o);
  assert.equal(c.DATA.find(r => r.id === 95003)._edited, true);
  assert.equal(c.window.DATA, c.DATA);
});

test('queue-only records recover while pending deletions stay deleted', () => {
  const { context: c } = sandbox();
  c.DATA = [{ ...old }];
  const added = { ...latest, id: 95002, ten_that: 'QA NEW' };
  const merged = c.mergeServerData([], [{ ...old, deleted: true }, added]);
  assert.deepEqual(Array.from(merged, r => r.id), [added.id]);
  assert.equal(merged[0]._edited, true);
});

test('quota cleanup never discards image operations or audit history', () => {
  const { context: c } = sandbox();
  c.localStorage.setItem('cn_pendimg_v1', '["photo:95001"]');
  c.localStorage.setItem('cn_penddel_v1', '["cmnd:95001"]');
  c.localStorage.setItem('cn_audit_logs_v1', '[{"action":"QA"}]');
  failStorage(c);
  assert.equal(c.safeSetStorage('cn_queue_v1', '[]'), false);
  const start = source.indexOf('(function autoHealStorageQuota(){');
  vm.runInContext(source.slice(start, source.indexOf('})();', start) + 5), c);
  assert.equal(c.localStorage.getItem('cn_pendimg_v1'), '["photo:95001"]');
  assert.equal(c.localStorage.getItem('cn_penddel_v1'), '["cmnd:95001"]');
  assert.equal(c.localStorage.getItem('cn_audit_logs_v1'), '[{"action":"QA"}]');
});

test('offline devices allocate different numeric IDs from the same dataset', () => {
  const { context: a } = sandbox();
  const { context: b } = sandbox();
  a.DATA = [{ id: 200147003 }];
  b.DATA = [{ id: 200147003 }];
  a.crypto = { getRandomValues: values => { values.set([12345, 67890]); return values; } };
  b.crypto = { getRandomValues: values => { values.set([23456, 78901]); return values; } };
  const first = a.blank('QA1');
  const second = b.blank('QA2');
  assert.notEqual(first.id, second.id);
  for (const rec of [first, second]) {
    assert.ok(Number.isSafeInteger(rec.id) && rec.id > 0);
    assert.ok(String(rec.id).length <= 15);
  }
  assert.equal(first.phong_o, 'QA1');
  assert.equal(second.phong_o, 'QA2');
});

test('new IDs skip existing IDs, zero, and pending deleted IDs', () => {
  const { context: c, setQueue } = sandbox();
  c.DATA = [{ id: 8 }];
  setQueue([{ id: 9, deleted: true }]);
  const draws = [[0, 0], [0, 8], [0, 9], [0, 10]];
  c.crypto = { getRandomValues: values => { values.set(draws.shift()); return values; } };
  assert.equal(c.blank().id, 10);
  assert.equal(draws.length, 0);
});

test('resolved discipline retains history without treating low ratings as resolved', () => {
  const { context: c } = sandbox();
  assert.equal(c.isDisciplineResolved(resolved), true);
  assert.equal(c.isDisciplineCase(resolved), true);
  assert.equal(c.isDisciplineResolved(discipline), false);
  assert.equal(c.isDisciplineResolved({ ...resolved, danh_gia_dao_duc: 2 }), false);
  assert.equal(c.isDisciplineResolved({ ...resolved, danh_gia_ky_nang: 1 }), false);
  assert.equal(c.isDisciplineResolved({ ...resolved, loai: 'Gia thuộc' }), false);
});

test('status-only discipline edit invalidates cached person card', () => {
  const { context: c } = sandbox();
  const signature = p => c.personCardSig(p, '', '', 3, 3, '');
  assert.notEqual(signature(discipline), signature(resolved));
  assert.equal(signature(resolved), signature({ ...resolved }));
});

test('server resolution replaces old discipline state and explicit empty clears note', () => {
  const { context: c } = sandbox();
  c.DATA = [{ ...discipline }];
  const result = c.mergeServerData([resolved], []);
  assert.equal(c.isDisciplineResolved(result[0]), true);
  assert.equal(result[0].ghi_chu_ky_luat, discipline.ghi_chu_ky_luat);
  const cleared = c.mergeServerData([{ ...resolved, ghi_chu_ky_luat: '',
    ngay_ky_luat: '', hinh_thuc_ky_luat: '', trang_thai_ky_luat: '', nguoi_lap_bien_ban: '' }], []);
  assert.equal(cleared[0].ghi_chu_ky_luat, '');
  assert.equal(c.isDisciplineCase(cleared[0]), false);
});

test('pending discipline correction survives rejected push and stale pull', async () => {
  const { context: c, setQueue, queue } = sandbox();
  const corrected = { ...resolved, ghi_chu_ky_luat: 'Đã khắc phục - kiểm thử' };
  c.DATA = [corrected];
  setQueue([corrected]);
  c.api = async action => action === 'push'
    ? { ok: true, accepted: [old.id], rejected: [{ id: old.id, reason: 'guest_field_restricted' }] }
    : { ok: true, rev: 1, rows: [discipline], images: {} };
  await c.syncNowCore(true, true);
  assert.equal(queue().length, 1);
  assert.equal(c.DATA[0].ghi_chu_ky_luat, corrected.ghi_chu_ky_luat);
  assert.equal(c.isDisciplineResolved(c.DATA[0]), true);
});

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
