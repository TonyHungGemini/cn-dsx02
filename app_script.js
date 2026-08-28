/* ===== Tra cứu Công nhân ĐSX02 - Phiên bản nâng cấp Thống kê & Quản lý Phòng ở, Số điện thoại ===== */
const LS_KEY = "csdl_cn_dsx02_v1";
const FIELDS = [
  ["cmnd","CMND / CCCD","input"],
  ["ten_that","Họ và tên (tên thật)","input"],
  ["ten_ho_so","Tên trong hồ sơ (tên mượn)","input"],
  ["ngay_sinh","Ngày sinh","input"],
  ["tuoi","Tuổi","input"],
  ["noi_sinh","Nơi sinh","input"],
  ["gioi_tinh","Giới tính","sel_gt"],
  ["loai","Loại","sel_loai"],
  ["to","Tổ","sel_to"],
  ["khu_vuc","Khu vực","input"],
  ["phan_cay","Phần cây hiện tại","input"],
  ["quan_he","Quan hệ","input"],
  ["phong_o","Phòng ở","input"],
  ["so_bao_hiem","Số bảo hiểm","input"],
  ["chi_tiet_noi_o","Chi tiết nơi ở","input"],
  ["dia_chi","Địa chỉ thường trú","input"],
  ["so_dt","Số điện thoại","input"],
  ["ghi_chu","Ghi chú","textarea"],
];

const TO_LIST = ["Tổ 1","Tổ 2","Tổ 3","Tổ 4","Tổ 5","Tổ 6","Tổ 7","Tổ 8"];

/* ===== Helper Functions ===== */
function clone(o){
  if(!o) return [];
  try{ return JSON.parse(JSON.stringify(o)); }catch(e){ return Array.isArray(o)?[...o]:Object.assign({},o); }
}

function cleanPhone(raw){
  if(!raw) return "";
  return String(raw).replace(/[^0-9+]/g, "").trim();
}

function getPhone(p){
  if(!p) return "";
  let s = String(p.so_dt || p.sdt || p["Số ĐT"] || p["SĐT"] || p["SDT"] || p["dien_thoai"] || p["phone"] || "").trim();
  if(!s && p.ghi_chu){
    const m = String(p.ghi_chu).match(/(?:\+855\s*\d[\d\s.-]{6,12}|0\d{8,10}|\+84\s*\d[\d\s.-]{8,11})/);
    if(m) s = m[0].trim();
  }
  return s;
}

function formatPhone(phone){
  if(!phone) return "";
  const cl = cleanPhone(phone);
  if(cl.startsWith("+855") && cl.length >= 11){
    return cl.slice(0, 4) + " " + cl.slice(4, 6) + " " + cl.slice(6, 9) + " " + cl.slice(9);
  }
  if(cl.startsWith("0") && cl.length === 10){
    return cl.slice(0, 4) + " " + cl.slice(4, 7) + " " + cl.slice(7);
  }
  if(cl.startsWith("0") && cl.length === 9){
    return cl.slice(0, 3) + " " + cl.slice(3, 6) + " " + cl.slice(6);
  }
  return phone;
}

function phonePillHtml(p, compact){
  const ph = getPhone(p);
  if(!ph) return "";
  const cl = cleanPhone(ph);
  const disp = formatPhone(ph);
  if(compact){
    return '<a href="tel:'+esc(cl)+'" class="pill phone-pill" onclick="event.stopPropagation()" title="Gọi '+esc(ph)+'">📞 '+esc(disp)+'</a>';
  }
  return '<a href="tel:'+esc(cl)+'" class="pill phone-pill" onclick="event.stopPropagation()" title="Bấm để gọi '+esc(ph)+'">📞 '+esc(disp)+'</a>';
}

function getBaseData(){
  if(typeof BASE_DATA!=="undefined" && Array.isArray(BASE_DATA) && BASE_DATA.length>0) return BASE_DATA;
  if(typeof window!=="undefined" && Array.isArray(window.BASE_DATA) && window.BASE_DATA.length>0) return window.BASE_DATA;
  return [];
}

function load(){
  try{
    const s = localStorage.getItem(LS_KEY);
    if(s && s!=="undefined" && s!=="null"){
      const parsed = JSON.parse(s);
      if(Array.isArray(parsed) && parsed.length>0){
        return parsed.map(p => {
          p.so_dt = getPhone(p);
          p.sdt = p.so_dt;
          return p;
        });
      }
    }
  }catch(e){
    console.warn("Lỗi đọc localStorage:", e);
  }
  const base = getBaseData();
  return clone(base).map(p => {
    p.so_dt = getPhone(p);
    p.sdt = p.so_dt;
    return p;
  });
}

function save(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(DATA));
  }catch(e){
    console.warn("Lỗi lưu localStorage:", e);
  }
}

var DATA = load();
if(!DATA || DATA.length === 0){
  DATA = clone(getBaseData()).map(p => {
    p.so_dt = getPhone(p);
    p.sdt = p.so_dt;
    return p;
  });
  save();
}
window.DATA = DATA;

let state = {
  q: "",
  to: "",
  loai: "",
  muon: false,
  hasPhone: false,
  view: "people", // "people" | "rooms"
  // Room specific filters
  roomBlock: "",
  roomCap: "",
  roomChu: "",
  roomType: ""
};

let currentRoom = null;
const NO_ROOM = "(chưa có phòng)";

function roomKey(p){
  return (p.phong_o||"").trim() || NO_ROOM;
}

function getRoomBlock(r){
  if(!r || r === NO_ROOM) return "Chưa có phòng";
  const trimR = r.trim();
  const m = trimR.match(/^([A-Za-z]+)/);
  if(m){
    const prefix = m[1].toUpperCase();
    if(prefix === "POPOK" || prefix === "POP") return "Dãy Popok";
    if(prefix === "NH" || prefix === "NHA") return "Dãy Nhà";
    if(prefix === "QU" || prefix === "QUAN") return "Dãy Quán";
    if(prefix.length === 1) return "Dãy " + prefix;
  }
  const low = noAccent(trimR);
  if(low.includes("quan")) return "Dãy Quán";
  if(low.includes("nha")) return "Dãy Nhà";
  return "Dãy Khác";
}

function allRooms(){
  const s = new Set();
  DATA.forEach(p => {
    const r = (p.phong_o||"").trim();
    if(r) s.add(r);
  });
  return Array.from(s).sort((a,b) => a.localeCompare(b, "vi",{numeric:true}));
}

function allRoomBlocks(){
  const blocks = new Set();
  DATA.forEach(p => {
    const r = roomKey(p);
    blocks.add(getRoomBlock(r));
  });
  return Array.from(blocks).sort((a, b) => {
    if(a === "Chưa có phòng") return 1;
    if(b === "Chưa có phòng") return -1;
    return a.localeCompare(b, "vi", {numeric:true});
  });
}

function noAccent(s){
  return (s||"").toString().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
}

function esc(s){
  return (s==null?"":""+s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}

/* ===== Ảnh: PRELOAD (nhúng sẵn) + IndexedDB (thay đổi/chụp mới) ===== */
const PRELOAD = (typeof PRELOAD_IMG!=="undefined") ? PRELOAD_IMG : {};
let IMG_OVR = {}; let _db = null; const DEL="__DEL__";

function idbOpen(){
  return new Promise(res => {
    try{
      const r = indexedDB.open("cn_imgs", 1);
      r.onupgradeneeded = e => e.target.result.createObjectStore("imgs");
      r.onsuccess = e => { _db=e.target.result; res(); };
      r.onerror = () => res();
    }catch(e){ res(); }
  });
}

function idbAll(){
  return new Promise(res => {
    if(!_db) return res();
    try{
      const st = _db.transaction("imgs","readonly").objectStore("imgs");
      const out = {};
      const c = st.openCursor();
      c.onsuccess = e => {
        const cur = e.target.result;
        if(cur){ out[cur.key]=cur.value; cur.continue(); }
        else { IMG_OVR=out; res(); }
      };
      c.onerror = () => res();
    }catch(e){ res(); }
  });
}

function idbPut(k,v){
  if(!_db) return;
  try{ _db.transaction("imgs","readwrite").objectStore("imgs").put(v,k); }catch(e){}
}

function imgFileId(id,t){
  try{
    const m = JSON.parse(localStorage.getItem("cn_imgfiles_v1")||"{}");
    return m[t+":"+id]||null;
  }catch(e){ return null; }
}

function driveImgUrl(fid){
  return fid ? "https://lh3.googleusercontent.com/d/" + fid : null;
}

let TEMP_NEW_IMGS = {};

function getImg(id, t) {
  if (id === "__new__") return TEMP_NEW_IMGS[t] || null;
  const k = t + ":" + id;
  if (k in IMG_OVR) return IMG_OVR[k] === DEL ? null : IMG_OVR[k];
  const fid = imgFileId(id, t);
  if (fid) return driveImgUrl(fid);
  const p = PRELOAD[id];
  return (p && p[t]) ? p[t] : null;
}

function setImg(id, t, uri) {
  if (id === "__new__") {
    TEMP_NEW_IMGS[t] = uri;
    return;
  }
  IMG_OVR[t + ":" + id] = uri;
  idbPut(t + ":" + id, uri);
  try { addPendImg(t + ":" + id); } catch(e) {}
}

function delImg(id, t) {
  if (id === "__new__") {
    delete TEMP_NEW_IMGS[t];
    return;
  }
  IMG_OVR[t + ":" + id] = DEL;
  idbPut(t + ":" + id, DEL);
  try { addPendDel(t + ":" + id); } catch(e) {}
}

function hasAnyImg(p){
  return !!(getImg(p.id,"photo")||getImg(p.id,"cmnd"));
}

function avatar(p){
  return getImg(p.id,"photo")||getImg(p.id,"cmnd");
}

function compress(file,max,q){
  return new Promise((res,rej)=>{
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        let w=im.width, h=im.height;
        const s = Math.min(1, max/Math.max(w,h));
        const c = document.createElement("canvas");
        c.width = Math.round(w*s);
        c.height = Math.round(h*s);
        c.getContext("2d").drawImage(im,0,0,c.width,c.height);
        res(c.toDataURL("image/jpeg",q));
      };
      im.onerror = rej;
      im.src = fr.result;
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

function ageFromDOB(ds){
  if(!ds) return "";
  const m = String(ds).match(/(19|20)\d{2}/);
  if(!m) return "";
  const y = +m[0];
  const a = (new Date().getFullYear())-y;
  return (a>=0&&a<120)?String(a):"";
}

function displayAge(p){
  const a = ageFromDOB(p.ngay_sinh);
  return a!==""?a:(p.tuoi||"");
}

function dobFromKHCode(code){
  code = String(code||"").replace(/\D/g,"");
  if(code.length<6) return "";
  const yy = +code.slice(0,2), mm = code.slice(2,4), dd = code.slice(4,6);
  const cy = new Date().getFullYear()%100;
  const year = (yy>cy)?1900+yy:2000+yy;
  if(+mm<1||+mm>12||+dd<1||+dd>31) return "";
  return dd+"/"+mm+"/"+year;
}

function getDriveFileUrl(id, t){
  const fid = imgFileId(id, t);
  if(fid) return "https://drive.google.com/file/d/" + fid + "/view";
  return null;
}

function openDriveFile(id, t){
  const driveUrl = getDriveFileUrl(id, t);
  if(driveUrl){
    window.open(driveUrl, "_blank", "noopener,noreferrer");
    toast("Đang mở file gốc trên Google Drive ☁️");
  } else {
    const uri = getImg(id, t);
    if(uri){
      const w = window.open("");
      if(w){
        w.document.write('<title>Ảnh gốc ' + (t === "photo" ? "Chân dung" : "CMND") + ' #' + id + '</title><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="' + uri + '" style="max-width:100%;max-height:100vh;object-fit:contain;"></body>');
      } else {
        toast("Vui lòng cho phép popup để xem ảnh");
      }
    } else {
      toast("Chưa có ảnh");
    }
  }
}

async function downloadImg(id, t, label){
  const uri = getImg(id, t);
  if(!uri){ toast("Chưa có ảnh để tải về"); return; }

  const p = (id !== "__new__") ? DATA.find(x => x.id === id) : null;
  const nameSlug = p && p.ten_that ? p.ten_that.replace(/[\s/\\?%*:|"<>]+/g, "_") : "";
  const typeName = t === "photo" ? "ChanDung" : (t === "cmnd" ? "CMND" : (label || "Anh"));
  const filename = `${typeName}_${nameSlug ? nameSlug + "_" : ""}${id}.jpg`;

  try {
    toast(`Đang tải ${label || typeName} về máy…`);
    if (uri.startsWith("data:") || uri.startsWith("blob:")) {
      const a = document.createElement("a");
      a.href = uri;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 100);
      toast(`Đã tải xong ${label || typeName} ✓`);
      return;
    }

    const res = await fetch(uri);
    if (!res.ok) throw new Error("Fetch error");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(blobUrl);
    }, 1000);
    toast(`Đã tải xong ${label || typeName} ✓`);
  } catch (err) {
    const a = document.createElement("a");
    a.href = uri;
    a.target = "_blank";
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
    toast(`Đã mở liên kết tải ${label || typeName}`);
  }
}

async function downloadAllImgs(id){
  const photo = getImg(id, "photo");
  const cmnd = getImg(id, "cmnd");
  if(!photo && !cmnd){
    toast("Không có ảnh chân dung hay CMND nào để tải về");
    return;
  }
  if(photo) await downloadImg(id, "photo", "Ảnh chân dung");
  if(cmnd){
    setTimeout(async () => {
      await downloadImg(id, "cmnd", "Ảnh CMND");
    }, 400);
  }
}

/* ---- OCR đọc thông minh & Dịch địa chỉ Campuchia / Khmer sang tiếng Việt ---- */
const KHMER_DICT = {
  provinces: [
    { kh: "កំពង់ធំ", en: "Kampong Thom", vi: "Tỉnh Kampong Thom" },
    { kh: "កំពង់ចាម", en: "Kampong Cham", vi: "Tỉnh Kampong Cham" },
    { kh: "ព្រៃវែង", en: "Prey Veng", vi: "Tỉnh Prey Veng" },
    { kh: "ស្វាយរៀង", en: "Svay Rieng", vi: "Tỉnh Svay Rieng" },
    { kh: "កណ្តាល", en: "Kandal", vi: "Tỉnh Kandal" },
    { kh: "តាកែវ", en: "Takeo", vi: "Tỉnh Takeo" },
    { kh: "បាត់ដំបង", en: "Battambang", vi: "Tỉnh Battambang" },
    { kh: "សៀមរាប", en: "Siem Reap", vi: "Tỉnh Siem Reap" },
    { kh: "ក្រចេះ", en: "Kratie", vi: "Tỉnh Kratie" },
    { kh: "ស្ទឹងត្រែង", en: "Stung Treng", vi: "Tỉnh Stung Treng" },
    { kh: "រតនគិរី", en: "Ratanakiri", vi: "Tỉnh Ratanakiri" },
    { kh: "មណ្ឌលគិរី", en: "Mondulkiri", vi: "Tỉnh Mondulkiri" },
    { kh: "បន្ទាយមានជ័យ", en: "Banteay Meanchey", vi: "Tỉnh Banteay Meanchey" },
    { kh: "កំពត", en: "Kampot", vi: "Tỉnh Kampot" },
    { kh: "កែប", en: "Kep", vi: "Tỉnh Kep" },
    { kh: "កោះកុង", en: "Koh Kong", vi: "Tỉnh Koh Kong" },
    { kh: "ពោធិ៍សាត់", en: "Pursat", vi: "Tỉnh Pursat" },
    { kh: "កំពង់ឆ្នាំង", en: "Kampong Chhnang", vi: "Tỉnh Kampong Chhnang" },
    { kh: "កំពង់ស្ពឺ", en: "Kampong Speu", vi: "Tỉnh Kampong Speu" },
    { kh: "ព្រះសីហនុ", en: "Preah Sihanouk", vi: "Tỉnh Preah Sihanouk" },
    { kh: "ព្រះវិហារ", en: "Preah Vihear", vi: "Tỉnh Preah Vihear" },
    { kh: "ឧត្តរមានជ័យ", en: "Oddar Meanchey", vi: "Tỉnh Oddar Meanchey" },
    { kh: "ប៉ៃលិន", en: "Pailin", vi: "Tỉnh Pailin" },
    { kh: "ត្បូងឃ្មុំ", en: "Tbong Khmum", vi: "Tỉnh Tbong Khmum" },
    { kh: "ភ្នំពេញ", en: "Phnom Penh", vi: "Thủ đô Phnom Penh" }
  ],
  districts: [
    { kh: "ស្ទោង", en: "Stoung", vi: "Huyện Stoung" },
    { kh: "បារាយណ៍", en: "Baray", vi: "Huyện Baray" },
    { kh: "សន្ទុក", en: "Santuk", vi: "Huyện Santuk" },
    { kh: "កំពង់ស្វាយ", en: "Kampong Svay", vi: "Huyện Kampong Svay" },
    { kh: "ប្រាសាទសំបូរ", en: "Prasat Sambour", vi: "Huyện Prasat Sambour" },
    { kh: "ប្រាសាទបាឡ័ង្ក", en: "Prasat Balangk", vi: "Huyện Prasat Balangk" },
    { kh: "តាំងគោក", en: "Tang Kok", vi: "Huyện Tang Kok" }
  ],
  communes: [
    { kh: "កំពង់ចិនជើង", en: "Kampong Chen Cheung", vi: "Xã Kampong Chen Cheung" },
    { kh: "កំពង់ចិនត្បូង", en: "Kampong Chen Tboung", vi: "Xã Kampong Chen Tboung" },
    { kh: "ចំណាក្រោម", en: "Chamna Kraom", vi: "Xã Chamna Kraom" },
    { kh: "ចំណាលើ", en: "Chamna Leu", vi: "Xã Chamna Leu" },
    { kh: "ម្សាក្រង", en: "Msa Krang", vi: "Xã Msa Krang" },
    { kh: "ពាមបាង", en: "Peam Bang", vi: "Xã Peam Bang" },
    { kh: "ពពក", en: "Popok", vi: "Xã Popok" },
    { kh: "ប្រឡាយ", en: "Pralay", vi: "Xã Pralay" },
    { kh: "ព្រះដំរី", en: "Preah Damrei", vi: "Xã Preah Damrei" },
    { kh: "រូងឡើង", en: "Rung Loeung", vi: "Xã Rung Loeung" },
    { kh: "សម្ប្រូច", en: "Samprouch", vi: "Xã Samprouch" },
    { kh: "ទ្រា", en: "Trea", vi: "Xã Trea" }
  ],
  villages: [
    { kh: "ចក", en: "Chork", vi: "Thôn Chork" }
  ]
};

function translateKhmerOffline(raw) {
  if (!raw) return "";
  let text = raw.trim();
  
  // Replace administrative keywords
  text = text.replace(/ភូមិ\s*/g, "Thôn ")
             .replace(/ឃុំ\s*/g, "Xã ")
             .replace(/សង្កាត់\s*/g, "Phường ")
             .replace(/ស្រុក\s*/g, "Huyện ")
             .replace(/ខណ្ឌ\s*/g, "Quận ")
             .replace(/ក្រុង\s*/g, "Thị xã ")
             .replace(/ខេត្ត\s*/g, "Tỉnh ")
             .replace(/រាជធានី\s*/g, "Thành phố ");
             
  for (const c of KHMER_DICT.communes) {
    text = text.replace(new RegExp(c.kh, "g"), c.en);
  }
  for (const d of KHMER_DICT.districts) {
    text = text.replace(new RegExp(d.kh, "g"), d.en);
  }
  for (const p of KHMER_DICT.provinces) {
    text = text.replace(new RegExp(p.kh, "g"), p.en);
  }
  for (const v of KHMER_DICT.villages) {
    text = text.replace(new RegExp(v.kh, "g"), v.en);
  }
  
  // Clean up formatting
  return text.replace(/\s{2,}/g, " ").trim();
}

async function translateAddress(text, progCb) {
  if (!text || !text.trim()) return text;
  if (progCb) progCb("Đang dịch địa chỉ sang tiếng Việt…");
  try {
    const res = await fetch("/api/translate-address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text })
    });
    const data = await res.json();
    if (data.ok && data.data && data.data.translated) {
      return data.data.translated;
    }
  } catch (e) {
    // Network or server error fallback
  }
  return translateKhmerOffline(text);
}

let _tessP = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (_tessP) return _tessP;
  _tessP = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js";
    s.onload = () => res();
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return _tessP;
}

function cropBottom(uri) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      try {
        const h = Math.round(im.height * 0.46);
        const c = document.createElement("canvas");
        c.width = im.width;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(im, 0, im.height - h, im.width, h, 0, 0, im.width, h);
        res(c.toDataURL("image/jpeg", 0.95));
      } catch(e) { res(uri); }
    };
    im.onerror = () => res(uri);
    im.src = uri;
  });
}

function parseMRZ(text) {
  const up = (text || "").toUpperCase();
  const rawLines = up.split(/\r?\n/).map(l => l.replace(/[^A-Z0-9<]/g, "").trim()).filter(l => l.length >= 6);
  const out = {};

  // 1. Line with DOB & Gender (e.g. 8110033F2210285KHM or 8110033M...)
  for (const l of rawLines) {
    const m = l.match(/(\d{6})\d?([MFX])/);
    if (m) {
      const s = m[1], yy = +s.slice(0, 2), mm = s.slice(2, 4), dd = s.slice(4, 6);
      const cy = new Date().getFullYear() % 100;
      const year = (yy > cy) ? 1900 + yy : 2000 + yy;
      if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) {
        out.ngay_sinh = dd + "/" + mm + "/" + year;
        out.gioi_tinh = (m[2] === "F" ? "F" : (m[2] === "M" ? "M" : ""));
        const age = new Date().getFullYear() - year;
        if (age >= 0 && age < 120) out.tuoi = String(age);
        break;
      }
    }
  }

  // 2. Line with Name (e.g. BOEURN<<YON<<<<<)
  for (const l of rawLines) {
    if (l.indexOf("<<") >= 0 && /^[A-Z<]+$/.test(l) && l.length >= 8) {
      const segs = l.split(/<+/).filter(Boolean);
      if (segs.length >= 2) {
        out.ten_that = (segs[0] + " " + segs.slice(1).join(" ")).trim();
        break;
      } else if (segs.length === 1) {
        out.ten_that = segs[0].trim();
        break;
      }
    }
  }

  // 3. Line with Document Number (e.g. IDKHM1505329610 or KHM150532961 or 9-12 digits)
  for (const l of rawLines) {
    const mKh = l.match(/(?:ID|I<)?KHM(\d{9})/);
    if (mKh) {
      out.cmnd = mKh[1];
      break;
    }
  }
  if (!out.cmnd) {
    for (const l of rawLines) {
      const mKh = l.match(/KHM(\d{8,12})/);
      if (mKh) {
        out.cmnd = mKh[1].length > 9 ? mKh[1].slice(0, 9) : mKh[1];
        break;
      }
      const mVn = l.match(/([0-9]{9,12})/);
      if (mVn && !out.cmnd) {
        out.cmnd = mVn[1];
      }
    }
  }

  // 4. Fallback text parser (for Vietnamese CCCD or standard cards)
  if (!out.ten_that) {
    const mName = text.match(/(?:Họ và tên|Full name|Họ tên|Name)[:\s]+([^\r\n]+)/i);
    if (mName) out.ten_that = mName[1].trim().toUpperCase();
  }
  if (!out.cmnd) {
    const mNum = text.match(/(?:Số|No\.?|CCCD|CMND)[:\s]*([0-9]{9,12})/i);
    if (mNum) out.cmnd = mNum[1].trim();
  }
  if (!out.ngay_sinh) {
    const mDob = text.match(/(?:Ngày sinh|Date of birth|Sinh ngày)[:\s]*([0-3]?\d[\/\-.][0-1]?\d[\/\-.](?:19|20)\d{2})/i);
    if (mDob) {
      out.ngay_sinh = mDob[1].replace(/[\-.]/g, "/");
      const mYear = out.ngay_sinh.match(/(19|20)\d{2}/);
      if (mYear) {
        const age = new Date().getFullYear() - (+mYear[0]);
        if (age >= 0 && age < 120) out.tuoi = String(age);
      }
    }
  }
  if (!out.gioi_tinh) {
    if (/Giới tính[:\s]+(Nữ|Female|F)/i.test(text)) out.gioi_tinh = "F";
    else if (/Giới tính[:\s]+(Nam|Male|M)/i.test(text)) out.gioi_tinh = "M";
  }

  return out;
}

async function ocrCMND(uri, progCb) {
  // Method 1: Try Server-Side Smart Gemini Vision AI OCR with automatic Khmer-to-Vietnamese translation
  try {
    if (progCb) progCb("Đang kết nối AI nhận diện & dịch địa chỉ sang tiếng Việt…");
    const aiRes = await fetch("/api/ocr-cmnd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: uri })
    });
    const aiJson = await aiRes.json();
    if (aiJson.ok && aiJson.data && (aiJson.data.ten_that || aiJson.data.cmnd || aiJson.data.dia_chi)) {
      return { ok: true, source: "ai", parsed: aiJson.data };
    }
  } catch(e) {
    // Fallback to offline / client-side Tesseract OCR
  }

  // Method 2: Client-side Tesseract OCR + MRZ parsing + Offline Khmer place translation fallback
  try {
    if (progCb) progCb("Đang tải công cụ quét cục bộ…");
    await loadTesseract();
    
    // First pass: Crop bottom 46% (MRZ region)
    const cropped = await cropBottom(uri);
    if (progCb) progCb("Đang quét mã MRZ CMND…");
    const res = await window.Tesseract.recognize(cropped, "eng", {
      logger: m => {
        if (progCb && m.status === "recognizing text") {
          progCb("Đang quét mã MRZ… " + Math.round(m.progress * 100) + "%");
        }
      }
    });
    
    let parsed = parseMRZ(res.data.text);
    
    // Second pass fallback: If MRZ didn't find key fields, try full image
    if (!parsed.ten_that || !parsed.cmnd || !parsed.ngay_sinh) {
      if (progCb) progCb("Đang quét bổ sung toàn bộ thẻ CMND…");
      const fullRes = await window.Tesseract.recognize(uri, "eng", {
        logger: m => {
          if (progCb && m.status === "recognizing text") {
            progCb("Đang quét thẻ… " + Math.round(m.progress * 100) + "%");
          }
        }
      });
      const fullParsed = parseMRZ(fullRes.data.text);
      parsed = Object.assign(fullParsed, parsed);
    }
    
    return { ok: true, source: "offline", text: res.data.text, parsed: parsed };
  } catch(e) {
    return { ok: false, err: e.message || String(e) };
  }
}

async function doOcrCMND(id) {
  const uri = getImg(id, "cmnd");
  if (!uri) {
    toast("Chưa có ảnh CMND để quét");
    return;
  }
  const sheet = document.getElementById("sheet");
  const ocrBox = sheet ? sheet.querySelector("#ocrStatusBox") : null;
  if (ocrBox) {
    ocrBox.style.display = "block";
    ocrBox.innerHTML = '<div class="ocr-status-running"><div class="ocr-spinner"></div> <span id="ocrProgText">Đang đọc thông tin & chuyển đổi địa chỉ sang tiếng Việt…</span></div>';
  }

  const progCb = text => {
    const el = document.getElementById("ocrProgText");
    if (el) el.textContent = text;
  };

  const res = await ocrCMND(uri, progCb);
  if (!res.ok) {
    if (ocrBox) {
      ocrBox.innerHTML = '<div class="ocr-status-err">❌ Không thể nhận diện: ' + esc(res.err) + '</div>';
    }
    toast("Lỗi nhận diện ảnh CMND");
    return;
  }

  const p = res.parsed || {};
  const hasData = !!(p.ten_that || p.cmnd || p.ngay_sinh || p.gioi_tinh || p.dia_chi || p.noi_sinh);
  if (!hasData) {
    if (ocrBox) {
      ocrBox.innerHTML = '<div class="ocr-status-err">⚠️ Không nhận diện được thông tin thẻ. Hãy thử chụp góc thẻ rõ nét hơn.</div>';
    }
    toast("Không nhận diện được chữ trên CMND");
    return;
  }

  // Auto-fill into form inputs
  const fillInput = (k, val) => {
    if (!val) return;
    const inp = sheet.querySelector(`[data-k="${k}"]`);
    if (inp) {
      inp.value = val;
      inp.classList.remove("field-pulse");
      void inp.offsetWidth; // reflow
      inp.classList.add("field-pulse");
      setTimeout(() => inp.classList.remove("field-pulse"), 2500);
    }
  };

  if (p.ten_that) fillInput("ten_that", p.ten_that);
  if (p.cmnd) fillInput("cmnd", p.cmnd);
  if (p.ngay_sinh) fillInput("ngay_sinh", p.ngay_sinh);
  if (p.tuoi) fillInput("tuoi", p.tuoi);
  if (p.gioi_tinh) fillInput("gioi_tinh", p.gioi_tinh);
  if (p.noi_sinh) fillInput("noi_sinh", p.noi_sinh);
  if (p.dia_chi) fillInput("dia_chi", p.dia_chi);

  // Render success banner in ocrBox
  if (ocrBox) {
    let details = [];
    if (p.ten_that) details.push("<b>Họ tên:</b> " + esc(p.ten_that));
    if (p.cmnd) details.push("<b>CMND:</b> " + esc(p.cmnd));
    if (p.ngay_sinh) details.push("<b>Ngày sinh:</b> " + esc(p.ngay_sinh) + (p.tuoi ? (" (" + esc(p.tuoi) + " tuổi)") : ""));
    if (p.gioi_tinh) details.push("<b>Giới tính:</b> " + (p.gioi_tinh === "F" ? "Nữ (F)" : (p.gioi_tinh === "M" ? "Nam (M)" : p.gioi_tinh)));
    if (p.noi_sinh) details.push("📍 <b>Nơi sinh:</b> " + esc(p.noi_sinh));
    if (p.dia_chi) details.push("🏠 <b>Địa chỉ:</b> " + esc(p.dia_chi));

    const note = p.dia_chi || p.noi_sinh ?
      "✓ Đã tự động đọc họ tên, số thẻ và chuyển đổi địa chỉ/nơi sinh sang tiếng Việt chuẩn." :
      "✓ Đã tự động cập nhật vào các ô nhập liệu bên dưới.";

    ocrBox.innerHTML =
      '<div class="ocr-status-ok">' +
      '<div class="ocr-ok-title">⚡ <b>Đã nhận diện thông tin & dịch địa chỉ tiếng Việt thành công:</b></div>' +
      '<div class="ocr-ok-details">' + details.join(' &bull; ') + '</div>' +
      '<div class="ocr-ok-note">' + note + '</div>' +
      '</div>';
  }

  toast("⚡ Đã đọc thông tin & chuyển đổi địa chỉ tiếng Việt thành công ✓");
}

function isMuon(p){
  return !!(p.ten_muon || (p.ten_ho_so && p.ten_that && p.ten_ho_so.trim().toLowerCase() !== p.ten_that.trim().toLowerCase()));
}

/* ===== Filter Data ===== */
function filtered(){
  const qRaw = state.q.trim();
  const q = noAccent(qRaw);
  const qDigits = cleanPhone(qRaw);

  return DATA.filter(p => {
    if(state.to && p.to !== state.to) return false;
    if(state.loai && p.loai !== state.loai) return false;
    if(state.muon && !isMuon(p)) return false;
    if(state.hasPhone && !getPhone(p)) return false;

    if(q){
      const phone = getPhone(p);
      const cleanP = cleanPhone(phone);
      const hay = noAccent([p.ten_that, p.ten_ho_so, p.cmnd, phone, p.phong_o, p.phan_cay, p.khu_vuc, p.dia_chi, p.so_bao_hiem, p.quan_he, p.noi_sinh, p.ghi_chu].join(" "));
      
      const textMatch = hay.includes(q);
      const phoneMatch = qDigits && cleanP && (cleanP.includes(qDigits) || phone.includes(qRaw));
      if(!textMatch && !phoneMatch) return false;
    }
    return true;
  });
}

function filteredRooms(){
  const rawRooms = {};
  filtered().forEach(p => {
    const r = roomKey(p);
    if(!rawRooms[r]) rawRooms[r] = [];
    rawRooms[r].push(p);
  });

  const out = {};
  for(const r in rawRooms){
    const ppl = rawRooms[r];
    const blk = getRoomBlock(r);
    
    // Room Block filter
    if(state.roomBlock && blk !== state.roomBlock) continue;

    // Room Capacity filter
    if(state.roomCap === "1" && ppl.length !== 1) continue;
    if(state.roomCap === "2-3" && (ppl.length < 2 || ppl.length > 3)) continue;
    if(state.roomCap === "4+" && ppl.length < 4) continue;

    // Room Leader filter
    const hasLeader = ppl.some(p => p.chu_phong);
    if(state.roomChu === "has_chu" && !hasLeader) continue;
    if(state.roomChu === "no_chu" && hasLeader) continue;

    // Room Occupant Type filter
    const hasLD = ppl.some(p => p.loai === "Lao động");
    const hasGT = ppl.some(p => p.loai === "Gia thuộc");
    if(state.roomType === "ld" && (!hasLD || hasGT)) continue;
    if(state.roomType === "gt" && (!hasGT || hasLD)) continue;
    if(state.roomType === "mixed" && (!hasLD || !hasGT)) continue;

    out[r] = ppl;
  }
  return out;
}

/* ---------- gợi ý tên khi gõ ---------- */
function highlightName(name,q){
  const nn = noAccent(name), nq = noAccent(q);
  const i = nq ? nn.indexOf(nq) : -1;
  if(i<0) return esc(name);
  return esc(name.slice(0,i))+'<span class="sghi">'+esc(name.slice(i,i+q.length))+'</span>'+esc(name.slice(i+q.length));
}

function renderSugg(){
  const el = document.getElementById("sugg");
  if(!el) return;
  const q = state.q.trim();
  if(state.view!=="people" || q.length<1){
    el.classList.remove("show");
    el.innerHTML = "";
    return;
  }
  const nq = noAccent(q);
  const rows = DATA.filter(p => {
    const hay = noAccent([p.ten_that, p.ten_ho_so, p.cmnd, getPhone(p), p.phong_o].join(" "));
    return hay.includes(nq);
  }).slice(0, 8);

  if(!rows.length){
    el.classList.remove("show");
    el.innerHTML = "";
    return;
  }

  el.innerHTML = rows.map(p => {
    const av = avatar(p);
    const avh = av ? '<img class="sgav" src="'+av+'">' : '<div class="sgav">'+esc((p.ten_that||"?").trim().slice(-1))+'</div>';
    const ph = getPhone(p);
    const meta = [p.to, p.phong_o?("🏠 "+p.phong_o):"", p.phan_cay?("🌳 "+p.phan_cay):"", ph?("📞 "+ph):""].filter(Boolean).join(" · ");
    return '<div class="sgrow" data-id="'+p.id+'">'+avh+
      '<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:700">'+highlightName(p.ten_that||"(chưa có tên)", q)+
      (p.chu_phong?' <span class="tag chu">👑 Chủ phòng</span>':'')+'</div><div style="font-size:11.5px;color:var(--muted)">'+esc(meta)+'</div></div>'+
      '<span class="sgchev">›</span></div>';
  }).join("");
  el.classList.add("show");
}

function hideSugg(){
  const el = document.getElementById("sugg");
  if(el) el.classList.remove("show");
}

/* ---------- Render List Người (People View) ---------- */
function renderPeople(){
  const rows = filtered();
  document.getElementById("count").textContent = rows.length + " / " + DATA.length;
  const list = document.getElementById("list");
  if(!rows.length){
    list.innerHTML = '<div class="empty">Không tìm thấy ai khớp với bộ lọc.</div>';
    return;
  }

  let html = "";
  for(const p of rows){
    const muon = isMuon(p);
    const phone = getPhone(p);
    const sub = [];

    if(p.cmnd) sub.push('<span class="pill">CMND: '+esc(p.cmnd)+'</span>');
    if(phone) sub.push(phonePillHtml(p));
    if(p.to) sub.push('<span class="pill">'+esc(p.to)+'</span>');
    if(p.phong_o) sub.push('<span class="pill">🏠 '+esc(p.phong_o)+'</span>');
    if(p.phan_cay) sub.push('<span class="pill">🌳 '+esc(p.phan_cay)+'</span>');
    if(p.quan_he) sub.push('<span class="pill">'+esc(p.quan_he)+'</span>');
    if(p.noi_sinh) sub.push('<span class="pill">📍 '+esc(p.noi_sinh)+'</span>');

    const av = avatar(p);
    const avHtml = av ? '<img class="avatar" src="'+av+'">' : '<div class="avatar" style="display:flex;align-items:center;justify-content:center;color:#9bb0a5;font-size:18px;">🧑</div>';

    html += '<div class="card" data-id="'+p.id+'"><div class="cardrow">'+avHtml+'<div class="cbody">'+
      '<div class="nm">'+esc(p.ten_that||"(chưa có tên)")+
      (p.loai==="Lao động"?' <span class="tag">Lao động</span>':(p.loai==="Gia thuộc"?' <span class="tag gt">Gia thuộc</span>':' <span class="tag kh">Khác</span>'))+
      (p.chu_phong?' <span class="tag chu">👑 Chủ phòng</span>':'')+
      (muon?' <span class="tag muon">⚑ Mượn tên: '+esc(p.ten_ho_so)+'</span>':'')+
      (p._edited?' <span class="tag edited">✎</span>':'')+
      '</div>'+
      '<div class="sub">'+sub.join(" ")+'</div>'+
      '</div></div></div>';
  }
  list.innerHTML = html;
}

/* ---------- Render List Phòng Ở (Room Categorization View) ---------- */
function renderRooms(){
  const groups = filteredRooms();
  const keys = Object.keys(groups).sort((a,b) => {
    if(a===NO_ROOM) return 1;
    if(b===NO_ROOM) return -1;
    return a.localeCompare(b,'vi',{numeric:true});
  });

  const totalPpl = Object.values(groups).reduce((acc, ppl) => acc + ppl.length, 0);
  document.getElementById("count").textContent = keys.length + " phòng (" + totalPpl + " người)";
  const list = document.getElementById("list");

  if(!keys.length){
    list.innerHTML = '<div class="empty">Không có phòng nào khớp với bộ lọc phân loại hiện tại.</div>';
    return;
  }

  let html = "";
  for(const r of keys){
    const ppl = groups[r];
    const blk = getRoomBlock(r);
    const leader = ppl.find(p => p.chu_phong);
    const countLd = ppl.filter(p => p.loai === "Lao động").length;
    const countGt = ppl.filter(p => p.loai === "Gia thuộc").length;

    // Leader badge or missing leader alert
    let leaderTag = "";
    if(r !== NO_ROOM){
      if(leader){
        const lPhone = getPhone(leader);
        leaderTag = '<span class="tag chu">👑 '+esc(leader.ten_that)+(lPhone?(' · 📞 '+esc(formatPhone(lPhone))):'')+'</span>';
      } else {
        leaderTag = '<span class="tag alert-tag">⚠️ Chưa có chủ phòng</span>';
      }
    }

    // Capacity tag
    let capTag = '<span class="tag">'+ppl.length+' người</span>';
    if(ppl.length >= 4){
      capTag = '<span class="tag warn">'+ppl.length+' người (đông)</span>';
    } else if(ppl.length === 1){
      capTag = '<span class="tag gt">1 người (đơn)</span>';
    }

    // Members list preview chips
    const memberChips = ppl.map(p => {
      const ph = getPhone(p);
      return '<span class="pill'+(p.chu_phong?' phone-pill':'')+'">'+(p.chu_phong?'👑 ':'')+esc(p.ten_that)+(ph?(' 📞'):'')+'</span>';
    }).slice(0, 8).join(" ") + (ppl.length > 8 ? " …" : "");

    // Composition info
    const compMeta = [];
    if(countLd > 0) compMeta.push(countLd + " Lao động");
    if(countGt > 0) compMeta.push(countGt + " Gia thuộc");
    const toNames = Array.from(new Set(ppl.map(p => p.to).filter(Boolean))).join(", ");
    if(toNames) compMeta.push(toNames);

    html += '<div class="card" data-room="'+esc(r)+'">'+
      '<div class="nm">'+
      '<span>🏠 '+esc(r)+'</span>'+
      '<span class="pill" style="font-size:11px;background:#e0f2fe;color:#0369a1;font-weight:700;">🏷️ '+esc(blk)+'</span>'+
      capTag+
      leaderTag+
      '</div>'+
      '<div style="font-size:12px;color:var(--muted);margin-top:4px;font-weight:600;">'+esc(compMeta.join(" · "))+'</div>'+
      '<div class="sub" style="margin-top:6px">'+memberChips+'</div>'+
      '</div>';
  }
  list.innerHTML = html;
}

function render(){
  if(state.view === "rooms") renderRooms();
  else renderPeople();
}

/* ---------- Popup Chi Tiết & Quản Lý Phòng Ở (Room Modal) ---------- */
function openRoom(room){
  currentRoom = room;
  const ppl = DATA.filter(p => roomKey(p) === room).sort((a,b) => (b.chu_phong?1:0)-(a.chu_phong?1:0) || (a.ten_that||"").localeCompare(b.ten_that||"", "vi"));
  const blk = getRoomBlock(room);
  const leader = ppl.find(p => p.chu_phong);

  let rows = "";
  for(const p of ppl){
    const av = avatar(p);
    const avHtml = av ? '<img class="avatar" src="'+av+'">' : '<div class="avatar" style="display:flex;align-items:center;justify-content:center;color:#9bb0a5">🧑</div>';
    const ph = getPhone(p);
    const phoneBtn = ph ? phonePillHtml(p) : '<span style="font-size:11.5px;color:var(--muted)">Chưa có SĐT</span>';

    rows += '<div class="occ" data-id="'+p.id+'">'+avHtml+
      '<div class="onm">'+esc(p.ten_that||"(chưa có tên)")+
      (p.chu_phong?' <span class="tag chu">👑 Chủ phòng</span>':'')+
      (isMuon(p)?' <span class="tag muon">⚑</span>':'')+
      '<div style="font-size:12px;color:var(--muted);font-weight:400;margin-top:3px">'+
      esc(p.loai)+(p.quan_he?' · '+esc(p.quan_he):'')+(p.to?' · '+esc(p.to):'')+(p.phan_cay?' · 🌳 '+esc(p.phan_cay):'')+(p.cmnd?' · CMND '+esc(p.cmnd):'')+
      '</div>'+
      '<div style="margin-top:4px">'+phoneBtn+'</div>'+
      '</div>'+
      '<button class="mini-b" data-act="chu" title="Đặt làm chủ phòng">'+(p.chu_phong?'👑 Chủ':'☆ Đặt chủ')+'</button>'+
      '<button class="mini-b" data-act="edit">Sửa</button>'+
      '<button class="mini-b move" data-act="move">Chuyển</button>'+
      '</div>';
  }

  const sheet = document.getElementById("sheet");
  sheet.innerHTML =
    '<div class="sheet-h">'+
    '<h2>🏠 Phòng '+esc(room)+' <span class="pill" style="font-size:12px;background:#e0f2fe;color:#0369a1">🏷️ '+esc(blk)+'</span></h2>'+
    '<button class="x" id="bClose">×</button>'+
    '</div>'+
    '<div class="sheet-b">'+
    '<div class="roomhdr">'+
    '<span>👥 <b>'+ppl.length+'</b> người</span>'+
    (leader ? (' · 👑 Chủ phòng: <b>'+esc(leader.ten_that)+'</b>') : ' · <span style="color:#ea580c;font-weight:700">⚠️ Chưa có chủ phòng</span>')+
    '</div>'+
    (rows || '<div class="empty">Phòng trống.</div>')+
    '</div>'+
    '<div class="sheet-f">'+
    '<button class="btn primary" id="bAddP">➕ Thêm người vào phòng này</button>'+
    '</div>';

  document.getElementById("overlay").classList.add("show");
  document.getElementById("bClose").onclick = closeEdit;
  document.getElementById("bAddP").onclick = () => openEdit("__new__", room, room);

  sheet.querySelector(".sheet-b").onclick = e => {
    const b = e.target.closest("button[data-act]");
    if(!b) return;
    const occ = b.closest(".occ");
    const id = +occ.dataset.id;
    const p = DATA.find(x => x.id === id);
    if(!p) return;

    const act = b.dataset.act;
    if(act === "chu"){
      const makeLeader = !p.chu_phong;
      DATA.forEach(x => {
        if(roomKey(x) === room && x.chu_phong){
          x.chu_phong = false;
          x._edited = true;
          queueChange(x);
        }
      });
      p.chu_phong = makeLeader;
      p._edited = true;
      queueChange(p);
      save();
      openRoom(room);
      render();
      toast(makeLeader ? ("Đã đặt " + p.ten_that + " làm chủ phòng 👑") : "Đã hủy chủ phòng");
    } else if(act === "edit"){
      openEdit(id, null, room);
    } else if(act === "move"){
      movePerson(id, room);
    }
  };
}

function movePerson(id, fromRoom){
  const p = DATA.find(x => x.id === id);
  if(!p) return;
  const target = prompt("Chuyển " + p.ten_that + " sang phòng:", p.phong_o || "");
  if(target === null) return;
  const newR = target.trim();
  p.phong_o = newR;
  p._edited = true;
  p.chu_phong = false;
  queueChange(p);
  save();
  render();
  toast("Đã chuyển sang phòng " + (newR || "(chưa có phòng)"));
  if(fromRoom) openRoom(fromRoom);
}

/* ---------- Popup Form Chỉnh Sửa Người (Edit Modal) ---------- */
let editingId = null;
let editBackRoom = null;

function blank(prefillRoom) {
  const maxId = DATA.reduce((m, x) => Math.max(m, +x.id || 0), 0);
  return {
    id: maxId + 1,
    cmnd: "",
    ten_that: "",
    ten_ho_so: "",
    ngay_sinh: "",
    tuoi: "",
    noi_sinh: "",
    gioi_tinh: "",
    loai: "Lao động",
    to: "",
    khu_vuc: "",
    phan_cay: "",
    quan_he: "",
    phong_o: prefillRoom || "",
    so_bao_hiem: "",
    chi_tiet_noi_o: "",
    dia_chi: "",
    so_dt: "",
    ghi_chu: "",
    chu_phong: false,
    _new: true
  };
}

function renderImgSlot(id, type, label) {
  const uri = getImg(id, type);
  const fid = imgFileId(id, type);
  const driveUrl = getDriveFileUrl(id, type);

  let h = '<div class="islot">';
  h += '<div class="ilabel" style="display:flex;justify-content:space-between;align-items:center;">';
  h += '<span style="font-weight:700;color:var(--text);">' + esc(label) + '</span>';
  if (fid) {
    h += '<a href="' + driveUrl + '" target="_blank" rel="noopener noreferrer" class="pill" style="font-size:11.5px;background:#e0f2fe;color:#0284c7;text-decoration:none;font-weight:700;padding:2px 8px;" title="Mở file gốc trên Google Drive">☁️ Drive gốc ↗</a>';
  }
  h += '</div>';

  if (uri) {
    h += '<div class="thumbwrap" style="position:relative;cursor:pointer;border-radius:10px;overflow:hidden;" title="Bấm để xem ảnh gốc / phóng to" data-img-act="preview" data-img-type="' + type + '">';
    h += '<img class="thumbimg" src="' + uri + '" alt="' + esc(label) + '">';
    h += '<div class="thumb-overlay" style="position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,0.68);color:#fff;font-size:11.5px;padding:3px 9px;border-radius:6px;backdrop-filter:blur(2px);font-weight:600;">🔍 Xem lớn</div>';
    h += '</div>';

    h += '<div class="ibtns" style="margin-top:8px;">';
    if (fid) {
      h += '<a href="' + driveUrl + '" target="_blank" rel="noopener noreferrer" class="btn mini-b" style="color:#0369a1;background:#f0f9ff;border-color:#bae6fd;font-weight:700;" title="Truy cập file ảnh gốc lưu trên Google Drive">☁️ Drive gốc</a>';
    } else {
      h += '<button type="button" class="btn mini-b" data-img-act="preview" data-img-type="' + type + '" title="Xem ảnh gốc độ phân giải cao">🔍 Xem gốc</button>';
    }
    h += '<button type="button" class="btn mini-b" data-img-act="download" data-img-type="' + type + '" data-img-label="' + esc(label) + '" style="font-weight:700;color:#047857;background:#ecfdf5;border-color:#a7f3d0;" title="Tải ảnh này về máy">⬇ Tải về</button>';
    h += '<button type="button" class="btn mini-b" data-img-act="change" data-img-type="' + type + '">📷 Đổi ảnh</button>';
    if (type === "cmnd") {
      h += '<button type="button" class="btn mini-b btn-ocr" data-img-act="ocr" title="Đọc thông tin CMND & Dịch địa chỉ">⚡ Đọc CMND & Dịch</button>';
    }
    h += '<button type="button" class="btn mini-b del" data-img-act="del" data-img-type="' + type + '" title="Xóa ảnh này">🗑 Xóa</button>';
    h += '</div>';
  } else {
    h += '<div class="noimg">Chưa có ' + esc(label.toLowerCase()) + '</div>';
    h += '<div class="ibtns">';
    h += '<button type="button" class="btn mini-b primary" data-img-act="upload" data-img-type="' + type + '">📷 Tải ' + esc(label.toLowerCase()) + ' lên</button>';
    if (fid) {
      h += '<a href="' + driveUrl + '" target="_blank" rel="noopener noreferrer" class="btn mini-b" style="color:#0369a1;" title="Mở file trên Google Drive">☁️ Mở Drive gốc</a>';
    }
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderImgSection(id) {
  const photo = getImg(id, "photo");
  const cmnd = getImg(id, "cmnd");
  const hasBoth = !!(photo && cmnd);
  const hasAny = !!(photo || cmnd);
  const photoFid = imgFileId(id, "photo");
  const cmndFid = imgFileId(id, "cmnd");

  let h = "";
  if (hasAny) {
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 12px;margin-bottom:12px;">';
    h += '<div style="font-size:12.5px;font-weight:700;color:#166534;display:flex;align-items:center;gap:5px;">🖼️ Quản lý hình ảnh</div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    if (hasBoth) {
      h += '<button type="button" class="btn mini-b" data-img-act="download-all" style="color:#047857;background:#fff;border-color:#86efac;font-weight:700;" title="Tải cả ảnh chân dung và CMND về máy">⬇ Tải cả 2 ảnh</button>';
    }
    if (photoFid || cmndFid) {
      h += '<span class="pill" style="background:#e0f2fe;color:#0369a1;font-size:11.5px;font-weight:700;">☁️ Đã đồng bộ Google Drive</span>';
    }
    h += '</div></div>';
  }

  h += renderImgSlot(id, "photo", "Ảnh chân dung");
  h += renderImgSlot(id, "cmnd", "Ảnh CMND / Thẻ căn cước");
  h += '<div id="ocrStatusBox" class="ocr-box" style="display:none"></div>';
  return h;
}

function pickImageFile(onPick) {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.onchange = async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      toast("Đang xử lý & nén ảnh…");
      const compressedUri = await compress(file, 1280, 0.82);
      onPick(compressedUri);
    } catch(err) {
      toast("Không đọc được file ảnh");
    }
  };
  inp.click();
}

function wireImgEvents(id) {
  const container = document.getElementById("imgSection");
  if (!container) return;

  container.querySelectorAll("[data-img-act]").forEach(b => {
    b.onclick = async e => {
      e.preventDefault();
      e.stopPropagation();
      const act = b.dataset.imgAct;
      const type = b.dataset.imgType;
      const label = b.dataset.imgLabel || (type === "photo" ? "Ảnh chân dung" : "Ảnh CMND");

      if (act === "upload" || act === "change") {
        pickImageFile(uri => {
          setImg(id, type, uri);
          container.innerHTML = renderImgSection(id);
          wireImgEvents(id);
          toast("Đã tải ảnh lên thành công ✓");
          if (type === "cmnd") {
            doOcrCMND(id);
          }
        });
      } else if (act === "del") {
        if (confirm("Xác nhận xóa ảnh này?")) {
          delImg(id, type);
          container.innerHTML = renderImgSection(id);
          wireImgEvents(id);
          toast("Đã xóa ảnh");
        }
      } else if (act === "download") {
        downloadImg(id, type, label);
      } else if (act === "download-all") {
        downloadAllImgs(id);
      } else if (act === "preview") {
        openDriveFile(id, type);
      } else if (act === "ocr") {
        doOcrCMND(id);
      }
    };
  });
}

function saveEdit(id) {
  const sheet = document.getElementById("sheet");
  if (!sheet) return;

  const isNew = id === "__new__";
  let rec = isNew ? blank() : DATA.find(x => x.id === id);
  if (!rec) return;

  const inputs = sheet.querySelectorAll("[data-k]");
  inputs.forEach(inp => {
    const k = inp.dataset.k;
    if (k) {
      rec[k] = inp.value.trim();
    }
  });

  if (!rec.ten_that) {
    toast("Vui lòng nhập Họ và tên (tên thật)");
    const nameInp = sheet.querySelector('[data-k="ten_that"]');
    if (nameInp) nameInp.focus();
    return;
  }

  rec.so_dt = cleanPhone(rec.so_dt) || rec.so_dt;
  rec.sdt = rec.so_dt;

  const ckChu = sheet.querySelector("#ckChu");
  const isLeader = ckChu ? ckChu.checked : false;
  if (isLeader && rec.phong_o) {
    DATA.forEach(x => {
      if (roomKey(x) === rec.phong_o && x.id !== rec.id && x.chu_phong) {
        x.chu_phong = false;
        x._edited = true;
        queueChange(x);
      }
    });
  }
  rec.chu_phong = isLeader;

  if (isNew) {
    if (TEMP_NEW_IMGS.photo) setImg(rec.id, "photo", TEMP_NEW_IMGS.photo);
    if (TEMP_NEW_IMGS.cmnd) setImg(rec.id, "cmnd", TEMP_NEW_IMGS.cmnd);
    TEMP_NEW_IMGS = {};
    rec._edited = true;
    DATA.unshift(rec);
  } else {
    rec._edited = true;
  }

  queueChange(rec);
  save();
  render();
  toast(isNew ? "Đã thêm hồ sơ mới ✓" : "Đã lưu thay đổi hồ sơ ✓");

  if (editBackRoom) {
    openRoom(editBackRoom);
  } else {
    closeEdit();
  }
}


function selField(k,lbl,opts,curVal,labels){
  let h = '<div class="fld"><label>'+lbl+'</label><select data-k="'+k+'">';
  for(const o of opts){
    const lb = (labels&&labels[o]!=null)?labels[o]:(o===""?"—":o);
    h += '<option value="'+esc(o)+'"'+(o===curVal?" selected":"")+'>'+esc(lb)+'</option>';
  }
  h += '</select></div>';
  return h;
}

function openEdit(id, prefillRoom, backRoom) {
  editingId = id;
  editBackRoom = backRoom || null;
  if (id === "__new__") TEMP_NEW_IMGS = {};
  const p = id === "__new__" ? blank(prefillRoom) : DATA.find(x => x.id === id);
  if (!p) { return; }
  const cur = clone(p);
  cur.so_dt = getPhone(cur);
  let body = "";
  const mkInput = (k, lbl, t) => {
    const v = esc(cur[k] || "");
    if (t === "textarea") return '<div class="fld"><label>' + lbl + '</label><textarea rows="2" data-k="' + k + '">' + v + '</textarea></div>';
    if (t === "sel_gt") return selField(k, lbl, ["", "M", "F"], cur[k], { "": "—", "M": "Nam (M)", "F": "Nữ (F)" });
    if (t === "sel_loai") return selField(k, lbl, ["Lao động", "Gia thuộc", "Khác"], cur[k] || "Khác");
    if (t === "sel_to") return selField(k, lbl, [""].concat(TO_LIST), cur[k]);
    if (k === "so_dt") {
      const ph = cur.so_dt;
      const cl = cleanPhone(ph);
      return '<div class="fld"><label>' + lbl + '</label><div class="fld-phone-wrap"><input type="tel" data-k="' + k + '" value="' + v + '" placeholder="Ví dụ: 0912345678 hoặc +855..."><a href="' + (cl ? ("tel:" + cl) : "#") + '" class="btn primary mini-b" style="' + (cl ? "" : "display:none") + ';text-decoration:none" id="bCallNow" title="Bấm gọi ngay">📞 Gọi</a></div></div>';
    }
    if (t === "addr") {
      return '<div class="fld"><label>' + lbl + '</label><div class="fld-addr-wrap"><input data-k="' + k + '" value="' + v + '" placeholder="Nhập địa chỉ hoặc quét từ CMND"><button type="button" class="btn-trans" data-field="' + k + '" title="Dịch địa chỉ tiếng Khmer sang tiếng Việt chuẩn">🌐 Dịch TV</button></div></div>';
    }
    return '<div class="fld"><label>' + lbl + '</label><input data-k="' + k + '" value="' + v + '"></div>';
  };
  
  body += '<div id="imgSection">' + renderImgSection(id) + '</div>';
  body += mkInput("ten_that", "Họ và tên (tên thật)*", "input");
  body += mkInput("ten_ho_so", "Tên trong hồ sơ (tên mượn)", "input");
  body += '<div class="row2">' + mkInput("cmnd", "CMND / CCCD", "input") + mkInput("ngay_sinh", "Ngày sinh (dd/mm/yyyy)", "input") + '</div>';
  body += '<div class="row2">' + mkInput("gioi_tinh", "Giới tính", "sel_gt") + mkInput("tuoi", "Tuổi", "input") + '</div>';
  body += '<div class="row2">' + mkInput("loai", "Loại đối tượng", "sel_loai") + mkInput("to", "Tổ", "sel_to") + '</div>';
  body += '<div class="row2">' + mkInput("phong_o", "Phòng ở", "input") + mkInput("phan_cay", "Phần cây hiện tại", "input") + '</div>';
  body += '<div class="fld"><label class="ckrow"><input type="checkbox" id="ckChu"' + (cur.chu_phong ? " checked" : "") + '> 👑 Là chủ phòng này</label></div>';
  body += mkInput("so_dt", "Số điện thoại (SĐT / Zalo)", "input");
  body += '<div class="row2">' + mkInput("khu_vuc", "Khu vực", "input") + mkInput("quan_he", "Quan hệ", "input") + '</div>';
  body += mkInput("so_bao_hiem", "Số bảo hiểm", "input");
  body += mkInput("noi_sinh", "Nơi sinh", "addr");
  body += mkInput("dia_chi", "Địa chỉ thường trú", "addr");
  body += mkInput("chi_tiet_noi_o", "Chi tiết nơi ở", "input");
  body += mkInput("ghi_chu", "Ghi chú", "textarea");

  const sheet = document.getElementById("sheet");
  sheet.innerHTML =
    '<div class="sheet-h"><h2>' + (id === "__new__" ? "➕ Thêm người mới" : "✏️ Chỉnh sửa hồ sơ") + '</h2><button class="x" id="bClose">×</button></div>' +
    '<div class="sheet-b">' + body + '</div>' +
    '<div class="sheet-f">' +
    (id !== "__new__" ? '<button class="btn del" id="bDel">🗑 Xóa</button>' : '') +
    '<button class="btn primary" id="bSave">💾 Lưu thay đổi</button>' +
    '</div>';

  document.getElementById("overlay").classList.add("show");
  document.getElementById("bClose").onclick = closeEdit;
  document.getElementById("bSave").onclick = () => saveEdit(id);
  if (id !== "__new__") document.getElementById("bDel").onclick = () => delRec(id);

  // Phone input listener to show call button dynamically
  const phInput = sheet.querySelector("input[data-k='so_dt']");
  const callBtn = sheet.querySelector("#bCallNow");
  if (phInput && callBtn) {
    phInput.addEventListener("input", e => {
      const val = cleanPhone(e.target.value);
      if (val) {
        callBtn.style.display = "";
        callBtn.href = "tel:" + val;
      } else {
        callBtn.style.display = "none";
      }
    });
  }

  // Address translation buttons
  sheet.querySelectorAll(".btn-trans").forEach(b => {
    b.onclick = async () => {
      const fieldKey = b.dataset.field;
      const inp = sheet.querySelector(`input[data-k="${fieldKey}"]`);
      if (!inp || !inp.value.trim()) {
        toast("Vui lòng nhập địa chỉ cần dịch");
        return;
      }
      b.disabled = true;
      b.textContent = "⏳ Đang dịch…";
      try {
        const trans = await translateAddress(inp.value);
        if (trans && trans !== inp.value) {
          inp.value = trans;
          inp.classList.remove("field-pulse");
          void inp.offsetWidth; // reflow
          inp.classList.add("field-pulse");
          setTimeout(() => inp.classList.remove("field-pulse"), 2500);
          toast("Đã chuyển đổi sang tiếng Việt ✓");
        } else {
          toast("Địa chỉ đã ở dạng tiếng Việt chuẩn");
        }
      } catch (err) {
        toast("Không thể dịch địa chỉ");
      } finally {
        b.disabled = false;
        b.textContent = "🌐 Dịch TV";
      }
    };
  });

  wireImgEvents(id);
}

function delRec(id){
  if(!confirm("Xác nhận xóa người này?")){ return; }
  const i = DATA.findIndex(x => x.id === id);
  if(i >= 0){
    const p = DATA[i];
    p.deleted = true;
    queueChange(p);
    DATA.splice(i, 1);
    save();
    render();
    toast("Đã xóa");
    if(editBackRoom) openRoom(editBackRoom);
    else closeEdit();
  }
}

function closeEdit(){
  document.getElementById("overlay").classList.remove("show");
  editingId = null;
  editBackRoom = null;
}

/* ---------- Modal Thống Kê & Phân Tích Toàn Diện (Analytics Modal) ---------- */
let currentStatTab = "person"; // "person" | "room"

function showStats(initTab){
  if(initTab) currentStatTab = initTab;
  const sheet = document.getElementById("sheet");

  // Nhân sự data
  const byTo = {}, byLoai = { "Lao động": 0, "Gia thuộc": 0, "Khác": 0 };
  let muon = 0, hasPhoneCount = 0, countM = 0, countF = 0, under25 = 0, mid2540 = 0, over40 = 0;
  const roomsSet = new Set();
  let noRoomCount = 0;

  DATA.forEach(p => {
    byTo[p.to || "(trống)"] = (byTo[p.to || "(trống)"] || 0) + 1;
    byLoai[p.loai] = (byLoai[p.loai] || 0) + 1;
    if(isMuon(p)) muon++;
    if(getPhone(p)) hasPhoneCount++;
    if(p.phong_o) roomsSet.add(p.phong_o);
    else noRoomCount++;

    if(p.gioi_tinh === "M") countM++;
    else if(p.gioi_tinh === "F") countF++;

    const a = +displayAge(p);
    if(a > 0){
      if(a < 25) under25++;
      else if(a <= 40) mid2540++;
      else over40++;
    }
  });

  // Room analytics data
  const roomMap = {};
  DATA.forEach(p => {
    const r = roomKey(p);
    if(!roomMap[r]) roomMap[r] = [];
    roomMap[r].push(p);
  });

  const blockStats = {};
  let totalRoomsWithChu = 0;
  let totalRoomsNoChu = 0;
  const capDist = { "1": 0, "2-3": 0, "4-5": 0, "6+": 0 };
  const allInUseRooms = Object.keys(roomMap).filter(r => r !== NO_ROOM);

  allInUseRooms.forEach(r => {
    const ppl = roomMap[r];
    const blk = getRoomBlock(r);
    if(!blockStats[blk]){
      blockStats[blk] = { name: blk, rooms: 0, totalPpl: 0, ld: 0, gt: 0, other: 0, hasChu: 0, noChu: 0 };
    }
    const b = blockStats[blk];
    b.rooms++;
    b.totalPpl += ppl.length;
    ppl.forEach(p => {
      if(p.loai === "Lao động") b.ld++;
      else if(p.loai === "Gia thuộc") b.gt++;
      else b.other++;
    });

    const hasLeader = ppl.some(p => p.chu_phong);
    if(hasLeader){
      b.hasChu++;
      totalRoomsWithChu++;
    } else {
      b.noChu++;
      totalRoomsNoChu++;
    }

    if(ppl.length === 1) capDist["1"]++;
    else if(ppl.length <= 3) capDist["2-3"]++;
    else if(ppl.length <= 5) capDist["4-5"]++;
    else capDist["6+"]++;
  });

  const avgDensity = allInUseRooms.length > 0 ? ((DATA.length - noRoomCount) / allInUseRooms.length).toFixed(1) : 0;
  const leaderCoverage = allInUseRooms.length > 0 ? Math.round((totalRoomsWithChu / allInUseRooms.length) * 100) : 0;

  // TAB 1 HTML: Nhân sự
  let toTable = "";
  Object.keys(byTo).sort().forEach(k => {
    const cnt = byTo[k];
    const pct = Math.round((cnt / DATA.length) * 100);
    toTable += '<tr class="clickable-row" data-filter-to="'+esc(k)+'"><td><b>'+esc(k)+'</b></td><td>'+cnt+' người ('+pct+'%)</td></tr>';
  });

  const tabPersonHtml =
    '<div class="statgrid">'+
    '<div class="stat"><b>'+DATA.length+'</b><span>Tổng số người</span></div>'+
    '<div class="stat"><b>'+(byLoai["Lao động"]||0)+'</b><span>Lao động</span></div>'+
    '<div class="stat"><b>'+(byLoai["Gia thuộc"]||0)+'</b><span>Gia thuộc</span></div>'+
    '<div class="stat"><b>'+hasPhoneCount+'</b><span>Đã có Số ĐT 📞</span></div>'+
    '<div class="stat"><b>'+muon+'</b><span>Có tên mượn ⚑</span></div>'+
    '<div class="stat"><b>'+countM+' Nam / '+countF+' Nữ</b><span>Giới tính</span></div>'+
    '<div class="stat'+(noRoomCount>0?" stat-warn":"")+'"><b>'+noRoomCount+'</b><span>Chưa có phòng ⚠️</span></div>'+
    '<div class="stat"><b>'+DATA.filter(p=>p._edited).length+'</b><span>Đã chỉnh sửa ✎</span></div>'+
    '</div>'+
    '<table class="mini"><tr><td colspan="2"><b>📊 Phân bổ theo Tổ sản xuất</b> (Bấm dòng để lọc)</td></tr>'+toTable+'</table>'+
    '<table class="mini"><tr><td colspan="2"><b>🎂 Phân bổ Độ tuổi</b></td></tr>'+
    '<tr><td>Dưới 25 tuổi</td><td>'+under25+' người</td></tr>'+
    '<tr><td>25 đến 40 tuổi</td><td>'+mid2540+' người</td></tr>'+
    '<tr><td>Trên 40 tuổi</td><td>'+over40+' người</td></tr>'+
    '</table>';

  // TAB 2 HTML: Phòng ở & Phân loại
  let blockTable = "";
  const sortedBlocks = Object.values(blockStats).sort((a,b) => a.name.localeCompare(b.name, "vi", {numeric:true}));
  sortedBlocks.forEach(b => {
    const dens = b.rooms > 0 ? (b.totalPpl / b.rooms).toFixed(1) : 0;
    blockTable += '<tr class="clickable-row" data-filter-block="'+esc(b.name)+'">'+
      '<td><b>'+esc(b.name)+'</b></td>'+
      '<td>'+b.rooms+'</td>'+
      '<td>'+b.totalPpl+'</td>'+
      '<td>'+b.ld+' LĐ / '+b.gt+' GT</td>'+
      '<td>'+(b.hasChu>0?('👑 '+b.hasChu):"0")+'</td>'+
      '<td>'+dens+'</td>'+
      '</tr>';
  });

  const tabRoomHtml =
    '<div class="statgrid">'+
    '<div class="stat"><b>'+allInUseRooms.length+'</b><span>Tổng số phòng đang ở</span></div>'+
    '<div class="stat"><b>'+avgDensity+'</b><span>TB người / phòng</span></div>'+
    '<div class="stat"><b>'+totalRoomsWithChu+' ('+leaderCoverage+'%)</b><span>Đã có Chủ phòng 👑</span></div>'+
    '<div class="stat'+(totalRoomsNoChu>0?" stat-warn":"")+'"><b>'+totalRoomsNoChu+'</b><span>Chưa có Chủ phòng ⚠️</span></div>'+
    '<div class="stat"><b>'+(capDist["4-5"]+capDist["6+"])+'</b><span>Phòng đông (≥4 người)</span></div>'+
    '<div class="stat"><b>'+capDist["1"]+'</b><span>Phòng 1 người (đơn)</span></div>'+
    '</div>'+
    '<table class="mini"><tr><td colspan="2"><b>👥 Phân loại sức chứa phòng</b></td></tr>'+
    '<tr class="clickable-row" data-filter-cap="1"><td>Phòng 1 người (ở riêng)</td><td>'+capDist["1"]+' phòng</td></tr>'+
    '<tr class="clickable-row" data-filter-cap="2-3"><td>Phòng 2 - 3 người (vừa)</td><td>'+capDist["2-3"]+' phòng</td></tr>'+
    '<tr class="clickable-row" data-filter-cap="4+"><td>Phòng đông (4 người trở lên)</td><td>'+(capDist["4-5"]+capDist["6+"])+' phòng</td></tr>'+
    '</table>'+
    '<div style="font-size:12.5px;font-weight:700;margin:12px 0 6px;color:var(--green-d)">🏢 Thống kê chi tiết theo Dãy phòng (Bấm để xem phòng)</div>'+
    '<div class="stat-table-wrap">'+
    '<table class="mini" style="font-size:12px">'+
    '<thead><tr style="background:#eef2ef"><th style="text-align:left;padding:6px 4px">Dãy</th><th style="padding:6px 4px">Số phòng</th><th style="padding:6px 4px">Tổng người</th><th style="padding:6px 4px">Thành phần</th><th style="padding:6px 4px">Có Chủ 👑</th><th style="padding:6px 4px">Mật độ TB</th></tr></thead>'+
    '<tbody>'+blockTable+'</tbody>'+
    '</table></div>';

  sheet.innerHTML =
    '<div class="sheet-h">'+
    '<h2>📊 Thống kê & Phân tích hệ thống</h2>'+
    '<button class="x" id="bClose">×</button>'+
    '</div>'+
    '<div class="stat-tabs-bar">'+
    '<button class="stat-tab-btn'+(currentStatTab==="person"?" on":"")+'" id="sTabPerson">👥 Thống kê Nhân sự</button>'+
    '<button class="stat-tab-btn'+(currentStatTab==="room"?" on":"")+'" id="sTabRoom">🏠 Thống kê & Dãy phòng</button>'+
    '</div>'+
    '<div class="statbox">'+(currentStatTab==="person" ? tabPersonHtml : tabRoomHtml)+'</div>';

  document.getElementById("overlay").classList.add("show");
  document.getElementById("bClose").onclick = closeEdit;

  document.getElementById("sTabPerson").onclick = () => showStats("person");
  document.getElementById("sTabRoom").onclick = () => showStats("room");

  // Clickable rows in stats to apply filters
  sheet.querySelectorAll(".clickable-row").forEach(row => {
    row.onclick = () => {
      closeEdit();
      if(row.dataset.filterTo){
        state.to = row.dataset.filterTo;
        document.getElementById("fTo").value = state.to;
        setView("people");
      } else if(row.dataset.filterBlock){
        state.roomBlock = row.dataset.filterBlock;
        const sel = document.getElementById("fRoomBlock");
        if(sel) sel.value = state.roomBlock;
        setView("rooms");
      } else if(row.dataset.filterCap){
        state.roomCap = row.dataset.filterCap;
        const sel = document.getElementById("fRoomCap");
        if(sel) sel.value = state.roomCap;
        setView("rooms");
      }
    };
  });
}

/* ---------- Switch View (People vs Rooms) ---------- */
function setView(v){
  state.view = v;
  hideSugg();
  document.getElementById("tabPeople").classList.toggle("on", v === "people");
  document.getElementById("tabRooms").classList.toggle("on", v === "rooms");
  document.getElementById("bAdd").style.display = v === "people" ? "" : "none";

  const pplFilters = document.getElementById("peopleFilters");
  const roomFilters = document.getElementById("roomFilters");
  if(pplFilters) pplFilters.style.display = v === "people" ? "" : "none";
  if(roomFilters) roomFilters.style.display = v === "rooms" ? "" : "none";

  document.getElementById("q").placeholder = v === "rooms" ? "Tìm mã phòng, tên người hoặc SĐT…" : "Tìm tên, CMND, SĐT, phòng, phần cây…";
  render();
}

/* ---------- Populate Dynamic Select Options ---------- */
function initFilterOptions(){
  const fTo = document.getElementById("fTo");
  if(fTo){
    fTo.innerHTML = '<option value="">Tất cả tổ</option>' + TO_LIST.map(t => '<option value="'+t+'">'+t+'</option>').join("");
  }

  const fRoomBlock = document.getElementById("fRoomBlock");
  if(fRoomBlock){
    const blocks = allRoomBlocks();
    fRoomBlock.innerHTML = '<option value="">Tất cả Dãy phòng</option>' + blocks.map(b => '<option value="'+b+'">'+b+'</option>').join("");
  }
}

/* ---------- Excel Import & Export ---------- */
const EXPORT_COLS = [
  ["STT", p => ""],
  ["CMND", "cmnd"],
  ["HỌ VÀ TÊN (Tên thật)", "ten_that"],
  ["TÊN TRONG HỒ SƠ", "ten_ho_so"],
  ["Tên mượn?", p => isMuon(p) ? "x" : ""],
  ["Ngày sinh", "ngay_sinh"],
  ["Tuổi", p => displayAge(p)],
  ["Nơi sinh", "noi_sinh"],
  ["Giới tính", "gioi_tinh"],
  ["Loại", "loai"],
  ["Chủ phòng", p => p.chu_phong ? "x" : ""],
  ["Tổ", "to"],
  ["Khu vực", "khu_vuc"],
  ["Phần cây hiện tại", "phan_cay"],
  ["Quan hệ", "quan_he"],
  ["PHÒNG Ở", "phong_o"],
  ["Số bảo hiểm", "so_bao_hiem"],
  ["Số điện thoại", p => getPhone(p)],
  ["Chi tiết nơi ở", "chi_tiet_noi_o"],
  ["Địa chỉ thường trú", "dia_chi"],
  ["Ghi chú", "ghi_chu"],
];

function exportXlsx(){
  const head = EXPORT_COLS.map(c => c[0]);
  const aoa = [head];
  const rows = filtered();

  rows.forEach((p, i) => {
    aoa.push(EXPORT_COLS.map(c => {
      if(c[0] === "STT") return i + 1;
      const f = c[1];
      const val = typeof f === "function" ? f(p) : (p[f] || "");
      return val != null ? String(val) : "";
    }));
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = head.map((h, i) => ({ wch: i===2||i===3||i===16||i===17?26:(i===18?30:14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tổng");
  const d = new Date();
  const fn = "Du lieu Cong nhan DSX02 - cap nhat " + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + ".xlsx";
  XLSX.writeFile(wb, fn);
  toast("Đã xuất " + rows.length + " dòng ra Excel");
}

function importXlsx(file){
  const rd = new FileReader();
  rd.onload = e => {
    try{
      const wb = XLSX.read(e.target.result, { type: "binary" });
      const sh = wb.Sheets["Tổng"] || wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sh, { header: 1, raw: false });

      let hr = -1;
      for(let i = 0; i < Math.min(aoa.length, 15); i++){
        const j = noAccent((aoa[i] || []).join("|"));
        if(j.includes("cmnd") && (j.includes("ho va ten") || j.includes("ten that"))){ hr = i; break; }
      }
      if(hr < 0){ toast("Không nhận ra cột tiêu đề"); return; }
      const H = aoa[hr].map(x => noAccent(x));
      const find = (...keys) => H.findIndex(h => keys.some(k => h.includes(k)));
      const idx = {
        cmnd: find("cmnd"),
        ten_that: find("ten that", "ho va ten"),
        ten_ho_so: find("ho so"),
        ngay_sinh: find("ngay sinh"),
        tuoi: find("tuoi"),
        gioi_tinh: find("gioi"),
        phan_cay: find("phan cay"),
        khu_vuc: find("khu vuc"),
        to: H.findIndex(h => h === "to" || h.startsWith("to ")),
        quan_he: find("quan he"),
        loai: find("loai"),
        phong_o: find("phong"),
        so_bao_hiem: find("bao hiem"),
        chi_tiet_noi_o: find("chi tiet"),
        dia_chi: find("dia chi"),
        so_dt: find("so dien thoai", "dien thoai", "sdt", "so dt", "phone", "mobile", "zalo", "tel", "lien he"),
        ghi_chu: find("ghi chu")
      };

      const out = [];
      let id = 1;
      for(let i = hr + 1; i < aoa.length; i++){
        const r = aoa[i] || [];
        const g = k => idx[k] >= 0 ? (r[idx[k]] == null ? "" : ("" + r[idx[k]]).trim()) : "";
        const ten = g("ten_that"), cmnd = g("cmnd");
        if(!ten && !cmnd) continue;
        const rec = { id: id++ };
        for(const [k] of FIELDS) rec[k] = g(k);
        if(!rec.to){
          const m = (rec.khu_vuc || "").toUpperCase().match(/KV\s*([1-8])/);
          if(m) rec.to = "Tổ " + m[1];
        }
        if(!rec.loai) rec.loai = rec.phan_cay ? "Lao động" : "Gia thuộc";
        rec.so_dt = getPhone(rec);
        rec.sdt = rec.so_dt;
        out.push(rec);
      }
      if(!out.length){ toast("Không đọc được dòng nào"); return; }
      if(confirm("Nhập " + out.length + " người từ Excel? (Ghi đè dữ liệu hiện tại)")){
        DATA = out;
        save();
        initFilterOptions();
        render();
        toast("Đã nhập " + out.length + " người");
      }
    }catch(err){
      toast("Lỗi đọc file: " + err.message);
    }
  };
  rd.readAsBinaryString(file);
}

/* ---------- Cloud Sync & Settings Integration ---------- */
let CFG = {
  url: (window.__CFG_DEFAULT && window.__CFG_DEFAULT.url) || "",
  key: (window.__CFG_DEFAULT && window.__CFG_DEFAULT.key) || "",
  user: (window.__CFG_DEFAULT && window.__CFG_DEFAULT.user) || ""
};

try{
  const s = localStorage.getItem("cn_cfg_v1");
  if(s) CFG = Object.assign({}, CFG, JSON.parse(s));
}catch(e){}

let ROLE = null;
function isGuest(){ return ROLE === "guest"; }

async function api(act, data){
  if(!CFG.url) throw new Error("Chưa cấu hình máy chủ");
  const payload = Object.assign({ act, key: CFG.key, user: CFG.user }, data || {});
  const res = await fetch(CFG.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

function queueChange(p){
  try{
    const q = JSON.parse(localStorage.getItem("cn_queue_v1") || "[]");
    const i = q.findIndex(x => x.id === p.id);
    if(i >= 0) q[i] = p; else q.push(p);
    localStorage.setItem("cn_queue_v1", JSON.stringify(q));
    updateSyncBadge();
  }catch(e){}
}

function updateSyncBadge(){
  try{
    const q = JSON.parse(localStorage.getItem("cn_queue_v1") || "[]");
    const b = document.getElementById("syncBadge");
    if(b){
      if(q.length > 0){
        b.style.display = "";
        b.textContent = "☁️ +" + q.length;
      } else {
        b.style.display = "none";
      }
    }
  }catch(e){}
}

function getPendImg(){ try{ return JSON.parse(localStorage.getItem("cn_pendimg_v1")||"[]"); }catch(e){ return []; } }
function setPendImg(a){ localStorage.setItem("cn_pendimg_v1", JSON.stringify(a)); }
function addPendImg(k){ const a=getPendImg(); if(!a.includes(k)){ a.push(k); setPendImg(a); } }
function getPendDel(){ try{ return JSON.parse(localStorage.getItem("cn_penddel_v1")||"[]"); }catch(e){ return []; } }
function setPendDel(a){ localStorage.setItem("cn_penddel_v1", JSON.stringify(a)); }
function addPendDel(k){ const a=getPendDel(); if(!a.includes(k)){ a.push(k); setPendDel(a); } }

function normServerRec(o){
  const r = {};
  for(const [k] of FIELDS) r[k] = o[k] != null ? o[k] : "";
  r.id = +o.id || o.id;
  r.chu_phong = (o.chu_phong === true || o.chu_phong === "true" || o.chu_phong === "x");
  r.deleted = (o.deleted === true || o.deleted === "true" || o.deleted === "x");
  r.so_dt = getPhone(r);
  r.sdt = r.so_dt;
  return r;
}

async function fetchServerImages(imgs, deleted){
  let map = {};
  try{ map = JSON.parse(localStorage.getItem("cn_imgfiles_v1") || "{}"); }catch(e){}
  let mapChanged = false;

  for(const id in imgs){
    for(const t in imgs[id]){
      const key = t + ":" + id;
      const fid = imgs[id][t];
      if(fid && map[key] !== fid){
        map[key] = fid;
        mapChanged = true;
      }
    }
  }
  if(deleted){
    for(const id in deleted){
      for(const t in deleted[id]){
        const key = t + ":" + id;
        if(IMG_OVR[key] !== DEL){ IMG_OVR[key] = DEL; idbPut(key, DEL); }
        if(map[key]){ delete map[key]; mapChanged = true; }
      }
    }
  }
  if(mapChanged){
    localStorage.setItem("cn_imgfiles_v1", JSON.stringify(map));
  }
}

async function syncNow(silent){
  if(!CFG.url){ if(!silent) toast("Chưa cấu hình máy chủ (⚙️ Cài đặt)"); return; }
  if(!ROLE){ const ok = await connect(); if(!ok) return; }
  if(!silent) toast("Đang đồng bộ…");

  try{
    let pend = getPendImg();
    const stillP = [];
    for(const k of pend){
      const [t, id] = k.split(":");
      const uri = getImg(id, t);
      if(!uri) continue;
      try{
        const r = await api("uploadImage", { id: id, type: t, dataUrl: uri });
        if(!r.ok) stillP.push(k);
      }catch(e){ stillP.push(k); }
    }
    setPendImg(stillP);

    let pendD = getPendDel();
    const stillD = [];
    for(const k of pendD){
      const [t, id] = k.split(":");
      try{
        const r = await api("deleteImage", { id: id, type: t });
        if(!r.ok) stillD.push(k);
      }catch(e){ stillD.push(k); }
    }
    setPendDel(stillD);

    const q = JSON.parse(localStorage.getItem("cn_queue_v1") || "[]");
    const res = await api("sync", { records: q });
    if(!res.ok){ toast("Lỗi: " + res.err); return; }

    localStorage.removeItem("cn_queue_v1");
    updateSyncBadge();

    if(Array.isArray(res.data) && res.data.length > 0){
      DATA = res.data.map(normServerRec);
      save();
      initFilterOptions();
      render();
    }
    if(res.images) fetchServerImages(res.images, res.deletedImages);
    if(!silent) toast("Đồng bộ thành công ✓");
  }catch(e){
    if(!silent) toast("Không kết nối được máy chủ");
  }
}

async function connect(){
  try{
    const r = await api("ping");
    if(r.ok){
      ROLE = r.role || "guest";
      applyRole();
      return true;
    } else {
      toast("Lỗi khóa: " + r.err);
      return false;
    }
  }catch(e){
    toast("Không kết nối được: " + e.message);
    return false;
  }
}

function applyRole(){
  const ban = document.getElementById("roleBanner");
  if(ban){
    if(isGuest()){
      ban.style.display = "";
      ban.textContent = "⭐ Chế độ VIP — Đang kết nối máy chủ Google Drive/Apps Script.";
    } else {
      ban.style.display = "none";
    }
  }
  const lb = document.getElementById("bLog");
  if(lb) lb.style.display = (ROLE === "admin") ? "" : "none";
  document.getElementById("bAdd").style.display = (state.view === "people") ? "" : "none";
}

function openSettings(){
  const s = document.getElementById("sheet");
  const v = k => document.getElementById(k).value.trim();
  s.innerHTML =
    '<div class="sheet-h"><h2>⚙️ Cài đặt đồng bộ</h2><button class="x" id="bClose">×</button></div>'+
    '<div class="sheet-b">'+
    '<div class="fld"><label>Web App URL (Google Apps Script)</label><input id="cUrl" value="'+esc(CFG.url)+'" placeholder="https://script.google.com/macros/s/.../exec"></div>'+
    '<div class="fld"><label>Mã bảo mật (Key kết nối)</label><input id="cKey" type="password" value="'+esc(CFG.key)+'" placeholder="Nhập key kết nối"></div>'+
    '<div class="fld"><label>Tên người dùng (Tùy chọn)</label><input id="cUser" value="'+esc(CFG.user)+'" placeholder="Ví dụ: QuanLy_01"></div>'+
    '<div style="font-size:12.5px;color:var(--muted);margin-top:8px">Kết nối với Google Apps Script giúp tự động sao lưu ảnh chân dung, CMND lên Google Drive và đồng bộ dữ liệu giữa các thiết bị.</div>'+
    '</div>'+
    '<div class="sheet-f"><button class="btn primary" id="bSaveCfg">💾 Lưu & Kết nối</button></div>';

  document.getElementById("overlay").classList.add("show");
  document.getElementById("bClose").onclick = closeEdit;
  document.getElementById("bSaveCfg").onclick = async () => {
    CFG = { url: v("cUrl"), key: v("cKey"), user: v("cUser") };
    localStorage.setItem("cn_cfg_v1", JSON.stringify(CFG));
    toast("Đang thử kết nối…");
    const ok = await connect();
    if(ok){ toast("Kết nối thành công! Đang đồng bộ…"); syncNow(true); closeEdit(); }
  };
}

/* ---------- Toast Notification ---------- */
let _toastT = null;
function toast(msg){
  const el = document.getElementById("toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(_toastT);
  _toastT = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- Init & Event Listeners ---------- */
document.addEventListener("DOMContentLoaded", () => {
  idbOpen().then(idbAll).then(() => {
    initFilterOptions();
    render();
    updateSyncBadge();
    if(CFG.url) connect().then(ok => { if(ok) syncNow(true); });
  });
});

// Search input
const qEl = document.getElementById("q");
if(qEl){
  qEl.addEventListener("input", e => {
    state.q = e.target.value;
    renderSugg();
    render();
  });
  qEl.addEventListener("focus", renderSugg);
}

document.addEventListener("click", e => {
  if(!e.target.closest(".searchbar")) hideSugg();
});

const suggEl = document.getElementById("sugg");
if(suggEl){
  suggEl.addEventListener("click", e => {
    const r = e.target.closest(".sgrow");
    if(!r) return;
    const id = +r.dataset.id;
    hideSugg();
    openEdit(id);
  });
}

// Filters - People
const fToEl = document.getElementById("fTo");
if(fToEl) fToEl.addEventListener("change", e => { state.to = e.target.value; render(); });

const fLoaiEl = document.getElementById("fLoai");
if(fLoaiEl) fLoaiEl.addEventListener("change", e => { state.loai = e.target.value; render(); });

const cMuonEl = document.getElementById("cMuon");
if(cMuonEl) cMuonEl.addEventListener("click", () => {
  state.muon = !state.muon;
  cMuonEl.classList.toggle("on", state.muon);
  render();
});

const cPhoneEl = document.getElementById("cPhone");
if(cPhoneEl) cPhoneEl.addEventListener("click", () => {
  state.hasPhone = !state.hasPhone;
  cPhoneEl.classList.toggle("on", state.hasPhone);
  render();
});

// Filters - Room Categorization
const fRoomBlockEl = document.getElementById("fRoomBlock");
if(fRoomBlockEl) fRoomBlockEl.addEventListener("change", e => { state.roomBlock = e.target.value; render(); });

const fRoomCapEl = document.getElementById("fRoomCap");
if(fRoomCapEl) fRoomCapEl.addEventListener("change", e => { state.roomCap = e.target.value; render(); });

const fRoomChuEl = document.getElementById("fRoomChu");
if(fRoomChuEl) fRoomChuEl.addEventListener("change", e => { state.roomChu = e.target.value; render(); });

const fRoomTypeEl = document.getElementById("fRoomType");
if(fRoomTypeEl) fRoomTypeEl.addEventListener("change", e => { state.roomType = e.target.value; render(); });

// List click (Cards)
const listEl = document.getElementById("list");
if(listEl){
  listEl.addEventListener("click", e => {
    const c = e.target.closest(".card");
    if(!c) return;
    if(state.view === "rooms"){
      openRoom(c.dataset.room);
    } else {
      const id = DATA.find(x => "" + x.id === c.dataset.id)?.id;
      if(id) openEdit(id);
    }
  });
}

// Toolbar buttons
document.getElementById("tabPeople").onclick = () => setView("people");
document.getElementById("tabRooms").onclick = () => setView("rooms");
document.getElementById("bAdd").onclick = () => openEdit("__new__");
document.getElementById("bExport").onclick = exportXlsx;
document.getElementById("bStat").onclick = () => showStats(state.view === "rooms" ? "room" : "person");
document.getElementById("bImport").onclick = () => document.getElementById("fileImport").click();
document.getElementById("fileImport").addEventListener("change", e => {
  if(e.target.files[0]) importXlsx(e.target.files[0]);
  e.target.value = "";
});
document.getElementById("bSync").onclick = () => syncNow(false);
document.getElementById("bSettings").onclick = openSettings;
document.getElementById("bReset").onclick = () => {
  if(confirm("Đặt lại về dữ liệu gốc ban đầu? Mọi chỉnh sửa cục bộ sẽ đặt lại.")){
    localStorage.removeItem(LS_KEY);
    DATA = clone(getBaseData()).map(p => {
      p.so_dt = getPhone(p);
      p.sdt = p.so_dt;
      return p;
    });
    save();
    initFilterOptions();
    render();
    toast("Đã đặt lại dữ liệu gốc");
  }
};

// Initial sync call
initFilterOptions();
render();
