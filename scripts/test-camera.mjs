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

function constantSource(name) {
  const match = new RegExp(`^const ${name} = `, 'm').exec(source);
  assert.ok(match, `Missing constant ${name}`);
  const end = source.indexOf(';\n', match.index);
  assert.ok(end > match.index, `Missing end of constant ${name}`);
  return source.slice(match.index, end + 1);
}

const LOCAL_OCR_SOURCE = [
  constantSource('KHMER_DICT'), constantSource('KHMER_TEST_RE'),
  ...['cleanOcrName', 'parseMRZ', 'parseCardAddresses', 'translateKhmerOffline',
    'translateAddress', 'ocrCMND'].map(functionSource)
].join('\n');
const FULL_CARD = 'data:image/jpeg;base64,c3ludGhldGljLWZ1bGwtY2FyZA==';
const CROPPED_CARD = 'data:image/jpeg;base64,c3ludGhldGljLWNyb3A=';
const COMPLETE_MRZ = MRZ_HEADER + '\nSOK<<CHANNA<<<<';
const RAW_BIRTH = 'ឃុំកំពង់ចិនជើង ស្រុកស្ទោង ខេត្តកំពង់ធំ';
const RAW_ADDRESS = 'ភូមិចក ' + RAW_BIRTH;
const VI_BIRTH = 'Xã Kampong Chen Cheung Huyện Stoung Tỉnh Kampong Thom';
const VI_ADDRESS = 'Thôn Chork ' + VI_BIRTH;
const KHMER_CARD = `ទីកន្លែងកំណើត៖ ${RAW_BIRTH}\nអាសយដ្ឋាន៖ ភូមិចក\n${RAW_BIRTH}\nសុពលភាព៖ 01/01/2030`;
const AI_IDENTITY = Object.freeze({
  ten_that: 'AI Worker', cmnd: '111222333', ngay_sinh: '02/03/1988', tuoi: '38', gioi_tinh: 'M'
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Bound hung-worker regressions without waiting for the real 90-second deadline.
async function settles(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('OCR did not settle after worker failure/deadline')), 1000);
    })]);
  } finally {
    clearTimeout(timer);
  }
}
const flushOcr = () => new Promise(resolve => setImmediate(resolve));

function localOcrSandbox(t, options = {}) {
  const calls = [], networkCalls = [], timers = [], progress = [];
  let workerOptions, workersCreated = 0, terminations = 0;
  const worker = {
    recognize: async image => {
      calls.push(['recognize', image]);
      if (options.recognize) return options.recognize(image);
      return { data: { text: image === CROPPED_CARD ?
        (options.cropText ?? COMPLETE_MRZ) : (options.fullText ?? KHMER_CARD) } };
    },
    reinitialize: async (...args) => {
      calls.push(['reinitialize', ...args]);
      if (options.reinitialize) return options.reinitialize(workerOptions);
    },
    terminate: async () => { calls.push(['terminate']); terminations++; }
  };
  const c = vm.createContext({
    API_OK: options.apiOK ?? false,
    setTimeout: (callback, delay) => {
      const timer = { callback, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout: timer => {
      assert.ok(timers.includes(timer), 'clear the actual deadline handle');
      assert.equal(timer.cleared, false, 'clear the deadline once');
      timer.cleared = true;
    },
    loadTesseract: async () => {
      calls.push(['load']);
      if (options.load) return options.load();
    },
    cropBottom: async uri => { calls.push(['crop', uri]); return CROPPED_CARD; },
    fetch: async (...args) => {
      networkCalls.push(args);
      assert.equal(options.apiOK, true, 'Static OCR must not send images or addresses');
      assert.equal(args[0], '/api/ocr-cmnd', 'Only the mocked AI endpoint is allowed');
      if (options.aiFetch) return options.aiFetch(...args);
      return { json: async () => ({ ok: true, data: options.aiData }) };
    },
    window: { Tesseract: { createWorker: async (language, mode, config) => {
      calls.push(['createWorker', language, mode]);
      workerOptions = config;
      assert.equal(typeof config.logger, 'function');
      assert.equal(typeof config.errorHandler, 'function');
      config.logger({ progress: 0.5 });
      if (options.createWorker) await options.createWorker(config);
      workersCreated++;
      return worker;
    } } }
  });
  vm.runInContext(LOCAL_OCR_SOURCE, c);
  t.after(() => {
    assert.equal(terminations, workersCreated, 'every created worker is terminated exactly once');
    for (const timer of timers) {
      assert.equal(timer.delay, 90000, 'local deadline is 90 seconds');
      assert.equal(timer.cleared, true, 'deadline is cleared on every exit');
    }
    if (options.apiOK !== true) assert.deepEqual(networkCalls, [], 'no external sends on static Pages');
    else {
      assert.equal(networkCalls.length, 1, 'AI is attempted once; translation stays local');
      const [url, init] = networkCalls[0];
      assert.equal(url, '/api/ocr-cmnd');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(init.body), { image: FULL_CARD });
    }
  });
  return {
    c, calls, networkCalls, timers, progress,
    get workerOptions() { return workerOptions; },
    run: () => c.ocrCMND(FULL_CARD, message => progress.push(message)),
    expire: () => {
      assert.equal(timers.length, 1, 'one deadline per local scan');
      assert.equal(timers[0].cleared, false);
      timers[0].callback();
    }
  };
}

function assertMrzIdentity(parsed) {
  assert.equal(parsed.ten_that, 'SOK CHANNA');
  assert.equal(parsed.cmnd, '990123456');
  assert.equal(parsed.ngay_sinh, '01/01/1990');
  assert.equal(parsed.gioi_tinh, 'F');
}
function assertIdentity(parsed, expected) {
  for (const [key, value] of Object.entries(expected)) assert.equal(parsed[key], value, key);
}
function assertAddressWarning(result) {
  assert.match(result.warning || '', /Chưa đọc được nơi sinh\/địa chỉ/);
}

const addressCases = [
  ['Khmer multiline and expiry boundary', KHMER_CARD, { noi_sinh: RAW_BIRTH, dia_chi: RAW_ADDRESS }],
  ['label-only lines followed by values', `ទីកន្លែងកំណើត៖\n${RAW_BIRTH}\nអាសយដ្ឋាន៖\n${RAW_ADDRESS}`, { noi_sinh: RAW_BIRTH, dia_chi: RAW_ADDRESS }],
  ['zero-width Khmer headers', `ទី\u200Bកន្លែង\u200Cកំណើត៖ ${RAW_BIRTH}\nអាសយ\u200Dដ្ឋាន\uFEFF៖ ${RAW_ADDRESS}`, { noi_sinh: RAW_BIRTH, dia_chi: RAW_ADDRESS }],
  ['spaced Khmer headers', `${[...'ទីកន្លែងកំណើត'].join(' ')}៖ ${RAW_BIRTH}\n${[...'អាសយដ្ឋាន'].join('\t')}៖ ${RAW_ADDRESS}`, { noi_sinh: RAW_BIRTH, dia_chi: RAW_ADDRESS }],
  ['numbered shorter Khmer birth header', `៣. កន្លែងកំណើត៖ ${RAW_BIRTH}\n4) អាសយដ្ឋាន៖ ${RAW_ADDRESS}`, { noi_sinh: RAW_BIRTH, dia_chi: RAW_ADDRESS }],
  ['bilingual Khmer/English', `ទីកន្លែងកំណើត / Place of birth: ${RAW_BIRTH}\nអាសយដ្ឋាន - Address: ${RAW_ADDRESS}`, { noi_sinh: RAW_BIRTH, dia_chi: RAW_ADDRESS }],
  ['bilingual English/Khmer', `Place of birth / ទីកន្លែងកំណើត: ${RAW_BIRTH}\nAddress / អាសយដ្ឋាន: ${RAW_ADDRESS}`, { noi_sinh: RAW_BIRTH, dia_chi: RAW_ADDRESS }],
  ['Vietnamese labelled continuations', 'Nơi sinh: Xã A\r\nHuyện B\r\nĐịa chỉ thường trú: Thôn C\r\nTỉnh D\r\nNgày sinh: 01/01/1990', { noi_sinh: 'Xã A Huyện B', dia_chi: 'Thôn C Tỉnh D' }],
  ['Vietnamese residence label', 'NƠI THƯỜNG TRÚ: Hà Nội\nQuốc tịch: Việt Nam', { dia_chi: 'Hà Nội' }],
  ['English case-insensitive labels', 'PLACE OF BIRTH: Kampong Thom\nPermanent Address: Village A\nDistrict B\nNationality: Khmer', { noi_sinh: 'Kampong Thom', dia_chi: 'Village A District B' }],
  ['English residence', 'Place of permanent residence: Phnom Penh', { dia_chi: 'Phnom Penh' }],
  ['unknown labelled location stays raw', 'Place of birth: សាកល្បង\nAddress: Unknown Village', { noi_sinh: 'សាកល្បង', dia_chi: 'Unknown Village' }],
  ['unlabelled known places are not guessed', `${RAW_BIRTH}\n${RAW_ADDRESS}\nKampong Thom\nPhnom Penh`, {}],
  ['unknown field cannot introduce an address', `Office: ${RAW_BIRTH}\n${RAW_ADDRESS}`, {}],
  ['blank OCR lines within labelled continuation', 'Address: Village A\n\nDistrict B\nExpiry: 01/01/2030', { dia_chi: 'Village A District B' }],
  ['empty labels and numeric-only values', 'Place of birth:\n12345\nAddress:\n67890', {}],
  ['empty input', '', {}],
  ['null input', null, {}]
];
for (const [label, text, expected] of addressCases) {
  test(`address parser: ${label}`, () => {
    const c = vm.createContext({});
    vm.runInContext(functionSource('parseCardAddresses'), c);
    assert.deepEqual({ ...c.parseCardAddresses(text) }, expected);
  });
}

for (const boundary of [
  'Họ và tên: Other Person', 'Full name Other Person', 'Ngày sinh: 01/01/1990',
  'Date of birth 01/01/1990', 'Giới tính: Nữ', 'Gender F', 'Nationality Khmer',
  'Số CCCD: 123456789', 'ID number 123456789', 'Có giá trị đến 01/01/2030',
  'Date of issue 01/01/2020', 'Date of expiry 01/01/2030', 'Expiry 01/01/2030',
  'Valid until 01/01/2030', 'Signature Other Person', 'ឈ្មោះ៖ Other Person',
  'ថ្ងៃ ខែ ឆ្នាំ កំណើត៖ 01/01/1990', 'ភេទ៖ ស្រី', 'សញ្ជាតិ៖ ខ្មែរ',
  'សុពលភាព៖ 01/01/2030', 'ថ្ងៃផុតកំណត់៖ 01/01/2030', 'ហត្ថលេខា៖ Other Person',
  'Unknown field: Other Value', 'IDKHM9901234561<<<<<<<<<<<<<<<',
  '9001011F3001011KHM', 'SOK<<CHANNA<<<<', 'SOK««CHANNA‹‹‹‹'
]) {
  test(`address parser stops at ${boundary}`, () => {
    const c = vm.createContext({});
    vm.runInContext(functionSource('parseCardAddresses'), c);
    for (const [label, key] of [['Place of birth', 'noi_sinh'], ['Address', 'dia_chi']]) {
      assert.deepEqual({ ...c.parseCardAddresses(`${label}: Village A\nDistrict B\n${boundary}\nUnrelated Location`) },
        { [key]: 'Village A District B' });
    }
    assert.deepEqual({ ...c.parseCardAddresses(`Place of birth: Village A\n${boundary}\nAddress: Village B`) },
      { noi_sinh: 'Village A', dia_chi: 'Village B' }, 'a later explicit label resumes parsing');
  });
}

const TWO_PASS_CALLS = [
  ['load'], ['createWorker', 'eng', 1], ['crop', FULL_CARD], ['recognize', CROPPED_CARD],
  ['reinitialize', 'khm+eng+vie', 1], ['recognize', FULL_CARD], ['terminate']
];

test('offline OCR reads Khmer addresses even when MRZ identity is complete', async t => {
  const s = localOcrSandbox(t);
  const result = await settles(s.run());
  assert.equal(result.ok, true);
  assert.equal(result.source, 'offline');
  assertMrzIdentity(result.parsed);
  assert.equal(result.parsed.noi_sinh, VI_BIRTH);
  assert.equal(result.parsed.dia_chi, VI_ADDRESS);
  assert.equal(result.parsed.noi_sinh_goc, RAW_BIRTH);
  assert.equal(result.parsed.dia_chi_goc, RAW_ADDRESS);
  assert.equal(result.warning, '');
  assert.deepEqual(s.calls, TWO_PASS_CALLS);
  assert.ok(s.progress.some(message => message.includes('50%')), 'worker logger reports progress');
});

for (const [raw, expected] of [
  [RAW_ADDRESS, VI_ADDRESS],
  ['ភូមិចកឃុំកំពង់ចិនជើងស្រុកស្ទោងខេត្តកំពង់ធំ', VI_ADDRESS],
  ['ឃុំកំពង់ចិនត្បូង ស្រុកបារាយណ៍ ខេត្តកំពង់ចាម', 'Xã Kampong Chen Tboung Huyện Baray Tỉnh Kampong Cham'],
  ['ភូមិសាកល្បង ខេត្តកំពង់ធំ', 'Thôn សាកល្បង Tỉnh Kampong Thom'],
  ['សាកល្បង', 'សាកល្បង'], ['Hà Nội', 'Hà Nội'], ['', ''], ['  ', '  ']
]) {
  test(`static translateAddress stays offline: ${raw || '(empty)'}`, async t => {
    const s = localOcrSandbox(t);
    assert.equal(await s.c.translateAddress(raw), expected);
    assert.deepEqual(s.calls, [], 'translation needs neither OCR nor an API');
  });
}

test('offline full-card identity cannot overwrite cropped MRZ identity', async t => {
  const s = localOcrSandbox(t, { fullText: 'Full name: Other Person\nNo: 123456789\nDate of birth: 02/02/1980\nGiới tính: Nam\n' + KHMER_CARD });
  const result = await settles(s.run());
  assertMrzIdentity(result.parsed);
  assert.equal(result.parsed.tuoi, String(new Date().getFullYear() - 1990));
  assert.equal(result.parsed.dia_chi, VI_ADDRESS);
  assert.deepEqual(s.calls, TWO_PASS_CALLS);
});

for (const [label, fullText, expected, warning] of [
  ['unknown Khmer is retained, not guessed', 'Place of birth: សាកល្បង\nAddress: ភូមិសាកល្បង', { noi_sinh: 'សាកល្បង', dia_chi: 'Thôn សាកល្បង' }, /Địa chỉ chưa dịch đầy đủ/],
  ['unlabelled known locations stay absent', RAW_BIRTH + '\n' + RAW_ADDRESS, {}, /Chưa đọc được nơi sinh\/địa chỉ/],
  ['identity-only card warns about missing addresses', COMPLETE_MRZ, {}, /Chưa đọc được nơi sinh\/địa chỉ/],
  ['Vietnamese addresses are not changed', 'Nơi sinh: Hà Nội\nĐịa chỉ: Đà Nẵng', { noi_sinh: 'Hà Nội', dia_chi: 'Đà Nẵng' }, /^$/],
  ['English addresses are not changed', 'Place of birth: Kampong Thom\nAddress: Phnom Penh', { noi_sinh: 'Kampong Thom', dia_chi: 'Phnom Penh' }, /^$/]
]) {
  test(`offline OCR ${label}`, async t => {
    const s = localOcrSandbox(t, { fullText });
    const result = await settles(s.run());
    assert.equal(result.ok, true);
    assertMrzIdentity(result.parsed);
    assert.equal(result.parsed.noi_sinh, expected.noi_sinh);
    assert.equal(result.parsed.dia_chi, expected.dia_chi);
    assert.match(result.warning || '', warning);
    assert.deepEqual(s.calls, TWO_PASS_CALLS);
  });
}

for (const supplied of [{}, { noi_sinh: 'AI birthplace' }, { dia_chi: 'AI residence' }]) {
  test(`partial AI supplements missing addresses: ${JSON.stringify(supplied)}`, async t => {
    const aiData = Object.freeze({ ...AI_IDENTITY, ...supplied });
    const s = localOcrSandbox(t, { apiOK: true, aiData, fullText: COMPLETE_MRZ + '\n' + KHMER_CARD });
    const result = await settles(s.run());
    assert.equal(result.ok, true);
    assert.equal(result.source, 'ai');
    assertIdentity(result.parsed, AI_IDENTITY);
    assert.equal(result.parsed.noi_sinh, supplied.noi_sinh || VI_BIRTH);
    assert.equal(result.parsed.dia_chi, supplied.dia_chi || VI_ADDRESS);
    assert.deepEqual(s.calls, TWO_PASS_CALLS.filter(([call]) => call !== 'crop').filter(call => call[1] !== CROPPED_CARD));
    assert.equal(result.warning, '');
  });
}

test('partial AI merges only nonempty known fields without replacing existing identity', async t => {
  const aiData = Object.freeze({ ten_that: '  AI Worker  ', cmnd: ' ', ngay_sinh: 123,
    tuoi: null, gioi_tinh: {}, noi_sinh: [], dia_chi: false, ignored: 'do not copy' });
  const s = localOcrSandbox(t, { apiOK: true, aiData });
  const result = await settles(s.run());
  assert.equal(result.ok, true);
  assert.equal(result.source, 'ai');
  assert.equal(result.parsed.ten_that, 'AI Worker');
  assert.equal(result.parsed.cmnd, '990123456');
  assert.equal(result.parsed.ngay_sinh, '01/01/1990');
  assert.equal(result.parsed.gioi_tinh, 'F');
  assert.equal(result.parsed.noi_sinh, VI_BIRTH);
  assert.equal(result.parsed.dia_chi, VI_ADDRESS);
  assert.equal(Object.hasOwn(result.parsed, 'ignored'), false);
  assert.deepEqual(s.calls, TWO_PASS_CALLS);
});

for (const [label, addresses, raw] of [
  ['translated', { noi_sinh: VI_BIRTH, dia_chi: VI_ADDRESS }, false],
  ['Khmer', { noi_sinh: RAW_BIRTH, dia_chi: RAW_ADDRESS }, true],
  ['raw *_goc only', { noi_sinh_goc: RAW_BIRTH, dia_chi_goc: RAW_ADDRESS }, true],
  ['translated plus raw *_goc', { noi_sinh: VI_BIRTH, dia_chi: VI_ADDRESS, noi_sinh_goc: RAW_BIRTH, dia_chi_goc: RAW_ADDRESS }, true]
]) {
  test(`complete AI ${label} addresses skip local OCR`, async t => {
    const aiData = Object.freeze({ ...AI_IDENTITY, ...addresses });
    const s = localOcrSandbox(t, { apiOK: true, aiData });
    const result = await settles(s.run());
    assert.equal(result.ok, true);
    assert.equal(result.source, 'ai');
    assertIdentity(result.parsed, AI_IDENTITY);
    assert.equal(result.parsed.noi_sinh, VI_BIRTH);
    assert.equal(result.parsed.dia_chi, VI_ADDRESS);
    if (raw) {
      assert.equal(result.parsed.noi_sinh_goc, RAW_BIRTH);
      assert.equal(result.parsed.dia_chi_goc, RAW_ADDRESS);
    }
    assert.deepEqual(s.calls, []);
    assert.deepEqual(s.timers, []);
  });
}

test('partial AI raw *_goc address is translated before local supplementation', async t => {
  const s = localOcrSandbox(t, { apiOK: true, aiData: { ten_that: 'AI Worker', noi_sinh_goc: RAW_BIRTH } });
  const result = await settles(s.run());
  assert.equal(result.ok, true);
  assert.equal(result.parsed.ten_that, 'AI Worker');
  assert.equal(result.parsed.noi_sinh, VI_BIRTH);
  assert.equal(result.parsed.noi_sinh_goc, RAW_BIRTH);
  assert.equal(result.parsed.dia_chi, VI_ADDRESS);
  assert.deepEqual(s.calls, TWO_PASS_CALLS);
});

for (const key of ['noi_sinh', 'dia_chi']) {
  test(`partial AI preserves original ${key}_goc through repeated local merges`, async t => {
    const raw = 'ភូមិសាកល្បង ខេត្តកំពង់ធំ';
    const s = localOcrSandbox(t, { apiOK: true, aiData: { ten_that: 'AI Worker', [key + '_goc']: raw } });
    const result = await settles(s.run());
    assert.equal(result.ok, true);
    assert.equal(result.parsed.ten_that, 'AI Worker');
    assert.equal(result.parsed[key], 'Thôn សាកល្បង Tỉnh Kampong Thom');
    assert.equal(result.parsed[key + '_goc'], raw, 'raw Khmer must not be replaced by a partially translated value');
    assert.match(result.warning || '', /Địa chỉ chưa dịch đầy đủ/);
    assert.deepEqual(s.calls, TWO_PASS_CALLS);
  });
}

test('complete AI with untranslated Khmer addresses still warns for review', async t => {
  const s = localOcrSandbox(t, { apiOK: true, aiData: { ...AI_IDENTITY, noi_sinh: 'សាកល្បង', dia_chi: 'សាកល្បង' } });
  const result = await settles(s.run());
  assert.equal(result.ok, true);
  assert.equal(result.parsed.noi_sinh, 'សាកល្បង');
  assert.match(result.warning || '', /Địa chỉ chưa dịch đầy đủ/);
});

for (const [label, aiFetch] of [
  ['network rejection', async () => { throw new Error('synthetic AI unavailable'); }],
  ['JSON rejection', async () => ({ json: async () => { throw new Error('synthetic bad JSON'); } })],
  ['unsuccessful response', async () => ({ json: async () => ({ ok: false }) })]
]) {
  test(`AI ${label} falls back to local identity and addresses`, async t => {
    const s = localOcrSandbox(t, { apiOK: true, aiFetch });
    const result = await settles(s.run());
    assert.equal(result.ok, true);
    assert.equal(result.source, 'offline');
    assertMrzIdentity(result.parsed);
    assert.equal(result.parsed.dia_chi, VI_ADDRESS);
    assert.deepEqual(s.calls, TWO_PASS_CALLS);
  });
}

for (const stage of ['load', 'createWorker', 'reinitialize', 'recognize']) {
  for (const ai of [false, true]) {
    test(`${stage} rejection retains ${ai ? 'AI' : 'available MRZ'} and cleans up`, async t => {
      const fail = async () => { throw new Error(`synthetic ${stage} failure`); };
      const options = { apiOK: ai, aiData: AI_IDENTITY };
      options[stage] = stage === 'recognize' ? async image => {
        if (image === FULL_CARD) return fail();
        return { data: { text: COMPLETE_MRZ } };
      } : fail;
      const s = localOcrSandbox(t, options);
      const result = await settles(s.run());
      const hasData = ai || ['reinitialize', 'recognize'].includes(stage);
      assert.equal(result.ok, hasData);
      if (hasData) {
        if (ai) assertIdentity(result.parsed, AI_IDENTITY);
        else assertMrzIdentity(result.parsed);
        assertAddressWarning(result);
      } else assert.match(result.err, new RegExp(`synthetic ${stage} failure`));
      assert.equal(s.calls.filter(([call]) => call === 'terminate').length, ['load', 'createWorker'].includes(stage) ? 0 : 1);
      if (stage === 'reinitialize') assert.equal(s.calls.some(call => call[0] === 'recognize' && call[1] === FULL_CARD), false);
    });
  }
}

test('cropped recognition rejection returns failure and terminates worker', async t => {
  const s = localOcrSandbox(t, { recognize: async () => { throw new Error('synthetic crop failure'); } });
  const result = await settles(s.run());
  assert.equal(result.ok, false);
  assert.match(result.err, /synthetic crop failure/);
  assert.deepEqual(s.calls, TWO_PASS_CALLS.slice(0, 4).concat([['terminate']]));
});

for (const ai of [false, true]) {
  test(`worker errorHandler interrupts never-resolving reinitialize and retains ${ai ? 'AI' : 'MRZ'}`, async t => {
    const s = localOcrSandbox(t, { apiOK: ai, aiData: AI_IDENTITY, reinitialize: () => new Promise(() => {}) });
    const pending = s.run();
    await flushOcr();
    assert.ok(s.calls.some(([call]) => call === 'reinitialize'));
    s.workerOptions.errorHandler(new Error('synthetic language download failure'));
    const result = await settles(pending);
    assert.equal(result.ok, true);
    if (ai) assertIdentity(result.parsed, AI_IDENTITY);
    else assertMrzIdentity(result.parsed);
    assertAddressWarning(result);
    assert.equal(s.calls.at(-1)[0], 'terminate');
    assert.equal(s.calls.some(call => call[0] === 'recognize' && call[1] === FULL_CARD), false);
    const before = [...s.progress];
    s.workerOptions.logger({ progress: 1 });
    assert.deepEqual(s.progress, before, 'late worker messages cannot update progress');
  });
}

for (const stage of ['reinitialize', 'recognize']) {
  for (const ai of [false, true]) {
    test(`deadline during ${stage} retains ${ai ? 'AI' : 'MRZ'} and ignores late results`, async t => {
      const late = deferred();
      const options = { apiOK: ai, aiData: AI_IDENTITY };
      options[stage] = stage === 'recognize' ? image => image === FULL_CARD ? late.promise :
        Promise.resolve({ data: { text: COMPLETE_MRZ } }) : () => late.promise;
      const s = localOcrSandbox(t, options);
      const pending = s.run();
      await flushOcr();
      assert.equal(s.calls.at(-1)[0], stage, 'deadline fires after identity was merged');
      s.expire();
      const result = await settles(pending);
      assert.equal(result.ok, true);
      if (ai) assertIdentity(result.parsed, AI_IDENTITY);
      else assertMrzIdentity(result.parsed);
      assertAddressWarning(result);
      const before = JSON.stringify({ result, calls: s.calls, progress: s.progress });
      late.resolve({ data: { text: KHMER_CARD } });
      s.workerOptions.logger({ progress: 1 });
      await flushOcr();
      assert.equal(JSON.stringify({ result, calls: s.calls, progress: s.progress }), before,
        'timed-out work must neither resume scanning nor mutate returned data');
    });
  }
}

for (const trigger of ['deadline', 'errorHandler']) {
  test(`initial worker resolving after ${trigger} is terminated without scanning`, async t => {
    const late = deferred();
    const s = localOcrSandbox(t, { createWorker: () => late.promise });
    const pending = s.run();
    await flushOcr();
    assert.equal(s.calls.at(-1)[0], 'createWorker');
    if (trigger === 'deadline') s.expire();
    else s.workerOptions.errorHandler('synthetic init worker error');
    const result = await settles(pending);
    assert.equal(result.ok, false);
    assert.match(result.err, trigger === 'deadline' ? /Quá thời gian đọc thẻ/ : /synthetic init worker error/);
    const before = [...s.progress];
    late.resolve();
    await flushOcr();
    s.workerOptions.logger({ progress: 1 });
    assert.deepEqual(s.calls, [['load'], ['createWorker', 'eng', 1], ['terminate']]);
    assert.deepEqual(s.progress, before);
  });
}

test('deadline before Tesseract loads does not create a late worker', async t => {
  const late = deferred();
  const s = localOcrSandbox(t, { load: () => late.promise });
  const pending = s.run();
  await flushOcr();
  s.expire();
  const result = await settles(pending);
  assert.equal(result.ok, false);
  assert.match(result.err, /Quá thời gian đọc thẻ/);
  late.resolve();
  await flushOcr();
  assert.deepEqual(s.calls, [['load']]);
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
  test(`offline OCR cleans cropped and full-card names, fallback=${secondPass}`, async t => {
    const s = localOcrSandbox(t, { recognize: async input => {
      const name = input === CROPPED_CARD && secondPass ? 'SOK<<CHANNAKKKKLLLLLLLL' : 'SOK<<CHANNA<KKKKLLLLLLLL';
      return { data: { text: MRZ_HEADER + '\n' + name } };
    } });
    const result = await settles(s.run());
    assert.equal(result.ok, true);
    assert.equal(result.source, 'offline');
    assert.equal(result.parsed.ten_that, 'SOK CHANNA');
    assert.deepEqual(s.calls, TWO_PASS_CALLS, 'both passes run even when cropped identity is complete');
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
