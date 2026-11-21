import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app_script.js', import.meta.url), 'utf8');
const start = source.indexOf('function loadImgForEdit(');
const end = source.indexOf('function rotateImage(');
assert.ok(start > 0 && end > start, 'loadImgForEdit is present');
const LOADER_SOURCE = source.slice(start, end);

const CORS_OK = 'https://cors.example/img.jpg';
const CORS_BLOCKED = 'https://blocked.example/img.jpg';
const BROKEN = 'https://broken.example/img.jpg';

class FakeImage {
  constructor() {
    this._crossOrigin = null;
    this.onload = null;
    this.onerror = null;
    this.width = 400;
    this.height = 250;
    this.naturalWidth = 400;
    this.naturalHeight = 250;
  }
  get crossOrigin() { return this._crossOrigin; }
  set crossOrigin(value) { this._crossOrigin = value; }
  removeAttribute(name) { if (name === 'crossorigin') this._crossOrigin = null; }
  get src() { return this._src; }
  set src(value) {
    this._src = value;
    queueMicrotask(() => {
      const ok = value === CORS_OK ||
        (value === CORS_BLOCKED && !this._crossOrigin);
      if (ok) this.onload && this.onload();
      else this.onerror && this.onerror();
    });
  }
}

function load(uri) {
  const context = vm.createContext({ Image: FakeImage });
  vm.runInContext(LOADER_SOURCE + '\nthis.loadImgForEdit = loadImgForEdit;', context);
  return context.loadImgForEdit(uri);
}

test('Drive-style image with CORS loads editable', async () => {
  const res = await load(CORS_OK);
  assert.ok(res, 'image loaded');
  assert.equal(res.editable, true);
  assert.equal(res.img.crossOrigin, 'anonymous');
});

test('source without CORS still loads for preview but is not editable', async () => {
  const res = await load(CORS_BLOCKED);
  assert.ok(res, 'fallback load succeeds');
  assert.equal(res.editable, false);
  assert.equal(res.img.crossOrigin, null, 'fallback drops crossOrigin');
});

test('unreachable image resolves null', async () => {
  assert.equal(await load(BROKEN), null);
});
