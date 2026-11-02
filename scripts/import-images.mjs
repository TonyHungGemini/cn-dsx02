#!/usr/bin/env node
/**
 * Gom ảnh từ máy quản trị vào thư mục images/ để GitHub Pages phục vụ trực tiếp
 * (không cần server /api).
 *
 * Cách dùng:
 *   node scripts/import-images.mjs DSX02_SaoLuu_20261102.json [file2.json ...]
 *
 * Nguồn ảnh:
 *   1. imagesOvr trong file sao lưu JSON (ảnh đang nằm trong IndexedDB trình duyệt)
 *   2. data/img_cache/photo_<id>.jpg, cmnd_<id>.jpg (ảnh server.js đã lưu trên đĩa)
 *
 * Kết quả:
 *   images/<type>_<id>.<ext>
 *   images_index.js  (danh sách ảnh tĩnh cho app)
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const IMAGES_DIR = path.join(ROOT, "images");
const INDEX_FILE = path.join(ROOT, "images_index.js");
const recordsFile = path.join(ROOT, "data", "records.json");
const catalogFile = path.join(ROOT, "data", "images.json");

const args = process.argv.slice(2);
const overwrite = args.includes("--overwrite");
const backupFiles = args.filter(a => !a.startsWith("--"));

const MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif"
};

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function decodeDataUrl(value) {
  if (typeof value !== "string") return null;
  if (value === "__DEL__") return null;
  const m = value.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), buf: Buffer.from(m[2], "base64") };
}

function parseKey(key) {
  const m = String(key || "").match(/^(photo|cmnd)[:_](\d+)$/);
  return m ? { type: m[1], id: m[2] } : null;
}

function loadPreload() {
  const box = { window: {} };
  for (let i = 1; i <= 4; i++) {
    const file = path.join(ROOT, `images-${i}.js`);
    if (!fs.existsSync(file)) continue;
    try { new Function("window", fs.readFileSync(file, "utf8"))(box.window); } catch {}
  }
  return box.window.PRELOAD_IMG || {};
}

async function writeImage(type, id, ext, buf, source) {
  const file = `${type}_${id}${ext}`;
  const target = path.join(IMAGES_DIR, file);
  if (!overwrite && fs.existsSync(target)) return { file, skipped: true };
  await fsp.writeFile(target, buf);
  return { file, skipped: false, source };
}

async function main() {
  await fsp.mkdir(IMAGES_DIR, { recursive: true });

  const records = readJson(recordsFile, []);
  const catalog = readJson(catalogFile, {});
  const written = new Map();
  let decoded = 0;
  let skipped = 0;

  for (const backupPath of backupFiles) {
    const backup = readJson(backupPath, null);
    if (!backup) {
      console.warn(`⚠️  Bỏ qua file không đọc được: ${backupPath}`);
      continue;
    }
    const imagesOvr = backup.imagesOvr || backup.images || {};
    for (const [key, value] of Object.entries(imagesOvr)) {
      const parsed = parseKey(key);
      if (!parsed) continue;
      const data = decodeDataUrl(value);
      if (!data) continue;
      const ext = MIME_EXT[data.mime] || ".jpg";
      const result = await writeImage(parsed.type, parsed.id, ext, data.buf, backupPath);
      if (result.skipped) { skipped++; continue; }
      written.set(`${parsed.type}:${parsed.id}`, result.file);
      decoded++;
    }
  }

  // Ảnh server.js đã lưu trên đĩa: photo_<id>.jpg / cmnd_<id>.jpg
  const cacheDir = path.join(ROOT, "data", "img_cache");
  if (fs.existsSync(cacheDir)) {
    for (const name of await fsp.readdir(cacheDir)) {
      const m = name.match(/^(photo|cmnd)_(\d+)\.jpg$/i);
      if (!m) continue;
      const type = m[1].toLowerCase();
      const id = m[2];
      const ext = ".jpg";
      const target = path.join(IMAGES_DIR, `${type}_${id}${ext}`);
      if (!overwrite && fs.existsSync(target)) continue;
      await fsp.copyFile(path.join(cacheDir, name), target);
      written.set(`${type}:${id}`, `${type}_${id}${ext}`);
      decoded++;
    }
  }

  // Giữ các file đã có trong images/ (lần import trước) để không làm mất ảnh
  for (const name of await fsp.readdir(IMAGES_DIR)) {
    const m = name.match(/^(photo|cmnd)_(\d+)\.(jpg|jpeg|png|webp|gif|heic|heif)$/i);
    if (!m) continue;
    const type = m[1].toLowerCase();
    const id = m[2];
    const key = `${type}:${id}`;
    if (!written.has(key)) written.set(key, name);
  }

  const sorted = Object.fromEntries(
    [...written.entries()].sort((a, b) => {
      const [ta, ia] = a[0].split(":");
      const [tb, ib] = b[0].split(":");
      return ta === tb ? Number(ia) - Number(ib) : ta.localeCompare(tb);
    })
  );

  const js = "window.__IMG_STATIC = " + JSON.stringify(sorted, null, 2) + ";\n";
  await fsp.writeFile(INDEX_FILE, js, "utf8");

  // Báo cáo độ phủ sau khi gộp fid Drive + ảnh tĩnh + preload
  const preload = loadPreload();
  const ids = records.map(r => String(r.id));
  const hasFid = (id, t) => !!(catalog[id] && catalog[id][t]);
  const hasStatic = (id, t) => !!sorted[`${t}:${id}`];
  const hasPre = (id, t) => !!(preload[id] && preload[id][t]);
  const count = (t) => ids.filter(id => hasFid(id, t) || hasStatic(id, t) || hasPre(id, t)).length;
  const missingBoth = ids.filter(id =>
    !hasFid(id, "photo") && !hasStatic(id, "photo") && !hasPre(id, "photo") &&
    !hasFid(id, "cmnd") && !hasStatic(id, "cmnd") && !hasPre(id, "cmnd")
  );

  console.log(`\nĐã ghi ${decoded} ảnh vào images/ (bỏ qua ${skipped} ảnh đã có, dùng --overwrite để ghi đè).`);
  console.log(`images_index.js: ${Object.keys(sorted).length} ảnh tĩnh.`);
  console.log(`Tổng hồ sơ: ${ids.length}`);
  console.log(`Ảnh đại diện có nguồn: ${count("photo")}/${ids.length}`);
  console.log(`CMND có nguồn: ${count("cmnd")}/${ids.length}`);
  console.log(`Không có bất kỳ ảnh nào: ${missingBoth.length}`);
  if (missingBoth.length) {
    console.log(`ID còn thiếu (tối đa 30): ${missingBoth.slice(0, 30).join(", ")}`);
  }
  console.log("\nLưu ý: repo GitHub đang public — ảnh CMND trong images/ sẽ công khai với người có link.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
