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
    window: {}, API_OK: false, IMG_OVR: {}, IMG_OP_TOKENS: {}, TEMP_NEW_IMGS: {},
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

const MRZ_HEADER = 'IDKHM9901234561<<<<<<<<<<<<<<<\n9001011F3001011KHM<<<<<<<<<<<';

for (const [line, expected] of [
  ['SOK<<CHANNA<KKKKKLKKLLLLLLLLL', 'SOK CHANNA'],
  ['SOK<<CHANNA KKKKKLKKLLLLLLLLL', 'SOK CHANNA'],
  ['SOK<<CHANNA<<K<K<L<K<L<L<L', 'SOK CHANNA'],
  ['SOK<<CHANNA<<<<<<<<<<<<<<', 'SOK CHANNA'],
  ['SOK<<CHANNA<LEAKHENA<<<<<<', 'SOK CHANNA LEAKHENA'],
  ['LY<<KIM<LY<<<<<<', 'LY KIM LY'],
  ['KOK<<KOL<<<<<<', 'KOK KOL'],
  ['ERIKSSON<<ANNA<MARIA<<<<<<', 'ERIKSSON ANNA MARIA'],
  ['SOK<<CHANNAKKKKKLLLLLL', undefined],
  ['<<<<KKKKLLLLLLLL<<<<', undefined]
]) {
  test(`MRZ name cleanup: ${line}`, () => {
    const c = vm.createContext({});
    vm.runInContext(['cleanOcrName', 'parseMRZ'].map(functionSource).join('\n'), c);
    const result = c.parseMRZ(MRZ_HEADER + '\n' + line);
    assert.equal(result.ten_that, expected);
    assert.equal(result.cmnd, '990123456');
    assert.equal(result.ngay_sinh, '01/01/1990');
    assert.equal(result.gioi_tinh, 'F');
  });
}

test('MRZ parsing does not lose accented names from the printed label', () => {
  const c = vm.createContext({});
  vm.runInContext(['cleanOcrName', 'parseMRZ'].map(functionSource).join('\n'), c);
  const result = c.parseMRZ('Họ và tên: NGUYỄN THỊ KIM LY\nSố: 990123456\nNgày sinh: 01/01/1990');
  assert.equal(result.ten_that, 'NGUYỄN THỊ KIM LY');
});

const OCR_FIELDS = {
  ten_that: 'Synthetic Worker', cmnd: '123456789', ngay_sinh: '01/01/1990',
  tuoi: '36', gioi_tinh: 'F', noi_sinh: 'Synthetic birthplace', dia_chi: 'Synthetic address'
};
const OCR_OK = { ok: true, parsed: OCR_FIELDS };
const OCR_OUTCOMES = [
  { label: 'success', result: OCR_OK },
  { label: 'empty result', result: { ok: true, parsed: {} } },
  { label: 'manual failure', result: { ok: false, err: 'synthetic failure' } },
  { label: 'automatic failure', result: { ok: false, err: 'synthetic failure' }, auto: true }
];

function ocrSandbox(t, id = ID) {
  const requests = [];
  const messages = [];
  const timers = [];
  const images = new Map();
  const forms = [];
  const networkCalls = [];
  const completionCalls = [];
  const classList = () => {
    const values = new Set();
    return {
      add: value => values.add(value), remove: value => values.delete(value),
      contains: value => values.has(value), snapshot: () => [...values]
    };
  };
  const overlay = { classList: classList() };
  let current;
  const sheet = {
    querySelector(selector) {
      if (selector === '#ocrStatusBox') return current?.status ?? null;
      if (selector === '#ocrProgText') return current?.status.progress ?? null;
      const key = /^\[data-k="([^"]+)"\]$/.exec(selector)?.[1];
      assert.ok(key, `Unexpected selector ${selector}`);
      return current?.inputs[key] ?? null;
    }
  };
  const c = vm.createContext({
    editingId: null,
    getImg: (recordId, type) => {
      assert.equal(type, 'cmnd');
      return images.get(recordId) ?? null;
    },
    toast: message => messages.push(message),
    updateEditCompletion: (_sheet, reveal) => { completionCalls.push({ form: forms.length - 1, reveal }); return []; },
    esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); },
    ocrCMND: (uri, progress) => new Promise(resolve => requests.push({ uri, progress, resolve })),
    fetch: (...args) => {
      networkCalls.push(args);
      throw new Error('Network is forbidden in OCR tests');
    },
    document: {
      getElementById: key => {
        if (key === 'sheet') return sheet;
        if (key === 'overlay') return overlay;
        if (key === 'ocrProgText') return current?.status.progress ?? null;
        return null;
      }
    }
  });
  vm.runInContext(['cleanOcrName', 'formatDOB', 'ageFromDOB', 'doOcrCMND'].map(functionSource).join('\n'), c);
  const open = recordId => {
    const status = {
      html: '', style: { display: 'none' }, progress: null,
      get innerHTML() { return this.html; },
      set innerHTML(value) {
        this.html = value;
        const text = /<span id="ocrProgText">([^<]*)<\/span>/.exec(value)?.[1];
        this.progress = text === undefined ? null : { textContent: text };
      },
      querySelector(selector) {
        assert.equal(selector, '#ocrProgText');
        return this.progress;
      }
    };
    const inputs = Object.fromEntries([...Object.keys(OCR_FIELDS), 'ten_ho_so'].map(key => [key, {
      value: `initial ${key}`, classList: classList(), offsetWidth: 100
    }]));
    current = { inputs, status };
    forms.push(current);
    images.set(recordId, OLD);
    c.editingId = recordId;
    overlay.classList.add('show');
    return current;
  };
  const close = () => {
    overlay.classList.remove('show');
    c.editingId = null;
  };
  const snapshot = () => ({
    forms: forms.map(form => ({
      fields: Object.fromEntries(Object.entries(form.inputs).map(([key, input]) => [key, {
        value: input.value, classes: input.classList.snapshot()
      }])),
      html: form.status.innerHTML, display: form.status.style.display,
      progress: form.status.progress?.textContent
    })),
    messages: [...messages], timers: timers.length, completionCalls: [...completionCalls]
  });
  const original = open(id);
  t.after(() => assert.deepEqual(networkCalls, [], 'no attempted network calls'));
  return { c, requests, messages, timers, images, original, open, close, snapshot,
    get current() { return current; } };
}

for (const [input, expected] of [
  ['SOK CHANNA KKKKKLKKLLLLLLLLL', 'SOK CHANNA'],
  ['SOK CHANNA K K L K L L L', 'SOK CHANNA'],
  ['SOK<<CHANNA<<<<<<', 'SOK CHANNA'],
  ['SOK««CHANNA‹KKKKLLLL', 'SOK CHANNA'],
  ['  NGUYỄN THỊ KIM LY  ', 'NGUYỄN THỊ KIM LY'],
  ['SOK KOL', 'SOK KOL'],
  ["ANNE-MARIE O'NEILL", "ANNE-MARIE O'NEILL"],
  ['SOK CHANNA LEAKHENA', 'SOK CHANNA LEAKHENA'],
  ['ANNA K', 'ANNA K'],
  ['MY CHANTHOL', 'MY CHANTHOL']
]) {
  test(`OCR cleans name before form and banner: ${input}`, async t => {
    const s = ocrSandbox(t);
    const pending = s.c.doOcrCMND(ID);
    const parsed = { ...OCR_FIELDS, ten_that: input };
    s.requests[0].resolve({ ok: true, source: 'ai', parsed });
    await pending;
    assert.equal(s.current.inputs.ten_that.value, expected);
    assert.ok(s.current.status.innerHTML.includes(expected));
    assert.doesNotMatch(s.current.status.innerHTML, /KKKK|LLLL|&lt;/);
    assert.equal(parsed.ten_that, input, 'do not mutate provider output');
    assert.equal(s.current.inputs.cmnd.value, OCR_FIELDS.cmnd);
  });
}

for (const [input, expected] of [
  ['1993-06-04T17:00:00.000Z', '05/06/1993'],
  ['1993-06-05', '05/06/1993'],
  ['5/6/1993', '05/06/1993'],
  ['5.6.1993', '05/06/1993'],
  ['05/06/1993', '05/06/1993']
]) {
  test(`OCR formats birth date before form and banner: ${input}`, async t => {
    const s = ocrSandbox(t);
    const pending = s.c.doOcrCMND(ID);
    const parsed = { ...OCR_FIELDS, ngay_sinh: input };
    s.requests[0].resolve({ ok: true, source: 'ai', parsed });
    await pending;
    assert.equal(s.current.inputs.ngay_sinh.value, expected);
    assert.ok(s.current.status.innerHTML.includes(expected));
    assert.doesNotMatch(s.current.status.innerHTML, /T17:00:00/);
    assert.equal(parsed.ngay_sinh, input, 'do not mutate provider output');
  });
}

for (const input of ['SOK CHANNAKKKKKLLLLLL', 'KKKKLLLLLLLL', null, { name: 'malformed' }]) {
  test(`OCR uncertain name preserves existing input: ${JSON.stringify(input)}`, async t => {
    const s = ocrSandbox(t);
    const pending = s.c.doOcrCMND(ID);
    s.requests[0].resolve({ ok: true, parsed: { ...OCR_FIELDS, ten_that: input } });
    await pending;
    assert.equal(s.current.inputs.ten_that.value, 'initial ten_that');
    assert.equal(s.current.inputs.cmnd.value, OCR_FIELDS.cmnd);
    assert.match(s.current.status.innerHTML, /Chưa đọc chắc chắn họ tên/);
    assert.match(s.current.status.innerHTML, /Đã đọc một phần thông tin CMND/);
    assert.doesNotMatch(s.current.status.innerHTML, /KKKK|LLLL|thành công/);
  });
}

test('OCR untranslated address asks for review instead of claiming translation success', async t => {
  const s = ocrSandbox(t);
  const pending = s.c.doOcrCMND(ID);
  s.requests[0].resolve({ ok: true, parsed: { ...OCR_FIELDS, noi_sinh: 'សាកល្បង', dia_chi: '' } });
  await pending;
  assert.equal(s.current.inputs.noi_sinh.value, 'សាកល្បង');
  assert.match(s.current.status.innerHTML, /bổ sung các ô còn thiếu/);
  assert.doesNotMatch(s.current.status.innerHTML, /chuyển đổi địa chỉ|thành công/);
  assert.deepEqual(s.snapshot().completionCalls, [{ form: 0, reveal: true }]);
});

test('OCR filler-only response is not presented as a recognized name', async t => {
  const s = ocrSandbox(t);
  const pending = s.c.doOcrCMND(ID);
  s.requests[0].resolve({ ok: true, parsed: { ten_that: 'KKKKLLLLLLLL' } });
  await pending;
  assert.equal(s.current.inputs.ten_that.value, 'initial ten_that');
  assert.match(s.current.status.innerHTML, /Không nhận diện được/);
  assert.doesNotMatch(s.current.status.innerHTML, /KKKK|LLLL/);
});

for (const secondPass of [false, true]) {
  test(`offline OCR cleans cropped and full-card names, fallback=${secondPass}`, async () => {
    const inputs = [];
    const c = vm.createContext({
      API_OK: false, setTimeout: () => {}, loadTesseract: async () => {},
      cropBottom: async () => 'cropped',
      fetch: () => assert.fail('No external OCR calls in test'),
      window: { Tesseract: { recognize: async input => {
        inputs.push(input);
        const name = input === 'cropped' && secondPass ? 'SOK<<CHANNAKKKKLLLLLLLL' : 'SOK<<CHANNA<KKKKLLLLLLLL';
        return { data: { text: MRZ_HEADER + '\n' + name } };
      } } }
    });
    vm.runInContext(['cleanOcrName', 'parseMRZ', 'ocrCMND'].map(functionSource).join('\n'), c);
    const result = await c.ocrCMND('full-card');
    assert.equal(result.ok, true);
    assert.equal(result.source, 'offline');
    assert.equal(result.parsed.ten_that, 'SOK CHANNA');
    assert.deepEqual(inputs, secondPass ? ['cropped', 'full-card'] : ['cropped']);
  });
}

for (const outcome of OCR_OUTCOMES) {
  test(`OCR ${outcome.label} prompts to complete missing profile information`, async t => {
    const s = ocrSandbox(t);
    const pending = s.c.doOcrCMND(ID, { auto: outcome.auto });
    s.requests[0].resolve(outcome.result);
    await pending;
    assert.deepEqual(s.snapshot().completionCalls, [{ form: 0, reveal: true }]);
  });
}

const OCR_TRANSITIONS = [
  { label: 'switch records', change: s => s.open('other-camera-test-record') },
  { label: 'close form', change: s => s.close() },
  { label: 'close and reopen same record', change: s => { s.close(); s.open(ID); } },
  { label: 'close and reopen new form', id: '__new__', change: s => { s.close(); s.open('__new__'); } },
  { label: 'replace record image', change: s => s.images.set(ID, CAPTURED) },
  { label: 'replace new form image', id: '__new__', change: s => s.images.set('__new__', CAPTURED) }
];

for (const transition of OCR_TRANSITIONS) {
  for (const outcome of OCR_OUTCOMES) {
    test(`OCR ${transition.label}: discard stale progress and ${outcome.label}`, async t => {
      const id = transition.id || ID;
      const s = ocrSandbox(t, id);
      const pending = s.c.doOcrCMND(id, { auto: outcome.auto });
      assert.equal(s.requests.length, 1);
      assert.equal(s.requests[0].uri, OLD, 'capture the original image before awaiting');
      s.requests[0].progress('current progress');
      assert.equal(s.original.status.progress.textContent, 'current progress');
      transition.change(s);
      const replacement = s.current !== s.original ? s.c.doOcrCMND(s.c.editingId) : null;
      const before = s.snapshot();
      s.requests[0].progress('stale progress');
      assert.deepEqual(s.snapshot(), before, 'stale progress cannot touch either form');
      s.requests[0].resolve(outcome.result);
      await pending;
      assert.deepEqual(s.snapshot(), before, 'stale results cannot fill, show banners, toast or schedule pulses');
      if (replacement) {
        s.requests[1].resolve(OCR_OK);
        await replacement;
        assert.equal(s.messages.length, 1, 'replacement form still accepts its own result');
        assert.equal(s.current.inputs.ten_that.value, OCR_FIELDS.ten_that);
      }
    });
  }
}

for (const id of [ID, '__new__']) {
  for (const auto of [false, true]) {
    test(`OCR current ${id} form, auto=${auto}: fills all fields`, async t => {
      const s = ocrSandbox(t, id);
      const pending = s.c.doOcrCMND(id, { auto });
      assert.equal(s.original.status.style.display, 'block');
      assert.match(s.original.status.innerHTML, /ocr-status-running/);
      s.requests[0].progress('reading synthetic image');
      assert.equal(s.original.status.progress.textContent, 'reading synthetic image');
      s.requests[0].resolve(OCR_OK);
      await pending;
      for (const [key, value] of Object.entries(OCR_FIELDS)) {
        assert.equal(s.original.inputs[key].value, value);
        assert.ok(s.original.inputs[key].classList.contains('field-pulse'));
      }
      assert.equal(s.original.inputs.ten_ho_so.value, 'initial ten_ho_so');
      assert.match(s.original.status.innerHTML, /ocr-status-ok/);
      assert.equal(s.messages.length, 1);
      assert.equal(s.timers.length, Object.keys(OCR_FIELDS).length);
      for (const timer of s.timers) {
        assert.equal(timer.delay, 2500);
        timer.callback();
      }
      for (const key of Object.keys(OCR_FIELDS)) {
        assert.equal(s.original.inputs[key].classList.contains('field-pulse'), false);
      }
    });
  }
}

for (const outcome of OCR_OUTCOMES) {
  for (const olderFirst of [true, false]) {
    test(`OCR concurrent ${outcome.label}, older finishes ${olderFirst ? 'first' : 'last'}: newest request wins`, async t => {
      const s = ocrSandbox(t);
      const older = s.c.doOcrCMND(ID, { auto: outcome.auto });
      const newer = s.c.doOcrCMND(ID);
      assert.equal(s.requests.length, 2);
      s.requests[1].progress('newest progress');
      const finishOlder = async () => {
        const before = s.snapshot();
        s.requests[0].progress('older progress');
        s.requests[0].resolve(outcome.result);
        await older;
        assert.deepEqual(s.snapshot(), before, 'superseded request cannot change the current output');
      };
      if (olderFirst) await finishOlder();
      s.requests[1].resolve({ ok: true, parsed: { ten_that: 'Newest Synthetic Worker' } });
      await newer;
      if (!olderFirst) await finishOlder();
      assert.equal(s.original.inputs.ten_that.value, 'Newest Synthetic Worker');
      assert.equal(s.messages.length, 1);
      assert.match(s.original.status.innerHTML, /Newest Synthetic Worker/);
    });
  }
}
