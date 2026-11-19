import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../app_script.js', import.meta.url), 'utf8');
function functionSource(name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `Missing function ${name}`);
  const lineEnd = source.indexOf('\n', match.index);
  const firstLine = source.slice(match.index, lineEnd);
  if (firstLine.trimEnd().endsWith('}')) return firstLine;
  const end = source.indexOf('\n}', match.index);
  assert.ok(end > match.index, `Missing end of function ${name}`);
  return source.slice(match.index, end + 2);
}

const ID = 'camera-test-record';
const OLD = 'data:image/jpeg;base64,b2xkLXRlc3Q=';
const CAPTURED = 'data:image/jpeg;base64,Y2FwdHVyZS10ZXN0';
const FILE = { name: 'synthetic-camera.jpg', type: 'image/jpeg' };

function attribute(tag, name) {
  return new RegExp(`\\b${name}=(['"])(.*?)\\1`).exec(tag)?.[2];
}

function actionButtons(html) {
  return Array.from(html.matchAll(/<button\b[^>]*>/g), ([tag]) => ({
    tag,
    dataset: { imgAct: attribute(tag, 'data-img-act'), imgType: attribute(tag, 'data-img-type') },
    closest: () => null
  })).filter(button => button.dataset.imgAct);
}

function sandbox(t, { hasImage = false, compression = async () => CAPTURED } = {}) {
  const storage = new Map();
  const idb = new Map();
  const writes = [];
  const changes = [];
  const ocr = [];
  const messages = [];
  const inputs = [];
  const attached = new Set();
  const compressionCalls = [];
  const networkCalls = [];
  const listeners = [];
  let html = '';
  let buttons = [];
  let renderCount = 0;
  let bindingCount = 0;
  const container = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      buttons = actionButtons(value);
      renderCount++;
    },
    querySelectorAll(selector) {
      if (selector === '[data-dropdown-toggle]') return [];
      assert.equal(selector, '[data-img-act]');
      bindingCount++;
      return buttons;
    }
  };
  const c = vm.createContext({
    console,
    window: {}, API_OK: false, IMG_OVR: {}, TEMP_NEW_IMGS: {},
    t: value => value,
    esc: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
    getImg: (id, type) => c.IMG_OVR[`${type}:${id}`] || null,
    imgFileId: () => null,
    getDriveFileUrl: () => null,
    toast: message => messages.push(message),
    doOcrCMND: (id, options) => ocr.push([id, options.auto]),
    compress: async (...args) => {
      compressionCalls.push(args);
      assert.equal(attached.size, 0, 'input is removed before compression starts');
      return compression(...args);
    },
    idbPut: (key, value) => {
      idb.set(key, value);
      writes.push([key, value]);
      return Promise.resolve();
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    fetch: (...args) => {
      networkCalls.push(args);
      throw new Error('Network is forbidden in camera tests');
    },
    document: {
      getElementById: id => id === 'imgSection' ? container : null,
      addEventListener: (...args) => listeners.push(args),
      body: { appendChild: input => { attached.add(input); return input; } },
      createElement: tag => {
        assert.equal(tag, 'input');
        const attributes = new Map();
        const input = {
          files: [], clicks: 0, removals: 0,
          setAttribute: (key, value) => attributes.set(key, String(value)),
          getAttribute: key => attributes.get(key) ?? null,
          hasAttribute: key => attributes.has(key),
          click() {
            assert.ok(attached.has(input), 'native picker must be attached before click');
            input.clicks++;
          },
          remove() { attached.delete(input); input.removals++; }
        };
        inputs.push(input);
        return input;
      }
    }
  });
  const names = ['renderImgSlot', 'renderImgSection', 'pickImageFile', 'wireImgEvents',
    'setImg', 'safeSetStorage', 'getPendImg', 'setPendImg', 'addPendImg'];
  vm.runInContext(names.map(functionSource).join('\n'), c);
  const realSetImg = c.setImg;
  c.setImg = (...args) => { changes.push(args); return realSetImg(...args); };
  if (hasImage) {
    c.IMG_OVR[`photo:${ID}`] = OLD;
    c.IMG_OVR[`cmnd:${ID}`] = OLD;
  }
  container.innerHTML = c.renderImgSection(ID);
  c.wireImgEvents(ID);
  t.after(() => assert.deepEqual(networkCalls, [], 'no attempted network calls'));

  const snapshot = () => ({
    images: { ...c.IMG_OVR }, storage: [...storage], idb: [...idb],
    writes: [...writes], changes: [...changes], ocr: [...ocr], html, renderCount, bindingCount
  });
  const click = async (act, type) => {
    const button = buttons.find(b => b.dataset.imgAct === act && b.dataset.imgType === type);
    assert.ok(button, `Missing ${act} button for ${type}`);
    assert.equal(typeof button.onclick, 'function', 'rendered button is wired');
    let prevented = 0;
    let stopped = 0;
    await button.onclick({ preventDefault: () => prevented++, stopPropagation: () => stopped++ });
    assert.equal(prevented, 1);
    assert.equal(stopped, 1);
    return inputs.at(-1);
  };
  return { c, storage, idb, writes, changes, ocr, messages, inputs, attached,
    compressionCalls, listeners, container, snapshot, click };
}

for (const type of ['photo', 'cmnd']) {
  for (const hasImage of [false, true]) {
    test(`render ${type}, ${hasImage ? 'existing' : 'empty'}: camera and gallery buttons`, t => {
      const { c } = sandbox(t, { hasImage });
      const buttons = actionButtons(c.renderImgSlot(ID, type, 'Synthetic image'));
      const cameras = buttons.filter(b => b.dataset.imgAct === 'capture');
      const galleries = buttons.filter(b => b.dataset.imgAct === (hasImage ? 'change' : 'upload'));
      assert.equal(cameras.length, 1);
      assert.ok(galleries.length > 0);
      for (const button of [...cameras, ...galleries]) {
        assert.equal(button.dataset.imgType, type);
        assert.equal(attribute(button.tag, 'type'), 'button', 'must not submit the edit form');
      }
    });
  }
}

for (const mode of [undefined, false, true]) {
  test(`native file input: useCamera=${mode}`, t => {
    const s = sandbox(t);
    const picked = [];
    if (mode === undefined) s.c.pickImageFile(uri => picked.push(uri));
    else s.c.pickImageFile(uri => picked.push(uri), mode);
    assert.equal(s.inputs.length, 1);
    const input = s.inputs[0];
    assert.equal(input.type, 'file');
    assert.equal(input.accept, 'image/*');
    assert.equal(input.hasAttribute('capture'), mode === true);
    assert.equal(input.getAttribute('capture'), mode === true ? 'environment' : null);
    assert.equal(input.clicks, 1);
    assert.ok(s.attached.has(input));
    assert.equal(typeof input.oncancel, 'function');
    assert.equal(typeof input.onchange, 'function');
    input.oncancel();
    assert.equal(s.attached.size, 0);
    assert.equal(input.removals, 1);
    assert.deepEqual(picked, []);
    assert.deepEqual(s.compressionCalls, []);
  });
}

for (const type of ['photo', 'cmnd']) {
  for (const hasImage of [false, true]) {
    for (const act of ['capture', hasImage ? 'change' : 'upload']) {
      test(`${act} ${type}, ${hasImage ? 'existing' : 'empty'}: compress, shared setImg, render and OCR`, async t => {
        let resolveCompression;
        const pending = new Promise(resolve => { resolveCompression = resolve; });
        const s = sandbox(t, { hasImage, compression: () => pending });
        const before = s.snapshot();
        const input = await s.click(act, type);
        assert.equal(input.getAttribute('capture'), act === 'capture' ? 'environment' : null);
        assert.deepEqual(s.snapshot(), before, 'opening the picker does not mutate images');
        input.files = [FILE];
        const selecting = input.onchange({ target: input });
        assert.equal(s.attached.size, 0);
        assert.deepEqual(s.compressionCalls, [[FILE, 1280, 0.82]]);
        assert.deepEqual(s.snapshot(), before, 'wait for compression before saving');
        resolveCompression(CAPTURED);
        await selecting;
        assert.equal(input.removals, 1);
        assert.deepEqual(s.changes, [[ID, type, CAPTURED]], 'all actions use the same setImg entry point');
        assert.equal(s.c.IMG_OVR[`${type}:${ID}`], CAPTURED);
        const other = type === 'photo' ? 'cmnd' : 'photo';
        assert.equal(s.c.IMG_OVR[`${other}:${ID}`], hasImage ? OLD : undefined);
        assert.deepEqual(s.writes, [[`${type}:${ID}`, CAPTURED]]);
        assert.deepEqual(JSON.parse(s.storage.get('cn_pendimg_v1')), [`${type}:${ID}`]);
        assert.equal(s.snapshot().renderCount, before.renderCount + 1);
        assert.equal(s.snapshot().bindingCount, before.bindingCount + 1);
        assert.ok(s.container.innerHTML.includes(CAPTURED));
        assert.deepEqual(s.ocr, type === 'cmnd' ? [[ID, true]] : []);
        assert.equal(s.messages.length, 2, 'processing and success messages');
        assert.equal(s.listeners.length, 1, 're-wiring must not duplicate the document listener');
        const nextInput = await s.click('capture', type);
        assert.notEqual(nextInput, input, 'replacement buttons are wired after rendering');
        nextInput.oncancel();
      });
    }
  }
}

for (const type of ['photo', 'cmnd']) {
  for (const act of ['capture', 'change']) {
    for (const outcome of ['cancel', 'empty files', 'missing files']) {
      test(`${act} ${type}: ${outcome} cleans up without mutation`, async t => {
        const s = sandbox(t, { hasImage: true });
        const before = s.snapshot();
        const input = await s.click(act, type);
        if (outcome === 'cancel') input.oncancel();
        else {
          input.files = outcome === 'empty files' ? [] : undefined;
          await input.onchange({ target: input });
        }
        assert.equal(input.removals, 1);
        assert.equal(s.attached.size, 0);
        assert.deepEqual(s.snapshot(), before);
        assert.deepEqual(s.compressionCalls, []);
        assert.deepEqual(s.messages, []);
      });
    }
  }
}

const failures = [
  { file: FILE, message: /Không đọc được file ảnh/ },
  { file: { name: 'synthetic.jpg', type: 'image/heic' }, message: /Ảnh HEIC chưa đọc được/ },
  { file: { name: 'synthetic.HEIF', type: '' }, message: /Ảnh HEIC chưa đọc được/ }
];
for (const type of ['photo', 'cmnd']) {
  for (const { file, message } of failures) {
    test(`capture ${type}: compression failure for ${file.type || file.name} preserves image`, async t => {
      const s = sandbox(t, { hasImage: true, compression: async () => { throw new Error('synthetic decode failure'); } });
      const before = s.snapshot();
      const input = await s.click('capture', type);
      input.files = [file];
      await input.onchange({ target: input });
      assert.equal(input.removals, 1);
      assert.equal(s.attached.size, 0);
      assert.deepEqual(s.compressionCalls, [[file, 1280, 0.82]]);
      assert.deepEqual(s.snapshot(), before, 'failure must not save, queue, re-render or run OCR');
      assert.equal(s.messages.length, 2);
      assert.match(s.messages[1], message);
    });
  }
}

test('captured images persist and deduplicate the pending queue using memory-only storage', async t => {
  const s = sandbox(t);
  s.storage.set('cn_pendimg_v1', JSON.stringify(['photo:unrelated-test-record']));
  s.storage.set('unrelated-test-key', 'untouched');
  for (const type of ['photo', 'cmnd', 'photo']) {
    const input = await s.click('capture', type);
    input.files = [FILE];
    await input.onchange({ target: input });
  }
  assert.deepEqual(JSON.parse(s.storage.get('cn_pendimg_v1')), [
    'photo:unrelated-test-record', `photo:${ID}`, `cmnd:${ID}`
  ]);
  assert.equal(s.storage.get('unrelated-test-key'), 'untouched');
  assert.deepEqual([...s.idb], [[`photo:${ID}`, CAPTURED], [`cmnd:${ID}`, CAPTURED]]);
  assert.deepEqual(s.writes, [
    [`photo:${ID}`, CAPTURED], [`cmnd:${ID}`, CAPTURED], [`photo:${ID}`, CAPTURED]
  ]);
  assert.equal(s.changes.length, 3);
  assert.equal(s.attached.size, 0);
});
