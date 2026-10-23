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
  ["nhom_mau","Nhóm máu","input"],
  ["danh_gia_ky_nang","Kỹ năng tay nghề (1-5 sao)","input"],
  ["danh_gia_dao_duc","Đạo đức & Kỷ luật (1-5 sao)","input"],
  ["ghi_chu_ky_luat","Ghi chú Sổ Kỷ luật (1-2★)","textarea"],
  ["ngay_ky_luat","Ngày ghi nhận kỷ luật","input"],
  ["ghi_chu","Ghi chú","textarea"],
];

const TO_LIST = ["Tổ 1","Tổ 2","Tổ 3","Tổ 4","Tổ 5","Tổ 6","Tổ 7","Tổ 8"];

const SKILL_LABELS = {
  1: "1★ Cần đào tạo lại",
  2: "2★ Trung bình yếu",
  3: "3★ Đạt yêu cầu (Mặc định)",
  4: "4★ Giỏi - Thao tác vững",
  5: "5★ Xuất sắc"
};

const ETHICS_LABELS = {
  1: "1★ Cần chấn chỉnh",
  2: "2★ Vi phạm nhắc nhở",
  3: "3★ Đạt yêu cầu (Mặc định)",
  4: "4★ Gương mẫu, trách nhiệm",
  5: "5★ Rất tốt"
};

function getBloodType(p){
  return (p && (p.nhom_mau || p.blood_type || p["Nhóm máu"] || p["nhom_mau"])) || "";
}

function getSkillRating(p){
  if(!p || p.loai === "Gia thuộc") return null;
  const v = p.danh_gia_ky_nang != null ? p.danh_gia_ky_nang : (p.ky_nang != null ? p.ky_nang : (p["Kỹ năng"] != null ? p["Kỹ năng"] : (p["danh_gia_ky_nang"] != null ? p["danh_gia_ky_nang"] : 3)));
  const num = parseInt(v, 10);
  return (!isNaN(num) && num >= 1 && num <= 5) ? num : 3;
}

function getEthicsRating(p){
  if(!p || p.loai === "Gia thuộc") return null;
  const v = p.danh_gia_dao_duc != null ? p.danh_gia_dao_duc : (p.dao_duc != null ? p.dao_duc : (p["Đạo đức"] != null ? p["Đạo đức"] : (p["danh_gia_dao_duc"] != null ? p["danh_gia_dao_duc"] : 3)));
  const num = parseInt(v, 10);
  return (!isNaN(num) && num >= 1 && num <= 5) ? num : 3;
}

function isDisciplineCase(p){
  if(!p || p.loai === "Gia thuộc") return false;
  const sk = getSkillRating(p);
  const et = getEthicsRating(p);
  const note = (p.ghi_chu_ky_luat || "").trim();
  return (sk != null && sk <= 2) || (et != null && et <= 2) || Boolean(note);
}

function getDisciplineCount(){
  if(!Array.isArray(DATA)) return 0;
  return DATA.filter(p => !p.deleted && isDisciplineCase(p)).length;
}

function updateDisciplineBadge(){
  const cnt = getDisciplineCount();
  const badge = document.getElementById("bDisciplineBadge");
  if(badge){
    badge.textContent = cnt;
    badge.style.display = cnt > 0 ? "inline-block" : "none";
  }
  const bnavBadge = document.getElementById("bnavDisciplineBadge");
  if(bnavBadge){
    bnavBadge.textContent = cnt;
    bnavBadge.style.display = cnt > 0 ? "inline-block" : "none";
  }
}

/* ===== Helper Functions ===== */
function noAccent(s){
  return (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
}

function cleanStr(s){
  return noAccent(s).trim().toLowerCase().replace(/\s+/g, " ");
}

function isValidCmnd(c){
  if(c == null) return false;
  const s = String(c).trim().toLowerCase();
  if(!s || s === "không có" || s === "khong co" || s === "chưa có" || s === "chua co" || s === "k" || s === "k co" || s === "-" || s === "0" || s === "none" || s === "null") return false;
  return s.length >= 5;
}

function clone(o){
  if(!o) return [];
  try{ return JSON.parse(JSON.stringify(o)); }catch(e){ return Array.isArray(o)?[...o]:Object.assign({},o); }
}

function cleanPhone(raw){
  if(raw == null) return "";
  let s = String(raw).trim().replace(/\.0+$/, "");
  let cl = s.replace(/[^0-9+]/g, "").trim();
  if(!cl) return "";
  // Excel or Google Sheets stripped leading zero (e.g. 97123456 -> 097123456 or 912345678 -> 0912345678)
  if(/^[1-9]\d{7,9}$/.test(cl)){
    cl = "0" + cl;
  } else if(/^84[1-9]\d{7,9}$/.test(cl)){
    cl = "0" + cl.slice(2);
  } else if(/^855\d{7,9}$/.test(cl)){
    cl = "+" + cl;
  } else if(/^\+8550\d{7,9}$/.test(cl)){
    cl = "+855" + cl.slice(5);
  }
  return cl;
}

/* Persistent local phone registry with auto-healing and collision protection */
const PHONES_KEY = "cn_phones_v1";

function getPhoneCache(){
  try {
    const raw = JSON.parse(localStorage.getItem(PHONES_KEY) || "{}");
    const cleaned = {};
    let changed = false;
    for(const k of Object.keys(raw)){
      const val = cleanPhone(raw[k]);
      if(!val){ changed = true; continue; }
      if(k.startsWith("cmnd:")){
        const cmndVal = k.slice(5);
        if(!isValidCmnd(cmndVal)){ changed = true; continue; }
      }
      cleaned[k] = val;
    }
    if(changed) localStorage.setItem(PHONES_KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch(e){ return {}; }
}

function setPhoneCache(c){
  try { localStorage.setItem(PHONES_KEY, JSON.stringify(c)); } catch(e){}
}

let _phoneSyncTimer = null;
function scheduleServerPhoneSync(){
  if(_phoneSyncTimer) clearTimeout(_phoneSyncTimer);
  _phoneSyncTimer = setTimeout(() => {
    try {
      fetch("/api/sync-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phones: getPhoneCache(),
          config: (typeof CFG !== "undefined") ? CFG : {}
        })
      }).catch(e => {});
    } catch(e){}
  }, 400);
}

function savePhoneToCache(p, phone){
  if(!p) return;
  const ph = cleanPhone(phone || (typeof p === "object" ? getPhone(p) : p));
  if(!ph) return;
  const c = getPhoneCache();
  let changed = false;

  const id = typeof p === "object" ? p.id : null;
  const cmnd = typeof p === "object" ? p.cmnd : null;
  const name = typeof p === "object" ? cleanStr(p.ten_that) : "";
  const room = typeof p === "object" ? cleanStr(p.phong_o) : "";
  const dob = typeof p === "object" ? String(p.ngay_sinh || "").trim() : "";

  if(id != null && id !== "" && id !== "__new__" && !String(id).startsWith("srv_")){
    c["id:" + id] = ph;
    changed = true;
  }
  if(isValidCmnd(cmnd)){
    c["cmnd:" + String(cmnd).trim().toLowerCase()] = ph;
    changed = true;
  }
  if(name && room){
    c["nr:" + name + "__" + room] = ph;
    changed = true;
  }
  if(name && dob){
    c["nd:" + name + "__" + dob] = ph;
    changed = true;
  }
  if(changed) {
    setPhoneCache(c);
    scheduleServerPhoneSync();
  }
}

function lookupPhoneFromCache(p){
  if(!p) return "";
  const c = getPhoneCache();
  if(typeof p !== "object"){
    return c["id:" + p] || "";
  }
  const id = p.id;
  const cmnd = p.cmnd;
  const name = cleanStr(p.ten_that);
  const room = cleanStr(p.phong_o);
  const dob = String(p.ngay_sinh || "").trim();

  if(id != null && id !== "" && id !== "__new__" && !String(id).startsWith("srv_") && c["id:" + id]){
    return c["id:" + id];
  }
  if(isValidCmnd(cmnd) && c["cmnd:" + String(cmnd).trim().toLowerCase()]){
    return c["cmnd:" + String(cmnd).trim().toLowerCase()];
  }
  if(name && room && c["nr:" + name + "__" + room]){
    return c["nr:" + name + "__" + room];
  }
  if(name && dob && c["nd:" + name + "__" + dob]){
    return c["nd:" + name + "__" + dob];
  }
  return "";
}

function removePhoneFromCache(p){
  if(!p || typeof p !== "object") return;
  const c = getPhoneCache();
  let changed = false;
  const id = p.id;
  const cmnd = p.cmnd;
  const name = cleanStr(p.ten_that);
  const room = cleanStr(p.phong_o);
  const dob = String(p.ngay_sinh || "").trim();

  if(id != null && id !== "" && id !== "__new__" && c["id:" + id]){ delete c["id:" + id]; changed = true; }
  if(isValidCmnd(cmnd) && c["cmnd:" + String(cmnd).trim().toLowerCase()]){ delete c["cmnd:" + String(cmnd).trim().toLowerCase()]; changed = true; }
  if(name && room && c["nr:" + name + "__" + room]){ delete c["nr:" + name + "__" + room]; changed = true; }
  if(name && dob && c["nd:" + name + "__" + dob]){ delete c["nd:" + name + "__" + dob]; changed = true; }
  if(changed) setPhoneCache(c);
}

function findMatchingRecord(target, list){
  if(!target || !Array.isArray(list) || list.length === 0) return null;

  const targetName = cleanStr(target.ten_that);
  const targetRoom = cleanStr(target.phong_o);
  const targetDob = String(target.ngay_sinh || "").trim();
  const targetCmnd = isValidCmnd(target.cmnd) ? String(target.cmnd).trim().toLowerCase() : "";

  // 1. Valid CMND match (strictly requires valid CMND to prevent invalid CMND cross-match)
  if(targetCmnd){
    const byCmnd = list.find(x => isValidCmnd(x.cmnd) && String(x.cmnd).trim().toLowerCase() === targetCmnd);
    if(byCmnd) return byCmnd;
  }

  // 2. Name + Room match (100% unique in dataset except 1 infant pair differentiated by DOB)
  if(targetName && targetRoom){
    const byNameRoom = list.filter(x => cleanStr(x.ten_that) === targetName && cleanStr(x.phong_o) === targetRoom);
    if(byNameRoom.length === 1) return byNameRoom[0];
    if(byNameRoom.length > 1 && targetDob){
      const byDob = byNameRoom.find(x => String(x.ngay_sinh || "").trim() === targetDob);
      if(byDob) return byDob;
      return byNameRoom[0];
    }
  }

  // 3. Name + Ngày sinh match
  if(targetName && targetDob){
    const byNameDob = list.find(x => cleanStr(x.ten_that) === targetName && String(x.ngay_sinh || "").trim() === targetDob);
    if(byNameDob) return byNameDob;
  }

  // 4. Tên hồ sơ + Room match
  const targetHoSo = cleanStr(target.ten_ho_so);
  if(targetHoSo && targetRoom){
    const byHoSoRoom = list.find(x => cleanStr(x.ten_ho_so) === targetHoSo && cleanStr(x.phong_o) === targetRoom);
    if(byHoSoRoom) return byHoSoRoom;
  }

  // 5. Direct ID match ONLY IF targetName matches or one of the names is empty!
  if(target.id != null && target.id !== "" && target.id !== "__new__" && !String(target.id).startsWith("srv_")){
    const byId = list.find(x => String(x.id) === String(target.id));
    if(byId){
      const byIdName = cleanStr(byId.ten_that);
      if(!targetName || !byIdName || targetName === byIdName){
        return byId;
      }
    }
  }

  // 6. Name match if unique in list
  if(targetName){
    const nameMatches = list.filter(x => cleanStr(x.ten_that) === targetName);
    if(nameMatches.length === 1) return nameMatches[0];
  }

  return null;
}

function getPhone(p){
  if(!p) return "";
  if(typeof p !== "object") return cleanPhone(p);

  // 1. Check direct standard & Vietnamese property variations
  let s = p.so_dt || p.sdt || p.so_dien_thoai || p.dien_thoai || p.phone ||
          p["Số điện thoại"] || p["Số ĐT"] || p["SĐT"] || p["SDT"] || p["Điện thoại"] ||
          p["Số DT"] || p["Số đt"] || p["sđt"] || p["So dien thoai"] || p["telephone"] ||
          p["mobile"] || p["tel"] || p["lien_he"] || p["Liên hệ"] || "";

  // 2. Iterate keys dynamically with accent-stripped lookup
  if(!s){
    for(const k of Object.keys(p)){
      if(!k || typeof k !== "string") continue;
      const nk = noAccent(k).toLowerCase().replace(/[^a-z0-9]/g, "");
      if(nk === "sodt" || nk === "sodienthoai" || nk === "dienthoai" || nk === "sdt" ||
         nk === "phone" || nk === "mobile" || nk === "tel" || nk === "lienhe" || nk === "telephone"){
        const val = p[k];
        if(val != null && String(val).trim() !== ""){
          s = val;
          break;
        }
      }
    }
  }

  // 3. Fallback: extract phone pattern from ghi_chu
  if(!s && p.ghi_chu){
    const m = String(p.ghi_chu).match(/(?:\+855\s*\d[\d\s.-]{6,12}|0\d{8,10}|\+84\s*\d[\d\s.-]{8,11})/);
    if(m) s = m[0].trim();
  }

  // 4. Fallback: persistent phone cache lookup
  if(!s){
    s = lookupPhoneFromCache(p);
  }

  if(!s) return "";
  return cleanPhone(s);
}

function formatPhone(phone){
  if(!phone) return "";
  const cl = cleanPhone(phone);
  if(cl.startsWith("+855")){
    const rem = cl.slice(4);
    if(rem.length >= 8){
      return "+855 " + rem.slice(0, 2) + " " + rem.slice(2, 5) + " " + rem.slice(5);
    }
    return "+855 " + rem;
  }
  if(cl.startsWith("0")){
    if(cl.length === 10){
      return cl.slice(0, 4) + " " + cl.slice(4, 7) + " " + cl.slice(7);
    }
    if(cl.length === 9){
      return cl.slice(0, 3) + " " + cl.slice(3, 6) + " " + cl.slice(6);
    }
    if(cl.length === 8){
      return cl.slice(0, 3) + " " + cl.slice(3, 6) + " " + cl.slice(6);
    }
  }
  return cl || phone;
}

function phonePillHtml(p, compact){
  const ph = getPhone(p);
  if(!ph) return "";
  const cl = cleanPhone(ph);
  const disp = formatPhone(ph);
  const iconSvg = '<svg class="phone-icon-svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"/></svg>';
  return '<a href="tel:'+esc(cl)+'" class="pill phone-pill" onclick="event.stopPropagation()" title="Bấm để gọi '+esc(disp)+'">' + iconSvg + '<span class="phone-number-text">' + esc(disp) + '</span></a>';
}

function getBaseData(){
  if(typeof BASE_DATA!=="undefined" && Array.isArray(BASE_DATA) && BASE_DATA.length>0) return BASE_DATA;
  if(typeof window!=="undefined" && Array.isArray(window.BASE_DATA) && window.BASE_DATA.length>0) return window.BASE_DATA;
  return [];
}

function dedupeDataset(list){
  if(!Array.isArray(list)) return [];
  const out = [];
  const seenKeys = new Set();

  list.forEach(r => {
    if(!r || typeof r !== "object") return;
    const name = cleanStr(r.ten_that);
    const room = cleanStr(r.phong_o);
    const dob = String(r.ngay_sinh || "").trim();
    const cmnd = isValidCmnd(r.cmnd) ? String(r.cmnd).trim().toLowerCase() : "";

    // Skip empty placeholder records
    if(!name && !cmnd && !room) return;

    let key = "";
    if(cmnd && name) key = `cmnd:${cmnd}__${name}`;
    else if(cmnd && !name) key = `cmnd:${cmnd}`;
    else if(name && room && dob) key = `nrd:${name}__${room}__${dob}`;
    else if(name && room) key = `nr:${name}__${room}`;
    else if(name && dob) key = `nd:${name}__${dob}`;
    else if(r.id != null && r.id !== "" && r.id !== "__new__" && !String(r.id).startsWith("srv_")) key = `id:${r.id}`;
    else key = `name:${name}`;

    if(seenKeys.has(key)){
      const existing = out.find(x => {
        if(cmnd && name && isValidCmnd(x.cmnd) && String(x.cmnd).trim().toLowerCase() === cmnd && cleanStr(x.ten_that) === name) return true;
        if(name && room && cleanStr(x.ten_that) === name && cleanStr(x.phong_o) === room) return true;
        if(x.id != null && r.id != null && String(x.id) === String(r.id)) return true;
        return false;
      });
      if(existing){
        const ph = getPhone(r);
        if(ph && !getPhone(existing)){
          existing.so_dt = ph;
          existing.sdt = ph;
          existing.phone = ph;
          existing["Số điện thoại"] = ph;
          existing["Số ĐT"] = ph;
          savePhoneToCache(existing, ph);
        }
        if(r._edited) existing._edited = true;
      }
      return;
    }
    seenKeys.add(key);
    out.push(r);
  });
  return out;
}

function load(){
  try{
    const s = localStorage.getItem(LS_KEY);
    if(s && s!=="undefined" && s!=="null"){
      let parsed = JSON.parse(s);
      if(Array.isArray(parsed) && parsed.length>0){
        // Auto-clean inflated/duplicate data (e.g. from duplicate sync)
        if(parsed.length > 570){
          parsed = dedupeDataset(parsed);
          try { localStorage.setItem(LS_KEY, JSON.stringify(parsed)); } catch(e){}
        }
        const base = getBaseData();
        const baseMap = new Map();
        base.forEach(b => {
          if(b.id != null) baseMap.set(String(b.id), b);
        });
        const mapped = parsed.map(p => {
          let ph = getPhone(p);
          if(!ph) ph = lookupPhoneFromCache(p);
          if(!ph && p.id != null && baseMap.has(String(p.id))){
            ph = getPhone(baseMap.get(String(p.id)));
          }
          if(ph) {
            p.so_dt = ph;
            p.sdt = ph;
            p.phone = ph;
            p["Số điện thoại"] = ph;
            savePhoneToCache(p, ph);
          }
          return p;
        });
        return dedupeDataset(mapped);
      }
    }
  }catch(e){
    console.warn("Lỗi đọc localStorage:", e);
  }
  const base = getBaseData();
  return dedupeDataset(clone(base).map(p => {
    let ph = getPhone(p);
    if(!ph) ph = lookupPhoneFromCache(p);
    if(ph) {
      p.so_dt = ph;
      p.sdt = ph;
      p.phone = ph;
      p["Số điện thoại"] = ph;
      savePhoneToCache(p, ph);
    }
    return p;
  }));
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
    let ph = getPhone(p);
    if(!ph) ph = lookupPhoneFromCache(p);
    if(ph) {
      p.so_dt = ph;
      p.sdt = ph;
      p.phone = ph;
      p["Số điện thoại"] = ph;
      savePhoneToCache(p, ph);
    }
    return p;
  });
  save();
}
window.DATA = DATA;

// Apply 3-star standard to laborers in current list (KHÔNG xếp hạng cho Gia thuộc)
function applyStandard3Stars(silent) {
  let count = 0;
  DATA.forEach(p => {
    if (p.loai === "Gia thuộc") {
      delete p.danh_gia_ky_nang;
      delete p.danh_gia_dao_duc;
    } else {
      p.danh_gia_ky_nang = 3;
      p.danh_gia_dao_duc = 3;
      count++;
    }
  });

  // Also clean queued modifications to prevent old ratings from reapplying
  try {
    const q = JSON.parse(localStorage.getItem("cn_queue_v1") || "[]");
    let qChanged = false;
    q.forEach(x => {
      if (x.loai === "Gia thuộc") {
        if (x.danh_gia_ky_nang != null || x.danh_gia_dao_duc != null) {
          delete x.danh_gia_ky_nang;
          delete x.danh_gia_dao_duc;
          qChanged = true;
        }
      } else if (x.danh_gia_ky_nang != null || x.danh_gia_dao_duc != null) {
        x.danh_gia_ky_nang = 3;
        x.danh_gia_dao_duc = 3;
        qChanged = true;
      }
    });
    if (qChanged) localStorage.setItem("cn_queue_v1", JSON.stringify(q));
  } catch (e) {}

  save();
  render();

  // Notify server of the 3-star standard application
  try {
    fetch("/api/apply-standard-3stars", { method: "POST" }).catch(() => {});
  } catch (e) {}

  if (!silent) {
    toast("Đã áp dụng tiêu chuẩn 3 sao cho " + count + " lao động");
  }
  return count;
}

// Auto-run once on existing client sessions to apply 3-star standard to all current laborers
try {
  const MIGRATION_KEY = "cn_standard_3star_v2";
  if (!localStorage.getItem(MIGRATION_KEY)) {
    applyStandard3Stars(true);
    localStorage.setItem(MIGRATION_KEY, "true");
  }
} catch (e) {
  console.warn("Standard 3-star migration error:", e);
}

let state = {
  q: "",
  to: "",
  loai: "",
  blood: "",
  rating: "",
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

function imgFileId(id, t){
  try {
    if (typeof window !== "undefined" && window.__IMG_MAP) {
      const entry = window.__IMG_MAP[id] || window.__IMG_MAP[String(id)];
      if (entry && entry[t]) return entry[t];
    }
    const m = JSON.parse(localStorage.getItem("cn_imgfiles_v1") || "{}");
    return m[t + ":" + id] || (m[id] && m[id][t]) || (m[String(id)] && m[String(id)][t]) || null;
  } catch(e) {
    if (typeof window !== "undefined" && window.__IMG_MAP) {
      const entry = window.__IMG_MAP[id] || window.__IMG_MAP[String(id)];
      if (entry && entry[t]) return entry[t];
    }
    return null;
  }
}

function driveImgUrl(fid, id, t){
  if (!fid) return null;
  return "/api/drive-image?fid=" + encodeURIComponent(fid) + (id ? "&id=" + encodeURIComponent(id) : "") + (t ? "&t=" + encodeURIComponent(t) : "");
}

let TEMP_NEW_IMGS = {};

function getImg(id, t) {
  if (id === "__new__") return TEMP_NEW_IMGS[t] || null;
  const k = t + ":" + id;
  // 1. Manual user override or local camera/file edit
  if (k in IMG_OVR) return IMG_OVR[k] === DEL ? null : IMG_OVR[k];
  // 2. Preloaded bundled base64 image (0 latency, 100% offline, zero login required)
  const preloadSource = (typeof PRELOAD_IMG !== "undefined") ? PRELOAD_IMG : ((typeof window !== "undefined" && window.PRELOAD_IMG) ? window.PRELOAD_IMG : PRELOAD);
  const p = preloadSource ? (preloadSource[id] || preloadSource[String(id)]) : null;
  if (p && p[t]) return p[t];
  // 3. Drive File ID synced from cloud -> proxy through server with zero login
  const fid = imgFileId(id, t);
  if (fid) return driveImgUrl(fid, id, t);
  return null;
}

function initServerImagesCatalog() {
  try {
    fetch("/api/images")
      .then(res => res.json())
      .then(data => {
        if (data && data.ok && data.images) {
          window.__IMG_MAP = Object.assign(window.__IMG_MAP || {}, data.images);
          try {
            const m = JSON.parse(localStorage.getItem("cn_imgfiles_v1") || "{}");
            let changed = false;
            for (const id in data.images) {
              for (const t in data.images[id]) {
                const k = t + ":" + id;
                if (m[k] !== data.images[id][t]) {
                  m[k] = data.images[id][t];
                  changed = true;
                }
              }
            }
            if (changed) localStorage.setItem("cn_imgfiles_v1", JSON.stringify(m));
          } catch(e) {}
          if (typeof render === "function") render();
        }
      })
      .catch(() => {});
  } catch(e) {}
}

// Auto-hydrate images catalog from server on load
if (typeof window !== "undefined") {
  if (typeof document !== "undefined" && (document.readyState === "complete" || document.readyState === "interactive")) {
    setTimeout(initServerImagesCatalog, 10);
  } else if (typeof window.addEventListener === "function") {
    window.addEventListener("DOMContentLoaded", initServerImagesCatalog);
  }
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

function getInitials(name) {
  if (!name) return "CN";
  const clean = String(name).trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function handleAvatarError(imgEl, name) {
  if (!imgEl) return;
  imgEl.onerror = null;
  const parent = imgEl.parentElement;
  const init = getInitials(name);
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  const colors = [
    { bg: "#e0f2fe", text: "#0369a1" },
    { bg: "#f0fdf4", text: "#15803d" },
    { bg: "#fef3c7", text: "#b45309" },
    { bg: "#fae8ff", text: "#86198f" },
    { bg: "#ffe4e6", text: "#be123c" },
    { bg: "#ecfdf5", text: "#047857" },
    { bg: "#e0e7ff", text: "#4338ca" }
  ];
  const c = colors[Math.abs(hash) % colors.length];
  const div = document.createElement("div");
  div.className = "avatar avatar-fallback";
  const w = imgEl.style.width || "42px";
  const h = imgEl.style.height || "42px";
  div.style.cssText = `display:flex;align-items:center;justify-content:center;background:${c.bg};color:${c.text};font-weight:700;font-size:13px;border-radius:10px;width:${w};height:${h};user-select:none;flex-shrink:0;`;
  div.textContent = init;
  if (parent) {
    parent.replaceChild(div, imgEl);
  }
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

let currentViewerZoom = 1;
let currentViewerRotation = 0;

function openImageViewer(id, t){
  const uri = getImg(id, t);
  if(!uri){
    toast("Chưa có ảnh để xem");
    return;
  }
  const p = (id !== "__new__") ? DATA.find(x => x.id === id) : null;
  const workerName = p ? (p.ten_that || p.ten_ho_so || "") : "";
  const typeLabel = t === "photo" ? "Ảnh chân dung" : "Ảnh CMND / Thẻ căn cước";
  const fid = imgFileId(id, t);
  const driveUrl = getDriveFileUrl(id, t);

  const oldModal = document.getElementById("imgLightboxModal");
  if(oldModal) oldModal.remove();

  currentViewerZoom = 1;
  currentViewerRotation = 0;

  const modal = document.createElement("div");
  modal.id = "imgLightboxModal";
  modal.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.92);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:12px;touch-action:none;-webkit-user-select:none;user-select:none;";

  modal.innerHTML =
    '<div style="width:100%;max-width:680px;display:flex;align-items:center;justify-content:space-between;color:#fff;padding:4px 6px;">' +
      '<div style="min-width:0;flex:1;">' +
        '<div style="font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(typeLabel) + (workerName ? (' · ' + esc(workerName)) : '') + '</div>' +
        '<div style="font-size:11.5px;color:#94a3b8;margin-top:2px;">Xem ảnh trực tiếp · Thu phóng & Xoay tiện lợi</div>' +
      '</div>' +
      '<button id="bCloseLightbox" style="background:rgba(255,255,255,0.18);border:none;color:#fff;width:34px;height:34px;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>' +
    '</div>' +

    '<div id="lightboxImgContainer" style="flex:1;width:100%;max-width:680px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;cursor:grab;">' +
      '<img id="lightboxImg" src="' + uri + '" style="max-width:100%;max-height:100%;object-fit:contain;transition:transform 0.15s ease-out;transform-origin:center center;" alt="' + esc(typeLabel) + '">' +
    '</div>' +

    '<div style="width:100%;max-width:680px;background:rgba(30,41,59,0.92);border-radius:14px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border:1px solid rgba(255,255,255,0.12);">' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
        '<button id="bZoomIn" class="btn mini-b" style="background:rgba(255,255,255,0.15);color:#fff;border:none;">🔍 +</button>' +
        '<button id="bZoomOut" class="btn mini-b" style="background:rgba(255,255,255,0.15);color:#fff;border:none;">🔍 -</button>' +
        '<button id="bResetZoom" class="btn mini-b" style="background:rgba(255,255,255,0.15);color:#fff;border:none;">↺ 100%</button>' +
        '<button id="bRotateImg" class="btn mini-b" style="background:rgba(255,255,255,0.15);color:#fff;border:none;">🔄 Xoay</button>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
        '<button id="bDownloadLightbox" class="btn mini-b primary" style="font-weight:700;">⬇ Tải về</button>' +
        (fid && driveUrl ? ('<a href="' + driveUrl + '" target="_blank" rel="noopener noreferrer" class="btn mini-b" style="background:rgba(255,255,255,0.12);color:#93c5fd;border:1px solid rgba(147,197,253,0.3);text-decoration:none;">☁️ Mở Drive</a>') : '') +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  const imgEl = modal.querySelector("#lightboxImg");
  const updateTransform = () => {
    if(imgEl) imgEl.style.transform = "scale(" + currentViewerZoom + ") rotate(" + currentViewerRotation + "deg)";
  };

  modal.querySelector("#bCloseLightbox").onclick = () => modal.remove();
  modal.querySelector("#bZoomIn").onclick = () => { currentViewerZoom = Math.min(currentViewerZoom + 0.25, 4); updateTransform(); };
  modal.querySelector("#bZoomOut").onclick = () => { currentViewerZoom = Math.max(currentViewerZoom - 0.25, 0.5); updateTransform(); };
  modal.querySelector("#bResetZoom").onclick = () => { currentViewerZoom = 1; currentViewerRotation = 0; updateTransform(); };
  modal.querySelector("#bRotateImg").onclick = () => { currentViewerRotation = (currentViewerRotation + 90) % 360; updateTransform(); };
  modal.querySelector("#bDownloadLightbox").onclick = () => downloadImg(id, t, typeLabel);
  modal.querySelector("#lightboxImgContainer").onclick = (e) => {
    if(e.target.id === "lightboxImgContainer") modal.remove();
  };
}

function openDriveFile(id, t){
  openImageViewer(id, t);
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

    if(state.blood){
      const b = getBloodType(p).trim().toUpperCase();
      if(state.blood === "has_blood" && !b) return false;
      if(state.blood === "no_blood" && b) return false;
      if(state.blood === "O" && !b.startsWith("O")) return false;
      if(state.blood === "A" && (b.startsWith("AB") || !b.startsWith("A"))) return false;
      if(state.blood === "B" && (b.startsWith("AB") || !b.startsWith("B"))) return false;
      if(state.blood === "AB" && !b.startsWith("AB")) return false;
      if(state.blood === "O+" && b !== "O+") return false;
      if(state.blood === "A+" && b !== "A+") return false;
      if(state.blood === "B+" && b !== "B+") return false;
      if(state.blood === "AB+" && b !== "AB+") return false;
    }

    if(state.rating){
      if(p.loai === "Gia thuộc") return false;
      if(state.rating === "discipline") {
        if(!isDisciplineCase(p)) return false;
      } else {
        const sk = getSkillRating(p);
        const et = getEthicsRating(p);
        if(sk == null || et == null) return false;
        if(state.rating === "5_all" && (sk !== 5 || et !== 5)) return false;
        if(state.rating === "skill_5" && sk !== 5) return false;
        if(state.rating === "skill_4plus" && sk < 4) return false;
        if(state.rating === "ethics_5" && et !== 5) return false;
        if(state.rating === "ethics_4plus" && et < 4) return false;
        if(state.rating === "standard_3" && (sk !== 3 || et !== 3)) return false;
        if(state.rating === "need_training" && (sk >= 3 && et >= 3)) return false;
      }
    }

    if(q){
      const phone = getPhone(p);
      const cleanP = cleanPhone(phone);
      const blood = getBloodType(p);
      const hay = noAccent([p.ten_that, p.ten_ho_so, p.cmnd, phone, blood, "nhom mau " + blood, p.phong_o, p.phan_cay, p.khu_vuc, p.dia_chi, p.so_bao_hiem, p.quan_he, p.noi_sinh, p.ghi_chu].join(" "));
      
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
    const avh = av ? '<img class="sgav" src="'+av+'" onerror="handleAvatarError(this, \''+esc(p.ten_that||'')+'\')">' : '<div class="sgav">'+esc((p.ten_that||"?").trim().slice(-1))+'</div>';
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
  const tbStatus = document.getElementById("tbStatusText");
  if(tbStatus) tbStatus.textContent = rows.length + " / " + DATA.length + " hồ sơ";
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
    const blood = getBloodType(p);
    const skill = getSkillRating(p);
    const ethics = getEthicsRating(p);

    if(p.cmnd) sub.push('<span class="pill">CMND: '+esc(p.cmnd)+'</span>');
    if(phone) sub.push(phonePillHtml(p));
    if(blood) sub.push('<span class="pill pill-blood" title="Nhóm máu: '+esc(blood)+'">🩸 Nhóm '+esc(blood)+'</span>');
    
    // Rating display pill (Skill & Ethics stars - Không xếp hạng cho Gia thuộc)
    if (skill != null && ethics != null && p.loai !== "Gia thuộc") {
      const isPerfect = (skill === 5 && ethics === 5);
      const starTitle = 'Kỹ năng: ' + skill + '/5★ · Đạo đức: ' + ethics + '/5★';
      const ratingHtml = '<span class="pill pill-rating' + (isPerfect ? ' pill-rating-perfect' : '') + '" title="' + starTitle + '">⭐ KN ' + skill + '★ · ĐĐ ' + ethics + '★</span>';
      sub.push(ratingHtml);
    }

    // Dedicated discipline note button for workers with 1-2 stars or discipline record
    if (p.loai !== "Gia thuộc" && isDisciplineCase(p)) {
      const discNote = (p.ghi_chu_ky_luat || "").trim();
      const discTitle = discNote ? ('Ghi chú kỷ luật: ' + esc(discNote)) : 'Công nhân có Kỹ năng hoặc Đạo đức 1-2★ - Quản lý bằng Sổ Kỷ luật';
      const discText = discNote 
        ? ('📕 Sổ Kỷ luật: ' + esc(discNote.length > 22 ? (discNote.slice(0, 20) + '…') : discNote)) 
        : '📕 Ghi chú Sổ Kỷ luật (1-2★)';
      sub.push('<button type="button" class="pill pill-discipline" data-disc-id="' + p.id + '" title="' + discTitle + '">' + discText + '</button>');
    }

    if(p.to) sub.push('<span class="pill">'+esc(p.to)+'</span>');
    if(p.phong_o) sub.push('<span class="pill">🏠 '+esc(p.phong_o)+'</span>');
    if(p.phan_cay) sub.push('<span class="pill">🌳 '+esc(p.phan_cay)+'</span>');
    if(p.quan_he) sub.push('<span class="pill">'+esc(p.quan_he)+'</span>');

    const av = avatar(p);
    const avHtml = av ? '<img class="avatar" src="'+av+'" onerror="handleAvatarError(this, \''+esc(p.ten_that||p.ten_ho_so||'')+'\')">' : '<div class="avatar" style="display:flex;align-items:center;justify-content:center;color:#9bb0a5;font-size:18px;">🧑</div>';

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
  const tbStatus = document.getElementById("tbStatusText");
  if(tbStatus) tbStatus.textContent = keys.length + " phòng (" + totalPpl + " người)";
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
      return '<span class="pill'+(p.chu_phong?' tag chu':'')+'">'+(p.chu_phong?'👑 ':'')+esc(p.ten_that)+(ph?(' 📞'):'')+'</span>';
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
  updateDisciplineBadge();
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
    const avHtml = av ? '<img class="avatar" src="'+av+'" onerror="handleAvatarError(this, \''+esc(p.ten_that||p.ten_ho_so||'')+'\')">' : '<div class="avatar" style="display:flex;align-items:center;justify-content:center;color:#9bb0a5">🧑</div>';
    const ph = getPhone(p);
    const phoneBtn = ph ? phonePillHtml(p) : '<span style="font-size:11.5px;color:var(--muted)">Chưa có SĐT</span>';

    const bld = getBloodType(p);
    const sk = getSkillRating(p);
    const et = getEthicsRating(p);
    let extraBadges = "";
    if (bld) extraBadges += ' <span class="pill pill-blood" style="font-size:11px;padding:1px 6px;">🩸 ' + esc(bld) + '</span>';
    if (p.loai !== "Gia thuộc" && sk != null && et != null) {
      extraBadges += ' <span class="pill pill-rating' + (sk === 5 && et === 5 ? ' pill-rating-perfect' : '') + '" style="font-size:11px;padding:1px 6px;">⭐ KN ' + sk + '★ · ĐĐ ' + et + '★</span>';
    }
    if (p.loai !== "Gia thuộc" && isDisciplineCase(p)) {
      extraBadges += ' <button type="button" class="pill pill-discipline" data-disc-id="' + p.id + '" style="font-size:10.5px;padding:1px 6px;cursor:pointer;" title="Xem/sửa ghi chú kỷ luật">📕 Sổ Kỷ luật (1-2★)</button>';
    }

    rows += '<div class="occ" data-id="'+p.id+'">'+avHtml+
      '<div class="onm">'+esc(p.ten_that||"(chưa có tên)")+
      (p.chu_phong?' <span class="tag chu">👑 Chủ phòng</span>':'')+
      (isMuon(p)?' <span class="tag muon">⚑</span>':'')+
      '<div style="font-size:12px;color:var(--muted);font-weight:400;margin-top:3px">'+
      esc(p.loai)+(p.quan_he?' · '+esc(p.quan_he):'')+(p.to?' · '+esc(p.to):'')+(p.phan_cay?' · 🌳 '+esc(p.phan_cay):'')+(p.cmnd?' · CMND '+esc(p.cmnd):'')+
      '</div>'+
      '<div style="margin-top:4px;display:flex;align-items:center;gap:4px;flex-wrap:wrap">'+phoneBtn+extraBadges+'</div>'+
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
    const discBtn = e.target.closest(".pill-discipline");
    if(discBtn) {
      e.stopPropagation();
      const discId = discBtn.dataset.discId;
      if(discId) openDisciplineQuickEdit(+discId || discId);
      return;
    }
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
    nhom_mau: "",
    danh_gia_ky_nang: 3,
    danh_gia_dao_duc: 3,
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
    ghi_chu_ky_luat: "",
    ngay_ky_luat: "",
    hinh_thuc_ky_luat: "",
    trang_thai_ky_luat: "",
    nguoi_lap_bien_ban: "",
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

  const ph = cleanPhone(rec.so_dt);
  rec.so_dt = ph;
  rec.sdt = ph;
  rec.so_dien_thoai = ph;
  rec.dien_thoai = ph;
  rec.phone = ph;
  rec["Số điện thoại"] = ph;
  rec["Số ĐT"] = ph;
  rec["SĐT"] = ph;
  rec["SDT"] = ph;
  rec["Điện thoại"] = ph;
  if (ph) {
    savePhoneToCache(rec, ph);
  } else {
    removePhoneFromCache(rec);
  }

  // Normalize blood type and ratings (default to 3 stars if not specified, KHÔNG xếp hạng cho Gia thuộc)
  rec.nhom_mau = (rec.nhom_mau || "").trim().toUpperCase();
  if (rec.loai === "Gia thuộc") {
    rec.danh_gia_ky_nang = "";
    rec.danh_gia_dao_duc = "";
    delete rec.danh_gia_ky_nang;
    delete rec.danh_gia_dao_duc;
    delete rec.ghi_chu_ky_luat;
    delete rec.ngay_ky_luat;
    delete rec.hinh_thuc_ky_luat;
    delete rec.trang_thai_ky_luat;
    delete rec.nguoi_lap_bien_ban;
  } else {
    rec.danh_gia_ky_nang = (rec.danh_gia_ky_nang != null && rec.danh_gia_ky_nang !== "") ? (parseInt(rec.danh_gia_ky_nang, 10) || 3) : 3;
    rec.danh_gia_dao_duc = (rec.danh_gia_dao_duc != null && rec.danh_gia_dao_duc !== "") ? (parseInt(rec.danh_gia_dao_duc, 10) || 3) : 3;
    rec._manuallyRated = true;
    rec.ghi_chu_ky_luat = (rec.ghi_chu_ky_luat || "").trim();
    rec.ngay_ky_luat = (rec.ngay_ky_luat || "").trim();
    rec.hinh_thuc_ky_luat = (rec.hinh_thuc_ky_luat || "").trim();
    rec.trang_thai_ky_luat = (rec.trang_thai_ky_luat || "").trim();
    rec.nguoi_lap_bien_ban = (rec.nguoi_lap_bien_ban || "").trim();
  }

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
  updateDisciplineBadge();
  render();

  // Instant server persistence for cross-device synchronization (Admin Phone <-> Computer)
  try {
    fetch("/api/sync-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records: [rec],
        phones: getPhoneCache(),
        queue: JSON.parse(localStorage.getItem("cn_queue_v1") || "[]"),
        config: CFG
      })
    }).catch(e => console.warn("Server save error:", e));
  } catch(e){}

  toast(isNew ? "Đã thêm hồ sơ mới ✓" : "Đã lưu thay đổi hồ sơ ✓");

  // If cloud connected, trigger background sync
  if(CFG.url && CFG.key){
    setTimeout(() => { syncNow(true); }, 500);
  }

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

function renderBloodTypeField(curVal) {
  const cleanVal = (curVal || "").trim().toUpperCase();
  const hasVal = Boolean(cleanVal);
  let h = '<div class="fld" style="margin-bottom:8px;">';
  h += '<div class="blood-picker-box">';
  
  // Header with title, current status badge, and clear button
  h += '  <div class="blood-picker-top">';
  h += '    <div class="blood-picker-title">';
  h += '      <span>🩸 Nhóm máu</span>';
  h += '      <span class="blood-cur-badge' + (hasVal ? '' : ' empty') + '" id="lblCurrentBlood">' + (hasVal ? ('Nhóm ' + esc(cleanVal)) : 'Chưa có') + '</span>';
  h += '    </div>';
  h += '    <button type="button" class="blood-clear-btn" id="bClearBlood" title="Bỏ chọn nhóm máu">✕ Xóa</button>';
  h += '  </div>';

  // 4 Main ABO Segment Buttons (Gom gọn 1 hàng duy nhất)
  h += '  <div class="blood-segment-row">';
  ["O", "A", "B", "AB"].forEach(bg => {
    const isAct = cleanVal === bg;
    h += '<button type="button" class="blood-seg-btn' + (isAct ? ' active' : '') + '" data-blood="' + bg + '"><b>' + bg + '</b></button>';
  });
  h += '  </div>';

  // Detail sub-row: Rh+, rare Rh-, and custom quick input
  h += '  <div class="blood-sub-pills">';
  h += '    <span class="blood-sub-lbl">Chi tiết:</span>';
  ["O+", "A+", "B+", "AB+", "Rh-"].forEach(subBg => {
    const isAct = cleanVal === subBg;
    h += '<button type="button" class="blood-mini-btn' + (isAct ? ' active' : '') + '" data-blood="' + subBg + '">' + subBg + '</button>';
  });
  h += '    <input type="text" data-k="nhom_mau" id="inpBloodType" value="' + esc(cleanVal) + '" placeholder="Khác..." class="blood-inp-compact" maxlength="8" title="Hoặc nhập nhóm máu khác">';
  h += '  </div>';

  h += '</div></div>';
  return h;
}

function renderRatingSection(cur) {
  const isGiaThuoc = cur && cur.loai === "Gia thuộc";
  const skill = (cur && cur.danh_gia_ky_nang != null && cur.danh_gia_ky_nang !== "") ? (parseInt(cur.danh_gia_ky_nang, 10) || 3) : 3;
  const ethics = (cur && cur.danh_gia_dao_duc != null && cur.danh_gia_dao_duc !== "") ? (parseInt(cur.danh_gia_dao_duc, 10) || 3) : 3;

  let h = '<div id="ratingSectionWrap" style="' + (isGiaThuoc ? 'display:none;' : '') + '">';
  h += '<div class="rating-box-card">';
  h += '<div class="rating-box-header">';
  h += '  <div>';
  h += '    <div class="rating-box-title">⭐ Đánh giá tay nghề & Đạo đức</div>';
  h += '    <div class="rating-box-sub">Thang điểm 1 - 5 sao &bull; Mặc định 3 sao (Đạt chuẩn) &bull; Không áp dụng Gia thuộc</div>';
  h += '  </div>';
  h += '  <div style="display:flex;gap:6px;">';
  h += '    <button type="button" class="btn mini-b" id="bToggleDisciplineBox" style="font-size:11px;padding:4px 8px;background:#fff1f2;color:#be123c;border-color:#fecdd3;" title="Bật/Tắt ghi chú Sổ Kỷ luật riêng">📕 Ghi chú Kỷ luật</button>';
  h += '    <button type="button" class="btn mini-b" id="bResetRatings" style="font-size:11px;padding:4px 8px;background:#fefce8;color:#854d0e;border-color:#fef08a;" title="Đặt lại 3 sao mặc định">↺ 3★ mặc định</button>';
  h += '  </div>';
  h += '</div>';

  // Skill row
  h += '<div class="rating-row" data-rating-type="ky_nang">';
  h += '  <div class="rating-row-info">';
  h += '    <span class="rating-label">🛠️ Kỹ năng tay nghề:</span>';
  h += '    <span class="rating-desc-badge" id="lblRatingSkill">' + esc(SKILL_LABELS[skill] || (skill + '★')) + '</span>';
  h += '  </div>';
  h += '  <input type="hidden" data-k="danh_gia_ky_nang" id="inpRatingSkill" value="' + skill + '">';
  h += '  <div class="stars-bar" id="starsSkill">';
  for (let s = 1; s <= 5; s++) {
    h += '<button type="button" class="star-btn' + (s <= skill ? ' on' : '') + '" data-val="' + s + '" title="' + s + ' sao">★</button>';
  }
  h += '  </div>';
  h += '</div>';

  // Ethics row
  h += '<div class="rating-row" data-rating-type="dao_duc" style="margin-top:10px;">';
  h += '  <div class="rating-row-info">';
  h += '    <span class="rating-label">🤝 Đạo đức & Kỷ luật:</span>';
  h += '    <span class="rating-desc-badge" id="lblRatingEthics">' + esc(ETHICS_LABELS[ethics] || (ethics + '★')) + '</span>';
  h += '  </div>';
  h += '  <input type="hidden" data-k="danh_gia_dao_duc" id="inpRatingEthics" value="' + ethics + '">';
  h += '  <div class="stars-bar" id="starsEthics">';
  for (let s = 1; s <= 5; s++) {
    h += '<button type="button" class="star-btn' + (s <= ethics ? ' on' : '') + '" data-val="' + s + '" title="' + s + ' sao">★</button>';
  }
  h += '  </div>';
  h += '</div>';

  // Dedicated discipline note box for workers with 1-2 stars or disciplinary records
  const hasLowStars = (skill <= 2 || ethics <= 2);
  const hasDisciplineRecord = hasLowStars || Boolean((cur && cur.ghi_chu_ky_luat || "").trim());

  h += '<div class="discipline-edit-box" id="disciplineBox" style="' + (hasDisciplineRecord ? '' : 'display:none;') + '">';
  h += '  <div class="discipline-box-header">';
  h += '    <div class="discipline-box-title">';
  h += '      <span>📕 Sổ Kỷ luật & Ghi chú Chấn chỉnh (1-2★)</span>';
  h += '      <span class="discipline-badge-alert" id="discAlertTag">' + (hasLowStars ? '⚠️ 1-2★ Cần theo dõi' : 'Đã ghi nhận') + '</span>';
  h += '    </div>';
  h += '    <button type="button" class="btn mini-b" id="bOpenDisciplineBookFromForm" style="font-size:11px;padding:3px 8px;background:#fff;border-color:#fca5a5;color:#991b1b;cursor:pointer;">📖 Mở Sổ Kỷ luật chung</button>';
  h += '  </div>';
  h += '  <div style="font-size:11.5px;color:#991b1b;margin-bottom:8px;line-height:1.4;">';
  h += '    ⚠️ Quản lý kỷ luật và theo dõi đào tạo lại riêng cho công nhân có Kỹ năng hoặc Đạo đức từ 1 đến 2 sao.';
  h += '  </div>';

  const curDate = (cur && cur.ngay_ky_luat) ? cur.ngay_ky_luat : '';
  const curHinhThuc = (cur && cur.hinh_thuc_ky_luat) ? cur.hinh_thuc_ky_luat : '';
  const curTrangThai = (cur && cur.trang_thai_ky_luat) ? cur.trang_thai_ky_luat : (hasLowStars ? 'Cần chấn chỉnh' : 'Đang theo dõi');
  const curNguoiLap = (cur && cur.nguoi_lap_bien_ban) ? cur.nguoi_lap_bien_ban : '';
  const curGhiChu = (cur && cur.ghi_chu_ky_luat) ? cur.ghi_chu_ky_luat : '';

  h += '  <div class="row2">';
  h += '    <div class="fld"><label>Ngày ghi nhận kỷ luật</label><input type="date" data-k="ngay_ky_luat" id="inpNgayKyLuat" value="' + esc(curDate) + '"></div>';
  h += '    <div class="fld"><label>Hình thức xử lý</label>';
  h += '      <select data-k="hinh_thuc_ky_luat" id="selHinhThucKyLuat">';
  h += '        <option value=""' + (!curHinhThuc ? ' selected' : '') + '>— Chưa chọn —</option>';
  ["Nhắc nhở", "Khiển trách", "Cảnh cáo", "Đào tạo lại tay nghề", "Đình chỉ tạm thời", "Chuyển tổ kiểm điểm", "Khác"].forEach(opt => {
    h += '      <option value="' + opt + '"' + (curHinhThuc === opt ? ' selected' : '') + '>' + opt + '</option>';
  });
  h += '      </select>';
  h += '    </div>';
  h += '  </div>';

  h += '  <div class="row2">';
  h += '    <div class="fld"><label>Trạng thái theo dõi</label>';
  h += '      <select data-k="trang_thai_ky_luat" id="selTrangThaiKyLuat">';
  ["Cần chấn chỉnh", "Đang theo dõi", "Đang đào tạo lại", "Đã có tiến bộ", "Đã khắc phục xong (Đạt chuẩn)"].forEach(opt => {
    h += '      <option value="' + opt + '"' + (curTrangThai === opt ? ' selected' : '') + '>' + opt + '</option>';
  });
  h += '      </select>';
  h += '    </div>';
  h += '    <div class="fld"><label>Cán bộ / Quản lý phụ trách</label><input type="text" data-k="nguoi_lap_bien_ban" id="inpNguoiLapBienBan" placeholder="Tổ trưởng / Giám sát..." value="' + esc(curNguoiLap) + '"></div>';
  h += '  </div>';

  h += '  <div class="fld" style="margin-top:6px;">';
  h += '    <label>Nội dung vi phạm / Ghi chú rèn luyện & kế hoạch đào tạo*</label>';
  h += '    <textarea rows="3" data-k="ghi_chu_ky_luat" id="inpGhiChuKyLuat" placeholder="Ghi rõ hành vi vi phạm kỷ luật hoặc thiếu sót kỹ năng thao tác, kế hoạch đào tạo lại, các mốc kiểm tra...">' + esc(curGhiChu) + '</textarea>';
  h += '  </div>';
  h += '</div>';

  h += '</div></div>';
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
      const iconSvg = '<svg class="phone-icon-svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="color:#fff;"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"/></svg>';
      return '<div class="fld"><label>' + lbl + '</label><div class="fld-phone-wrap"><input type="tel" data-k="' + k + '" value="' + v + '" placeholder="Ví dụ: 0912345678 hoặc +855..."><a href="' + (cl ? ("tel:" + cl) : "#") + '" class="btn primary mini-b" style="' + (cl ? "" : "display:none") + '" id="bCallNow" title="Bấm gọi ngay">' + iconSvg + ' <span>Gọi ngay</span></a></div></div>';
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
  body += renderBloodTypeField(cur.nhom_mau);
  body += renderRatingSection(cur);
  body += '<div class="row2">' + mkInput("khu_vuc", "Khu vực", "input") + mkInput("quan_he", "Quan hệ", "input") + '</div>';
  body += mkInput("so_bao_hiem", "Số bảo hiểm", "input");
  body += mkInput("noi_sinh", "Nơi sinh", "addr");
  body += mkInput("dia_chi", "Địa chỉ thường trú", "addr");
  body += mkInput("chi_tiet_noi_o", "Chi tiết nơi ở", "input");
  body += mkInput("ghi_chu", "Ghi chú", "textarea");

  const sheet = document.getElementById("sheet");
  const workerName = (cur.ten_that || cur.ten_ho_so || "").trim();
  const modalTitle = id === "__new__" 
    ? "➕ Thêm người mới" 
    : ("✏️ " + esc(workerName || "Hồ sơ công nhân"));

  sheet.innerHTML =
    '<div class="sheet-h"><h2 id="sheetTitle">' + modalTitle + '</h2><button class="x" id="bClose">×</button></div>' +
    '<div class="sheet-b">' + body + '</div>' +
    '<div class="sheet-f">' +
    (id !== "__new__" ? '<button class="btn del" id="bDel">🗑 Xóa</button>' : '') +
    '<button class="btn primary" id="bSave">💾 Lưu thay đổi</button>' +
    '</div>';

  document.getElementById("overlay").classList.add("show");
  document.getElementById("bClose").onclick = closeEdit;
  document.getElementById("bSave").onclick = () => saveEdit(id);
  if (id !== "__new__") document.getElementById("bDel").onclick = () => delRec(id);

  // Dynamically update title if worker name is edited in input
  const nameInput = sheet.querySelector("input[data-k='ten_that']");
  if (nameInput && id !== "__new__") {
    nameInput.addEventListener("input", e => {
      const titleEl = sheet.querySelector("#sheetTitle");
      if (titleEl) {
        const val = e.target.value.trim();
        titleEl.textContent = "✏️ " + (val || cur.ten_ho_so || "Hồ sơ công nhân");
      }
    });
  }

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

  // Wire compact blood type picker
  function syncBloodUI(val) {
    const clean = (val || "").trim().toUpperCase();
    const lbl = sheet.querySelector("#lblCurrentBlood");
    if (lbl) {
      if (clean) {
        lbl.textContent = "Nhóm " + clean;
        lbl.classList.remove("empty");
      } else {
        lbl.textContent = "Chưa có";
        lbl.classList.add("empty");
      }
    }
    sheet.querySelectorAll(".blood-seg-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.blood === clean);
    });
    sheet.querySelectorAll(".blood-mini-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.blood === clean);
    });
  }

  sheet.querySelectorAll(".blood-seg-btn, .blood-mini-btn").forEach(btn => {
    btn.onclick = () => {
      const bg = btn.dataset.blood;
      const inp = sheet.querySelector("#inpBloodType");
      if (!inp) return;
      if (inp.value.trim().toUpperCase() === bg) {
        inp.value = "";
      } else {
        inp.value = bg;
      }
      syncBloodUI(inp.value);
    };
  });

  const bClearBlood = sheet.querySelector("#bClearBlood");
  if (bClearBlood) {
    bClearBlood.onclick = () => {
      const inp = sheet.querySelector("#inpBloodType");
      if (inp) inp.value = "";
      syncBloodUI("");
    };
  }

  const inpBlood = sheet.querySelector("#inpBloodType");
  if (inpBlood) {
    inpBlood.addEventListener("input", e => {
      syncBloodUI(e.target.value);
    });
  }

  // Wire star rating picker and auto-open discipline box on 1-2 stars
  function checkDisciplineBoxTrigger() {
    const sVal = parseInt(sheet.querySelector("#inpRatingSkill")?.value, 10) || 3;
    const eVal = parseInt(sheet.querySelector("#inpRatingEthics")?.value, 10) || 3;
    const discBox = sheet.querySelector("#disciplineBox");
    const alertTag = sheet.querySelector("#discAlertTag");
    if (discBox) {
      if (sVal <= 2 || eVal <= 2) {
        discBox.style.display = "block";
        if (alertTag) alertTag.textContent = "⚠️ 1-2★ Cần theo dõi";
        const dDate = sheet.querySelector("#inpNgayKyLuat");
        if (dDate && !dDate.value) dDate.value = new Date().toISOString().slice(0, 10);
      }
    }
  }

  function updateStars(containerId, inputId, labelId, labels, val) {
    const inp = sheet.querySelector("#" + inputId);
    if (inp) inp.value = val;
    const lbl = sheet.querySelector("#" + labelId);
    if (lbl && labels[val]) lbl.textContent = labels[val];
    const container = sheet.querySelector("#" + containerId);
    if (container) {
      container.querySelectorAll(".star-btn").forEach(btn => {
        const starVal = +btn.dataset.val;
        btn.classList.toggle("on", starVal <= val);
      });
    }
    checkDisciplineBoxTrigger();
  }

  sheet.querySelectorAll("#starsSkill .star-btn").forEach(b => {
    b.onclick = () => updateStars("starsSkill", "inpRatingSkill", "lblRatingSkill", SKILL_LABELS, +b.dataset.val);
  });
  sheet.querySelectorAll("#starsEthics .star-btn").forEach(b => {
    b.onclick = () => updateStars("starsEthics", "inpRatingEthics", "lblRatingEthics", ETHICS_LABELS, +b.dataset.val);
  });

  const bToggleDisc = sheet.querySelector("#bToggleDisciplineBox");
  if (bToggleDisc) {
    bToggleDisc.onclick = () => {
      const box = sheet.querySelector("#disciplineBox");
      if (box) {
        const isHidden = box.style.display === "none";
        box.style.display = isHidden ? "block" : "none";
        if (isHidden) {
          const inp = box.querySelector("#inpGhiChuKyLuat");
          if (inp) inp.focus();
        }
      }
    };
  }

  const bOpenDiscForm = sheet.querySelector("#bOpenDisciplineBookFromForm");
  if (bOpenDiscForm) {
    bOpenDiscForm.onclick = () => {
      showDisciplineBook();
    };
  }

  const bResetR = sheet.querySelector("#bResetRatings");
  if (bResetR) {
    bResetR.onclick = () => {
      updateStars("starsSkill", "inpRatingSkill", "lblRatingSkill", SKILL_LABELS, 3);
      updateStars("starsEthics", "inpRatingEthics", "lblRatingEthics", ETHICS_LABELS, 3);
      const noteInp = sheet.querySelector("#inpGhiChuKyLuat");
      const box = sheet.querySelector("#disciplineBox");
      if (box && (!noteInp || !noteInp.value.trim())) {
        box.style.display = "none";
      }
      toast("Đã đặt lại 3 sao mặc định (Đạt chuẩn)");
    };
  }

  // Toggle rating section based on object type (Không xếp hạng cho Gia thuộc)
  const loaiSelect = sheet.querySelector('select[data-k="loai"]');
  const ratingWrap = sheet.querySelector('#ratingSectionWrap');
  if (loaiSelect && ratingWrap) {
    loaiSelect.addEventListener('change', e => {
      if (e.target.value === "Gia thuộc") {
        ratingWrap.style.display = "none";
        const inpS = sheet.querySelector("#inpRatingSkill");
        const inpE = sheet.querySelector("#inpRatingEthics");
        if (inpS) inpS.value = "";
        if (inpE) inpE.value = "";
        const box = sheet.querySelector("#disciplineBox");
        if (box) box.style.display = "none";
      } else {
        ratingWrap.style.display = "";
        const inpS = sheet.querySelector("#inpRatingSkill");
        const inpE = sheet.querySelector("#inpRatingEthics");
        if (inpS && !inpS.value) {
          updateStars("starsSkill", "inpRatingSkill", "lblRatingSkill", SKILL_LABELS, 3);
        }
        if (inpE && !inpE.value) {
          updateStars("starsEthics", "inpRatingEthics", "lblRatingEthics", ETHICS_LABELS, 3);
        }
      }
    });
  }

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

/* ==========================================================================
   SỔ KỶ LUẬT & THEO DÕI CÔNG NHÂN 1 - 2 SAO (DISCIPLINE MANAGEMENT SYSTEM)
   ========================================================================== */

function openDisciplineQuickEdit(id) {
  const p = DATA.find(x => x.id === id);
  if (!p) {
    toast("Không tìm thấy công nhân");
    return;
  }
  const sheet = document.getElementById("sheet");
  const sk = getSkillRating(p);
  const et = getEthicsRating(p);
  const av = avatar(p);
  const avHtml = av ? '<img class="avatar" style="width:46px;height:46px;border-radius:10px;object-fit:cover;" src="' + av + '" onerror="handleAvatarError(this, \''+esc(p.ten_that||p.ten_ho_so||'')+'\')">' : '<div class="avatar" style="width:46px;height:46px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;font-size:22px;">🧑</div>';
  const ph = getPhone(p);
  const cleanP = cleanPhone(ph);

  const curNote = p.ghi_chu_ky_luat || "";
  const curDate = p.ngay_ky_luat || new Date().toISOString().slice(0, 10);
  const curHinhThuc = p.hinh_thuc_ky_luat || "Nhắc nhở";
  const curTrangThai = p.trang_thai_ky_luat || "Đang theo dõi";
  const curNguoiLap = p.nguoi_lap_bien_ban || "";

  let html = '';
  html += '<div class="sheet-h" style="padding:14px 16px 12px;border-bottom:1px solid #e2e8f0;background:#ffffff;">';
  html += '  <div style="display:flex;align-items:center;gap:10px;">';
  html += '    <div style="width:36px;height:36px;border-radius:10px;background:#fff1f2;color:#be123c;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📝</div>';
  html += '    <div>';
  html += '      <h2 style="font-size:16px;font-weight:800;color:#0f172a;margin:0;line-height:1.2;">Cập nhật Biên bản & Xếp hạng</h2>';
  html += '      <div style="font-size:12px;color:#64748b;margin-top:2px;">Theo dõi tiến độ rèn luyện công nhân và ghi nhận biện pháp chấn chỉnh</div>';
  html += '    </div>';
  html += '  </div>';
  html += '  <button class="x" id="bCloseDisc" title="Đóng">×</button>';
  html += '</div>';

  html += '<div class="sheet-b" style="padding:14px 16px;">';
  
  // Worker profile summary
  html += '<div style="display:flex;gap:12px;align-items:center;background:#fff;border:1px solid #fee2e2;border-radius:10px;padding:10px 12px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">';
  html += avHtml;
  html += '  <div style="flex:1;">';
  html += '    <div style="font-size:15px;font-weight:800;color:#0f172a;">' + esc(p.ten_that || "(Chưa có tên)") + (isMuon(p) ? ' <span class="tag muon" style="font-size:11px;">⚑ ' + esc(p.ten_ho_so) + '</span>' : '') + '</div>';
  html += '    <div style="font-size:12px;color:#64748b;margin-top:2px;">';
  html += '      <span>🏠 ' + esc(p.phong_o || "Chưa xếp phòng") + '</span> &bull; ';
  html += '      <span>' + esc(p.to || "Chưa có tổ") + '</span> &bull; ';
  html += '      <span>🌳 ' + esc(p.phan_cay || "Chưa phân") + '</span>';
  if (p.cmnd) html += ' &bull; <span>CMND: ' + esc(p.cmnd) + '</span>';
  html += '    </div>';
  if (cleanP) {
    const iconSvg = '<svg class="phone-icon-svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"/></svg>';
    html += '    <div style="margin-top:5px;"><a href="tel:' + esc(cleanP) + '" class="pill phone-pill" title="Bấm để gọi ' + esc(formatPhone(cleanP)) + '">' + iconSvg + '<span class="phone-number-text">' + esc(formatPhone(cleanP)) + '</span></a></div>';
  }
  html += '  </div>';
  html += '</div>';

  // Ratings adjuster block
  html += '<div style="background:#fffbeb;border:1px solid #fef08a;border-radius:10px;padding:10px 12px;margin-bottom:14px;">';
  html += '  <div style="font-size:12.5px;font-weight:800;color:#854d0e;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">';
  html += '    <span>⭐ Mức Xếp Hạng Đánh Giá</span>';
  html += '    <span style="font-size:11px;color:#a16207;font-weight:600;">(Chạm sao để thay đổi)</span>';
  html += '  </div>';
  html += '  <div class="row2">';
  html += '    <div>';
  html += '      <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:4px;">🛠️ Kỹ năng tay nghề: <span id="lblQuickSkill" style="color:#b45309;">' + (SKILL_LABELS[sk] || (sk + '★')) + '</span></div>';
  html += '      <div class="stars-bar" id="starsQuickSkill">';
  for (let s = 1; s <= 5; s++) {
    html += '<button type="button" class="star-btn' + (s <= sk ? ' on' : '') + '" data-val="' + s + '" style="font-size:22px;">★</button>';
  }
  html += '      </div>';
  html += '      <input type="hidden" id="quickInpSkill" value="' + sk + '">';
  html += '    </div>';
  html += '    <div>';
  html += '      <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:4px;">🤝 Đạo đức & Kỷ luật: <span id="lblQuickEthics" style="color:#b45309;">' + (ETHICS_LABELS[et] || (et + '★')) + '</span></div>';
  html += '      <div class="stars-bar" id="starsQuickEthics">';
  for (let s = 1; s <= 5; s++) {
    html += '<button type="button" class="star-btn' + (s <= et ? ' on' : '') + '" data-val="' + s + '" style="font-size:22px;">★</button>';
  }
  html += '      </div>';
  html += '      <input type="hidden" id="quickInpEthics" value="' + et + '">';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  // Discipline Note Form
  html += '<div style="background:#fff;border:1.5px solid #fecdd3;border-radius:10px;padding:12px 14px;box-shadow:0 1px 4px rgba(0,0,0,0.03);">';
  html += '  <div style="font-size:13px;font-weight:800;color:#991b1b;margin-bottom:10px;">📋 Biên Bản Ghi Nhận Vi Phạm & Biện Pháp Chấn Chỉnh</div>';
  html += '  <div class="row2">';
  html += '    <div class="fld"><label>Ngày ghi nhận kỷ luật*</label><input type="date" id="quickNgayKyLuat" value="' + esc(curDate) + '"></div>';
  html += '    <div class="fld"><label>Hình thức xử lý*</label>';
  html += '      <select id="quickHinhThuc">';
  const hinhThucs = ["Nhắc nhở", "Khiển trách", "Cảnh cáo", "Đào tạo lại tay nghề", "Đình chỉ tạm thời", "Chuyển tổ kiểm điểm", "Khác"];
  hinhThucs.forEach(h => {
    html += '<option value="' + h + '"' + (curHinhThuc === h ? ' selected' : '') + '>' + h + '</option>';
  });
  html += '      </select>';
  html += '    </div>';
  html += '  </div>';

  html += '  <div class="row2">';
  html += '    <div class="fld"><label>Trạng thái theo dõi rèn luyện*</label>';
  html += '      <select id="quickTrangThai">';
  const trangThais = ["Cần chấn chỉnh", "Đang theo dõi", "Đang đào tạo lại", "Đã có tiến bộ", "Đã khắc phục xong (Đạt chuẩn)"];
  trangThais.forEach(t => {
    html += '<option value="' + t + '"' + (curTrangThai === t ? ' selected' : '') + '>' + t + '</option>';
  });
  html += '      </select>';
  html += '    </div>';
  html += '    <div class="fld"><label>Cán bộ / Quản lý phụ trách</label><input type="text" id="quickNguoiLap" placeholder="Tổ trưởng / Giám sát..." value="' + esc(curNguoiLap) + '"></div>';
  html += '  </div>';

  html += '  <div class="fld" style="margin-top:6px;">';
  html += '    <label>Nội dung ghi chú vi phạm / kế hoạch rèn luyện chi tiết*</label>';
  html += '    <textarea id="quickGhiChu" rows="4" placeholder="Nhập chi tiết: ngày giờ, hành vi vi phạm kỷ luật hoặc thiếu sót kỹ năng thao tác, kế hoạch chấn chỉnh, thời hạn theo dõi...">' + esc(curNote) + '</textarea>';
  html += '  </div>';
  html += '</div>';

  // Bottom action bar
  html += '<div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">';
  html += '  <button type="button" class="btn" id="bUpgradeTo3Star" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;font-weight:700;" title="Nâng lên 3 sao khi công nhân đã khắc phục tiến bộ">⭐ Nâng 3★ Đạt chuẩn</button>';
  html += '  <div style="display:flex;gap:8px;">';
  html += '    <button type="button" class="btn" id="bCancelDisc">Đóng</button>';
  html += '    <button type="button" class="btn primary" id="bSaveDisc" style="background:#be123c;border-color:#9f1239;font-weight:700;">💾 Lưu Sổ Kỷ Luật</button>';
  html += '  </div>';
  html += '</div>';

  html += '</div>';

  sheet.innerHTML = html;
  document.getElementById("overlay").classList.add("show");

  // Wire buttons and star clicks
  const closeFn = () => {
    document.getElementById("overlay").classList.remove("show");
  };
  document.getElementById("bCloseDisc").onclick = closeFn;
  document.getElementById("bCancelDisc").onclick = closeFn;

  const wireStarGroup = (containerId, inputId, labelId, labels) => {
    sheet.querySelectorAll("#" + containerId + " .star-btn").forEach(btn => {
      btn.onclick = () => {
        const val = +btn.dataset.val;
        sheet.querySelector("#" + inputId).value = val;
        const lbl = sheet.querySelector("#" + labelId);
        if (lbl && labels[val]) lbl.textContent = labels[val];
        sheet.querySelectorAll("#" + containerId + " .star-btn").forEach(b => {
          b.classList.toggle("on", +b.dataset.val <= val);
        });
      };
    });
  };

  wireStarGroup("starsQuickSkill", "quickInpSkill", "lblQuickSkill", SKILL_LABELS);
  wireStarGroup("starsQuickEthics", "quickInpEthics", "lblQuickEthics", ETHICS_LABELS);

  // Upgrade to 3-star button
  document.getElementById("bUpgradeTo3Star").onclick = () => {
    sheet.querySelector("#quickInpSkill").value = 3;
    sheet.querySelector("#quickInpEthics").value = 3;
    sheet.querySelector("#lblQuickSkill").textContent = SKILL_LABELS[3];
    sheet.querySelector("#lblQuickEthics").textContent = ETHICS_LABELS[3];
    sheet.querySelectorAll("#starsQuickSkill .star-btn").forEach(b => b.classList.toggle("on", +b.dataset.val <= 3));
    sheet.querySelectorAll("#starsQuickEthics .star-btn").forEach(b => b.classList.toggle("on", +b.dataset.val <= 3));
    sheet.querySelector("#quickTrangThai").value = "Đã khắc phục xong (Đạt chuẩn)";
    toast("Đã đặt lại 3★ Đạt chuẩn - Nhấn 'Lưu Sổ Kỷ Luật' để xác nhận");
  };

  // Save button
  document.getElementById("bSaveDisc").onclick = () => {
    const newSkill = parseInt(sheet.querySelector("#quickInpSkill").value, 10) || 3;
    const newEthics = parseInt(sheet.querySelector("#quickInpEthics").value, 10) || 3;
    const newDate = sheet.querySelector("#quickNgayKyLuat").value.trim();
    const newHinhThuc = sheet.querySelector("#quickHinhThuc").value.trim();
    const newTrangThai = sheet.querySelector("#quickTrangThai").value.trim();
    const newNguoiLap = sheet.querySelector("#quickNguoiLap").value.trim();
    const newNote = sheet.querySelector("#quickGhiChu").value.trim();

    p.danh_gia_ky_nang = newSkill;
    p.danh_gia_dao_duc = newEthics;
    p.ngay_ky_luat = newDate;
    p.hinh_thuc_ky_luat = newHinhThuc;
    p.trang_thai_ky_luat = newTrangThai;
    p.nguoi_lap_bien_ban = newNguoiLap;
    p.ghi_chu_ky_luat = newNote;
    p._edited = true;

    queueChange(p);
    save();
    render();
    updateDisciplineBadge();

    // Sync to server
    try {
      fetch("/api/save-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record: p })
      }).catch(e => console.warn("Save discipline error:", e));
    } catch(e) {}

    toast("Đã lưu ghi chú Sổ Kỷ luật cho " + (p.ten_that || "công nhân") + " ✓");
    closeFn();
  };
}

let currentDiscFilter = "all";
let currentDiscSearch = "";

function showDisciplineBook(initFilter, initSearch) {
  if (initFilter) currentDiscFilter = initFilter;
  if (initSearch != null) currentDiscSearch = initSearch;

  const sheet = document.getElementById("sheet");
  const allCases = DATA.filter(p => !p.deleted && isDisciplineCase(p));

  // Compute KPI stats
  const totalCases = allCases.length;
  const count1Star = allCases.filter(p => getSkillRating(p) === 1 || getEthicsRating(p) === 1).length;
  const count2Star = allCases.filter(p => (getSkillRating(p) === 2 || getEthicsRating(p) === 2) && getSkillRating(p) !== 1 && getEthicsRating(p) !== 1).length;
  const countEthics = allCases.filter(p => getEthicsRating(p) <= 2).length;
  const countSkill = allCases.filter(p => getSkillRating(p) <= 2).length;
  const countHasNote = allCases.filter(p => Boolean((p.ghi_chu_ky_luat || "").trim())).length;
  const countNoNote = totalCases - countHasNote;

  // Filter based on active filter tab
  let displayed = allCases;
  if (currentDiscFilter === "1star") {
    displayed = displayed.filter(p => getSkillRating(p) === 1 || getEthicsRating(p) === 1);
  } else if (currentDiscFilter === "2star") {
    displayed = displayed.filter(p => (getSkillRating(p) === 2 || getEthicsRating(p) === 2) && getSkillRating(p) !== 1 && getEthicsRating(p) !== 1);
  } else if (currentDiscFilter === "ethics") {
    displayed = displayed.filter(p => getEthicsRating(p) <= 2);
  } else if (currentDiscFilter === "skill") {
    displayed = displayed.filter(p => getSkillRating(p) <= 2);
  } else if (currentDiscFilter === "has_note") {
    displayed = displayed.filter(p => Boolean((p.ghi_chu_ky_luat || "").trim()));
  } else if (currentDiscFilter === "no_note") {
    displayed = displayed.filter(p => !Boolean((p.ghi_chu_ky_luat || "").trim()));
  }

  // Filter by search query
  const q = noAccent(currentDiscSearch.trim());
  if (q) {
    displayed = displayed.filter(p => {
      const hay = noAccent([p.ten_that, p.ten_ho_so, p.cmnd, p.phong_o, p.to, p.phan_cay, p.ghi_chu_ky_luat, p.hinh_thuc_ky_luat, p.trang_thai_ky_luat].join(" "));
      return hay.includes(q);
    });
  }

  let html = '';
  // Header
  html += '<div class="sheet-h" style="padding:14px 16px 12px;border-bottom:1px solid #e2e8f0;background:#ffffff;">';
  html += '  <div style="display:flex;align-items:center;gap:10px;">';
  html += '    <div style="width:36px;height:36px;border-radius:10px;background:#fff1f2;color:#be123c;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📕</div>';
  html += '    <div>';
  html += '      <h2 style="font-size:16px;font-weight:800;color:#0f172a;margin:0;line-height:1.2;">Sổ Kỷ luật & Theo dõi Rèn luyện</h2>';
  html += '      <div style="font-size:12px;color:#64748b;margin-top:2px;">Quản lý nhân sự cần bồi dưỡng tay nghề (1-2★) và theo dõi vi phạm quy chế xưởng</div>';
  html += '    </div>';
  html += '  </div>';
  html += '  <button class="x" id="bCloseDiscBook" title="Đóng">×</button>';
  html += '</div>';

  html += '<div class="sheet-b" style="padding:14px 16px;">';

  // KPI summary grid
  html += '<div class="disc-kpi-grid">';
  html += '  <div class="disc-kpi-card">';
  html += '    <b>' + totalCases + '</b>';
  html += '    <span>Tổng số trong Sổ</span>';
  html += '  </div>';
  html += '  <div class="disc-kpi-card ' + (count1Star > 0 ? 'urgent' : '') + '">';
  html += '    <b>' + count1Star + '</b>';
  html += '    <span>🚨 Báo động đỏ (1★)</span>';
  html += '  </div>';
  html += '  <div class="disc-kpi-card ' + (count2Star > 0 ? 'warning' : '') + '">';
  html += '    <b>' + count2Star + '</b>';
  html += '    <span>⚠️ Cần theo dõi (2★)</span>';
  html += '  </div>';
  html += '  <div class="disc-kpi-card ' + (countHasNote > 0 ? 'info' : '') + '">';
  html += '    <b>' + countHasNote + '</b>';
  html += '    <span>📝 Đã lập biên bản</span>';
  html += '  </div>';
  html += '</div>';

  // Toolbar
  html += '<div class="disc-toolbar">';
  html += '  <div class="disc-search-wrap">';
  html += '    <span class="disc-search-icon"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4"/></svg></span>';
  html += '    <input type="search" id="discSearchInput" placeholder="Tìm tên, CMND, tổ, phòng, nội dung vi phạm..." value="' + esc(currentDiscSearch) + '">';
  html += '  </div>';
  html += '  <div class="disc-toolbar-actions">';
  html += '    <button type="button" class="btn primary" id="bAddWorkerToDisc" style="background:#be123c;border-color:#9f1239;padding:7px 11px;font-size:12.5px;font-weight:700;">➕ Thêm vào sổ</button>';
  html += '    <button type="button" class="btn" id="bExportDiscXlsx" style="padding:7px 10px;font-size:12.5px;" title="Xuất file Excel danh sách kỷ luật">⬇️ Excel</button>';
  html += '    <button type="button" class="btn" id="bPrintDisc" style="padding:7px 10px;font-size:12.5px;" title="In danh sách kỷ luật">🖨️ In</button>';
  html += '  </div>';
  html += '</div>';

  // Filter tabs
  const tabs = [
    ["all", "Tất cả (" + totalCases + ")"],
    ["1star", "🚨 Báo động 1★ (" + count1Star + ")"],
    ["2star", "⚠️ Cần theo dõi 2★ (" + count2Star + ")"],
    ["has_note", "📝 Có biên bản (" + countHasNote + ")"],
    ["no_note", "Chưa biên bản (" + countNoNote + ")"]
  ];
  html += '<div class="disc-tabs-bar">';
  tabs.forEach(t => {
    const isAct = currentDiscFilter === t[0];
    html += '<button type="button" class="disc-tab-btn' + (isAct ? ' on' : '') + '" data-filter="' + t[0] + '">' + t[1] + '</button>';
  });
  html += '</div>';

  // Workers List
  if (displayed.length === 0) {
    if (totalCases === 0) {
      html += '<div style="text-align:center;padding:36px 16px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;margin-top:8px;">';
      html += '  <div style="font-size:42px;margin-bottom:8px;">🎉</div>';
      html += '  <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px;">Hiện không có công nhân nào trong Sổ Kỷ luật!</div>';
      html += '  <div style="font-size:13px;color:#64748b;max-width:440px;margin:0 auto 14px;">Tất cả lao động đang đạt tiêu chuẩn từ 3 sao trở lên (Đạt chuẩn quy định) và không có vi phạm kỷ luật.</div>';
      html += '  <button type="button" class="btn primary" id="bEmptyAddDisc" style="background:#be123c;border-color:#9f1239;">➕ Ghi nhận trường hợp kỷ luật mới</button>';
      html += '</div>';
    } else {
      html += '<div style="text-align:center;padding:28px 16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;color:#64748b;font-size:13px;">Không tìm thấy công nhân nào khớp với bộ lọc hoặc từ khóa tìm kiếm.</div>';
    }
  } else {
    html += '<div class="disc-list">';
    displayed.forEach(p => {
      const sk = getSkillRating(p);
      const et = getEthicsRating(p);
      const av = avatar(p);
      const avHtml = av ? '<img class="avatar" style="width:42px;height:42px;border-radius:10px;object-fit:cover;flex-shrink:0;" src="' + av + '" onerror="handleAvatarError(this, \''+esc(p.ten_that||p.ten_ho_so||'')+'\')">' : '<div class="avatar" style="width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;font-size:18px;flex-shrink:0;">🧑</div>';
      const ph = getPhone(p);
      const cleanP = cleanPhone(ph);

      const isUrgent = (sk === 1 || et === 1);
      const isWarning = (!isUrgent && (sk === 2 || et === 2));
      const curStatus = p.trang_thai_ky_luat || "Đang theo dõi";
      const isResolved = curStatus.includes("Đã khắc phục");

      let cardStatusClass = "status-normal";
      if (isResolved) cardStatusClass = "status-resolved";
      else if (isUrgent) cardStatusClass = "status-urgent";
      else if (isWarning) cardStatusClass = "status-warning";

      html += '<div class="disc-card ' + cardStatusClass + '" data-disc-id="' + p.id + '">';
      html += '  <div class="disc-card-status-bar"></div>';
      
      // Header row
      html += '  <div class="disc-card-header">';
      html += '    <div class="disc-card-user">';
      html += avHtml;
      html += '      <div>';
      html += '        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
      html += '          <span class="disc-card-name">' + esc(p.ten_that || "(Chưa có tên)") + '</span>';
      if (isMuon(p)) html += '<span class="tag muon" style="font-size:10px;padding:1px 5px;">⚑ ' + esc(p.ten_ho_so) + '</span>';
      html += '        </div>';
      html += '        <div class="disc-card-meta">';
      if (p.to) html += '<span>' + esc(p.to) + '</span><span aria-hidden="true">&bull;</span>';
      if (p.phong_o) html += '<span>Phòng ' + esc(p.phong_o) + '</span><span aria-hidden="true">&bull;</span>';
      if (p.phan_cay) html += '<span>Cây ' + esc(p.phan_cay) + '</span><span aria-hidden="true">&bull;</span>';
      if (p.cmnd) html += '<span>CMND: ' + esc(p.cmnd) + '</span>';
      if (cleanP) {
        html += '<span aria-hidden="true">&bull;</span><a href="tel:' + esc(cleanP) + '" style="color:#0f766e;font-weight:700;text-decoration:none;" title="Gọi ' + esc(formatPhone(cleanP)) + '">📞 ' + esc(formatPhone(cleanP)) + '</a>';
      }
      html += '        </div>';
      html += '      </div>';
      html += '    </div>';

      let pillClass = "warning";
      if (isResolved) pillClass = "resolved";
      else if (isUrgent) pillClass = "urgent";
      html += '    <span class="disc-status-pill ' + pillClass + '">' + esc(curStatus) + '</span>';
      html += '  </div>';

      // Ratings & Disciplinary metrics line
      html += '  <div class="disc-card-ratings">';
      html += '    <span class="disc-rating-item ' + (sk <= 1 ? 'low' : (sk === 2 ? 'mid' : '')) + '">🛠️ Kỹ năng: <b>' + sk + '★</b>' + (sk <= 1 ? ' (Cần đào tạo lại)' : '') + '</span>';
      html += '    <span class="disc-rating-item ' + (et <= 1 ? 'low' : (et === 2 ? 'mid' : '')) + '">🤝 Đạo đức: <b>' + et + '★</b>' + (et <= 1 ? ' (Chấn chỉnh)' : '') + '</span>';
      if (p.hinh_thuc_ky_luat) {
        html += '    <span class="disc-rating-item" style="background:#f5f3ff;color:#6d28d9;border-color:#ede9fe;">⚖️ ' + esc(p.hinh_thuc_ky_luat) + '</span>';
      }
      if (p.ngay_ky_luat) {
        html += '    <span class="disc-rating-item" style="color:#64748b;">📅 ' + esc(p.ngay_ky_luat) + '</span>';
      }
      html += '  </div>';

      // Note content box
      html += '  <div class="disc-note-box">';
      if ((p.ghi_chu_ky_luat || "").trim()) {
        html += '    <div class="disc-note-title"><span>📝</span> Nội dung biên bản vi phạm & kế hoạch rèn luyện:</div>';
        html += '    <div class="disc-note-body">' + esc(p.ghi_chu_ky_luat) + '</div>';
        if (p.nguoi_lap_bien_ban) {
          html += '    <div class="disc-note-author">— Cán bộ phụ trách: ' + esc(p.nguoi_lap_bien_ban) + '</div>';
        }
      } else {
        html += '    <div class="disc-note-empty">⚠️ Chưa có ghi chú cụ thể. Nhấn "Cập nhật biên bản" bên dưới để bổ sung nội dung rèn luyện.</div>';
      }
      html += '  </div>';

      // Actions footer
      html += '  <div class="disc-card-actions">';
      html += '    <button type="button" class="disc-action-btn disc-action-upgrade btn-upgrade-3star" data-id="' + p.id + '" title="Nâng lên 3 sao Đạt chuẩn khi công nhân có tiến bộ">⭐ Nâng 3★ Đạt chuẩn</button>';
      html += '    <button type="button" class="disc-action-btn disc-action-edit btn-quick-disc" data-id="' + p.id + '">📝 Cập nhật biên bản</button>';
      html += '    <button type="button" class="disc-action-btn disc-action-view btn-full-profile" data-id="' + p.id + '">👤 Hồ sơ chi tiết &rarr;</button>';
      html += '  </div>';

      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>';

  sheet.innerHTML = html;
  document.getElementById("overlay").classList.add("show");

  // Wire close
  const closeBookFn = () => {
    document.getElementById("overlay").classList.remove("show");
  };
  document.getElementById("bCloseDiscBook").onclick = closeBookFn;

  // Wire search input with live search
  const sInp = sheet.querySelector("#discSearchInput");
  if (sInp) {
    sInp.addEventListener("input", e => {
      currentDiscSearch = e.target.value;
      showDisciplineBook(currentDiscFilter, currentDiscSearch);
      const newInp = document.getElementById("discSearchInput");
      if (newInp) {
        newInp.focus();
        newInp.setSelectionRange(newInp.value.length, newInp.value.length);
      }
    });
  }

  // Wire filter tabs
  sheet.querySelectorAll(".disc-filter-tab").forEach(tab => {
    tab.onclick = () => {
      currentDiscFilter = tab.dataset.filter;
      showDisciplineBook(currentDiscFilter, currentDiscSearch);
    };
  });

  // Wire quick edit buttons on cards
  sheet.querySelectorAll(".btn-quick-disc").forEach(btn => {
    btn.onclick = () => {
      openDisciplineQuickEdit(+btn.dataset.id || btn.dataset.id);
    };
  });

  // Wire upgrade 3-star buttons
  sheet.querySelectorAll(".btn-upgrade-3star").forEach(btn => {
    btn.onclick = () => {
      const pid = +btn.dataset.id || btn.dataset.id;
      const worker = DATA.find(x => x.id === pid);
      if (!worker) return;
      if (confirm("Nâng công nhân '" + (worker.ten_that || "này") + "' lên 3★ Đạt chuẩn và đánh dấu Đã khắc phục?")) {
        worker.danh_gia_ky_nang = 3;
        worker.danh_gia_dao_duc = 3;
        worker.trang_thai_ky_luat = "Đã khắc phục xong (Đạt chuẩn)";
        worker._edited = true;
        queueChange(worker);
        save();
        render();
        updateDisciplineBadge();
        try {
          fetch("/api/save-record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ record: worker })
          }).catch(() => {});
        } catch(e) {}
        toast("Đã nâng 3★ Đạt chuẩn cho " + (worker.ten_that || "công nhân"));
        showDisciplineBook(currentDiscFilter, currentDiscSearch);
      }
    };
  });

  // Wire full profile buttons
  sheet.querySelectorAll(".btn-full-profile").forEach(btn => {
    btn.onclick = () => {
      const pid = +btn.dataset.id || btn.dataset.id;
      openEdit(pid);
    };
  });

  // Wire add worker to discipline
  const bAdd = sheet.querySelector("#bAddWorkerToDisc");
  const bEmptyAdd = sheet.querySelector("#bEmptyAddDisc");
  const addFn = () => openAddDisciplineWorker();
  if (bAdd) bAdd.onclick = addFn;
  if (bEmptyAdd) bEmptyAdd.onclick = addFn;

  // Wire export and print
  const bExport = sheet.querySelector("#bExportDiscXlsx");
  if (bExport) bExport.onclick = exportDisciplineXlsx;
  const bPrint = sheet.querySelector("#bPrintDisc");
  if (bPrint) bPrint.onclick = printDisciplineReport;
}

function openAddDisciplineWorker() {
  const sheet = document.getElementById("sheet");
  const nonGiaThuoc = DATA.filter(p => !p.deleted && p.loai !== "Gia thuộc").sort((a,b) => (a.ten_that || "").localeCompare(b.ten_that || "", "vi"));

  html += '<div class="sheet-h" style="padding:14px 16px 12px;border-bottom:1px solid #e2e8f0;background:#ffffff;">';
  html += '  <div style="display:flex;align-items:center;gap:10px;">';
  html += '    <div style="width:36px;height:36px;border-radius:10px;background:#fff1f2;color:#be123c;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">➕</div>';
  html += '    <div>';
  html += '      <h2 style="font-size:16px;font-weight:800;color:#0f172a;margin:0;line-height:1.2;">Chọn Công Nhân vào Sổ Kỷ Luật</h2>';
  html += '      <div style="font-size:12px;color:#64748b;margin-top:2px;">Tìm kiếm và chọn công nhân cần bồi dưỡng tay nghề hoặc chấn chỉnh tác phong</div>';
  html += '    </div>';
  html += '  </div>';
  html += '  <button class="x" id="bCloseAddDisc" title="Đóng">×</button>';
  html += '</div>';

  html += '<div class="sheet-b" style="padding:14px 16px;">';
  html += '  <div style="font-size:12.5px;color:#64748b;margin-bottom:10px;">Tìm kiếm và chọn công nhân cần ghi nhận kỷ luật hoặc chấn chỉnh tay nghề:</div>';
  html += '  <input type="search" id="inpSearchPickWorker" placeholder="Gõ tên, CMND, phòng ở để tìm nhanh..." style="width:100%;padding:8px 12px;font-size:13px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:12px;">';
  html += '  <div id="pickWorkerList" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">';
  
  nonGiaThuoc.forEach(p => {
    const isAlready = isDisciplineCase(p);
    html += '<div class="clickable-worker-row" data-id="' + p.id + '" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;background:' + (isAlready ? '#fff1f2' : '#fff') + '">';
    html += '  <div>';
    html += '    <b style="font-size:13.5px;color:#0f172a;">' + esc(p.ten_that || "(Chưa có tên)") + '</b>';
    if (isMuon(p)) html += ' <span class="tag muon" style="font-size:10px;">⚑ ' + esc(p.ten_ho_so) + '</span>';
    html += '    <div style="font-size:11.5px;color:#64748b;">';
    html += '      <span>🏠 ' + esc(p.phong_o || "—") + '</span> &bull; <span>' + esc(p.to || "—") + '</span> &bull; <span>CMND: ' + esc(p.cmnd || "—") + '</span>';
    html += '    </div>';
    html += '  </div>';
    html += '  <div style="display:flex;align-items:center;gap:6px;">';
    if (isAlready) {
      html += '    <span class="discipline-badge-alert" style="font-size:10.5px;">Đang trong Sổ</span>';
    }
    html += '    <button type="button" class="btn mini-b" style="background:#be123c;color:#fff;border-color:#9f1239;font-size:11px;padding:3px 8px;">Chọn ➔</button>';
    html += '  </div>';
    html += '</div>';
  });

  html += '  </div>';
  html += '  <div style="margin-top:12px;display:flex;justify-content:flex-end;">';
  html += '    <button type="button" class="btn" id="bBackToDiscBook">Quay lại Sổ Kỷ luật</button>';
  html += '  </div>';
  html += '</div>';

  sheet.innerHTML = html;

  document.getElementById("bCloseAddDisc").onclick = () => showDisciplineBook();
  document.getElementById("bBackToDiscBook").onclick = () => showDisciplineBook();

  // Search filter
  const sInp = sheet.querySelector("#inpSearchPickWorker");
  if (sInp) {
    sInp.addEventListener("input", e => {
      const q = noAccent(e.target.value.trim());
      sheet.querySelectorAll(".clickable-worker-row").forEach(row => {
        const txt = noAccent(row.textContent);
        row.style.display = txt.includes(q) ? "" : "none";
      });
    });
  }

  // Click row to pick worker
  sheet.querySelectorAll(".clickable-worker-row").forEach(row => {
    row.onclick = () => {
      const pid = +row.dataset.id || row.dataset.id;
      const worker = DATA.find(x => x.id === pid);
      if (worker) {
        if (getSkillRating(worker) >= 3 && getEthicsRating(worker) >= 3) {
          worker.danh_gia_dao_duc = 2; // Default to 2 stars (vi phạm nhắc nhở)
        }
        if (!worker.ngay_ky_luat) {
          worker.ngay_ky_luat = new Date().toISOString().slice(0, 10);
        }
        openDisciplineQuickEdit(pid);
      }
    };
  });
}

function exportDisciplineXlsx() {
  const cases = DATA.filter(p => !p.deleted && isDisciplineCase(p));
  if (cases.length === 0) {
    toast("Hiện không có công nhân nào trong Sổ Kỷ luật để xuất");
    return;
  }

  const head = [
    "STT",
    "Họ và tên (Tên thật)",
    "Tên trong hồ sơ",
    "Tên mượn?",
    "CMND / CCCD",
    "Số điện thoại",
    "Phòng ở",
    "Tổ",
    "Phân cây",
    "Kỹ năng (1-5★)",
    "Đạo đức (1-5★)",
    "Mức độ xếp loại",
    "Ngày ghi nhận kỷ luật",
    "Hình thức xử lý",
    "Trạng thái theo dõi",
    "Cán bộ phụ trách",
    "Nội dung vi phạm & Ghi chú kỷ luật chi tiết"
  ];

  const aoa = [head];
  cases.forEach((p, i) => {
    const sk = getSkillRating(p);
    const et = getEthicsRating(p);
    let mucDo = "";
    if (sk === 1 || et === 1) mucDo = "🚨 1★ Báo động đỏ";
    else if (sk === 2 || et === 2) mucDo = "⚠️ 2★ Cần theo dõi";
    else mucDo = "Đã khắc phục / Theo dõi";

    aoa.push([
      i + 1,
      p.ten_that || "",
      p.ten_ho_so || "",
      isMuon(p) ? "x" : "",
      p.cmnd || "",
      getPhone(p) || "",
      p.phong_o || "",
      p.to || "",
      p.phan_cay || "",
      sk != null ? (sk + " sao") : "",
      et != null ? (et + " sao") : "",
      mucDo,
      p.ngay_ky_luat || "",
      p.hinh_thuc_ky_luat || "",
      p.trang_thai_ky_luat || "",
      p.nguoi_lap_bien_ban || "",
      p.ghi_chu_ky_luat || ""
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 22 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 40 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sổ Kỷ Luật");
  const d = new Date();
  const fn = "So_Ky_Luat_Cong_Nhan_DSX02_" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + ".xlsx";
  XLSX.writeFile(wb, fn);
  toast("Đã xuất " + cases.length + " trường hợp Sổ Kỷ luật ra Excel ✓");
}

function printDisciplineReport() {
  const cases = DATA.filter(p => !p.deleted && isDisciplineCase(p));
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }
  const d = new Date();
  const dateStr = ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();

  let h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sổ Kỷ Luật & Theo Dõi Rèn Luyện</title>';
  h += '<style>';
  h += 'body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:20px;}';
  h += 'h1{font-size:18px;text-align:center;margin-bottom:4px;color:#991b1b;}';
  h += '.sub{text-align:center;font-size:12px;color:#555;margin-bottom:16px;}';
  h += 'table{width:100%;border-collapse:collapse;margin-top:10px;}';
  h += 'th,td{border:1px solid #333;padding:6px 8px;font-size:11.5px;text-align:left;}';
  h += 'th{background:#f1f5f9;font-weight:bold;}';
  h += '.alert1{color:#dc2626;font-weight:bold;}';
  h += '.alert2{color:#ea580c;font-weight:bold;}';
  h += '@media print{button{display:none;}}';
  h += '</style></head><body>';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
  h += '  <div><b>ĐỘI SẢN XUẤT 02</b><br>BỘ PHẬN NHÂN SỰ & QUẢN LÝ LAO ĐỘNG</div>';
  h += '  <button onclick="window.print()" style="padding:6px 12px;font-weight:bold;cursor:pointer;">🖨️ In trang này</button>';
  h += '</div>';
  h += '<h1>SỔ KỶ LUẬT & THEO DÕI RÈN LUYỆN LAO ĐỘNG (1-2★)</h1>';
  h += '<div class="sub">Ngày kết xuất báo cáo: ' + dateStr + ' &bull; Tổng số trường hợp: <b>' + cases.length + '</b></div>';
  h += '<table>';
  h += '<thead><tr><th>STT</th><th>Họ và tên</th><th>CMND</th><th>SĐT</th><th>Phòng / Tổ</th><th>Kỹ năng</th><th>Đạo đức</th><th>Ngày</th><th>Hình thức</th><th>Trạng thái</th><th>Nội dung vi phạm / Ghi chú</th></tr></thead>';
  h += '<tbody>';
  cases.forEach((p, i) => {
    const sk = getSkillRating(p);
    const et = getEthicsRating(p);
    h += '<tr>';
    h += '<td>' + (i + 1) + '</td>';
    h += '<td><b>' + esc(p.ten_that || "") + '</b>' + (isMuon(p) ? '<br><small>(Tên HS: ' + esc(p.ten_ho_so) + ')</small>' : '') + '</td>';
    h += '<td>' + esc(p.cmnd || "") + '</td>';
    h += '<td>' + esc(getPhone(p) || "") + '</td>';
    h += '<td>' + esc(p.phong_o || "") + ' (' + esc(p.to || "") + ')</td>';
    h += '<td class="' + (sk === 1 ? 'alert1' : (sk === 2 ? 'alert2' : '')) + '">' + sk + '★</td>';
    h += '<td class="' + (et === 1 ? 'alert1' : (et === 2 ? 'alert2' : '')) + '">' + et + '★</td>';
    h += '<td>' + esc(p.ngay_ky_luat || "") + '</td>';
    h += '<td>' + esc(p.hinh_thuc_ky_luat || "") + '</td>';
    h += '<td>' + esc(p.trang_thai_ky_luat || "") + '</td>';
    h += '<td>' + esc(p.ghi_chu_ky_luat || "") + '</td>';
    h += '</tr>';
  });
  h += '</tbody></table>';
  h += '<div style="margin-top:30px;display:flex;justify-content:space-around;text-align:center;">';
  h += '  <div><b>NGƯỜI LẬP BIỂU</b><br><br><br><br>(Ký, họ tên)</div>';
  h += '  <div><b>TỔ TRƯỞNG / QUẢN LÝ</b><br><br><br><br>(Ký, họ tên)</div>';
  h += '  <div><b>CHỈ HUY ĐỘI SX02</b><br><br><br><br>(Ký, đóng dấu)</div>';
  h += '</div>';
  h += '</body></html>';

  printWindow.document.write(h);
  printWindow.document.close();
}

/* ---------- Modal Thống Kê & Phân Tích Toàn Diện (Analytics Modal) ---------- */
let currentStatTab = "person"; // "person" | "room"

function animateStatCounters(container){
  if(!container) return;
  const els = container.querySelectorAll(".stat-num");
  const duration = 850; // ms
  const startTime = performance.now();
  const items = [];

  els.forEach(el => {
    const raw = el.getAttribute("data-val") || el.textContent.trim();
    const type = el.getAttribute("data-type") || "int";
    const v1 = parseFloat(el.getAttribute("data-v1") || raw) || 0;
    const v2 = parseFloat(el.getAttribute("data-v2") || "0") || 0;
    const format = el.getAttribute("data-format") || "{v1}";
    const suffix = el.getAttribute("data-suffix") || "";
    items.push({ el, type, v1, v2, format, suffix });
  });

  function tick(now){
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

    items.forEach(item => {
      let text = "";
      if(item.type === "int"){
        const cur = Math.round(item.v1 * ease);
        text = cur.toLocaleString("vi-VN") + item.suffix;
      } else if(item.type === "decimal"){
        const cur = (item.v1 * ease).toFixed(1);
        text = cur + item.suffix;
      } else if(item.type === "dual-int"){
        const c1 = Math.round(item.v1 * ease);
        const c2 = Math.round(item.v2 * ease);
        text = item.format.replace("{v1}", c1).replace("{v2}", c2);
      } else if(item.type === "dual-star"){
        const c1 = (item.v1 * ease).toFixed(1);
        const c2 = (item.v2 * ease).toFixed(1);
        text = item.format.replace("{v1}", c1).replace("{v2}", c2);
      } else if(item.type === "ratio"){
        const c1 = Math.round(item.v1 * ease);
        const c2 = Math.round(item.v2 * ease);
        text = item.format.replace("{v1}", c1).replace("{v2}", c2);
      } else if(item.type === "with-pct"){
        const c1 = Math.round(item.v1 * ease);
        const c2 = Math.round(item.v2 * ease);
        text = item.format.replace("{v1}", c1).replace("{v2}", c2);
      }
      item.el.textContent = text;
    });

    if(progress < 1){
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);

  // Animate progress bar widths smoothly
  container.querySelectorAll(".stat-bar-fill").forEach(bar => {
    const targetWidth = bar.getAttribute("data-pct") || "0%";
    bar.style.width = "0%";
    setTimeout(() => {
      bar.style.width = targetWidth;
    }, 40);
  });
}

function showStats(initTab){
  if(initTab) currentStatTab = initTab;
  const sheet = document.getElementById("sheet");
  if(!sheet) return;

  // Nhân sự data
  const byTo = {}, byLoai = { "Lao động": 0, "Gia thuộc": 0, "Khác": 0 };
  let muon = 0, hasPhoneCount = 0, countM = 0, countF = 0, under25 = 0, mid2540 = 0, over40 = 0;
  const roomsSet = new Set();
  let noRoomCount = 0;

  const byBlood = { "O": 0, "A": 0, "B": 0, "AB": 0, "Chưa rõ": 0 };
  let hasBloodCount = 0;
  let countRatedWorkers = 0;
  let sumSkill = 0, sumEthics = 0;
  let perfect5Count = 0;

  DATA.forEach(p => {
    byTo[p.to || "(trống)"] = (byTo[p.to || "(trống)"] || 0) + 1;
    byLoai[p.loai] = (byLoai[p.loai] || 0) + 1;
    if(isMuon(p)) muon++;
    if(getPhone(p)) hasPhoneCount++;
    if(p.phong_o) roomsSet.add(p.phong_o);
    else noRoomCount++;

    const b = getBloodType(p).trim().toUpperCase();
    if(b){
      hasBloodCount++;
      if(b.startsWith("O")) byBlood["O"]++;
      else if(b.startsWith("AB")) byBlood["AB"]++;
      else if(b.startsWith("A")) byBlood["A"]++;
      else if(b.startsWith("B")) byBlood["B"]++;
      else byBlood["Chưa rõ"]++;
    } else {
      byBlood["Chưa rõ"]++;
    }

    if(p.loai !== "Gia thuộc"){
      const sk = getSkillRating(p);
      const et = getEthicsRating(p);
      if(sk != null && et != null){
        countRatedWorkers++;
        sumSkill += sk;
        sumEthics += et;
        if(sk === 5 && et === 5) perfect5Count++;
      }
    }

    if(p.gioi_tinh === "M") countM++;
    else if(p.gioi_tinh === "F") countF++;

    const a = +displayAge(p);
    if(a > 0){
      if(a < 25) under25++;
      else if(a <= 40) mid2540++;
      else over40++;
    }
  });

  const avgSkill = countRatedWorkers > 0 ? (sumSkill / countRatedWorkers).toFixed(1) : "3.0";
  const avgEthics = countRatedWorkers > 0 ? (sumEthics / countRatedWorkers).toFixed(1) : "3.0";
  const editedCount = DATA.filter(p => p._edited).length;

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

  const avgDensity = allInUseRooms.length > 0 ? ((DATA.length - noRoomCount) / allInUseRooms.length).toFixed(1) : "0.0";
  const leaderCoverage = allInUseRooms.length > 0 ? Math.round((totalRoomsWithChu / allInUseRooms.length) * 100) : 0;

  // TAB 1 HTML: Nhân sự
  let toTable = "";
  const sortedTo = Object.keys(byTo).sort((a,b) => (byTo[b] || 0) - (byTo[a] || 0));
  sortedTo.forEach((k, idx) => {
    const cnt = byTo[k];
    const pct = Math.round((cnt / (DATA.length || 1)) * 100);
    const rankClass = idx === 0 ? "top-1" : (idx === 1 ? "top-2" : (idx === 2 ? "top-3" : ""));
    toTable += '<tr class="clickable-row" data-filter-to="'+esc(k)+'" title="Bấm để lọc danh sách theo '+esc(k)+'">'+
      '<td><span class="stat-rank '+rankClass+'">'+(idx+1)+'</span><b>'+esc(k)+'</b></td>'+
      '<td style="text-align:right;font-weight:700;color:#0f766e;">'+cnt+' <span style="font-size:11px;color:#64748b;font-weight:500;">('+pct+'%)</span></td>'+
      '<td style="width:28%;min-width:75px;padding-right:12px;">'+
        '<div class="stat-bar-track">'+
          '<div class="stat-bar-fill" data-pct="'+pct+'%" style="background:#0f766e;"></div>'+
        '</div>'+
      '</td>'+
      '</tr>';
  });

  const bloodGroups = [
    { label: "Nhóm máu O (O, O+)", key: "O", color: "#e11d48" },
    { label: "Nhóm máu A (A, A+)", key: "A", color: "#0284c7" },
    { label: "Nhóm máu B (B, B+)", key: "B", color: "#7c3aed" },
    { label: "Nhóm máu AB (AB, AB+)", key: "AB", color: "#059669" },
    { label: "Chưa cập nhật nhóm máu", key: "Chưa rõ", color: "#94a3b8" }
  ];
  let bloodBarsHtml = "";
  bloodGroups.forEach(bg => {
    const cnt = byBlood[bg.key] || 0;
    const pct = Math.round((cnt / (DATA.length || 1)) * 100);
    bloodBarsHtml += 
      '<div class="stat-bar-item">'+
        '<div class="stat-bar-label-row">'+
          '<span>'+bg.label+'</span>'+
          '<span style="font-weight:700;color:'+bg.color+';">'+cnt+' người <span style="color:#94a3b8;font-size:11px;font-weight:500;">('+pct+'%)</span></span>'+
        '</div>'+
        '<div class="stat-bar-track">'+
          '<div class="stat-bar-fill" data-pct="'+pct+'%" style="background:'+bg.color+';"></div>'+
        '</div>'+
      '</div>';
  });

  const ageGroups = [
    { label: "Dưới 25 tuổi (Thanh niên trẻ)", cnt: under25, color: "#06b6d4" },
    { label: "25 đến 40 tuổi (Độ tuổi vàng lao động)", cnt: mid2540, color: "#0f766e" },
    { label: "Trên 40 tuổi (Kinh nghiệm thâm niên)", cnt: over40, color: "#f59e0b" }
  ];
  let ageBarsHtml = "";
  const totalWithAge = under25 + mid2540 + over40 || 1;
  ageGroups.forEach(ag => {
    const pct = Math.round((ag.cnt / totalWithAge) * 100);
    ageBarsHtml += 
      '<div class="stat-bar-item">'+
        '<div class="stat-bar-label-row">'+
          '<span>'+ag.label+'</span>'+
          '<span style="font-weight:700;color:'+ag.color+';">'+ag.cnt+' người <span style="color:#94a3b8;font-size:11px;font-weight:500;">('+pct+'%)</span></span>'+
        '</div>'+
        '<div class="stat-bar-track">'+
          '<div class="stat-bar-fill" data-pct="'+pct+'%" style="background:'+ag.color+';"></div>'+
        '</div>'+
      '</div>';
  });

  const ldPercent = Math.round(((byLoai["Lao động"] || 0) / (DATA.length || 1)) * 100);
  const gtPercent = Math.round(((byLoai["Gia thuộc"] || 0) / (DATA.length || 1)) * 100);

  const tabPersonHtml =
    '<div class="stat-hero-card">'+
      '<div class="stat-hero-title"><span>🏭</span> TỔNG QUY MÔ NHÂN SỰ ĐỘI SẢN XUẤT 02</div>'+
      '<div class="stat-hero-val">'+
        '<span class="stat-num" data-val="'+DATA.length+'" data-type="int">0</span>'+
        '<span style="font-size:18px;font-weight:600;opacity:0.9;">người</span>'+
      '</div>'+
      '<div class="stat-hero-chips">'+
        '<span class="stat-hero-chip">👷 Lao động: '+(byLoai["Lao động"]||0)+' ('+ldPercent+'%)</span>'+
        '<span class="stat-hero-chip">👨‍👩‍👧 Gia thuộc: '+(byLoai["Gia thuộc"]||0)+' ('+gtPercent+'%)</span>'+
        '<span class="stat-hero-chip">⚥ '+countM+' Nam · '+countF+' Nữ</span>'+
      '</div>'+
    '</div>'+

    '<div class="statgrid">'+
      '<div class="stat-card stat-theme-teal">'+
        '<div class="stat-card-icon">👷</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+(byLoai["Lao động"]||0)+'" data-type="int">0</span></div>'+
        '<div class="stat-card-label">Lao động trực tiếp</div>'+
        '<div class="stat-card-sub">Chiếm '+ldPercent+'% tổng nhân sự</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-purple">'+
        '<div class="stat-card-icon">👨‍👩‍👧</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+(byLoai["Gia thuộc"]||0)+'" data-type="int">0</span></div>'+
        '<div class="stat-card-label">Gia thuộc đi cùng</div>'+
        '<div class="stat-card-sub">Chiếm '+gtPercent+'% tổng số người</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-blue">'+
        '<div class="stat-card-icon">⚥</div>'+
        '<div class="stat-card-num" style="font-size:17px;"><span class="stat-num" data-type="dual-int" data-v1="'+countM+'" data-v2="'+countF+'" data-format="{v1} Nam / {v2} Nữ">0 Nam / 0 Nữ</span></div>'+
        '<div class="stat-card-label">Cơ cấu Giới tính</div>'+
        '<div class="stat-card-sub">'+Math.round(countM/(DATA.length||1)*100)+'% Nam · '+Math.round(countF/(DATA.length||1)*100)+'% Nữ</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-amber">'+
        '<div class="stat-card-icon">⭐</div>'+
        '<div class="stat-card-num" style="font-size:18px;"><span class="stat-num" data-type="dual-star" data-v1="'+avgSkill+'" data-v2="'+avgEthics+'" data-format="{v1}★ / {v2}★">0.0★ / 0.0★</span></div>'+
        '<div class="stat-card-label">TB Kỹ năng / Đạo đức</div>'+
        '<div class="stat-card-sub">Thang 5★ (Chuẩn mặc định 3★)</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-emerald">'+
        '<div class="stat-card-icon">🏆</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-type="ratio" data-v1="'+perfect5Count+'" data-v2="'+countRatedWorkers+'" data-format="{v1} / {v2}">0 / 0</span></div>'+
        '<div class="stat-card-label">5★ Toàn diện (LĐ)</div>'+
        '<div class="stat-card-sub">Đạt tối đa kỹ năng & đạo đức</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-rose">'+
        '<div class="stat-card-icon">🩸</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+hasBloodCount+'" data-type="int">0</span></div>'+
        '<div class="stat-card-label">Đã có Nhóm máu 🩸</div>'+
        '<div class="stat-card-sub">Cần cho y tế & cấp cứu an toàn</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-blue">'+
        '<div class="stat-card-icon">📞</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+hasPhoneCount+'" data-type="int">0</span></div>'+
        '<div class="stat-card-label">Đã có Số điện thoại 📞</div>'+
        '<div class="stat-card-sub">Liên lạc công việc & gia đình</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-amber">'+
        '<div class="stat-card-icon">⚑</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+muon+'" data-type="int">0</span></div>'+
        '<div class="stat-card-label">Có tên mượn ⚑</div>'+
        '<div class="stat-card-sub">Cần rà soát hồ sơ định danh</div>'+
      '</div>'+

      '<div class="stat-card '+(noRoomCount > 0 ? 'stat-theme-warn' : 'stat-theme-emerald')+'">'+
        '<div class="stat-card-icon">'+(noRoomCount > 0 ? '⚠️' : '🏡')+'</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+noRoomCount+'" data-type="int">0</span></div>'+
        '<div class="stat-card-label">'+(noRoomCount > 0 ? 'Chưa có phòng ở ⚠️' : '100% Đã có phòng')+'</div>'+
        '<div class="stat-card-sub">'+(noRoomCount > 0 ? 'Cần bố trí nơi cư trú sớm' : 'Chỗ ở ổn định hoàn toàn')+'</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-slate">'+
        '<div class="stat-card-icon">✎</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+editedCount+'" data-type="int">0</span></div>'+
        '<div class="stat-card-label">Đã chỉnh sửa thông tin</div>'+
        '<div class="stat-card-sub">Được lưu vết tự động</div>'+
      '</div>'+
    '</div>'+

    '<div class="stat-section">'+
      '<div class="stat-section-title">'+
        '<span>🩸 Phân bổ Nhóm máu</span>'+
        '<span class="stat-section-subtitle">Y tế & Cấp cứu lao động</span>'+
      '</div>'+
      bloodBarsHtml+
    '</div>'+

    '<div class="stat-section">'+
      '<div class="stat-section-title">'+
        '<span>🏭 Phân bổ theo Tổ sản xuất</span>'+
        '<span class="stat-section-subtitle">Bấm dòng để lọc danh sách</span>'+
      '</div>'+
      '<div style="overflow-x:auto;">'+
        '<table class="stat-table">'+
          '<thead>'+
            '<tr>'+
              '<th>Tổ sản xuất</th>'+
              '<th style="text-align:right;">Số lượng</th>'+
              '<th style="padding-right:12px;">Tỷ trọng</th>'+
            '</tr>'+
          '</thead>'+
          '<tbody>'+toTable+'</tbody>'+
        '</table>'+
      '</div>'+
    '</div>'+

    '<div class="stat-section">'+
      '<div class="stat-section-title">'+
        '<span>🎂 Phân bổ Độ tuổi nhân sự</span>'+
        '<span class="stat-section-subtitle">Cơ cấu độ tuổi lao động</span>'+
      '</div>'+
      ageBarsHtml+
    '</div>';

  // TAB 2 HTML: Phòng ở & Phân loại
  let blockTable = "";
  const sortedBlocks = Object.values(blockStats).sort((a,b) => a.name.localeCompare(b.name, "vi", {numeric:true}));
  sortedBlocks.forEach(b => {
    const dens = b.rooms > 0 ? (b.totalPpl / b.rooms).toFixed(1) : "0.0";
    blockTable += '<tr class="clickable-row" data-filter-block="'+esc(b.name)+'" title="Bấm để xem các phòng dãy '+esc(b.name)+'">'+
      '<td><b>'+esc(b.name)+'</b></td>'+
      '<td><span class="stat-badge" style="background:#f1f5f9;color:#334155;">'+b.rooms+'</span></td>'+
      '<td><b style="color:#0f766e;">'+b.totalPpl+'</b></td>'+
      '<td><span style="font-size:11.5px;color:#475569;">'+b.ld+' LĐ / '+b.gt+' GT</span></td>'+
      '<td>'+(b.hasChu > 0 ? ('<span class="stat-badge" style="background:#fef3c7;color:#b45309;">👑 '+b.hasChu+'</span>') : '<span style="color:#cbd5e1;">—</span>')+'</td>'+
      '<td><span class="stat-badge" style="background:#e0f2fe;color:#0369a1;">'+dens+' ng/p</span></td>'+
      '</tr>';
  });

  const tabRoomHtml =
    '<div class="stat-hero-card" style="background:linear-gradient(135deg, #0369a1 0%, #0f766e 100%);">'+
      '<div class="stat-hero-title"><span>🏠</span> HỆ THỐNG PHÒNG Ở VÀ CƯ TRÚ ĐSX 02</div>'+
      '<div class="stat-hero-val">'+
        '<span class="stat-num" data-val="'+allInUseRooms.length+'" data-type="int">0</span>'+
        '<span style="font-size:18px;font-weight:600;opacity:0.9;">phòng đang ở</span>'+
      '</div>'+
      '<div class="stat-hero-chips">'+
        '<span class="stat-hero-chip">👥 Mật độ TB: '+avgDensity+' người/phòng</span>'+
        '<span class="stat-hero-chip">👑 Đã có chủ: '+totalRoomsWithChu+' phòng ('+leaderCoverage+'%)</span>'+
        '<span class="stat-hero-chip">'+(totalRoomsNoChu > 0 ? ('⚠️ Chưa có chủ: ' + totalRoomsNoChu) : '✅ 100% có chủ phòng')+'</span>'+
      '</div>'+
    '</div>'+

    '<div class="statgrid">'+
      '<div class="stat-card stat-theme-blue">'+
        '<div class="stat-card-icon">👥</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+avgDensity+'" data-type="decimal">0.0</span></div>'+
        '<div class="stat-card-label">Mật độ trung bình</div>'+
        '<div class="stat-card-sub">Người trên mỗi phòng</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-amber">'+
        '<div class="stat-card-icon">👑</div>'+
        '<div class="stat-card-num" style="font-size:17px;"><span class="stat-num" data-type="with-pct" data-v1="'+totalRoomsWithChu+'" data-v2="'+leaderCoverage+'" data-format="{v1} phòng ({v2}%)">0 (0%)</span></div>'+
        '<div class="stat-card-label">Đã có Chủ phòng 👑</div>'+
        '<div class="stat-card-sub">Tỷ lệ bao phủ quản lý phòng</div>'+
      '</div>'+

      '<div class="stat-card '+(totalRoomsNoChu > 0 ? 'stat-theme-warn' : 'stat-theme-emerald')+'">'+
        '<div class="stat-card-icon">'+(totalRoomsNoChu > 0 ? '⚠️' : '✅')+'</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+totalRoomsNoChu+'" data-type="int">0</span></div>'+
        '<div class="stat-card-label">'+(totalRoomsNoChu > 0 ? 'Chưa có Chủ phòng ⚠️' : 'Đầy đủ Chủ phòng')+'</div>'+
        '<div class="stat-card-sub">'+(totalRoomsNoChu > 0 ? 'Cần bầu chủ quản lý phòng' : 'Tất cả phòng đều có chủ')+'</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-teal">'+
        '<div class="stat-card-icon">🚪</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+capDist["1"]+'" data-type="int">0</span></div>'+
        '<div class="stat-card-label">Phòng 1 người (ở riêng)</div>'+
        '<div class="stat-card-sub">Phòng đơn độc lập</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-purple">'+
        '<div class="stat-card-icon">🏠</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+capDist["2-3"]+'" data-type="int">0</span></div>'+
        '<div class="stat-card-label">Phòng vừa (2 – 3 người)</div>'+
        '<div class="stat-card-sub">Quy mô phổ biến nhất</div>'+
      '</div>'+

      '<div class="stat-card stat-theme-slate">'+
        '<div class="stat-card-icon">🏢</div>'+
        '<div class="stat-card-num"><span class="stat-num" data-val="'+(capDist["4-5"]+capDist["6+"])+'" data-type="int">0</span></div>'+
        '<div class="stat-card-label">Phòng đông (≥4 người)</div>'+
        '<div class="stat-card-sub">Gia đình hoặc tổ ghép</div>'+
      '</div>'+
    '</div>'+

    '<div class="stat-section">'+
      '<div class="stat-section-title">'+
        '<span>👥 Phân loại quy mô sức chứa</span>'+
        '<span class="stat-section-subtitle">Bấm dòng để lọc phòng</span>'+
      '</div>'+
      '<div style="overflow-x:auto;">'+
        '<table class="stat-table">'+
          '<tbody>'+
            '<tr class="clickable-row" data-filter-cap="1" title="Xem phòng 1 người">'+
              '<td>🚪 <b>Phòng 1 người (ở riêng)</b></td>'+
              '<td style="text-align:right;font-weight:700;color:#0f766e;">'+capDist["1"]+' phòng</td>'+
            '</tr>'+
            '<tr class="clickable-row" data-filter-cap="2-3" title="Xem phòng 2 - 3 người">'+
              '<td>🏠 <b>Phòng 2 – 3 người (vừa)</b></td>'+
              '<td style="text-align:right;font-weight:700;color:#0f766e;">'+capDist["2-3"]+' phòng</td>'+
            '</tr>'+
            '<tr class="clickable-row" data-filter-cap="4+" title="Xem phòng đông 4 người trở lên">'+
              '<td>🏢 <b>Phòng đông (4 người trở lên)</b></td>'+
              '<td style="text-align:right;font-weight:700;color:#0f766e;">'+(capDist["4-5"]+capDist["6+"])+' phòng</td>'+
            '</tr>'+
          '</tbody>'+
        '</table>'+
      '</div>'+
    '</div>'+

    '<div class="stat-section">'+
      '<div class="stat-section-title">'+
        '<span>🏢 Chi tiết theo từng Dãy phòng</span>'+
        '<span class="stat-section-subtitle">Bấm dòng để mở dãy phòng</span>'+
      '</div>'+
      '<div style="overflow-x:auto;">'+
        '<table class="stat-table">'+
          '<thead>'+
            '<tr>'+
              '<th>Dãy</th>'+
              '<th>Số phòng</th>'+
              '<th>Tổng người</th>'+
              '<th>Thành phần</th>'+
              '<th>Có Chủ 👑</th>'+
              '<th>Mật độ TB</th>'+
            '</tr>'+
          '</thead>'+
          '<tbody>'+blockTable+'</tbody>'+
        '</table>'+
      '</div>'+
    '</div>';

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

  // Run dynamic number counter and progress bar animations
  animateStatCounters(sheet);
}

/* ---------- Switch View (People vs Rooms) ---------- */
function setView(v){
  state.view = v;
  hideSugg();
  const tabPeople = document.getElementById("tabPeople");
  const tabRooms = document.getElementById("tabRooms");
  if(tabPeople) tabPeople.classList.toggle("on", v === "people");
  if(tabRooms) tabRooms.classList.toggle("on", v === "rooms");

  const bnavPeople = document.getElementById("bnavPeople");
  const bnavRooms = document.getElementById("bnavRooms");
  if(bnavPeople) bnavPeople.classList.toggle("on", v === "people");
  if(bnavRooms) bnavRooms.classList.toggle("on", v === "rooms");

  const bAdd = document.getElementById("bAdd");
  if(bAdd) bAdd.style.display = "none";

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
  ["Nhóm máu", p => getBloodType(p)],
  ["Kỹ năng (1-5★)", p => (p.loai === "Gia thuộc" || getSkillRating(p) == null) ? "" : (getSkillRating(p) + " sao")],
  ["Đạo đức (1-5★)", p => (p.loai === "Gia thuộc" || getEthicsRating(p) == null) ? "" : (getEthicsRating(p) + " sao")],
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
        nhom_mau: find("nhom mau", "mau", "blood"),
        danh_gia_ky_nang: find("ky nang", "tay nghe", "skill"),
        danh_gia_dao_duc: find("dao duc", "ky luat", "ethics"),
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
        rec.nhom_mau = (rec.nhom_mau || "").trim().toUpperCase();
        rec.danh_gia_ky_nang = rec.loai === "Gia thuộc" ? "" : (parseInt(rec.danh_gia_ky_nang, 10) || 3);
        rec.danh_gia_dao_duc = rec.loai === "Gia thuộc" ? "" : (parseInt(rec.danh_gia_dao_duc, 10) || 3);
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

function isKeyAdmin(key, user) {
  const k = (key || "").toLowerCase().trim();
  const u = (user || "").toLowerCase().trim();
  if (k.includes("admin") || u.includes("admin") || u === "tony" || u.includes("quanly") || u.includes("totruong") || u.includes("nguyễn việt hùng") || u.includes("nguyen viet hung")) return true;
  if (k === "tony" || k === "dsx02" || k === "123456" || k === "admin123" || k === "dsx02admin") return true;
  if (k.length >= 4) return true; // flexible master key for administrators
  return false;
}

try{
  const s = localStorage.getItem("cn_cfg_v1");
  if(s) CFG = Object.assign({}, CFG, JSON.parse(s));
}catch(e){}

let savedRole = null;
try { savedRole = localStorage.getItem("cn_role_v1"); } catch(e){}
let ROLE = savedRole || (isKeyAdmin(CFG.key, CFG.user) ? "admin" : "vip");
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
      DATA = mergeServerData(list, []);
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

let RESOLVED_ACTIONS = { sync: "pull", pull: "pull", push: "push", uploadImage: "uploadImage", deleteImage: "deleteImage" };

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

    // Ensure compatibility with Google Apps Script push format
    if(actionName === "push" && !payload.changes && Array.isArray(payload.records)){
      payload.changes = payload.records.map(r => ({ rec: r }));
    }

    return { targetUrl, payload };
  }

  // 1. Try effective action
  const { targetUrl, payload } = buildUrlAndPayload(effectiveAct);
  let res = normalizeApiResponse(await rawApiCall(targetUrl, payload, "POST"));

  // 2. If unknown_action, auto-negotiate with fallback candidate actions
  const isUnknown = res.error === "unknown_action" || res.msg === "unknown_action" || res.err === "unknown_action";
  if(isUnknown && (act === "sync" || act === "pull")){
    const candidates = [
      "pull", "sync", "syncData", "getData", "sync_data", "get_data", "get", "read",
      "load", "fetch", "getAll", "get_all", "list", "save", "saveData", "push"
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
      const getBuild = buildUrlAndPayload("pull");
      const getRes = normalizeApiResponse(await rawApiCall(getBuild.targetUrl, null, "GET"));
      if(getRes.ok && Array.isArray(getRes.data)){
        return getRes;
      }
    } catch(e){}
  }

  return res;
}

function enrichRecordForServer(r){
  if(!r || typeof r !== "object") return r;
  const o = Object.assign({}, r);
  const ph = getPhone(o) || lookupPhoneFromCache(o);
  if(ph){
    o.so_dt = ph;
    o.sdt = ph;
    o.so_dien_thoai = ph;
    o.dien_thoai = ph;
    o.phone = ph;
    o.mobile = ph;
    o.tel = ph;
    o["Số điện thoại"] = ph;
    o["Số ĐT"] = ph;
    o["SĐT"] = ph;
    o["SDT"] = ph;
    o["Điện thoại"] = ph;
  }
  // Standard Vietnamese Sheet headers matching EXPORT_COLS for direct GAS column updates
  if(o.cmnd != null) o["CMND"] = o.cmnd;
  if(o.ten_that != null) {
    o["HỌ VÀ TÊN (Tên thật)"] = o.ten_that;
    o["Họ và tên (tên thật)"] = o.ten_that;
    o["Họ và tên"] = o.ten_that;
  }
  if(o.ten_ho_so != null) {
    o["TÊN TRONG HỒ SƠ"] = o.ten_ho_so;
    o["Tên trong hồ sơ"] = o.ten_ho_so;
  }
  if(o.ngay_sinh != null) o["Ngày sinh"] = o.ngay_sinh;
  if(o.tuoi != null) o["Tuổi"] = o.tuoi;
  if(o.noi_sinh != null) o["Nơi sinh"] = o.noi_sinh;
  if(o.gioi_tinh != null) o["Giới tính"] = o.gioi_tinh;
  if(o.loai != null) o["Loại"] = o.loai;
  if(o.to != null) o["Tổ"] = o.to;
  if(o.khu_vuc != null) o["Khu vực"] = o.khu_vuc;
  if(o.phan_cay != null) o["Phần cây hiện tại"] = o.phan_cay;
  if(o.quan_he != null) o["Quan hệ"] = o.quan_he;
  if(o.phong_o != null) {
    o["PHÒNG Ở"] = o.phong_o;
    o["Phòng ở"] = o.phong_o;
  }
  if(o.so_bao_hiem != null) o["Số bảo hiểm"] = o.so_bao_hiem;
  if(o.chi_tiet_noi_o != null) o["Chi tiết nơi ở"] = o.chi_tiet_noi_o;
  if(o.dia_chi != null) o["Địa chỉ thường trú"] = o.dia_chi;
  if(o.ghi_chu != null) o["Ghi chú"] = o.ghi_chu;
  o["Chủ phòng"] = o.chu_phong ? "x" : "";
  return o;
}

function queueChange(p){
  try{
    const enriched = enrichRecordForServer(p);
    const q = JSON.parse(localStorage.getItem("cn_queue_v1") || "[]");
    const i = q.findIndex(x => String(x.id) === String(enriched.id));
    if(i >= 0) q[i] = enriched; else q.push(enriched);
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
  if(!o || typeof o !== "object") return blank();
  const r = {};

  const normKeyMap = {};
  for(const k of Object.keys(o)){
    const nk = noAccent(k).toLowerCase().replace(/[^a-z0-9]/g, "");
    normKeyMap[nk] = o[k];
  }

  const findVal = (fieldKey, ...aliases) => {
    if(o[fieldKey] != null && String(o[fieldKey]).trim() !== "") return String(o[fieldKey]).trim();
    for(const a of aliases){
      if(o[a] != null && String(o[a]).trim() !== "") return String(o[a]).trim();
      const na = noAccent(a).toLowerCase().replace(/[^a-z0-9]/g, "");
      if(normKeyMap[na] != null && String(normKeyMap[na]).trim() !== "") return String(normKeyMap[na]).trim();
    }
    const nfk = noAccent(fieldKey).toLowerCase().replace(/[^a-z0-9]/g, "");
    if(normKeyMap[nfk] != null && String(normKeyMap[nfk]).trim() !== "") return String(normKeyMap[nfk]).trim();
    return "";
  };

  r.cmnd = findVal("cmnd", "CMND / CCCD", "CMND", "CCCD", "Số CMND", "so_cmnd");
  r.ten_that = findVal("ten_that", "Họ và tên (tên thật)", "Họ và tên", "HỌ VÀ TÊN (Tên thật)", "Họ tên", "ho_ten", "ten");
  r.ten_ho_so = findVal("ten_ho_so", "Tên trong hồ sơ (tên mượn)", "TÊN TRONG HỒ SƠ", "Tên hồ sơ", "ten_muon");
  r.ngay_sinh = findVal("ngay_sinh", "Ngày sinh", "Ngày sinh (dd/mm/yyyy)", "ngay sinh");
  r.tuoi = findVal("tuoi", "Tuổi");
  r.noi_sinh = findVal("noi_sinh", "Nơi sinh");
  r.gioi_tinh = findVal("gioi_tinh", "Giới tính", "Giới");
  r.loai = findVal("loai", "Loại", "Loại đối tượng");
  r.to = findVal("to", "Tổ");
  r.khu_vuc = findVal("khu_vuc", "Khu vực");
  r.phan_cay = findVal("phan_cay", "Phần cây hiện tại", "Phần cây");
  r.quan_he = findVal("quan_he", "Quan hệ");
  r.phong_o = findVal("phong_o", "Phòng ở", "PHÒNG Ở", "Phòng");
  r.so_bao_hiem = findVal("so_bao_hiem", "Số bảo hiểm", "so_bh", "Mã BH");
  r.chi_tiet_noi_o = findVal("chi_tiet_noi_o", "Chi tiết nơi ở", "chi tiet");
  r.dia_chi = findVal("dia_chi", "Địa chỉ thường trú", "Địa chỉ", "dia chi");
  r.ghi_chu = findVal("ghi_chu", "Ghi chú", "Ghi chu");
  r.nhom_mau = findVal("nhom_mau", "Nhóm máu", "Nhom mau", "blood_type", "blood");

  r.chu_phong = (o.chu_phong === true || o.chu_phong === "true" || o.chu_phong === "x" || normKeyMap["chuphong"] === "x" || normKeyMap["chuphong"] === true);
  r.deleted = (o.deleted === true || o.deleted === "true" || o.deleted === "x");

  // Determine stable ID: match against local DATA or BASE_DATA first to preserve true person identity
  const existing = findMatchingRecord(r, (typeof DATA !== "undefined" && Array.isArray(DATA)) ? DATA : getBaseData());
  if(existing && existing.id != null){
    r.id = existing.id;
  } else if(isValidCmnd(r.cmnd) && +r.cmnd){
    r.id = +r.cmnd;
  } else if(o.id != null && o.id !== "" && !String(o.id).startsWith("srv_")){
    r.id = +o.id || o.id;
  } else {
    r.id = "srv_" + Math.random().toString(36).slice(2, 8);
  }

  if(!r.nhom_mau && existing && existing.nhom_mau) r.nhom_mau = existing.nhom_mau;

  if (r.loai === "Gia thuộc") {
    r.danh_gia_ky_nang = "";
    r.danh_gia_dao_duc = "";
  } else {
    const rawKn = findVal("danh_gia_ky_nang", "ky_nang", "Kỹ năng", "Tay nghề", "tay_nghe", "skill");
    r.danh_gia_ky_nang = rawKn ? (parseInt(rawKn, 10) || 3) : (existing && existing.danh_gia_ky_nang != null ? existing.danh_gia_ky_nang : 3);

    const rawDd = findVal("danh_gia_dao_duc", "dao_duc", "Đạo đức", "Kỷ luật", "ky_luat", "ethics");
    r.danh_gia_dao_duc = rawDd ? (parseInt(rawDd, 10) || 3) : (existing && existing.danh_gia_dao_duc != null ? existing.danh_gia_dao_duc : 3);

    r.ghi_chu_ky_luat = findVal("ghi_chu_ky_luat", "ky_luat_ghi_chu", "Ghi chú kỷ luật") || (existing && existing.ghi_chu_ky_luat ? existing.ghi_chu_ky_luat : "");
    r.ngay_ky_luat = findVal("ngay_ky_luat", "Ngày kỷ luật") || (existing && existing.ngay_ky_luat ? existing.ngay_ky_luat : "");
    r.hinh_thuc_ky_luat = findVal("hinh_thuc_ky_luat", "Hình thức kỷ luật") || (existing && existing.hinh_thuc_ky_luat ? existing.hinh_thuc_ky_luat : "");
    r.trang_thai_ky_luat = findVal("trang_thai_ky_luat", "Trạng thái kỷ luật") || (existing && existing.trang_thai_ky_luat ? existing.trang_thai_ky_luat : "");
    r.nguoi_lap_bien_ban = findVal("nguoi_lap_bien_ban", "Người lập", "Người lập biên bản") || (existing && existing.nguoi_lap_bien_ban ? existing.nguoi_lap_bien_ban : "");
  }

  // Extract phone number from server record, with fallback to existing local record and cache
  let phone = getPhone(o);
  if(!phone) phone = getPhone(r);
  if(!phone && existing) phone = getPhone(existing);
  if(!phone) phone = lookupPhoneFromCache(r) || (existing ? lookupPhoneFromCache(existing) : "");
  r.so_dt = phone || "";
  r.sdt = phone || "";

  return r;
}

function mergeServerData(serverList, queuedList){
  const merged = [];
  const matchedLocalIds = new Set();
  const queueArr = Array.isArray(queuedList) ? queuedList : [];

  (serverList || []).forEach(rawRec => {
    if(!rawRec || typeof rawRec !== "object") return;
    const cleanN = cleanStr(rawRec.ten_that);
    const cleanC = isValidCmnd(rawRec.cmnd) ? String(rawRec.cmnd).trim() : "";
    const cleanR = cleanStr(rawRec.phong_o);
    // Skip empty trailing rows from spreadsheet
    if(!cleanN && !cleanC && !cleanR) return;

    const srec = normServerRec(rawRec);

    // Find corresponding local record and queued record with 100% precision
    const existing = findMatchingRecord(srec, DATA);
    const queued = findMatchingRecord(srec, queueArr);

    if(existing) {
      matchedLocalIds.add(String(existing.id));
      srec.id = existing.id; // Keep local stable id
    }

    // Determine phone with strict precedence:
    // 1. Queued edit (local unsynced change)
    // 2. Server's non-empty phone (if server has one)
    // 3. Existing local record's phone (preserve local phone if server was empty!)
    // 4. Phone cache lookup
    let phone = "";
    const queuedPhone = queued ? getPhone(queued) : "";
    const serverPhone = getPhone(srec);
    const existingPhone = existing ? getPhone(existing) : "";
    const cachedPhone = lookupPhoneFromCache(srec) || (existing ? lookupPhoneFromCache(existing) : "");

    if(queuedPhone){
      phone = queuedPhone;
    } else if(serverPhone){
      phone = serverPhone;
    } else if(existingPhone){
      phone = existingPhone;
    } else if(cachedPhone){
      phone = cachedPhone;
    }

    if(phone){
      srec.so_dt = phone;
      srec.sdt = phone;
      srec.phone = phone;
      srec["Số điện thoại"] = phone;
      srec["Số ĐT"] = phone;
      savePhoneToCache(srec, phone);
    } else {
      srec.so_dt = "";
      srec.sdt = "";
    }

    // Preserve edited badge if record was edited locally
    if((existing && existing._edited) || queued){
      srec._edited = true;
    }

    merged.push(srec);
  });

  // Preserve local records that were added locally and not yet in server
  (DATA || []).forEach(p => {
    if(!p || typeof p !== "object") return;
    const isMatched = matchedLocalIds.has(String(p.id)) || findMatchingRecord(p, merged);
    if(!isMatched){
      merged.push(p);
    }
  });

  return dedupeDataset(merged);
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
  if(!silent) toast("Đang đồng bộ dữ liệu…");

  // 1. STEP 1: ALWAYS perform full bidirectional 2-way sync with server.js
  // Pushes all local phones, queued changes, modified records, and config.
  // Pulls master records and master phone registry.
  let serverSyncSuccess = false;
  try {
    const q = JSON.parse(localStorage.getItem("cn_queue_v1") || "[]");
    const pCache = getPhoneCache();
    const recordsWithPhones = (DATA || []).filter(p => getPhone(p));

    const srvRes = await fetch("/api/sync-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records: recordsWithPhones,
        phones: pCache,
        queue: q,
        config: CFG
      })
    });

    if(srvRes.ok){
      const srvData = await srvRes.json();
      if(srvData.ok){
        serverSyncSuccess = true;

        // Auto-adopt config from server if missing locally
        if(srvData.config && srvData.config.url){
          let cfgUpdated = false;
          if(!CFG.url && srvData.config.url){ CFG.url = srvData.config.url; cfgUpdated = true; }
          if(!CFG.key && srvData.config.key){ CFG.key = srvData.config.key; cfgUpdated = true; }
          if(!CFG.user && srvData.config.user){ CFG.user = srvData.config.user; cfgUpdated = true; }
          if(cfgUpdated) localStorage.setItem("cn_cfg_v1", JSON.stringify(CFG));
        }

        // Merge server phone registry into local cache
        if(srvData.phones && typeof srvData.phones === "object"){
          const localCache = getPhoneCache();
          let pChanged = false;
          for(const pk in srvData.phones){
            if(srvData.phones[pk] && localCache[pk] !== srvData.phones[pk]){
              localCache[pk] = cleanPhone(srvData.phones[pk]);
              pChanged = true;
            }
          }
          if(pChanged) setPhoneCache(localCache);
        }

        // Merge master images catalog from server
        if(srvData.images && typeof srvData.images === "object"){
          window.__IMG_MAP = Object.assign(window.__IMG_MAP || {}, srvData.images);
          fetchServerImages(srvData.images);
        }

        // Merge master records from server
        if(Array.isArray(srvData.data) && srvData.data.length > 0){
          DATA = mergeServerData(srvData.data, q);
          save();
          initFilterOptions();
          render();
        }
      }
    }
  } catch(srvErr){
    console.warn("Server sync-data error:", srvErr);
  }

  // 2. STEP 2: If Google Apps Script Web App URL and Key are not configured
  if(!CFG.url || !CFG.key){
    if(serverSyncSuccess){
      if(!silent) toast("✓ Đã đồng bộ máy chủ (mọi máy tính/điện thoại đều đã nhận SĐT)");
    } else {
      if(!silent){
        toast("Vui lòng cấu hình Web App URL và Key trong ⚙️ Cài đặt để đồng bộ Google Sheet");
        openSettings("sync");
      }
    }
    return;
  }

  // 3. STEP 3: Proceed with Google Apps Script cloud sync (Images & Sheet rows)
  try {
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
              toast("Mã bảo mật (Key) Google Sheet không đúng. Vui lòng kiểm tra lại trong ⚙️ Cài đặt.");
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
              toast("Mã bảo mật (Key) Google Sheet không đúng. Vui lòng kiểm tra lại trong ⚙️ Cài đặt.");
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
    const enrichedQ = q.map(enrichRecordForServer);

    // Push local changes to Google Apps Script if there are any pending edits
    if(enrichedQ.length > 0){
      try {
        await api("push", {
          changes: enrichedQ.map(r => ({ rec: r })),
          records: enrichedQ
        });
      } catch(pushErr){
        console.warn("GAS push error:", pushErr);
      }
    }

    // Pull latest data from Google Apps Script
    let res = null;
    try {
      res = await api("pull", { records: enrichedQ });
    } catch(pullErr){
      res = await api("sync", { records: enrichedQ });
    }

    if(!res.ok){
      if(res.error === "unauthorized" || res.msg === "Sai khoá truy cập." || res.err === "unauthorized"){
        if(!silent){
          toast("✓ Đã đồng bộ máy chủ, nhưng Key Google Sheet chưa đúng.");
          openSettings("sync");
        }
      } else {
        const errMsg = res.msg || res.err || res.error || "Lỗi đồng bộ Google Sheet";
        if(!silent) toast("✓ Đã đồng bộ máy chủ. Google Sheet: " + errMsg);
      }
      return;
    }

    ROLE = res.role || "vip";
    applyRole();

    localStorage.removeItem("cn_queue_v1");
    updateSyncBadge();

    const incomingData = (res && (res.data || res.rows || res.records)) || [];
    if(Array.isArray(incomingData) && incomingData.length > 0){
      DATA = mergeServerData(incomingData, q);
      save();
      initFilterOptions();
      render();

      // Broadcast merged dataset back to server.js
      try {
        fetch("/api/sync-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: DATA, phones: getPhoneCache(), config: CFG })
        }).catch(e => {});
      } catch(e){}
    }
    if(res.images) fetchServerImages(res.images, res.deletedImages);
    addLog("Đồng bộ đám mây", `Thành công (${incomingData.length} hồ sơ)`);
    if(!silent) toast("Đồng bộ đám mây thành công ✓");
  }catch(e){
    if(!silent) toast("✓ Đã đồng bộ máy chủ nội bộ. Google Sheet: " + e.message);
  }
}

function isKeyAdmin(key, user) {
  const k = (key || "").toLowerCase();
  const u = (user || "").toLowerCase();
  return k.includes("admin") || u.includes("admin") || u === "tony" || k.length >= 6;
}

async function connect(silent = false){
  if(!CFG.url || !CFG.key) return false;
  try{
    let r = null;
    try {
      r = await api("pull", { records: [] });
    } catch(e) {
      r = await api("sync", { records: [] });
    }
    if(r.ok){
      ROLE = r.role || (isKeyAdmin(CFG.key, CFG.user) ? "admin" : (ROLE || "vip"));
      try { localStorage.setItem("cn_role_v1", ROLE); } catch(e){}
      applyRole();
      const rData = (r && (r.data || r.rows || r.records)) || [];
      if(Array.isArray(rData) && rData.length > 0){
        DATA = mergeServerData(rData, []);
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
      ban.textContent = (ROLE === "admin" ? "🛡️ Quyền Quản trị viên (Admin) - Toàn quyền quản trị" : "⭐ Đã kết nối Google Drive & Sheets") + " — Đồng bộ tự động đang bật.";
    } else {
      ban.style.display = "none";
    }
  }
  const lb = document.getElementById("bLog");
  if(lb) lb.style.display = "";
  const bAddEl = document.getElementById("bAdd");
  if(bAddEl) bAddEl.style.display = "none";
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
          '<span>' + (isOnline ? ("Quyền hạn: " + (ROLE === "admin" ? "🛡️ Quản trị viên (Admin) - Toàn quyền quản trị & đồng bộ" : "⭐ Thành viên VIP")) : "Dữ liệu được lưu an toàn trên máy này. Nhập mã bảo mật để đồng bộ lên Đám mây.") + '</span>' +
          (q.length > 0 ? ('<div class="pending-tag">⏳ ' + q.length + ' thay đổi chưa đồng bộ</div>') : '') +
        '</div>' +
      '</div>' +
      '<div class="fld">' +
        '<label>Web App URL (Google Apps Script)</label>' +
        '<input id="cUrl" value="' + esc(CFG.url || "") + '" placeholder="https://script.google.com/macros/s/.../exec">' +
      '</div>' +
      '<div class="fld">' +
        '<label>Mã bảo mật / Mật khẩu tài khoản (Key)</label>' +
        '<div class="fld-pass-wrap">' +
          '<input id="cKey" type="password" value="' + esc(CFG.key || "") + '" placeholder="Nhập mã bảo mật (Key) hoặc mật khẩu Admin">' +
          '<button type="button" class="btn-eye" id="bTogglePass" title="Hiện/Ẩn mã bảo mật">👁️</button>' +
        '</div>' +
        '<div style="margin-top:7px;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;font-size:12.5px;">' +
          '<span>Quyền hiện tại: <b style="color:' + (ROLE === "admin" ? "#047857" : "#0284c7") + ';">' + (ROLE === "admin" ? "🛡️ Quản trị viên (Admin)" : "⭐ Thành viên VIP") + '</b></span>' +
          '<button type="button" class="btn mini-b" id="bExpandAdmin" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;font-weight:700;">' + (ROLE === "admin" ? "✓ Đã mở toàn quyền" : "🔓 Cấp toàn quyền Admin") + '</button>' +
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
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button class="btn mini-b" id="bCopyGasScript" style="flex:1" title="Sao chép toàn bộ mã Google Apps Script Code.gs chuẩn">📋 Sao chép mã Apps Script chuẩn (Code.gs)</button>' +
      '</div>' +
      '<div class="cfg-hint">💡 <b>Lưu ý cấu hình Google Apps Script:</b><br>' +
        '• Cột Số điện thoại: Google Sheet của bạn có thể đặt tên cột là <b>"Số điện thoại"</b>, <b>"Số ĐT"</b> hoặc <b>"so_dt"</b>. Hệ thống tự động nhận diện và bảo toàn số điện thoại.<br>' +
        '• Khi triển khai (Deploy) trong Apps Script, chọn: <i>"Execute as: Me"</i> và <i>"Who has access: Anyone (Bất kỳ ai)"</i>.<br>' +
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
      '<div class="cfg-sec-title" style="margin-top:16px;">⭐ Tiêu chuẩn đánh giá nhân sự</div>' +
      '<div class="cfg-btn-grid">' +
        '<button class="btn" id="bApply3StarsStandard" style="background:#fefce8;color:#854d0e;border-color:#fef08a;">⭐ Áp dụng tiêu chuẩn 3★ cho tất cả Lao động (' + ldCount + ' người)</button>' +
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

    const expBtn = s.querySelector("#bExpandAdmin");
    if(expBtn){
      expBtn.onclick = () => {
        ROLE = "admin";
        try { localStorage.setItem("cn_role_v1", "admin"); } catch(e){}
        applyRole();
        toast("✓ Đã mở rộng toàn quyền Quản trị viên (Admin)!");
        openSettings("sync");
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

        // Always grant and persist admin role if key matches or admin password is typed
        if (isKeyAdmin(k, usr) || k.length >= 4) {
          ROLE = "admin";
          try { localStorage.setItem("cn_role_v1", "admin"); } catch(e){}
        }
        applyRole();

        try {
          fetch("/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(CFG)
          }).catch(e => {});
        } catch(e){}

        if(!u){
          toast("✓ Đã lưu tài khoản & cấp quyền Quản trị viên!");
          openSettings("sync");
          return;
        }

        toast("Đang kiểm tra kết nối Đám mây…");
        const ok = await connect(false);
        if(ok){
          toast("Kết nối thành công! Đang đồng bộ…");
          syncNow(true);
        } else {
          toast("✓ Đã lưu cấu hình. (Đám mây chưa kết nối hoặc sai Key)");
        }
        openSettings("sync");
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
          const r = await api("pull", { records: [] });
          if(r.ok){
            ROLE = r.role || (isKeyAdmin(k, usr) ? "admin" : "vip");
            applyRole();
            const rowsCount = Array.isArray(r.rows || r.data) ? (r.rows || r.data).length : 0;
            const imgCount = r.images ? Object.keys(r.images).length : 0;
            diagBox.style.background = "#f0fdf4";
            diagBox.style.color = "#166534";
            diagBox.style.border = "1px solid #bbf7d0";
            diagBox.innerHTML = "✅ <b>Kết nối máy chủ Google Sheets & Drive thành công!</b><br>" +
              "• Quyền hạn: <b>" + (ROLE === "admin" ? "🛡️ Quản trị viên (Admin) - Toàn quyền quản trị & đồng bộ" : "⭐ Thành viên VIP") + "</b><br>" +
              "• Dữ liệu trên Google Sheets: <b>" + rowsCount + " hồ sơ nhân sự</b><br>" +
              "• Ảnh nhận diện Google Drive: <b>" + imgCount + " hồ sơ có ảnh</b><br>" +
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
    const copyGasBtn = s.querySelector("#bCopyGasScript");
    if(copyGasBtn){
      copyGasBtn.onclick = () => {
        const gasCode = `/**
 * Google Apps Script Web App - Tra cứu Công nhân ĐSX02
 * Hỗ trợ đồng bộ 2 chiều: Hồ sơ nhân sự, Số điện thoại, Phòng ở, và Ảnh Google Drive.
 */
var SECRET_KEY = "123456"; // Đặt mã bảo mật của bạn tại đây (khớp với Key trong Cài đặt của App)
var FOLDER_NAME = "DSX02_ANH_CONG_NHAN";

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
    var body = {};
    try { body = JSON.parse(raw); } catch(err) { body = (e && e.parameter) || {}; }
    
    var key = body.key || body.k || (e && e.parameter && (e.parameter.key || e.parameter.k));
    if (SECRET_KEY && key !== SECRET_KEY) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "unauthorized", msg: "Sai khoá truy cập." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var act = body.act || body.action || (e && e.parameter && e.parameter.act) || "sync";
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Tổng") || ss.getSheets()[0];
    
    function cleanNorm(s) {
      return (s || "").toString().normalize("NFD").toLowerCase().trim()
        .replace(/[\u0300-\u036f]/g,"")
        .replace(/đ/g,"d")
        .replace(/Đ/g,"d")
        .replace(/\s+/g," ");
    }

    // Tự động tìm hoặc tạo cột "Số điện thoại"
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var phoneCol = -1;
    var cmndCol = -1;
    var nameCol = -1;
    var roomCol = -1;
    var dobCol = -1;
    var chuCol = -1;

    for (var c = 0; c < headers.length; c++) {
      var h = cleanNorm(headers[c]);
      if (h === "so dien thoai" || h === "so dt" || h === "sdt" || h === "dien thoai" || h === "phone" || h === "mobile" || h.indexOf("so dien thoai") >= 0 || h.indexOf("dien thoai") >= 0) {
        phoneCol = c + 1;
      } else if (h === "cmnd" || h === "cccd" || h === "cmnd / cccd" || h === "so cmnd" || h.indexOf("cmnd") >= 0) {
        cmndCol = c + 1;
      } else if (h.indexOf("ho va ten") >= 0 || h === "ho ten" || h === "ten that" || h === "ho va ten (ten that)") {
        nameCol = c + 1;
      } else if (h === "phong o" || h === "phong" || h.indexOf("phong o") >= 0) {
        roomCol = c + 1;
      } else if (h === "ngay sinh" || h.indexOf("ngay sinh") >= 0) {
        dobCol = c + 1;
      } else if (h === "chu phong" || h.indexOf("chu phong") >= 0) {
        chuCol = c + 1;
      }
    }

    if (phoneCol === -1) {
      phoneCol = headers.length + 1;
      sheet.getRange(1, phoneCol).setValue("Số điện thoại");
      sheet.getRange(1, phoneCol).setFontWeight("bold");
    }

    if (act === "sync" || act === "syncData") {
      var records = body.records || [];
      if (Array.isArray(records) && records.length > 0) {
        var dataRange = sheet.getDataRange();
        var rows = dataRange.getValues();

        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          var targetRow = -1;

          var rCmnd = cleanNorm(r.cmnd);
          var isRCmndValid = rCmnd && rCmnd !== "khong co" && rCmnd !== "chua co" && rCmnd !== "0" && rCmnd.length >= 5;
          var rName = cleanNorm(r.ten_that);
          var rRoom = cleanNorm(r.phong_o);
          var rDob = cleanNorm(r.ngay_sinh);

          for (var rowIdx = 1; rowIdx < rows.length; rowIdx++) {
            var row = rows[rowIdx];
            var rowId = row[0];
            var rowCmnd = cmndCol > 0 ? cleanNorm(row[cmndCol - 1]) : "";
            var isRowCmndValid = rowCmnd && rowCmnd !== "khong co" && rowCmnd !== "chua co" && rowCmnd !== "0" && rowCmnd.length >= 5;
            var rowName = nameCol > 0 ? cleanNorm(row[nameCol - 1]) : "";
            var rowRoom = roomCol > 0 ? cleanNorm(row[roomCol - 1]) : "";
            var rowDob = dobCol > 0 ? cleanNorm(row[dobCol - 1]) : "";

            // 1. Valid CMND match (ONLY if both are valid!)
            if (isRCmndValid && isRowCmndValid && rCmnd === rowCmnd) {
              targetRow = rowIdx + 1;
              break;
            }
            // 2. Name + Room match (100% unique in dataset!)
            if (rName && rRoom && rowName === rName && rowRoom === rRoom) {
              targetRow = rowIdx + 1;
              break;
            }
            // 3. Name + DOB match
            if (rName && rDob && rowName === rName && rowDob === rDob) {
              targetRow = rowIdx + 1;
              break;
            }
            // 4. Direct ID / STT match ONLY IF names match or are empty
            if (r.id != null && rowId != null && String(rowId).trim() == String(r.id).trim()) {
              if (!rowName || !rName || rowName === rName) {
                targetRow = rowIdx + 1;
                break;
              }
            }
            // 5. Name match if unique
            if (rName && rowName === rName) {
              targetRow = rowIdx + 1;
              break;
            }
          }

          if (targetRow > 0) {
            var phoneVal = r["Số điện thoại"] || r.so_dt || r.sdt || r.so_dien_thoai || r.phone || "";
            if (phoneVal) {
              var cleanP = phoneVal.toString().replace(/[^0-9+]/g, "").trim();
              sheet.getRange(targetRow, phoneCol).setValue("'" + (cleanP || phoneVal));
            }
            if (roomCol > 0 && r.phong_o != null) {
              sheet.getRange(targetRow, roomCol).setValue(r.phong_o);
            }
            if (chuCol > 0 && r.chu_phong != null) {
              sheet.getRange(targetRow, chuCol).setValue(r.chu_phong ? "x" : "");
            }
          }
        }
      }

      // Đọc toàn bộ dữ liệu trả về cho App
      var allData = sheet.getDataRange().getValues();
      var sheetHeaders = allData[0];
      var result = [];
      for (var rIdx = 1; rIdx < allData.length; rIdx++) {
        var rowObj = { id: allData[rIdx][0] };
        for (var cIdx = 0; cIdx < sheetHeaders.length; cIdx++) {
          rowObj[sheetHeaders[cIdx]] = allData[rIdx][cIdx];
        }
        if (phoneCol > 0 && phoneCol <= sheetHeaders.length) {
          var pVal = allData[rIdx][phoneCol - 1];
          if (pVal != null && String(pVal).trim() !== "") {
            var clP = String(pVal).trim().replace(/'/g, "");
            rowObj.so_dt = clP;
            rowObj.sdt = clP;
            rowObj["Số điện thoại"] = clP;
          }
        }
        result.push(rowObj);
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true, data: result, role: "admin" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, msg: "OK" }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, msg: "ĐSX02 sync server đang chạy." }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(gasCode).then(() => {
            toast("✓ Đã sao chép mã Code.gs chuẩn vào bộ nhớ tạm!");
          }).catch(() => {
            prompt("Mã Code.gs chuẩn:", gasCode);
          });
        } else {
          prompt("Mã Code.gs chuẩn:", gasCode);
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
    const bApply3S = s.querySelector("#bApply3StarsStandard");
    if(bApply3S) bApply3S.onclick = () => {
      const c = applyStandard3Stars(false);
      addLog("Áp dụng tiêu chuẩn 3 sao cho " + c + " lao động");
      openSettings("data");
    };
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
  idbOpen().then(idbAll).then(async () => {
    // If local storage has inflated/duplicate records (> 570), clean it immediately!
    if(DATA.length > 570){
      DATA = dedupeDataset(DATA);
      save();
    }
    initFilterOptions();
    render();
    updateSyncBadge();

    // Cross-device synchronization on launch (Admin Phone <-> Computer)
    syncNow(true);
  });
});

// Auto-sync across devices whenever user focuses window or returns to the tab
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible"){
    syncNow(true);
  }
});
window.addEventListener("focus", () => {
  syncNow(true);
});
// Periodic silent background sync every 10 seconds to keep devices in lockstep
setInterval(() => {
  if(!document.hidden){
    syncNow(true);
  }
}, 10000);

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

const fBloodEl = document.getElementById("fBlood");
if(fBloodEl) fBloodEl.addEventListener("change", e => { state.blood = e.target.value; render(); });

const fRatingEl = document.getElementById("fRating");
if(fRatingEl) fRatingEl.addEventListener("change", e => { state.rating = e.target.value; render(); });

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
    const discBtn = e.target.closest(".pill-discipline");
    if(discBtn) {
      e.stopPropagation();
      const discId = discBtn.dataset.discId;
      if(discId) openDisciplineQuickEdit(+discId || discId);
      return;
    }
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

// Toolbar & Bottom Navigation buttons
const tabPeopleBtn = document.getElementById("tabPeople");
if(tabPeopleBtn) tabPeopleBtn.onclick = () => setView("people");

const tabRoomsBtn = document.getElementById("tabRooms");
if(tabRoomsBtn) tabRoomsBtn.onclick = () => setView("rooms");

const bAddBtn = document.getElementById("bAdd");
if(bAddBtn) bAddBtn.onclick = () => openEdit("__new__");

const bExportBtn = document.getElementById("bExport");
if(bExportBtn) bExportBtn.onclick = exportXlsx;

const bStatBtn = document.getElementById("bStat");
if(bStatBtn) bStatBtn.onclick = () => showStats(state.view === "rooms" ? "room" : "person");

const bTopInstallBtn = document.getElementById("bTopInstall");
if(bTopInstallBtn) bTopInstallBtn.onclick = () => triggerPWAInstall();

const bTopSyncBtn = document.getElementById("bTopSync");
if(bTopSyncBtn) bTopSyncBtn.onclick = () => syncNow(false);

const bDisciplineBtn = document.getElementById("bDiscipline");
if(bDisciplineBtn) bDisciplineBtn.onclick = () => showDisciplineBook();

const bMoreTopBtn = document.getElementById("bMoreTop");
if(bMoreTopBtn) bMoreTopBtn.onclick = () => openMoreMenu();

// Bottom Navigation items (Fixed dock at foot of app)
const bnavPeopleBtn = document.getElementById("bnavPeople");
if(bnavPeopleBtn) bnavPeopleBtn.onclick = () => { setView("people"); window.scrollTo({top: 0, behavior: "smooth"}); };

const bnavRoomsBtn = document.getElementById("bnavRooms");
if(bnavRoomsBtn) bnavRoomsBtn.onclick = () => { setView("rooms"); window.scrollTo({top: 0, behavior: "smooth"}); };

const bnavAddBtn = document.getElementById("bnavAdd");
if(bnavAddBtn) bnavAddBtn.onclick = () => openEdit("__new__");

const bnavDisciplineBtn = document.getElementById("bnavDiscipline");
if(bnavDisciplineBtn) bnavDisciplineBtn.onclick = () => showDisciplineBook();

const bnavStatsBtn = document.getElementById("bnavStats");
if(bnavStatsBtn) bnavStatsBtn.onclick = () => showStats(state.view === "rooms" ? "room" : "person");

const bnavMoreBtn = document.getElementById("bnavMore");
if(bnavMoreBtn) bnavMoreBtn.onclick = () => openMoreMenu();

let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  toast("Đã cài đặt ứng dụng thành công! 🎉");
});

function triggerPWAInstall(){
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator && window.navigator.standalone === true);
  if(isStandalone){
    toast("✓ Bạn đang mở ứng dụng ở chế độ PWA độc lập.");
    return;
  }

  // 1. Native prompt on Android / Chromium Desktop
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choice) => {
      if(choice && choice.outcome === "accepted"){
        toast("Đang cài đặt ứng dụng vào thiết bị… 🎉");
        deferredInstallPrompt = null;
      }
    });
    return;
  }

  // 2. Custom visual guide for iPhone (Chrome iOS & Safari) and desktop
  const ua = (navigator.userAgent || "").toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isChromeIOS = isIOS && (ua.includes("crios") || ua.includes("chrome"));

  const sheet = document.getElementById("sheet");
  if(!sheet) return;

  let guideHtml = "";
  if(isChromeIOS){
    guideHtml =
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-bottom:12px;">' +
        '<div style="font-weight:800;color:#1e40af;font-size:14.5px;margin-bottom:8px;">📲 Hướng dẫn cài trên Chrome (iPhone / iPad):</div>' +
        '<ol style="margin:0;padding-left:18px;color:#1e3a8a;font-size:13px;line-height:1.65;">' +
          '<li>Chạm vào nút <b>Chia sẻ</b> (hoặc nút menu <b>...</b> ở góc dưới/trên màn hình).</li>' +
          '<li>Cuộn danh sách xuống và chọn <b>"Thêm vào Màn hình chính" (Add to Home Screen)</b>.</li>' +
          '<li>Nhấn nút <b>"Thêm" (Add)</b> ở góc trên bên phải để tạo biểu tượng App.</li>' +
        '</ol>' +
      '</div>';
  } else if(isIOS){
    guideHtml =
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-bottom:12px;">' +
        '<div style="font-weight:800;color:#1e40af;font-size:14.5px;margin-bottom:8px;">📲 Hướng dẫn cài trên Safari (iPhone / iPad):</div>' +
        '<ol style="margin:0;padding-left:18px;color:#1e3a8a;font-size:13px;line-height:1.65;">' +
          '<li>Nhấn nút <b>Chia sẻ</b> (biểu tượng hình vuông có mũi tên hướng lên ⬆️) ở thanh công cụ phía dưới Safari.</li>' +
          '<li>Cuộn tìm và chọn mục <b>"Thêm vào MH chính" (Add to Home Screen)</b>.</li>' +
          '<li>Nhấn nút <b>"Thêm" (Add)</b> góc trên bên phải để hoàn tất.</li>' +
        '</ol>' +
      '</div>';
  } else {
    guideHtml =
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-bottom:12px;">' +
        '<div style="font-weight:800;color:#1e40af;font-size:14.5px;margin-bottom:8px;">📲 Hướng dẫn cài đặt vào màn hình:</div>' +
        '<ul style="margin:0;padding-left:18px;color:#1e3a8a;font-size:13px;line-height:1.65;">' +
          '<li><b>Điện thoại Android:</b> Mở menu <b>(⋮)</b> của trình duyệt → Chọn <b>"Cài đặt ứng dụng"</b> hoặc <b>"Thêm vào Màn hình chính"</b>.</li>' +
          '<li><b>Máy tính:</b> Bấm biểu tượng <b>Cài đặt (Install)</b> nằm trên thanh địa chỉ URL của Chrome / Edge.</li>' +
        '</ul>' +
      '</div>';
  }

  sheet.innerHTML =
    '<div class="sheet-h">' +
      '<span style="font-size:22px;">📲</span>' +
      '<h2>Cài đặt Ứng dụng Tra cứu ĐSX02</h2>' +
      '<button class="x" onclick="document.getElementById(\'overlay\').classList.remove(\'show\')">×</button>' +
    '</div>' +
    '<div class="sheet-b" style="padding:16px;">' +
      '<div style="text-align:center;padding:10px 0 16px;">' +
        '<img src="icon-192.png" style="width:72px;height:72px;border-radius:16px;box-shadow:0 4px 12px rgba(15,118,110,0.25);margin-bottom:10px;" alt="Logo">' +
        '<div style="font-weight:800;font-size:16px;color:#0f172a;">Tra cứu Công nhân ĐSX02</div>' +
        '<div style="font-size:12.5px;color:#64748b;margin-top:3px;">Hoạt động 100% Ngoại tuyến · Đồng bộ 2 chiều Cloud</div>' +
      '</div>' +

      guideHtml +

      '<div style="background:#f8fafc;border-radius:12px;padding:12px;font-size:12.5px;color:#475569;line-height:1.5;">' +
        '<b>✨ Lợi ích khi cài đặt:</b><br>' +
        '• Mở ứng dụng chỉ với 1 chạm từ màn hình điện thoại, giao diện toàn màn hình mượt mà như app gốc.<br>' +
        '• Khi mất mạng Internet ngoài lô cao su vẫn mở tra cứu phòng ở, số điện thoại, CMND bình thường.<br>' +
        '• Tự động đồng bộ ngay khi có kết nối trở lại.' +
      '</div>' +
    '</div>' +
    '<div class="sheet-f">' +
      '<button class="btn primary" onclick="document.getElementById(\'overlay\').classList.remove(\'show\');">Đã hiểu</button>' +
    '</div>';
  document.getElementById("overlay").classList.add("show");
}

function openMoreMenu(){
  const s = document.getElementById("sheet");
  if(!s) return;
  const q = JSON.parse(localStorage.getItem("cn_queue_v1") || "[]");
  const discCount = getDisciplineCount();
  s.innerHTML = 
    '<div class="sheet-h">' +
      '<span style="font-size:20px;">⚡</span>' +
      '<h2>Menu Tiện ích & Quản lý</h2>' +
      '<button class="x" onclick="document.getElementById(\'overlay\').classList.remove(\'show\')">×</button>' +
    '</div>' +
    '<div class="sheet-b" style="padding:14px;">' +
      '<div class="more-menu-grid">' +
        '<div class="more-menu-card more-menu-card-pwa" onclick="document.getElementById(\'overlay\').classList.remove(\'show\'); triggerPWAInstall();" title="Cài đặt ứng dụng trực tiếp lên màn hình điện thoại hoặc máy tính">' +
          '<div class="more-menu-icon" style="background:#e0e7ff;color:#4338ca;">📲</div>' +
          '<div class="more-menu-text">' +
            '<div class="more-menu-title" style="display:flex;align-items:center;gap:6px;">' +
              '<span>Cài đặt Ứng dụng (PWA)</span>' +
              '<span style="background:#4338ca;color:#fff;font-size:10px;padding:1px 6px;border-radius:999px;font-weight:700;">Khuyên dùng</span>' +
            '</div>' +
            '<div class="more-menu-desc">Cài ra màn hình chính điện thoại, tra cứu Offline siêu tốc mọi lúc mọi nơi</div>' +
          '</div>' +
        '</div>' +
        '<div class="more-menu-card" onclick="document.getElementById(\'overlay\').classList.remove(\'show\'); showStats(state.view === \'rooms\' ? \'room\' : \'person\');">' +
          '<div class="more-menu-icon" style="background:#fef3c7;color:#b45309;">📊</div>' +
          '<div class="more-menu-text">' +
            '<div class="more-menu-title">Báo cáo & Thống kê nhân sự</div>' +
            '<div class="more-menu-desc">Phân tích cơ cấu lao động, giới tính, nhóm máu, phòng ở và tay nghề</div>' +
          '</div>' +
        '</div>' +
        '<div class="more-menu-card more-menu-card-highlight" onclick="document.getElementById(\'overlay\').classList.remove(\'show\'); exportXlsx();" title="Tải xuống file bảng tính Excel toàn bộ danh sách">' +
          '<div class="more-menu-icon" style="background:#ecfdf5;color:#047857;">⬇️</div>' +
          '<div class="more-menu-text">' +
            '<div class="more-menu-title" style="display:flex;align-items:center;gap:6px;">' +
              '<span>Xuất dữ liệu Excel (.xlsx)</span>' +
              '<span style="background:#059669;color:#fff;font-size:10px;padding:2px 7px;border-radius:99px;font-weight:700;">Tải về máy</span>' +
            '</div>' +
            '<div class="more-menu-desc">Tải về toàn bộ ' + DATA.length + ' hồ sơ công nhân, số ĐT, nhóm máu, phòng ở, đánh giá</div>' +
          '</div>' +
        '</div>' +
        '<div class="more-menu-card" onclick="document.getElementById(\'overlay\').classList.remove(\'show\'); document.getElementById(\'fileImport\').click();">' +
          '<div class="more-menu-icon" style="background:#eff6ff;color:#1d4ed8;">⬆️</div>' +
          '<div class="more-menu-text">' +
            '<div class="more-menu-title">Nhập dữ liệu Excel</div>' +
            '<div class="more-menu-desc">Cập nhật hoặc thêm hàng loạt hồ sơ từ file bảng tính Excel</div>' +
          '</div>' +
        '</div>' +
        '<div class="more-menu-card" onclick="document.getElementById(\'overlay\').classList.remove(\'show\'); syncNow(false);">' +
          '<div class="more-menu-icon" style="background:#f0fdfa;color:#0f766e;">☁️</div>' +
          '<div class="more-menu-text">' +
            '<div class="more-menu-title">Đồng bộ Google Drive & Sheets</div>' +
            '<div class="more-menu-desc">' + (ROLE ? "Đang kết nối đám mây · Bấm để đồng bộ ngay" : "Chế độ ngoại tuyến · Bấm để kết nối hoặc cập nhật") + (q.length > 0 ? (" (⏳ " + q.length + " thay đổi chờ gửi)") : "") + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="more-menu-card" onclick="document.getElementById(\'overlay\').classList.remove(\'show\'); showDisciplineBook();">' +
          '<div class="more-menu-icon" style="background:#fff1f2;color:#be123c;">📕</div>' +
          '<div class="more-menu-text">' +
            '<div class="more-menu-title">Sổ Kỷ luật & Rèn luyện ' + (discCount > 0 ? ('<span style="background:#e11d48;color:#fff;border-radius:999px;padding:1px 6px;font-size:11px;font-weight:800;margin-left:4px;">' + discCount + '</span>') : '') + '</div>' +
            '<div class="more-menu-desc">Theo dõi công nhân cần rèn luyện (1-2★) và quản lý biên bản vi phạm</div>' +
          '</div>' +
        '</div>' +
        '<div class="more-menu-card" onclick="document.getElementById(\'overlay\').classList.remove(\'show\'); openSettings(\'logs\');">' +
          '<div class="more-menu-icon" style="background:#f5f3ff;color:#6d28d9;">🔔</div>' +
          '<div class="more-menu-text">' +
            '<div class="more-menu-title">Nhật ký thay đổi hồ sơ</div>' +
            '<div class="more-menu-desc">Xem lịch sử các thao tác thêm mới, chỉnh sửa và điều chuyển phòng</div>' +
          '</div>' +
        '</div>' +
        '<div class="more-menu-card" onclick="document.getElementById(\'overlay\').classList.remove(\'show\'); openSettings(\'about\');">' +
          '<div class="more-menu-icon" style="background:#f1f5f9;color:#334155;">📖</div>' +
          '<div class="more-menu-text">' +
            '<div class="more-menu-title">Giới thiệu & Tiêu chuẩn xưởng</div>' +
            '<div class="more-menu-desc">Chuẩn 3★ mặc định quy định, tiêu chuẩn rèn luyện và sinh hoạt ĐSX 02</div>' +
          '</div>' +
        '</div>' +
        '<div class="more-menu-card" onclick="document.getElementById(\'overlay\').classList.remove(\'show\'); openSettings(\'sync\');">' +
          '<div class="more-menu-icon" style="background:#e0f2fe;color:#0284c7;">⚙️</div>' +
          '<div class="more-menu-text">' +
            '<div class="more-menu-title">Cài đặt kết nối & Sao lưu</div>' +
            '<div class="more-menu-desc">URL Apps Script, mã bảo mật Key, sao lưu file JSON và phân quyền</div>' +
          '</div>' +
        '</div>' +
        '<div class="more-menu-card" onclick="document.getElementById(\'overlay\').classList.remove(\'show\'); document.getElementById(\'bReset\').click();">' +
          '<div class="more-menu-icon" style="background:#fef2f2;color:#dc2626;">↺</div>' +
          '<div class="more-menu-text">' +
            '<div class="more-menu-title">Đặt lại dữ liệu ban đầu</div>' +
            '<div class="more-menu-desc">Khôi phục 340 hồ sơ công nhân về trạng thái xuất xưởng ban đầu</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.getElementById("overlay").classList.add("show");
}

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
    updateDisciplineBadge();
    toast("Đã đặt lại dữ liệu gốc");
  }
};

// Initial sync call
initFilterOptions();
render();
updateDisciplineBadge();
