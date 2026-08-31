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

function rotateImage(uri, angle = 90) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const rad = (angle * Math.PI) / 180;
        const sin = Math.abs(Math.sin(rad));
        const cos = Math.abs(Math.cos(rad));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * cos + img.height * sin);
        canvas.height = Math.round(img.width * sin + img.height * cos);
        const ctx = canvas.getContext("2d");
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (e) {
        resolve(uri);
      }
    };
    img.onerror = () => resolve(uri);
    img.src = uri;
  });
}

function flipImage(uri, horizontal = true) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (horizontal) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        } else {
          ctx.translate(0, canvas.height);
          ctx.scale(1, -1);
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (e) {
        resolve(uri);
      }
    };
    img.onerror = () => resolve(uri);
    img.src = uri;
  });
}

// Computer Vision Smart Border & Edge Detector for ID Cards (Client-side Fallback & AI Hybrid)
function smartComputerVisionCrop(img) {
  try {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (srcW < 50 || srcH < 50) return null;

    // Use a normalized analysis canvas for edge gradient & color variance analysis
    const aW = Math.min(400, srcW);
    const aH = Math.round(srcH * (aW / srcW));
    const aCanvas = document.createElement("canvas");
    aCanvas.width = aW;
    aCanvas.height = aH;
    const aCtx = aCanvas.getContext("2d", { willReadFrequently: true });
    aCtx.drawImage(img, 0, 0, aW, aH);

    const imgData = aCtx.getImageData(0, 0, aW, aH);
    const data = imgData.data;

    // Helper: get grayscale brightness at (x, y)
    const getLum = (x, y) => {
      const idx = (y * aW + x) * 4;
      return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    };

    // Calculate background reference brightness from the 4 outer corner zones (top-left, top-right, bottom-left, bottom-right)
    const cornerSamples = [];
    const cornerSize = Math.max(3, Math.floor(Math.min(aW, aH) * 0.04));
    for (let dy = 0; dy < cornerSize; dy++) {
      for (let dx = 0; dx < cornerSize; dx++) {
        cornerSamples.push(getLum(dx, dy)); // TL
        cornerSamples.push(getLum(aW - 1 - dx, dy)); // TR
        cornerSamples.push(getLum(dx, aH - 1 - dy)); // BL
        cornerSamples.push(getLum(aW - 1 - dx, aH - 1 - dy)); // BR
      }
    }
    const bgLum = cornerSamples.reduce((s, v) => s + v, 0) / (cornerSamples.length || 1);

    // Scan from Top (0 to 30% of height)
    let topCut = 0;
    const maxScanY = Math.floor(aH * 0.28);
    for (let y = 1; y < maxScanY; y++) {
      let rowDiff = 0;
      for (let x = Math.floor(aW * 0.2); x < Math.floor(aW * 0.8); x += 2) {
        const lum = getLum(x, y);
        const prevLum = getLum(x, y - 1);
        rowDiff += Math.abs(lum - prevLum) + Math.abs(lum - bgLum) * 0.3;
      }
      const avgDiff = rowDiff / (aW * 0.3);
      if (avgDiff > 14) {
        topCut = Math.max(0, y - 1);
        break;
      }
    }

    // Scan from Bottom (aH-1 down to 70% of height)
    let bottomCut = 0;
    const minScanY = Math.floor(aH * 0.72);
    for (let y = aH - 2; y > minScanY; y--) {
      let rowDiff = 0;
      for (let x = Math.floor(aW * 0.2); x < Math.floor(aW * 0.8); x += 2) {
        const lum = getLum(x, y);
        const nextLum = getLum(x, y + 1);
        rowDiff += Math.abs(lum - nextLum) + Math.abs(lum - bgLum) * 0.3;
      }
      const avgDiff = rowDiff / (aW * 0.3);
      if (avgDiff > 14) {
        bottomCut = Math.max(0, (aH - 1) - (y + 1));
        break;
      }
    }

    // Scan from Left (0 to 30% of width)
    let leftCut = 0;
    const maxScanX = Math.floor(aW * 0.28);
    for (let x = 1; x < maxScanX; x++) {
      let colDiff = 0;
      for (let y = Math.floor(aH * 0.2); y < Math.floor(aH * 0.8); y += 2) {
        const lum = getLum(x, y);
        const prevLum = getLum(x - 1, y);
        colDiff += Math.abs(lum - prevLum) + Math.abs(lum - bgLum) * 0.3;
      }
      const avgDiff = colDiff / (aH * 0.3);
      if (avgDiff > 14) {
        leftCut = Math.max(0, x - 1);
        break;
      }
    }

    // Scan from Right (aW-1 down to 70% of width)
    let rightCut = 0;
    const minScanX = Math.floor(aW * 0.72);
    for (let x = aW - 2; x > minScanX; x--) {
      let colDiff = 0;
      for (let y = Math.floor(aH * 0.2); y < Math.floor(aH * 0.8); y += 2) {
        const lum = getLum(x, y);
        const nextLum = getLum(x + 1, y);
        colDiff += Math.abs(lum - nextLum) + Math.abs(lum - bgLum) * 0.3;
      }
      const avgDiff = colDiff / (aH * 0.3);
      if (avgDiff > 14) {
        rightCut = Math.max(0, (aW - 1) - (x + 1));
        break;
      }
    }

    // If edges are minimal/not detected, apply a clean 3.5% border trim to remove dark margin/vignettes
    let pLeft = leftCut > 0 ? leftCut / aW : 0.035;
    let pRight = rightCut > 0 ? rightCut / aW : 0.035;
    let pTop = topCut > 0 ? topCut / aH : 0.035;
    let pBottom = bottomCut > 0 ? bottomCut / aH : 0.035;

    // Safety clamps: never cut more than 28% from any edge
    pLeft = Math.min(0.28, Math.max(0.015, pLeft));
    pRight = Math.min(0.28, Math.max(0.015, pRight));
    pTop = Math.min(0.28, Math.max(0.015, pTop));
    pBottom = Math.min(0.28, Math.max(0.015, pBottom));

    const sx = Math.round(srcW * pLeft);
    const sy = Math.round(srcH * pTop);
    const sw = Math.round(srcW * (1 - pLeft - pRight));
    const sh = Math.round(srcH * (1 - pTop - pBottom));

    if (sw < 50 || sh < 50) return null;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = sw;
    outCanvas.height = sh;
    const outCtx = outCanvas.getContext("2d");
    outCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    return outCanvas.toDataURL("image/jpeg", 0.94);
  } catch (err) {
    return null;
  }
}

function aiCropCard(uri) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;

      // 1. First attempt: Cloud Vision AI Bounding Box Detection
      try {
        const res = await fetch("/api/detect-card-bounds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: uri })
        });
        const json = await res.json();
        if (json.ok && json.data && json.data.detected && json.data.ymin != null) {
          const { ymin, xmin, ymax, xmax } = json.data;
          if (ymax > ymin && xmax > xmin && (xmax - xmin) > 80 && (ymax - ymin) > 80) {
            // Pad 0.5% margin around detected bounds to ensure edge text/corners remain fully intact
            const padX = Math.round(srcW * 0.005);
            const padY = Math.round(srcH * 0.005);

            const sx = Math.max(0, Math.round((xmin / 1000) * srcW) - padX);
            const sy = Math.max(0, Math.round((ymin / 1000) * srcH) - padY);
            const ex = Math.min(srcW, Math.round((xmax / 1000) * srcW) + padX);
            const ey = Math.min(srcH, Math.round((ymax / 1000) * srcH) + padY);

            const sw = ex - sx;
            const sh = ey - sy;

            if (sw > 30 && sh > 30) {
              const canvas = document.createElement("canvas");
              canvas.width = sw;
              canvas.height = sh;
              const ctx = canvas.getContext("2d");
              
              // Strictly crop original pixels only - NEVER modify or distort original text/photos
              ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
              const croppedUri = canvas.toDataURL("image/jpeg", 0.94);
              resolve({ ok: true, uri: croppedUri, msg: "Đã nhận diện & cắt viền CMND bằng AI thành công!" });
              return;
            }
          }
        }
      } catch (aiErr) {
        // Fall through to smart Computer Vision edge detector
      }

      // 2. High-Precision Client-Side Smart Edge & Contour Detector (Always works even offline/quota limit)
      const cvCropped = smartComputerVisionCrop(img);
      if (cvCropped) {
        resolve({ ok: true, uri: cvCropped, msg: "Đã nhận diện & cắt gọn viền thẻ CMND!" });
      } else {
        resolve({ ok: false, reason: "Ảnh khó nhận diện tự động, vui lòng chọn Cắt viền thủ công.", uri });
      }
    };
    img.onerror = () => resolve({ ok: false, reason: "Không tải được ảnh gốc", uri });
    img.src = uri;
  });
}

function openManualCropModal(id, type, label, onDone) {
  const uri = getImg(id, type);
  if (!uri) return;

  const existing = document.getElementById("cropModalWrap");
  if (existing) existing.remove();

  const wrap = document.createElement("div");
  wrap.id = "cropModalWrap";
  wrap.className = "crop-modal-overlay";

  wrap.innerHTML = `
    <div class="crop-modal-card">
      <div class="crop-modal-header">
        <h3>✂️ Cắt viền CMND / Căn chỉnh</h3>
        <button type="button" class="x" id="bCloseCrop" title="Đóng">&times;</button>
      </div>
      <div class="crop-modal-body">
        <div class="crop-presets">
          <span style="font-size:11.5px;font-weight:700;color:#64748b;align-self:center;">Mẫu sẵn:</span>
          <button type="button" class="crop-preset-btn" data-preset="std">Chuẩn 16:10</button>
          <button type="button" class="crop-preset-btn" data-preset="trim5">Cắt viền 5%</button>
          <button type="button" class="crop-preset-btn" data-preset="trim10">Cắt viền 10%</button>
          <button type="button" class="crop-preset-btn" data-preset="reset">Gốc 100%</button>
        </div>
        <div class="crop-preview-wrap">
          <canvas id="cropCanvas"></canvas>
        </div>
        <div class="crop-controls-grid">
          <div class="crop-ctrl-item">
            <label>Cắt Trên: <span id="vCropTop">0%</span></label>
            <input type="range" id="slCropTop" min="0" max="35" value="0">
          </div>
          <div class="crop-ctrl-item">
            <label>Cắt Dưới: <span id="vCropBottom">0%</span></label>
            <input type="range" id="slCropBottom" min="0" max="35" value="0">
          </div>
          <div class="crop-ctrl-item">
            <label>Cắt Trái: <span id="vCropLeft">0%</span></label>
            <input type="range" id="slCropLeft" min="0" max="35" value="0">
          </div>
          <div class="crop-ctrl-item">
            <label>Cắt Phải: <span id="vCropRight">0%</span></label>
            <input type="range" id="slCropRight" min="0" max="35" value="0">
          </div>
        </div>
      </div>
      <div class="crop-modal-footer">
        <button type="button" class="btn" id="bCancelCrop" style="flex:1;">Hủy</button>
        <button type="button" class="btn primary" id="bApplyCrop" style="flex:2;">✓ Áp dụng cắt viền</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  const img = new Image();
  img.onload = () => {
    const canvas = wrap.querySelector("#cropCanvas");
    const ctx = canvas.getContext("2d");

    const slTop = wrap.querySelector("#slCropTop");
    const slBottom = wrap.querySelector("#slCropBottom");
    const slLeft = wrap.querySelector("#slCropLeft");
    const slRight = wrap.querySelector("#slCropRight");

    const vTop = wrap.querySelector("#vCropTop");
    const vBottom = wrap.querySelector("#vCropBottom");
    const vLeft = wrap.querySelector("#vCropLeft");
    const vRight = wrap.querySelector("#vCropRight");

    function renderCropPreview() {
      const pTop = parseInt(slTop.value, 10) / 100;
      const pBottom = parseInt(slBottom.value, 10) / 100;
      const pLeft = parseInt(slLeft.value, 10) / 100;
      const pRight = parseInt(slRight.value, 10) / 100;

      vTop.textContent = slTop.value + "%";
      vBottom.textContent = slBottom.value + "%";
      vLeft.textContent = slLeft.value + "%";
      vRight.textContent = slRight.value + "%";

      const x = Math.round(img.width * pLeft);
      const y = Math.round(img.height * pTop);
      const w = Math.max(10, Math.round(img.width * (1 - pLeft - pRight)));
      const h = Math.max(10, Math.round(img.height * (1 - pTop - pBottom)));

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    }

    [slTop, slBottom, slLeft, slRight].forEach(sl => {
      sl.oninput = renderCropPreview;
    });

    wrap.querySelectorAll("[data-preset]").forEach(btn => {
      btn.onclick = () => {
        const pr = btn.dataset.preset;
        if (pr === "trim5") {
          slTop.value = 5; slBottom.value = 5; slLeft.value = 5; slRight.value = 5;
        } else if (pr === "trim10") {
          slTop.value = 10; slBottom.value = 10; slLeft.value = 10; slRight.value = 10;
        } else if (pr === "std") {
          slTop.value = 4; slBottom.value = 4; slLeft.value = 4; slRight.value = 4;
        } else {
          slTop.value = 0; slBottom.value = 0; slLeft.value = 0; slRight.value = 0;
        }
        renderCropPreview();
      };
    });

    renderCropPreview();

    wrap.querySelector("#bApplyCrop").onclick = () => {
      const croppedUri = canvas.toDataURL("image/jpeg", 0.92);
      wrap.remove();
      if (onDone) onDone(croppedUri);
    };
  };

  img.src = uri;

  const close = () => wrap.remove();
  wrap.querySelector("#bCloseCrop").onclick = close;
  wrap.querySelector("#bCancelCrop").onclick = close;
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
}

function renderDriveBadge(driveUrl) {
  if (!driveUrl) return "";
  return '<a href="' + driveUrl + '" target="_blank" rel="noopener noreferrer" class="drive-badge-link" style="display:inline-flex;align-items:center;gap:4px;background:#0f766e;color:#ffffff;border:1px solid #0d9488;font-size:12px;font-weight:700;padding:3px 8px;border-radius:6px;text-decoration:none;box-shadow:0 1px 2px rgba(15,118,110,0.25);line-height:1.2;cursor:pointer;" title="Mở file gốc trên Google Drive">' +
    '<span style="font-size:12px;line-height:1;">☁️</span>' +
    '<span style="text-decoration:none;color:#ffffff;">Drive</span>' +
  '</a>';
}

function renderImgSlot(id, type, label) {
  const uri = getImg(id, type);
  const fid = imgFileId(id, type);
  const driveUrl = getDriveFileUrl(id, type);

  let h = '<div class="islot">';
  h += '<div class="ilabel" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
  h += '<span style="font-weight:700;color:var(--text);font-size:13px;">' + esc(label) + '</span>';
  if (fid && driveUrl) {
    h += renderDriveBadge(driveUrl);
  }
  h += '</div>';

  if (uri) {
    h += '<div class="thumbwrap" style="position:relative;cursor:pointer;border-radius:10px;overflow:hidden;background:#f7f9f8;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;min-height:140px;" title="Bấm để xem ảnh gốc / phóng to" data-img-act="preview" data-img-type="' + type + '">';
    h += '<img class="thumbimg" src="' + uri + '" alt="' + esc(label) + '" style="max-height:240px;width:100%;object-fit:contain;border:none;background:transparent;">';
    h += '<div class="thumb-overlay" style="position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,0.68);color:#fff;font-size:11.5px;padding:3px 9px;border-radius:6px;backdrop-filter:blur(2px);font-weight:600;">🔍 Xem lớn</div>';
    h += '</div>';

    h += '<div class="ibtns">';
    if (type === "cmnd") {
      h += '<button type="button" class="btn mini-b btn-ocr" data-img-act="ocr" title="Đọc thông tin CMND & Dịch địa chỉ">⚡ Đọc CMND & Dịch</button>';
      h += '<div class="img-dropdown-wrap">';
      h += '<button type="button" class="btn mini-b btn-tool-secondary" data-dropdown-toggle title="Danh sách công cụ xử lý ảnh">⚙️ Công cụ ▾</button>';
      h += '<div class="img-dropdown-menu">';
      h += '<button type="button" class="img-dropdown-item" data-img-act="ai-crop" data-img-type="cmnd" title="AI tự động nhận diện khung viền CMND và cắt bỏ chi tiết thừa">✂️ AI Cắt viền CMND</button>';
      h += '<button type="button" class="img-dropdown-item" data-img-act="manual-crop" data-img-type="cmnd" title="Cắt viền và căn chỉnh kích thước thủ công">📐 Cắt viền thủ công</button>';
      h += '<div class="img-dropdown-divider"></div>';
      h += '<button type="button" class="img-dropdown-item" data-img-act="rotate" data-img-type="cmnd">🔄 Xoay 90°</button>';
      h += '<button type="button" class="img-dropdown-item" data-img-act="flip" data-img-type="cmnd">↔️ Lật ảnh</button>';
      h += '<div class="img-dropdown-divider"></div>';
      h += '<button type="button" class="img-dropdown-item" data-img-act="change" data-img-type="cmnd">📷 Đổi ảnh mới</button>';
      h += '<button type="button" class="img-dropdown-item" data-img-act="download" data-img-type="cmnd" data-img-label="Ảnh CMND">⬇ Tải ảnh về máy</button>';
      h += '<div class="img-dropdown-divider"></div>';
      h += '<button type="button" class="img-dropdown-item del-item" data-img-act="del" data-img-type="cmnd">🗑 Xóa ảnh này</button>';
      h += '</div>';
      h += '</div>';
    } else {
      h += '<div class="img-dropdown-wrap">';
      h += '<button type="button" class="btn mini-b btn-tool-secondary" data-dropdown-toggle title="Danh sách công cụ chỉnh sửa">⚙️ Công cụ ▾</button>';
      h += '<div class="img-dropdown-menu">';
      h += '<button type="button" class="img-dropdown-item" data-img-act="rotate" data-img-type="photo">🔄 Xoay 90°</button>';
      h += '<button type="button" class="img-dropdown-item" data-img-act="flip" data-img-type="photo">↔️ Lật ảnh</button>';
      h += '<div class="img-dropdown-divider"></div>';
      h += '<button type="button" class="img-dropdown-item" data-img-act="change" data-img-type="photo">📷 Đổi ảnh mới</button>';
      h += '<button type="button" class="img-dropdown-item" data-img-act="download" data-img-type="photo" data-img-label="Ảnh chân dung">⬇ Tải ảnh về máy</button>';
      h += '<div class="img-dropdown-divider"></div>';
      h += '<button type="button" class="img-dropdown-item del-item" data-img-act="del" data-img-type="photo">🗑 Xóa ảnh này</button>';
      h += '</div>';
      h += '</div>';
    }
    h += '<button type="button" class="btn mini-b" data-img-act="change" data-img-type="' + type + '" title="Tải ảnh khác thay thế">📷 Đổi ảnh</button>';
    h += '<button type="button" class="btn mini-b" data-img-act="download" data-img-type="' + type + '" data-img-label="' + esc(label) + '" style="font-weight:700;color:#047857;background:#ecfdf5;border-color:#a7f3d0;" title="Tải ảnh này về máy">⬇ Tải về</button>';
    h += '<button type="button" class="btn mini-b del" data-img-act="del" data-img-type="' + type + '" title="Xóa ảnh này">🗑 Xóa</button>';
    h += '</div>';
  } else {
    h += '<div class="noimg">Chưa có ' + esc(label.toLowerCase()) + '</div>';
    h += '<div class="ibtns">';
    h += '<button type="button" class="btn mini-b primary" data-img-act="upload" data-img-type="' + type + '">📷 Tải ' + esc(label.toLowerCase()) + ' lên</button>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderImgSection(id) {
  let h = "";
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

  // Toggle dropdown menus
  container.querySelectorAll("[data-dropdown-toggle]").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wrap = btn.closest(".img-dropdown-wrap");
      if (!wrap) return;
      const wasOpen = wrap.classList.contains("open");
      document.querySelectorAll(".img-dropdown-wrap.open").forEach(w => w.classList.remove("open"));
      if (!wasOpen) {
        wrap.classList.add("open");
      }
    };
  });

  // Global listener to close dropdowns when clicking outside
  if (!window.__imgDropdownCloseBound) {
    window.__imgDropdownCloseBound = true;
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".img-dropdown-wrap")) {
        document.querySelectorAll(".img-dropdown-wrap.open").forEach(w => w.classList.remove("open"));
      }
    });
  }

  container.querySelectorAll("[data-img-act]").forEach(b => {
    b.onclick = async e => {
      e.preventDefault();
      e.stopPropagation();

      // Close dropdown if clicked inside
      const parentWrap = b.closest(".img-dropdown-wrap");
      if (parentWrap) parentWrap.classList.remove("open");

      const act = b.dataset.imgAct;
      const type = b.dataset.imgType || "cmnd";
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
      } else if (act === "rotate") {
        const curUri = getImg(id, type);
        if (!curUri) return;
        toast("Đang xoay ảnh 90°…");
        const rotated = await rotateImage(curUri, 90);
        setImg(id, type, rotated);
        container.innerHTML = renderImgSection(id);
        wireImgEvents(id);
        toast("Đã xoay ảnh 90° ✓");
      } else if (act === "flip") {
        const curUri = getImg(id, type);
        if (!curUri) return;
        toast("Đang lật ảnh…");
        const flipped = await flipImage(curUri, true);
        setImg(id, type, flipped);
        container.innerHTML = renderImgSection(id);
        wireImgEvents(id);
        toast("Đã lật ảnh thành công ✓");
      } else if (act === "ai-crop") {
        const curUri = getImg(id, type);
        if (!curUri) return;
        toast("🤖 Đang nhận diện khung viền thẻ CMND…");
        const cropRes = await aiCropCard(curUri);
        if (cropRes.ok && cropRes.uri) {
          setImg(id, type, cropRes.uri);
          container.innerHTML = renderImgSection(id);
          wireImgEvents(id);
          toast("✓ " + (cropRes.msg || "Đã nhận diện & cắt gọn viền thẻ CMND!"));
        } else {
          toast("⚠️ " + (cropRes.reason || "Ảnh khó xác định rõ viền thẻ, bạn có thể dùng Cắt thủ công."));
        }
      } else if (act === "manual-crop") {
        openManualCropModal(id, type, label, croppedUri => {
          setImg(id, type, croppedUri);
          container.innerHTML = renderImgSection(id);
          wireImgEvents(id);
          toast("Đã áp dụng cắt viền CMND ✓");
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

let PREFS = { autoTranslate: true, highlightChu: true, confirmDelete: true };
try {
  const sp = localStorage.getItem("cn_prefs_v1");
  if(sp) PREFS = Object.assign({}, PREFS, JSON.parse(sp));
} catch(e){}

function savePrefs(p){
  PREFS = Object.assign({}, PREFS, p);
  localStorage.setItem("cn_prefs_v1", JSON.stringify(PREFS));
}

/* ---------- Audit Logs ---------- */
function addLog(action, detail){
  try{
    const logs = JSON.parse(localStorage.getItem("cn_audit_logs_v1") || "[]");
    logs.unshift({
      time: new Date().toLocaleString("vi-VN"),
      user: CFG.user || "Người dùng",
      action: action,
      detail: detail || ""
    });
    if(logs.length > 50) logs.length = 50;
    localStorage.setItem("cn_audit_logs_v1", JSON.stringify(logs));
  }catch(e){}
}

function getLogs(){
  try{
    return JSON.parse(localStorage.getItem("cn_audit_logs_v1") || "[]");
  }catch(e){ return []; }
}

function clearLogs(){
  localStorage.removeItem("cn_audit_logs_v1");
}

/* ---------- Backup & Restore JSON ---------- */
function backupJson(){
  const dump = {
    appName: "Tra cứu Công nhân ĐSX02",
    version: "2.4",
    exportDate: new Date().toISOString(),
    totalRecords: DATA.length,
    records: DATA,
    imagesOvr: IMG_OVR,
    config: { url: CFG.url, user: CFG.user }
  };
  const str = JSON.stringify(dump, null, 2);
  const blob = new Blob([str], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const d = new Date();
  const dateStr = d.getFullYear() + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
  a.download = `DSX02_SaoLuu_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
  addLog("Sao lưu JSON", `Xuất file JSON (${DATA.length} hồ sơ)`);
  toast("Đã xuất file sao lưu JSON ✓");
}

function restoreJson(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const parsed = JSON.parse(e.target.result);
      const list = parsed.records || (Array.isArray(parsed) ? parsed : null);
      if(!list || !Array.isArray(list) || list.length === 0){
        toast("File JSON không hợp lệ hoặc rỗng");
        return;
      }
      DATA = list.map(normServerRec);
      save();
      if(parsed.imagesOvr && typeof parsed.imagesOvr === "object"){
        Object.assign(IMG_OVR, parsed.imagesOvr);
        for(const k in parsed.imagesOvr){
          idbPut(k, parsed.imagesOvr[k]);
        }
      }
      initFilterOptions();
      render();
      addLog("Khôi phục JSON", `Nạp ${DATA.length} hồ sơ từ file JSON`);
      toast(`Đã khôi phục thành công ${DATA.length} hồ sơ ✓`);
    }catch(err){
      toast("Lỗi đọc file JSON: " + err.message);
    }
  };
  reader.readAsText(file);
}

function clearImgCache(){
  if(!confirm("Xóa bộ nhớ đệm ảnh cục bộ trên máy này? Ảnh gốc trên Google Drive vẫn được giữ nguyên.")){ return; }
  try {
    IMG_OVR = {};
    localStorage.removeItem("cn_imgfiles_v1");
    idbOpen().then(db => {
      const tx = db.transaction("images", "readwrite");
      tx.objectStore("images").clear();
    }).then(() => {
      addLog("Dọn cache ảnh", "Đã xóa toàn bộ bộ đệm ảnh cục bộ");
      toast("Đã dọn dẹp bộ đệm ảnh ✓");
      render();
      if(CFG.url && CFG.key) syncNow(true);
    });
  }catch(e){
    toast("Lỗi khi dọn cache: " + e.message);
  }
}

let RESOLVED_ACTIONS = { sync: "sync", uploadImage: "uploadImage", deleteImage: "deleteImage" };

async function rawApiCall(url, payload, method = "POST"){
  const cleanUrl = (url || "").trim();
  const httpMethod = method.toUpperCase();
  let lastErr = null;

  // 1. Direct fetch
  try {
    const fetchOptions = {
      method: httpMethod,
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    };
    if(httpMethod !== "GET" && httpMethod !== "HEAD"){
      fetchOptions.body = JSON.stringify(payload || {});
    }
    const res = await fetch(cleanUrl, fetchOptions);
    if(res.ok){
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch(parseE){
        lastErr = new Error("Phản hồi không phải JSON: " + text.slice(0, 100));
      }
    } else {
      lastErr = new Error("Mã phản hồi HTTP: " + res.status);
    }
  } catch(err){
    lastErr = err;
  }

  // 2. Server proxy fallback
  try {
    const proxyRes = await fetch("/api/sync-gas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: cleanUrl, payload: payload, method: httpMethod })
    });
    if(proxyRes.ok){
      const data = await proxyRes.json();
      return data;
    }
  } catch(proxyErr){
    console.warn("Proxy fallback error:", proxyErr);
  }

  throw lastErr || new Error("Không thể kết nối máy chủ Google Apps Script");
}

function normalizeApiResponse(res){
  if(!res || typeof res !== "object") return { ok: false, error: "invalid_response" };
  const r = Object.assign({}, res);
  if(r.records && !r.data && Array.isArray(r.records)) r.data = r.records;
  if(r.rows && !r.data && Array.isArray(r.rows)) r.data = r.rows;
  if(r.result && !r.data && Array.isArray(r.result)) r.data = r.result;
  if(r.items && !r.data && Array.isArray(r.items)) r.data = r.items;

  if(r.ok === true || r.success === true || r.status === "success" || r.status === "ok" || (Array.isArray(r.data) && r.data.length > 0)){
    r.ok = true;
  }
  return r;
}

async function api(act, data){
  if(!CFG.url) throw new Error("Chưa cấu hình máy chủ");
  const cleanUrl = (CFG.url || "").trim();
  const cleanKey = (CFG.key || "").trim();
  const cleanUser = (CFG.user || "").trim();

  const effectiveAct = RESOLVED_ACTIONS[act] || act;

  function buildUrlAndPayload(actionName){
    let targetUrl = cleanUrl;
    try {
      const u = new URL(cleanUrl);
      u.searchParams.set("act", actionName);
      u.searchParams.set("action", actionName);
      u.searchParams.set("type", actionName);
      u.searchParams.set("cmd", actionName);
      if(cleanKey) u.searchParams.set("key", cleanKey);
      if(cleanUser) u.searchParams.set("user", cleanUser);
      targetUrl = u.toString();
    } catch(e){}

    const payload = Object.assign({
      act: actionName,
      action: actionName,
      type: actionName,
      cmd: actionName,
      method: actionName,
      op: actionName,
      key: cleanKey,
      k: cleanKey,
      user: cleanUser,
      u: cleanUser
    }, data || {});

    return { targetUrl, payload };
  }

  // 1. Try effective action
  const { targetUrl, payload } = buildUrlAndPayload(effectiveAct);
  let res = normalizeApiResponse(await rawApiCall(targetUrl, payload, "POST"));

  // 2. If unknown_action, auto-negotiate with fallback candidate actions
  const isUnknown = res.error === "unknown_action" || res.msg === "unknown_action" || res.err === "unknown_action";
  if(isUnknown && act === "sync"){
    const candidates = [
      "sync", "syncData", "sync_data", "getData", "get_data", "get", "read",
      "load", "fetch", "getAll", "get_all", "list", "save", "saveData", "pull", "push"
    ];
    for(const cand of candidates){
      if(cand === effectiveAct) continue;
      try {
        const testBuild = buildUrlAndPayload(cand);
        const testRes = normalizeApiResponse(await rawApiCall(testBuild.targetUrl, testBuild.payload, "POST"));
        if(testRes.ok || (testRes.error !== "unknown_action" && testRes.msg !== "unknown_action")){
          RESOLVED_ACTIONS[act] = cand;
          return testRes;
        }
      } catch(e){}
    }

    // Also try GET method if all POST actions fail
    try {
      const getBuild = buildUrlAndPayload("sync");
      const getRes = normalizeApiResponse(await rawApiCall(getBuild.targetUrl, null, "GET"));
      if(getRes.ok && Array.isArray(getRes.data)){
        return getRes;
      }
    } catch(e){}
  }

  return res;
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
  if(!CFG.url){
    if(!silent){
      toast("Vui lòng cấu hình Web App URL trong ⚙️ Cài đặt");
      openSettings("sync");
    }
    return;
  }
  if(!CFG.key){
    if(!silent){
      toast("Vui lòng nhập Mã bảo mật (Key) trong ⚙️ Cài đặt");
      openSettings("sync");
    }
    return;
  }
  if(!silent) toast("Đang đồng bộ dữ liệu đám mây…");

  try{
    let pend = getPendImg();
    const stillP = [];
    for(const k of pend){
      const [t, id] = k.split(":");
      const uri = getImg(id, t);
      if(!uri) continue;
      try{
        const r = await api("uploadImage", { id: id, type: t, dataUrl: uri });
        if(!r.ok){
          if(r.error === "unauthorized" || r.msg === "Sai khoá truy cập." || r.err === "unauthorized"){
            if(!silent){
              toast("Mã bảo mật (Key) không đúng. Vui lòng kiểm tra lại trong ⚙️ Cài đặt.");
              openSettings("sync");
            }
            return;
          }
          stillP.push(k);
        }
      }catch(e){ stillP.push(k); }
    }
    setPendImg(stillP);

    let pendD = getPendDel();
    const stillD = [];
    for(const k of pendD){
      const [t, id] = k.split(":");
      try{
        const r = await api("deleteImage", { id: id, type: t });
        if(!r.ok){
          if(r.error === "unauthorized" || r.msg === "Sai khoá truy cập." || r.err === "unauthorized"){
            if(!silent){
              toast("Mã bảo mật (Key) không đúng. Vui lòng kiểm tra lại trong ⚙️ Cài đặt.");
              openSettings("sync");
            }
            return;
          }
          stillD.push(k);
        }
      }catch(e){ stillD.push(k); }
    }
    setPendDel(stillD);

    const q = JSON.parse(localStorage.getItem("cn_queue_v1") || "[]");
    const res = await api("sync", { records: q });
    if(!res.ok){
      if(res.error === "unauthorized" || res.msg === "Sai khoá truy cập." || res.err === "unauthorized"){
        if(!silent){
          toast("Mã bảo mật (Key) không đúng. Vui lòng kiểm tra lại trong ⚙️ Cài đặt.");
          openSettings("sync");
        }
      } else {
        const errMsg = res.msg || res.err || res.error || "Lỗi đồng bộ";
        if(!silent) toast("Lỗi: " + errMsg);
      }
      return;
    }

    ROLE = res.role || "vip";
    applyRole();

    localStorage.removeItem("cn_queue_v1");
    updateSyncBadge();

    if(Array.isArray(res.data) && res.data.length > 0){
      DATA = res.data.map(normServerRec);
      save();
      initFilterOptions();
      render();
    }
    if(res.images) fetchServerImages(res.images, res.deletedImages);
    addLog("Đồng bộ đám mây", `Thành công (${(res.data||[]).length} hồ sơ)`);
    if(!silent) toast("Đồng bộ đám mây thành công ✓");
  }catch(e){
    if(!silent) toast("Không kết nối được máy chủ: " + e.message);
  }
}

async function connect(silent = false){
  if(!CFG.url || !CFG.key) return false;
  try{
    const r = await api("sync", { records: [] });
    if(r.ok){
      ROLE = r.role || "vip";
      applyRole();
      if(Array.isArray(r.data) && r.data.length > 0){
        DATA = r.data.map(normServerRec);
        save();
        initFilterOptions();
        render();
      }
      if(r.images) fetchServerImages(r.images, r.deletedImages);
      return true;
    } else {
      if(r.error === "unauthorized" || r.msg === "Sai khoá truy cập." || r.err === "unauthorized"){
        if(!silent) toast("Mã bảo mật (Key) không đúng. Vui lòng kiểm tra lại trong ⚙️ Cài đặt.");
      } else {
        const errMsg = r.msg || r.err || r.error || "Không thể xác thực máy chủ";
        if(!silent) toast("Lỗi kết nối: " + errMsg);
      }
      return false;
    }
  }catch(e){
    if(!silent) toast("Không kết nối được: " + e.message);
    return false;
  }
}

function applyRole(){
  const ban = document.getElementById("roleBanner");
  if(ban){
    if(ROLE){
      ban.style.display = "";
      ban.textContent = (ROLE === "admin" ? "🛡️ Quyền Quản trị viên (Admin)" : "⭐ Đã kết nối Google Drive & Sheets") + " — Đồng bộ tự động đang bật.";
    } else {
      ban.style.display = "none";
    }
  }
  const lb = document.getElementById("bLog");
  if(lb) lb.style.display = "";
  document.getElementById("bAdd").style.display = (state.view === "people") ? "" : "none";
}

let curSettingsTab = "sync"; // "sync" | "data" | "prefs" | "logs" | "about"

function openSettings(initTab){
  if(initTab) curSettingsTab = initTab;
  const s = document.getElementById("sheet");
  if(!s) return;

  const q = JSON.parse(localStorage.getItem("cn_queue_v1") || "[]");
  const imgCount = Object.keys(IMG_OVR).filter(k => IMG_OVR[k] && IMG_OVR[k] !== DEL).length;
  const uniqueRooms = new Set(DATA.map(x => x.phong_o).filter(Boolean)).size;
  const ldCount = DATA.filter(x => (x.loai || "").toLowerCase().includes("lao")).length;
  const gtCount = DATA.filter(x => (x.loai || "").toLowerCase().includes("gia")).length;

  let tabContent = "";

  if(curSettingsTab === "sync"){
    const isOnline = !!ROLE;
    tabContent =
      '<div class="cfg-card status-card ' + (isOnline ? "cfg-online" : "cfg-offline") + '">' +
        '<div class="status-indicator">' + (isOnline ? "🟢" : "🟡") + '</div>' +
        '<div class="status-info">' +
          '<b>' + (isOnline ? "Máy chủ Google Drive & Sheets: Đã kết nối" : "Chế độ Ngoại tuyến / Chưa kết nối") + '</b>' +
          '<span>' + (isOnline ? ("Quyền hạn: " + (ROLE === "admin" ? "Quản trị viên (Admin)" : "Thành viên VIP")) : "Dữ liệu được lưu an toàn trên máy này. Nhập mã bảo mật để đồng bộ lên Đám mây.") + '</span>' +
          (q.length > 0 ? ('<div class="pending-tag">⏳ ' + q.length + ' thay đổi chưa đồng bộ</div>') : '') +
        '</div>' +
      '</div>' +
      '<div class="fld">' +
        '<label>Web App URL (Google Apps Script)</label>' +
        '<input id="cUrl" value="' + esc(CFG.url || "") + '" placeholder="https://script.google.com/macros/s/.../exec">' +
      '</div>' +
      '<div class="fld">' +
        '<label>Mã bảo mật (Key kết nối)</label>' +
        '<div class="fld-pass-wrap">' +
          '<input id="cKey" type="password" value="' + esc(CFG.key || "") + '" placeholder="Nhập mã bảo mật (Key)">' +
          '<button type="button" class="btn-eye" id="bTogglePass" title="Hiện/Ẩn mã bảo mật">👁️</button>' +
        '</div>' +
      '</div>' +
      '<div class="fld">' +
        '<label>Tên người dùng / Mã nhân sự</label>' +
        '<input id="cUser" value="' + esc(CFG.user || "") + '" placeholder="Ví dụ: Tony, QuanLy_01, ToTruong_1">' +
      '</div>' +
      '<div id="cfgDiagBox" style="display:none;margin-top:10px;padding:10px;border-radius:8px;font-size:12.5px;line-height:1.4;"></div>' +
      '<div class="cfg-actions-grid">' +
        '<button class="btn primary" id="bSaveCfg">💾 Lưu cấu hình & Kết nối</button>' +
        '<button class="btn" id="bTestCfg">🔍 Kiểm tra kết nối</button>' +
        '<button class="btn" id="bSyncFromSettings">☁️ Đồng bộ ngay</button>' +
      '</div>' +
      (q.length > 0 ? '<div style="margin-top:10px;text-align:right"><button class="btn del mini-b" id="bClearQueue">🧹 Xóa hàng đợi (' + q.length + ')</button></div>' : '') +
      '<div class="cfg-hint">💡 <b>Lưu ý cấu hình Google Apps Script:</b><br>' +
        '• Khi triển khai (Deploy), chọn: <i>"Execute as: Me"</i> và <i>"Who has access: Anyone (Bất kỳ ai)"</i>.<br>' +
        '• Mỗi khi sửa mã hoặc đổi Key trong Apps Script, hãy chọn <i>Deploy → Manage Deployments → Sửa (bút chì) → Version: New version → Deploy</i>.</div>';
  } else if(curSettingsTab === "data"){
    tabContent =
      '<div class="cfg-stat-summary">' +
        '<div class="css-item"><b>' + DATA.length + '</b><span>Tổng hồ sơ</span></div>' +
        '<div class="css-item"><b>' + uniqueRooms + '</b><span>Phòng ở</span></div>' +
        '<div class="css-item"><b>' + ldCount + '</b><span>Lao động</span></div>' +
        '<div class="css-item"><b>' + gtCount + '</b><span>Gia thuộc</span></div>' +
        '<div class="css-item"><b>' + imgCount + '</b><span>Ảnh cục bộ</span></div>' +
      '</div>' +
      '<div class="cfg-sec-title">📦 Sao lưu & Khôi phục (JSON / Excel)</div>' +
      '<div class="cfg-btn-grid">' +
        '<button class="btn" id="bBackupJson">⬇️ Sao lưu dữ liệu JSON</button>' +
        '<button class="btn" id="bRestoreJson">⬆️ Khôi phục từ file JSON</button>' +
        '<button class="btn" id="bExportExcel">📊 Xuất dữ liệu Excel (.xlsx)</button>' +
        '<button class="btn" id="bImportExcel">⬆️ Nhập dữ liệu từ Excel</button>' +
      '</div>' +
      '<div class="cfg-sec-title" style="margin-top:16px;">🖼️ Bộ nhớ ảnh & Dữ liệu gốc</div>' +
      '<div class="cfg-btn-grid">' +
        '<button class="btn" id="bClearImgCache">🗑️ Dọn dẹp bộ đệm ảnh (' + imgCount + ')</button>' +
        '<button class="btn del" id="bResetBase">↺ Đặt lại 128 hồ sơ gốc</button>' +
      '</div>' +
      '<input type="file" id="fileJsonImport" accept=".json" style="display:none">';
  } else if(curSettingsTab === "prefs"){
    tabContent =
      '<div class="cfg-sec-title">🎨 Tùy chọn hiển thị & Nhập liệu</div>' +
      '<div class="fld"><label class="ckrow"><input type="checkbox" id="ckAutoTrans"' + (PREFS.autoTranslate !== false ? " checked" : "") + '> 🌐 Tự động hiện nút Dịch địa chỉ Campuchia sang Tiếng Việt</label></div>' +
      '<div class="fld"><label class="ckrow"><input type="checkbox" id="ckHighlightChu"' + (PREFS.highlightChu !== false ? " checked" : "") + '> 👑 Tô nổi bật Chủ phòng trên danh sách phòng ở</label></div>' +
      '<div class="fld"><label class="ckrow"><input type="checkbox" id="ckConfirmDel"' + (PREFS.confirmDelete !== false ? " checked" : "") + '> ⚠️ Luôn xác nhận trước khi xóa hồ sơ nhân sự</label></div>' +
      '<div class="cfg-sec-title" style="margin-top:16px;">ℹ️ Thông tin hệ thống</div>' +
      '<div class="cfg-info-box">' +
        '<div class="cib-row"><span>Tên ứng dụng:</span><b>Tra cứu Công nhân ĐSX02</b></div>' +
        '<div class="cib-row"><span>Phiên bản:</span><b>PWA v2.4 (Offline-First)</b></div>' +
        '<div class="cib-row"><span>Đồng bộ:</span><b>Google Apps Script & Drive v2.4</b></div>' +
        '<div class="cib-row"><span>Bộ nhớ đệm:</span><b>IndexedDB + LocalStorage</b></div>' +
      '</div>';
  } else if(curSettingsTab === "logs"){
    const logs = getLogs();
    tabContent =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<div class="cfg-sec-title" style="margin:0">📜 Nhật ký thao tác gần đây (' + logs.length + ')</div>' +
        (logs.length > 0 ? '<button class="btn mini-b del" id="bClearLogs">🧹 Xóa nhật ký</button>' : '') +
      '</div>' +
      (logs.length === 0 ?
        '<div class="empty" style="padding:24px 0">Chưa có thao tác nào được ghi nhận.</div>' :
        '<div class="cfg-log-list">' +
          logs.map(l =>
            '<div class="cfg-log-item">' +
              '<div class="cli-top"><b>' + esc(l.action) + '</b><span class="cli-time">' + esc(l.time) + '</span></div>' +
              '<div class="cli-desc">' + esc(l.detail) + (l.user ? (' <span class="cli-user">(' + esc(l.user) + ')</span>') : '') + '</div>' +
            '</div>'
          ).join("") +
        '</div>'
      );
  } else if(curSettingsTab === "about"){
    tabContent =
      '<div class="about-wrap">' +
        '<div class="about-hero">' +
          '<div class="about-hero-tag">🌟 Chuyển Đổi Số Thực Địa – ĐSX 02</div>' +
          '<h3>ỨNG DỤNG QUẢN LÝ NHÂN SỰ & PHÒNG Ở CÔNG NHÂN</h3>' +
          '<p>Giải pháp tra cứu, quản lý nhân sự và nơi cư trú công nhân thế hệ mới — Hoạt động mượt mà Offline không cần Internet, đồng bộ Đám mây Google Drive & Sheets 2 chiều.</p>' +
        '</div>' +

        '<div class="about-card">' +
          '<div class="about-card-title"><span class="icon">🌱</span> 1. Bối cảnh ra đời & Quá trình hình thành</div>' +
          '<p style="margin:0 0 10px;text-align:justify;">' +
            'Tại địa bàn quản lý sản xuất nông nghiệp / cao su đặc thù của <b>Đội sản xuất 02</b>, lực lượng công nhân biến động thường xuyên với số lượng hàng trăm lao động và gia thuộc. Trong quá trình điều hành thực tế, việc quản lý gặp phải nhiều khó khăn phức tạp:' +
          '</p>' +
          '<ul style="margin:0 0 10px 18px;padding:0;color:#475569;font-size:13px;line-height:1.6;">' +
            '<li><b>Giấy tờ CMND / CCCD tiếng Campuchia:</b> Chữ viết và địa chỉ gốc khó đọc, khó dịch chính xác khi cần làm thủ tục hành chính hoặc khai báo lưu trú.</li>' +
            '<li><b>Bố trí phòng ở & quan hệ gia đình phức tạp:</b> Công nhân đi làm thường mang theo cả gia đình (vợ chồng, con nhỏ, cha mẹ già) ở ghép trong các dãy nhà tập thể (Popok, Dãy A, B, C, D, E, F...). Quản lý bằng giấy tờ dễ gây sai sót số phòng hoặc bỏ sót nhân khẩu.</li>' +
            '<li><b>Điều kiện thực địa vùng sâu:</b> Khi cán bộ quản lý đi kiểm tra ngoài lô cao su hoặc lúc đêm hôm thường <i>không có sóng Internet hoặc mạng 3G/4G chập chờn</i>.</li>' +
          '</ul>' +
          '<p style="margin:0;text-align:justify;">' +
            '👉 Xuất phát từ trăn trở thực tiễn đó, <b>App Quản lý Công nhân ĐSX 02</b> đã được nghiên cứu và xây dựng với tiêu chí cốt lõi: <b>"Gọn nhẹ – Trực quan – Ai cũng dùng được ngay – Tra cứu siêu tốc mọi lúc mọi nơi kể cả khi mất mạng"</b>.' +
          '</p>' +
        '</div>' +

        '<div class="about-card">' +
          '<div class="about-card-title"><span class="icon">🚀</span> 2. Những tính năng nổi bật của Ứng dụng</div>' +
          '<div class="about-feat-grid">' +
            '<div class="about-feat-item">' +
              '<b>⚡ 1. Tra cứu đa năng siêu tốc (1 giây)</b>' +
              '<p>Tìm kiếm tức thì theo tên thật, tên mượn, số CMND, số điện thoại, số phòng, phần cây cạo mủ hoặc lọc nhanh theo từng tổ sản xuất.</p>' +
            '</div>' +
            '<div class="about-feat-item">' +
              '<b>🏠 2. Quản lý Phòng ở & Nơi cư trú</b>' +
              '<p>Sơ đồ phòng trực quan, hiển thị rõ Chủ phòng, phân tách rạch ròi Lao động cạo mủ vs Gia thuộc đi theo, cảnh báo phòng quá tải.</p>' +
            '</div>' +
            '<div class="about-feat-item">' +
              '<b>🤖 3. AI đọc CMND & Tự động dịch</b>' +
              '<p>Tự động nhận diện chữ từ ảnh chụp CMND Campuchia, hỗ trợ 1 chạm dịch địa chỉ xã/huyện/tỉnh Khmer sang tiếng Việt chuẩn xác.</p>' +
            '</div>' +
            '<div class="about-feat-item">' +
              '<b>✂️ 4. AI Cắt viền & Xử lý ảnh CMND</b>' +
              '<p>AI tự động nhận diện viền CMND để cắt bỏ chi tiết thừa, công cụ xoay lật, phóng to xem rõ ảnh chân dung và giấy tờ gốc.</p>' +
            '</div>' +
            '<div class="about-feat-item">' +
              '<b>📶 5. Hoạt động Ngoại tuyến 100% (PWA)</b>' +
              '<p>Cài đặt trực tiếp lên màn hình điện thoại. Ra ngoài lô không có mạng Internet vẫn mở app tra cứu và chỉnh sửa bình thường.</p>' +
            '</div>' +
            '<div class="about-feat-item">' +
              '<b>☁️ 6. Đồng bộ Đám mây 2 chiều (Cloud)</b>' +
              '<p>Kết nối an toàn Google Sheets & Google Drive, tự động đồng bộ khi có mạng, phân quyền quản trị, sao lưu & phục hồi dữ liệu dễ dàng.</p>' +
            '</div>' +
            '<div class="about-feat-item" style="grid-column:1 / -1;">' +
              '<b>📞 7. Tương tác nhanh 1 chạm tại hiện trường</b>' +
              '<p>Bấm trực tiếp vào số điện thoại để gọi ngay cho công nhân hoặc người thân khi có việc khẩn cấp mà không cần chép số ra giấy.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="about-card">' +
          '<div class="about-card-title"><span class="icon">⚖️</span> 3. Sự khác biệt so với Mô hình Theo dõi Truyền thống</div>' +
          '<table class="about-compare-table">' +
            '<thead>' +
              '<tr>' +
                '<th style="width:26%;">Tiêu chí</th>' +
                '<th style="width:37%;">Sổ sách / Excel truyền thống</th>' +
                '<th style="width:37%;background:#ecfdf5;color:#065f46;">App Quản Lý Công Nhân</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              '<tr>' +
                '<td><b>Tra cứu hiện trường</b></td>' +
                '<td>Phải mở máy tính cồng kềnh hoặc lật từng trang sổ; rất chậm và dễ nhầm lẫn.</td>' +
                '<td style="background:#f0fdf4;color:#166534;"><b>Bấm 1 giây trên điện thoại</b> là ra ngay hồ sơ, số phòng, phần cây, số ĐT.</td>' +
              '</tr>' +
              '<tr>' +
                '<td><b>Môi trường mất sóng</b></td>' +
                '<td>File online bị đơ, không mở được khi ra giữa lô cao su.</td>' +
                '<td style="background:#f0fdf4;color:#166534;"><b>Chạy mượt 100% Offline</b>, có mạng tự động cập nhật lên đám mây.</td>' +
              '</tr>' +
              '<tr>' +
                '<td><b>Hình ảnh & Giấy tờ</b></td>' +
                '<td>Ảnh chụp gửi Zalo dễ trôi mất, không gắn liền với hồ sơ nhân sự.</td>' +
                '<td style="background:#f0fdf4;color:#166534;"><b>Lưu kèm ảnh chân dung + 2 mặt CMND</b> trực tiếp vào từng hồ sơ, có AI xử lý.</td>' +
              '</tr>' +
              '<tr>' +
                '<td><b>Khả năng nhân rộng</b></td>' +
                '<td>Mỗi người quản lý theo một cách riêng, khó bàn giao khi thay đổi nhân sự.</td>' +
                '<td style="background:#f0fdf4;color:#166534;"><b>Chuẩn hóa quy trình</b>, sẵn sàng triển khai áp dụng rộng rãi cho mọi đơn vị với chi phí 0 đồng.</td>' +
              '</tr>' +
            '</tbody>' +
          '</table>' +
        '</div>' +

        '<div class="about-author-box">' +
          '<div class="author-header">' +
            '<div class="about-author-avatar">VH</div>' +
            '<div class="about-author-meta">' +
              '<b>Nguyễn Việt Hùng</b>' +
              '<span>Trợ lý Đội sản xuất 02</span>' +
            '</div>' +
          '</div>' +
          '<div class="about-author-quote">' +
            '“Ứng dụng được xây dựng từ thực tiễn sản xuất tại cơ sở với mục tiêu đơn giản hóa công tác quản lý lao động, phục vụ nhanh chóng, chính xác và sẵn sàng chia sẻ, nhân rộng mô hình đến các Đội sản xuất, Nông trường trong toàn đơn vị.”' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  s.innerHTML =
    '<div class="sheet-h">' +
      '<h2>' + (curSettingsTab === "about" ? "📖 Giới thiệu App Quản lý Công nhân" : "⚙️ Cài đặt & Quản lý hệ thống") + '</h2>' +
      '<button class="x" id="bClose">×</button>' +
    '</div>' +
    '<div class="cfg-nav-tabs">' +
      '<button class="cnt-btn ' + (curSettingsTab === "about" ? "on" : "") + '" data-tab="about">📖 Giới thiệu</button>' +
      '<button class="cnt-btn ' + (curSettingsTab === "sync" ? "on" : "") + '" data-tab="sync">☁️ Đồng bộ</button>' +
      '<button class="cnt-btn ' + (curSettingsTab === "data" ? "on" : "") + '" data-tab="data">💾 Dữ liệu</button>' +
      '<button class="cnt-btn ' + (curSettingsTab === "prefs" ? "on" : "") + '" data-tab="prefs">🎨 Tùy chọn</button>' +
      '<button class="cnt-btn ' + (curSettingsTab === "logs" ? "on" : "") + '" data-tab="logs">📜 Nhật ký</button>' +
    '</div>' +
    '<div class="sheet-b" style="padding-top:14px;">' + tabContent + '</div>' +
    '<div class="sheet-f">' +
      '<button class="btn primary" id="bDoneSettings">Đóng</button>' +
    '</div>';

  document.getElementById("overlay").classList.add("show");
  document.getElementById("bClose").onclick = closeEdit;
  document.getElementById("bDoneSettings").onclick = closeEdit;

  // Tab switching
  s.querySelectorAll(".cnt-btn").forEach(b => {
    b.onclick = () => openSettings(b.dataset.tab);
  });

  // Tab 1: Sync bindings
  if(curSettingsTab === "sync"){
    const tBtn = s.querySelector("#bTogglePass");
    const kInp = s.querySelector("#cKey");
    if(tBtn && kInp){
      tBtn.onclick = () => {
        kInp.type = kInp.type === "password" ? "text" : "password";
        tBtn.textContent = kInp.type === "password" ? "👁️" : "🔒";
      };
    }
    const saveBtn = s.querySelector("#bSaveCfg");
    if(saveBtn){
      saveBtn.onclick = async () => {
        const u = s.querySelector("#cUrl").value.trim();
        const k = s.querySelector("#cKey").value.trim();
        const usr = s.querySelector("#cUser").value.trim();
        CFG = { url: u, key: k, user: usr };
        localStorage.setItem("cn_cfg_v1", JSON.stringify(CFG));
        if(!CFG.url){ toast("Vui lòng nhập Web App URL"); return; }
        if(!CFG.key){ toast("Vui lòng nhập mã bảo mật (Key)"); return; }
        toast("Đang kiểm tra kết nối…");
        const ok = await connect(false);
        if(ok){
          toast("Kết nối thành công! Đang đồng bộ…");
          syncNow(true);
          openSettings("sync");
        }
      };
    }
    const testBtn = s.querySelector("#bTestCfg");
    const diagBox = s.querySelector("#cfgDiagBox");
    if(testBtn && diagBox){
      testBtn.onclick = async () => {
        const u = s.querySelector("#cUrl").value.trim();
        const k = s.querySelector("#cKey").value.trim();
        const usr = s.querySelector("#cUser").value.trim();
        if(!u){
          diagBox.style.display = "block";
          diagBox.style.background = "#fef2f2";
          diagBox.style.color = "#991b1b";
          diagBox.style.border = "1px solid #fecaca";
          diagBox.innerHTML = "❌ <b>Chưa nhập Web App URL</b>";
          return;
        }
        if(!k){
          diagBox.style.display = "block";
          diagBox.style.background = "#fef2f2";
          diagBox.style.color = "#991b1b";
          diagBox.style.border = "1px solid #fecaca";
          diagBox.innerHTML = "❌ <b>Chưa nhập Mã bảo mật (Key)</b>";
          return;
        }

        diagBox.style.display = "block";
        diagBox.style.background = "#eff6ff";
        diagBox.style.color = "#1e40af";
        diagBox.style.border = "1px solid #bfdbfe";
        diagBox.innerHTML = "⏳ <b>Đang gửi yêu cầu kiểm tra đến Google Apps Script…</b>";

        CFG = { url: u, key: k, user: usr };
        try {
          const r = await api("sync", { records: [] });
          if(r.ok){
            ROLE = r.role || "vip";
            applyRole();
            diagBox.style.background = "#f0fdf4";
            diagBox.style.color = "#166534";
            diagBox.style.border = "1px solid #bbf7d0";
            diagBox.innerHTML = "✅ <b>Kết nối máy chủ thành công!</b><br>" +
              "• Quyền hạn: <b>" + (ROLE === "admin" ? "Quản trị viên (Admin)" : "Thành viên VIP") + "</b><br>" +
              "• Dữ liệu trên Google Sheets: <b>" + (Array.isArray(r.data) ? r.data.length : 0) + " hồ sơ</b><br>" +
              "• Nhấn <b>💾 Lưu cấu hình & Kết nối</b> để bắt đầu sử dụng.";
          } else {
            diagBox.style.background = "#fef2f2";
            diagBox.style.color = "#991b1b";
            diagBox.style.border = "1px solid #fecaca";
            if(r.error === "unauthorized" || r.msg === "Sai khoá truy cập." || r.err === "unauthorized"){
              diagBox.innerHTML = "❌ <b>Mã bảo mật (Key) không khớp</b><br>" +
                "• Máy chủ phản hồi: <i>Sai khoá truy cập</i>.<br>" +
                "• Hãy kiểm tra lại Key trong Script Properties hoặc Code.gs của Google Apps Script.<br>" +
                "• <b>Lưu ý quan trọng:</b> Nếu vừa đổi Key trong Code.gs, bạn phải vào Google Apps Script bấm <b>Deploy → Manage Deployments → Sửa (biểu tượng bút chì) → Version: New version → Deploy</b> thì URL Web App mới cập nhật Key mới.";
            } else {
              diagBox.innerHTML = "⚠️ <b>Máy chủ phản hồi:</b> " + esc(r.msg || r.err || r.error || JSON.stringify(r));
            }
          }
        } catch(err) {
          diagBox.style.background = "#fef2f2";
          diagBox.style.color = "#991b1b";
          diagBox.style.border = "1px solid #fecaca";
          diagBox.innerHTML = "❌ <b>Không thể kết nối đến Web App URL:</b><br>" +
            "• Lỗi: " + esc(err.message) + "<br>" +
            "• Đảm bảo Web App đã được cấu hình quyền <i>Who has access: Anyone (Bất kỳ ai)</i>.";
        }
      };
    }
    const syncBtn = s.querySelector("#bSyncFromSettings");
    if(syncBtn){
      syncBtn.onclick = async () => {
        await syncNow(false);
        openSettings("sync");
      };
    }
    const clrQBtn = s.querySelector("#bClearQueue");
    if(clrQBtn){
      clrQBtn.onclick = () => {
        if(confirm("Xóa toàn bộ hàng đợi thay đổi chưa gửi?")){
          localStorage.removeItem("cn_queue_v1");
          updateSyncBadge();
          toast("Đã dọn sạch hàng đợi ✓");
          openSettings("sync");
        }
      };
    }
  }

  // Tab 2: Data bindings
  if(curSettingsTab === "data"){
    const bJson = s.querySelector("#bBackupJson");
    if(bJson) bJson.onclick = backupJson;
    const rJson = s.querySelector("#bRestoreJson");
    const fJson = s.querySelector("#fileJsonImport");
    if(rJson && fJson){
      rJson.onclick = () => fJson.click();
      fJson.onchange = e => {
        if(e.target.files[0]) restoreJson(e.target.files[0]);
        e.target.value = "";
      };
    }
    const expExcel = s.querySelector("#bExportExcel");
    if(expExcel) expExcel.onclick = exportXlsx;
    const impExcel = s.querySelector("#bImportExcel");
    if(impExcel) impExcel.onclick = () => document.getElementById("fileImport").click();
    const clrImg = s.querySelector("#bClearImgCache");
    if(clrImg) clrImg.onclick = clearImgCache;
    const rstBase = s.querySelector("#bResetBase");
    if(rstBase) rstBase.onclick = () => document.getElementById("bReset").click();
  }

  // Tab 3: Prefs bindings
  if(curSettingsTab === "prefs"){
    const ckAt = s.querySelector("#ckAutoTrans");
    const ckHc = s.querySelector("#ckHighlightChu");
    const ckCd = s.querySelector("#ckConfirmDel");
    const updatePref = () => {
      savePrefs({
        autoTranslate: ckAt ? ckAt.checked : true,
        highlightChu: ckHc ? ckHc.checked : true,
        confirmDelete: ckCd ? ckCd.checked : true
      });
      render();
      toast("Đã cập nhật tùy chọn ✓");
    };
    if(ckAt) ckAt.onchange = updatePref;
    if(ckHc) ckHc.onchange = updatePref;
    if(ckCd) ckCd.onchange = updatePref;
  }

  // Tab 4: Logs bindings
  if(curSettingsTab === "logs"){
    const clrLogs = s.querySelector("#bClearLogs");
    if(clrLogs){
      clrLogs.onclick = () => {
        if(confirm("Xóa toàn bộ nhật ký thao tác?")){
          clearLogs();
          toast("Đã xóa nhật ký");
          openSettings("logs");
        }
      };
    }
  }
}

/* ---------- Toast Notification ---------- */
let _toastT = null;
function toast(msg){
  const el = document.getElementById("toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(_toastT);
  _toastT = setTimeout(() => el.classList.remove("show"), 2500);
}

/* ---------- Init & Event Listeners ---------- */
document.addEventListener("DOMContentLoaded", () => {
  idbOpen().then(idbAll).then(() => {
    initFilterOptions();
    render();
    updateSyncBadge();
    if(CFG.url && CFG.key) connect(true).then(ok => { if(ok) syncNow(true); });
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
const bAboutBtn = document.getElementById("bAbout");
if(bAboutBtn) bAboutBtn.onclick = () => openSettings("about");
document.getElementById("bImport").onclick = () => document.getElementById("fileImport").click();
document.getElementById("fileImport").addEventListener("change", e => {
  if(e.target.files[0]) importXlsx(e.target.files[0]);
  e.target.value = "";
});
document.getElementById("bSync").onclick = () => syncNow(false);
const bLogEl = document.getElementById("bLog");
if(bLogEl) bLogEl.onclick = () => openSettings("logs");
document.getElementById("bSettings").onclick = () => openSettings("sync");
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
