import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../app_script.js', import.meta.url), 'utf8');
function functionSource(name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `Missing function ${name}`);
  const lineEnd = source.indexOf('\n', match.index);
  if (source.slice(match.index, lineEnd).trimEnd().endsWith('}')) {
    return source.slice(match.index, lineEnd);
  }
  const end = source.indexOf('\n}', match.index);
  assert.ok(end >= 0, `Missing end of ${name}`);
  return source.slice(match.index, end + 2);
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function sandbox() {
  const storage = new Map();
  const idbWrites = [];
  const audits = [];
  const requests = [];
  const warnings = [];
  const h = { onImage: (_action, params) => ({ ok: true, fid: `uploaded-${params.id}` }) };
  const c = vm.createContext({
    console: { warn: (...args) => warnings.push(args) },
    IMG_OVR: {}, DEL: '__DEL__', TEMP_NEW_IMGS: {}, PRELOAD: {}, IMG_STATIC: {}, IMG_BASE: 'images',
    DATA: [], CFG: { url: 'mock', key: 'mock' }, API_OK: false,
    _lastCloudSig: '[]', _lastCloudRev: null, _lastPeopleHtml: null,
    window: {}, document: { getElementById: () => null },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    safeSetStorage: (key, value) => { storage.set(key, value); return true; },
    idbPut: (key, value) => idbWrites.push({ key, value }),
    logAudit: entry => audits.push(entry),
    getPhoneCache: () => ({}), getPhone: () => '',
    enrichRecordForServer: rec => rec, acknowledgeChanges: () => [], updateSyncBadge: () => {},
    applyRole: () => {}, logIncomingChanges: () => {}, mergeServerData: () => [],
    save: () => assert.fail('Image test must not save record data'),
    initFilterOptions: () => {}, render: () => {}, updateDisciplineBadge: () => {},
    toast: () => {}, t: value => value, openSettings: () => {}, addLog: () => {},
    fetch: () => assert.fail('Unexpected network request'),
    api: async (action, params) => {
      if (action === 'uploadImage' || action === 'deleteImage') {
        requests.push({ action, ...params });
        return h.onImage(action, params);
      }
      assert.equal(action, 'pull');
      return { ok: true, rows: [], images: {}, rev: 1 };
    }
  });
  const names = ['getImg', 'imgFileId', 'driveImgUrl', 'setImg', 'delImg', 'rememberImgFid',
    'getPendImg', 'setPendImg', 'addPendImg', 'getPendDel', 'setPendDel', 'addPendDel',
    'snapshotImgOp', 'isCurrentImgOp', 'acknowledgeImgOp', 'fetchServerImages', 'syncNowCore'];
  const tokens = source.match(/^const IMG_OP_TOKENS = .*$/m);
  assert.ok(tokens, 'Missing image operation tokens');
  vm.runInContext(tokens[0] + '\n' + names.map(functionSource).join('\n'), c);
  return Object.assign(h, {
    c, requests, idbWrites, audits,
    uploads: () => Array.from(c.getPendImg()),
    deletions: () => Array.from(c.getPendDel()),
    map: () => JSON.parse(storage.get('cn_imgfiles_v1') || '{}'),
    seedFid: (id, type, fid) => c.rememberImgFid(id, type, fid),
    async sync() {
      c._lastCloudRev = null;
      await c.syncNowCore(true, true);
      assert.equal(c._lastCloudRev, 1, 'Sync must reach the successful pull, not swallow an exception');
      assert.deepEqual(warnings, []);
    }
  });
}

function holdFirst(h, action) {
  const started = deferred();
  const result = deferred();
  const fallback = h.onImage;
  let held = false;
  h.onImage = (next, params) => {
    if (!held && next === action) {
      held = true;
      started.resolve(params);
      return result.promise;
    }
    return fallback(next, params);
  };
  return { started: started.promise, release: result.resolve };
}

const uri = name => `data:image/jpeg;base64,${name}`;

test('successful upload and deletion propagate and acknowledge their own keys', async () => {
  const h = sandbox();
  h.seedFid('2', 'photo', 'old-2');
  h.c.setImg('1', 'photo', uri('one'));
  h.c.delImg('2', 'photo');
  await h.sync();
  assert.deepEqual(h.requests, [
    { action: 'uploadImage', id: '1', type: 'photo', dataUrl: uri('one') },
    { action: 'deleteImage', id: '2', type: 'photo' }
  ]);
  assert.deepEqual(h.uploads(), []);
  assert.deepEqual(h.deletions(), []);
  assert.equal(h.c.imgFileId('1', 'photo'), 'uploaded-1');
  assert.equal(h.map()['photo:1'], 'uploaded-1');
  assert.equal(h.c.imgFileId('2', 'photo'), null);
  assert.equal(h.map()['photo:2'], undefined);
  assert.equal(h.c.getImg('2', 'photo'), null);
});

test('replacement and new upload during await survive, while unchanged siblings are acknowledged', async () => {
  const h = sandbox();
  h.seedFid('1', 'photo', 'original-fid');
  h.c.setImg('1', 'photo', uri('old'));
  h.c.setImg('2', 'photo', uri('two'));
  const gate = holdFirst(h, 'uploadImage');
  const syncing = h.sync();
  await gate.started;
  h.c.setImg('1', 'photo', uri('replacement'));
  h.c.setImg('3', 'photo', uri('new'));
  gate.release({ ok: true, fid: 'stale-fid' });
  await syncing;
  assert.deepEqual(h.uploads(), ['photo:1', 'photo:3']);
  assert.equal(h.c.imgFileId('1', 'photo'), 'original-fid');
  assert.equal(h.map()['photo:1'], 'original-fid');
  assert.equal(h.c.imgFileId('2', 'photo'), 'uploaded-2');
  assert.deepEqual(h.requests.map(r => r.id), ['1', '2']);
  await h.sync();
  assert.deepEqual(h.uploads(), []);
  assert.deepEqual(h.requests.slice(2).map(r => r.dataUrl), [uri('replacement'), uri('new')]);
  assert.equal(h.c.imgFileId('1', 'photo'), 'uploaded-1');
});

for (const mutation of ['replace', 'delete']) {
  test(`upload snapshot ${mutation}d before dispatch is skipped`, async () => {
    const h = sandbox();
    h.c.setImg('1', 'photo', uri('one'));
    h.c.setImg('2', 'photo', uri('two'));
    const gate = holdFirst(h, 'uploadImage');
    const syncing = h.sync();
    await gate.started;
    if (mutation === 'replace') h.c.setImg('2', 'photo', uri('new-two'));
    else h.c.delImg('2', 'photo');
    gate.release({ ok: true, fid: 'uploaded-1' });
    await syncing;
    assert.deepEqual(h.requests.filter(r => r.action === 'uploadImage').map(r => r.id), ['1']);
    assert.deepEqual(h.uploads(), mutation === 'replace' ? ['photo:2'] : []);
    if (mutation === 'delete') {
      assert.deepEqual(h.requests[1], { action: 'deleteImage', id: '2', type: 'photo' });
      assert.deepEqual(h.deletions(), []);
    }
  });
}

test('upload completion after a local deletion cannot install a stale fid', async () => {
  const h = sandbox();
  h.seedFid('1', 'photo', 'original-fid');
  h.c.setImg('1', 'photo', uri('one'));
  h.onImage = () => {
    assert.equal(h.c.imgFileId('1', 'photo'), 'original-fid');
    return { ok: false, error: 'retry-delete' };
  };
  const gate = holdFirst(h, 'uploadImage');
  const syncing = h.sync();
  await gate.started;
  h.c.delImg('1', 'photo');
  gate.release({ ok: true, fid: 'stale-fid' });
  await syncing;
  assert.deepEqual(h.uploads(), []);
  assert.deepEqual(h.deletions(), ['photo:1']);
  assert.equal(h.c.getImg('1', 'photo'), null);
  assert.equal(h.map()['photo:1'], 'original-fid');
});

test('new and repeated deletion during await survive without stale map cleanup', async () => {
  const h = sandbox();
  for (const id of ['1', '2', '3']) h.seedFid(id, 'photo', `original-${id}`);
  h.c.delImg('1', 'photo');
  h.c.delImg('2', 'photo');
  const gate = holdFirst(h, 'deleteImage');
  const syncing = h.sync();
  await gate.started;
  h.c.delImg('1', 'photo');
  h.c.delImg('3', 'photo');
  gate.release({ ok: true });
  await syncing;
  assert.deepEqual(h.deletions(), ['photo:1', 'photo:3']);
  assert.deepEqual(h.requests.map(r => r.id), ['1', '2']);
  assert.equal(h.c.imgFileId('1', 'photo'), 'original-1');
  assert.equal(h.map()['photo:1'], 'original-1');
  assert.equal(h.c.imgFileId('2', 'photo'), null);
  await h.sync();
  assert.deepEqual(h.deletions(), []);
  assert.equal(h.c.imgFileId('1', 'photo'), null);
  assert.equal(h.c.imgFileId('3', 'photo'), null);
});

test('reupload cancels deletion in flight and before dispatch without clearing a newer fid', async () => {
  const h = sandbox();
  h.c.delImg('1', 'photo');
  h.c.delImg('2', 'photo');
  const gate = holdFirst(h, 'deleteImage');
  const syncing = h.sync();
  await gate.started;
  h.c.setImg('1', 'photo', uri('new-one'));
  h.seedFid('1', 'photo', 'new-operation-fid');
  h.c.setImg('2', 'photo', uri('new-two'));
  gate.release({ ok: true });
  await syncing;
  assert.deepEqual(h.requests, [{ action: 'deleteImage', id: '1', type: 'photo' }]);
  assert.deepEqual(h.deletions(), []);
  assert.deepEqual(h.uploads(), ['photo:1', 'photo:2']);
  assert.equal(h.c.imgFileId('1', 'photo'), 'new-operation-fid');
  assert.equal(h.map()['photo:1'], 'new-operation-fid');
  await h.sync();
  assert.deepEqual(h.uploads(), []);
});

test('reupload after deletion removes the older pending deletion', async () => {
  const h = sandbox();
  h.c.setImg('1', 'photo', uri('old'));
  h.c.delImg('1', 'photo');
  assert.deepEqual(h.uploads(), []);
  h.c.setImg('1', 'photo', uri('new'));
  assert.deepEqual(h.deletions(), []);
  await h.sync();
  assert.deepEqual(h.requests, [{ action: 'uploadImage', id: '1', type: 'photo', dataUrl: uri('new') }]);
  assert.equal(h.c.getImg('1', 'photo'), uri('new'));
  assert.deepEqual(h.uploads(), []);
});

test('delete and reupload of the identical URI cannot acknowledge an older upload', async () => {
  const h = sandbox();
  h.seedFid('1', 'photo', 'original-fid');
  h.c.setImg('1', 'photo', uri('same'));
  const gate = holdFirst(h, 'uploadImage');
  const syncing = h.sync();
  await gate.started;
  h.c.delImg('1', 'photo');
  h.c.setImg('1', 'photo', uri('same'));
  gate.release({ ok: true, fid: 'stale-fid' });
  await syncing;
  assert.deepEqual(h.uploads(), ['photo:1']);
  assert.deepEqual(h.deletions(), []);
  assert.equal(h.c.imgFileId('1', 'photo'), 'original-fid');
  await h.sync();
  assert.deepEqual(h.uploads(), []);
  assert.equal(h.c.imgFileId('1', 'photo'), 'uploaded-1');
});

test('remote tombstones and map updates cannot overwrite a pending upload', async () => {
  const h = sandbox();
  h.seedFid('1', 'photo', 'original-fid');
  h.c.setImg('1', 'photo', uri('local'));
  await h.c.fetchServerImages({ 1: { photo: 'remote-fid' } }, { 1: { photo: true } });
  assert.equal(h.c.getImg('1', 'photo'), uri('local'));
  assert.equal(h.c.imgFileId('1', 'photo'), 'original-fid');
  assert.equal(h.map()['photo:1'], 'original-fid');
  assert.deepEqual(h.uploads(), ['photo:1']);
  assert.deepEqual(h.idbWrites, [{ key: 'photo:1', value: uri('local') }]);
  assert.deepEqual(h.audits, []);
});

test('pending deletion blocks remote map and tombstone changes but not sibling images', async () => {
  const h = sandbox();
  h.seedFid('1', 'photo', 'original-photo');
  h.seedFid('1', 'cmnd', 'original-cmnd');
  h.c.delImg('1', 'photo');
  await h.c.fetchServerImages({ 1: { photo: 'remote-photo', cmnd: 'remote-cmnd' } }, { 1: { photo: true } });
  assert.equal(h.c.getImg('1', 'photo'), null);
  assert.equal(h.c.imgFileId('1', 'photo'), 'original-photo');
  assert.equal(h.map()['photo:1'], 'original-photo');
  assert.equal(h.c.imgFileId('1', 'cmnd'), 'remote-cmnd');
  assert.equal(h.map()['cmnd:1'], 'remote-cmnd');
  assert.deepEqual(h.deletions(), ['photo:1']);
  assert.deepEqual(h.idbWrites, [{ key: 'photo:1', value: '__DEL__' }]);
  assert.deepEqual(h.audits, []);
});

test('uncontested remote map updates and tombstones propagate normally', async () => {
  const h = sandbox();
  await h.c.fetchServerImages({ 1: { photo: 'remote-photo', cmnd: 'remote-cmnd' } });
  assert.equal(h.c.imgFileId('1', 'photo'), 'remote-photo');
  assert.equal(h.map()['photo:1'], 'remote-photo');
  assert.match(h.c.getImg('1', 'photo'), /remote-photo/);
  await h.c.fetchServerImages({}, { 1: { photo: true } });
  assert.equal(h.c.getImg('1', 'photo'), null);
  assert.equal(h.c.imgFileId('1', 'photo'), null);
  assert.equal(h.map()['photo:1'], undefined);
  assert.equal(h.c.imgFileId('1', 'cmnd'), 'remote-cmnd');
  assert.deepEqual(h.idbWrites, [{ key: 'photo:1', value: '__DEL__' }]);
  assert.equal(h.audits.length, 1);
  await h.c.fetchServerImages({}, { 1: { photo: true } });
  assert.equal(h.idbWrites.length, 1);
  assert.equal(h.audits.length, 1);
});

test('missing URI is retained until image data is available', async () => {
  const h = sandbox();
  h.c.addPendImg('photo:1');
  await h.sync();
  assert.deepEqual(h.uploads(), ['photo:1']);
  assert.deepEqual(h.requests, []);
  h.c.setImg('1', 'photo', uri('available'));
  await h.sync();
  assert.deepEqual(h.uploads(), []);
  assert.equal(h.requests[0].dataUrl, uri('available'));
});

for (const failure of ['rejected', 'exception']) {
  test(`${failure} image requests retain uploads and deletions for retry`, async () => {
    const h = sandbox();
    h.c.setImg('1', 'photo', uri('one'));
    h.c.delImg('2', 'photo');
    h.onImage = () => {
      if (failure === 'exception') throw new Error('simulated offline');
      return { ok: false, error: 'retry' };
    };
    await h.sync();
    assert.deepEqual(h.uploads(), ['photo:1']);
    assert.deepEqual(h.deletions(), ['photo:2']);
    assert.equal(h.requests.length, 2);
    assert.deepEqual(h.map(), {});
  });
}

test('local-server catalog merge uses the same per-image pending protection', async () => {
  const h = sandbox();
  h.seedFid('1', 'photo', 'original-photo');
  h.c.delImg('1', 'photo');
  h.c.API_OK = true;
  h.c.fetch = async url => {
    assert.equal(url, '/api/sync-data');
    return { ok: true, json: async () => ({ ok: true, images: { 1: { photo: 'remote-photo', cmnd: 'remote-cmnd' } } }) };
  };
  h.onImage = () => ({ ok: false, error: 'retry-delete' });
  await h.sync();
  assert.equal(h.c.imgFileId('1', 'photo'), 'original-photo');
  assert.equal(h.map()['photo:1'], 'original-photo');
  assert.equal(h.c.imgFileId('1', 'cmnd'), 'remote-cmnd');
  assert.deepEqual(h.deletions(), ['photo:1']);
});

test('temporary new-record images do not enqueue persisted image operations', () => {
  const h = sandbox();
  h.c.setImg('__new__', 'photo', uri('temporary'));
  assert.equal(h.c.getImg('__new__', 'photo'), uri('temporary'));
  h.c.delImg('__new__', 'photo');
  assert.equal(h.c.getImg('__new__', 'photo'), null);
  assert.deepEqual(h.uploads(), []);
  assert.deepEqual(h.deletions(), []);
  assert.deepEqual(h.idbWrites, []);
});
