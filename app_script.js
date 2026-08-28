/* ===== Tra cứu Công nhân ĐSX02 ===== */
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

var DATA = load(); window.DATA = DATA;
let state = { q:"", to:"", loai:"", muon:false, view:"people" };
let currentRoom = null;
const NO_ROOM = "(chưa có phòng)";
function roomKey(p){ return (p.phong_o||"").trim() || NO_ROOM; }
function allRooms(){ const s=new Set(); DATA.forEach(p=>{ const r=(p.phong_o||"").trim(); if(r) s.add(r); }); return Array.from(s).sort((a,b)=>a.localeCompare(b,'vi',{numeric:true})); }

function clone(o){ if(!o) return []; try{ return JSON.parse(JSON.stringify(o)); }catch(e){ return Array.isArray(o)?[...o]:Object.assign({},o); } }
function getBaseData(){
  if(typeof BASE_DATA!=="undefined" && Array.isArray(BASE_DATA) && BASE_DATA.length>0) return BASE_DATA;
  if(typeof window!=="undefined" && Array.isArray(window.BASE_DATA) && window.BASE_DATA.length>0) return window.BASE_DATA;
  return [];
}
function load(){
  try{
    const s=localStorage.getItem(LS_KEY);
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
    console.warn("Loi doc localStorage:", e);
  }
  const base = getBaseData();
  return clone(base).map(p => {
    p.so_dt = getPhone(p);
    p.sdt = p.so_dt;
    return p;
  });
}
function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(DATA)); }catch(e){ toast("Không lưu được (bộ nhớ đầy)"); } }
function noAccent(s){ return (s||"").toString().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase(); }
function esc(s){ return (s==null?"":""+s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

/* ===== Ảnh: PRELOAD (nhúng sẵn) + IndexedDB (thay đổi/chụp mới) ===== */
const PRELOAD = (typeof PRELOAD_IMG!=="undefined") ? PRELOAD_IMG : {};
let IMG_OVR = {}; let _db = null; const DEL="__DEL__";
function idbOpen(){ return new Promise(res=>{ try{ const r=indexedDB.open("cn_imgs",1);
  r.onupgradeneeded=e=>e.target.result.createObjectStore("imgs");
  r.onsuccess=e=>{_db=e.target.result;res();}; r.onerror=()=>res(); }catch(e){res();} }); }
function idbAll(){ return new Promise(res=>{ if(!_db) return res(); try{
  const st=_db.transaction("imgs","readonly").objectStore("imgs"); const out={}; const c=st.openCursor();
  c.onsuccess=e=>{ const cur=e.target.result; if(cur){ out[cur.key]=cur.value; cur.continue(); } else { IMG_OVR=out; res(); } };
  c.onerror=()=>res(); }catch(e){res();} }); }
function idbPut(k,v){ if(!_db) return; try{ _db.transaction("imgs","readwrite").objectStore("imgs").put(v,k); }catch(e){} }
function imgFileId(id,t){ try{ const m=JSON.parse(localStorage.getItem("cn_imgfiles_v1")||"{}"); return m[t+":"+id]||null; }catch(e){ return null; } }
function driveImgUrl(fid){ return fid ? "https://lh3.googleusercontent.com/d/" + fid : null; }
function getImg(id,t){
  const k=t+":"+id;
  if(k in IMG_OVR) return IMG_OVR[k]===DEL?null:IMG_OVR[k];
  const fid=imgFileId(id,t);
  if(fid) return driveImgUrl(fid);
  const p=PRELOAD[id];
  return (p&&p[t])?p[t]:null;
}
function setImg(id,t,uri){ IMG_OVR[t+":"+id]=uri; idbPut(t+":"+id,uri); try{ addPendImg(t+":"+id); }catch(e){} }
function delImg(id,t){ IMG_OVR[t+":"+id]=DEL; idbPut(t+":"+id,DEL); try{ addPendDel(t+":"+id); }catch(e){} }
function hasAnyImg(p){ return !!(getImg(p.id,"photo")||getImg(p.id,"cmnd")); }
function avatar(p){ return getImg(p.id,"photo")||getImg(p.id,"cmnd"); }
function compress(file,max,q){ return new Promise((res,rej)=>{ const fr=new FileReader();
  fr.onload=()=>{ const im=new Image(); im.onload=()=>{ let w=im.width,h=im.height; const s=Math.min(1,max/Math.max(w,h));
    const c=document.createElement("canvas"); c.width=Math.round(w*s); c.height=Math.round(h*s);
    c.getContext("2d").drawImage(im,0,0,c.width,c.height); res(c.toDataURL("image/jpeg",q)); };
    im.onerror=rej; im.src=fr.result; }; fr.onerror=rej; fr.readAsDataURL(file); }); }
function ageFromDOB(ds){ if(!ds) return ""; const m=String(ds).match(/(19|20)\d{2}/); if(!m) return ""; const y=+m[0]; const a=(new Date().getFullYear())-y; return (a>=0&&a<120)?String(a):""; }
function displayAge(p){ const a=ageFromDOB(p.ngay_sinh); return a!==""?a:(p.tuoi||""); }
function dobFromKHCode(code){ code=String(code||"").replace(/\D/g,""); if(code.length<6) return ""; const yy=+code.slice(0,2), mm=code.slice(2,4), dd=code.slice(4,6); const cy=new Date().getFullYear()%100; const year=(yy>cy)?1900+yy:2000+yy; if(+mm<1||+mm>12||+dd<1||+dd>31) return ""; return dd+"/"+mm+"/"+year; }
function downloadImg(id,t,label){ const uri=getImg(id,t); if(!uri){ toast("Chưa có ảnh"); return; } const a=document.createElement("a"); a.href=uri; a.download=(label||"anh")+"_"+id+".jpg"; document.body.appendChild(a); a.click(); setTimeout(()=>a.remove(),100); }
/* ---- OCR đọc MRZ trên CMND (miễn phí, trên máy) ---- */
let _tessP=null;
function loadTesseract(){ if(window.Tesseract) return Promise.resolve(); if(_tessP) return _tessP;
  _tessP=new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js"; s.onload=()=>res(); s.onerror=rej; document.head.appendChild(s); });
  return _tessP; }
function cropBottom(uri){ return new Promise(res=>{ const im=new Image(); im.onload=()=>{ try{ const h=Math.round(im.height*0.42); const c=document.createElement("canvas"); c.width=im.width; c.height=h; c.getContext("2d").drawImage(im,0,im.height-h,im.width,h,0,0,im.width,h); res(c.toDataURL("image/jpeg",0.92)); }catch(e){ res(uri); } }; im.onerror=()=>res(uri); im.src=uri; }); }
function parseMRZ(text){
  const up = (text||"").toUpperCase();
  const lines = up.split(/\r?\n/).map(l => l.replace(/[^A-Z0-9<]/g, "")).filter(l => l.length >= 8);
  const out = {};
  for(const l of lines){
    const m = l.match(/(\d{6})\d?([MFX])/);
    if(m){
      const s = m[1], yy = +s.slice(0, 2), mm = s.slice(2, 4), dd = s.slice(4, 6), cy = new Date().getFullYear() % 100, year = (yy > cy) ? 1900 + yy : 2000 + yy;
      if(+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31){
        out.ngay_sinh = dd + "/" + mm + "/" + year;
        out.gioi_tinh = (m[2] === "F" ? "F" : (m[2] === "M" ? "M" : ""));
        break;
      }
    }
  }
  for(const l of lines){
    if(l.indexOf("<<") >= 0 && /^[A-Z<]+$/.test(l) && l.length >= 8){
      const parts = l.split("<<");
      const sur = parts[0].replace(/</g, " ").trim();
      const giv = (parts[1] || "").replace(/</g, " ").trim();
      out.ten = (sur + " " + giv).replace(/\s+/g, " ").trim();
      break;
    }
  }
  for(const l of lines){
    const m = l.match(/(?:IDKHM|^ID[A-Z]{3}|ID[A-Z0-9]{3})([0-9]{5,})/);
    if(m){
      let num = m[1];
      // Tự động bỏ số cuối cùng trong dòng IDKHM (số kiểm tra checksum của chuẩn MRZ) để khớp đúng số CMND thực tế
      if(num.length >= 6){
        num = num.slice(0, -1);
      }
      out.cmnd = num;
      break;
    }
  }
  return out;
}
async function ocrCmnd(id){
  const uri=getImg(id,"cmnd"); if(!uri){ toast("Chưa có ảnh CMND"); return; }
  toast("Đang đọc CMND… (lần đầu cần mạng)");
  try{
    await loadTesseract();
    const crop=await cropBottom(uri);
    const r=await Tesseract.recognize(crop,"eng",{tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789< "});
    const p=parseMRZ(r.data&&r.data.text||"");
    if(!p.ngay_sinh && !p.ten){ toast("Không đọc được MRZ — chụp rõ 3 dòng dưới cùng"); return; }
    const q=s=>document.querySelector('#sheet [data-k="'+s+'"]');
    if(p.ten && q("ten_that") && !q("ten_that").value) q("ten_that").value=p.ten;
    if(p.ten && q("ten_ho_so") && !q("ten_ho_so").value) q("ten_ho_so").value=p.ten;
    if(p.ngay_sinh && q("ngay_sinh")) q("ngay_sinh").value=p.ngay_sinh;
    if(p.gioi_tinh && q("gioi_tinh")) q("gioi_tinh").value=p.gioi_tinh;
    if(p.cmnd && q("cmnd")) q("cmnd").value=p.cmnd;
    if(p.ngay_sinh && q("tuoi")){ const a=ageFromDOB(p.ngay_sinh); if(a) q("tuoi").value=a; }
    toast("Đã đọc ✓ "+[p.ten,p.ngay_sinh].filter(Boolean).join(" · ")+" — kiểm tra rồi bấm Lưu");
  }catch(e){ toast("Không đọc được (cần mạng lần đầu để tải bộ đọc)"); }
}
async function batchOcrDOB(){
  if(isGuest()){ toast("Chỉ Admin mới cập nhật hàng loạt"); return; }
  const list=DATA.filter(p=>getImg(p.id,"cmnd"));
  if(!list.length){ toast("Chưa có ảnh CMND nào trong app"); return; }
  if(!confirm("Đọc "+list.length+" ảnh CMND và tự cập nhật NGÀY SINH (chuẩn Campuchia)?\n• Có thể mất vài phút.\n• Chỉ đổi khi đọc được; bạn nên kiểm tra lại rồi bấm Đồng bộ.")) return;
  let worker;
  try{ await loadTesseract(); worker=await Tesseract.createWorker("eng"); }
  catch(e){ toast("Cần mạng để tải bộ đọc lần đầu"); return; }
  let updated=0, fail=0, i=0;
  for(const p of list){ i++;
    try{ const crop=await cropBottom(getImg(p.id,"cmnd")); const r=await worker.recognize(crop); const m=parseMRZ(r.data&&r.data.text||"");
      if(m.ngay_sinh){ if(p.ngay_sinh!==m.ngay_sinh){ p.ngay_sinh=m.ngay_sinh; const a=ageFromDOB(m.ngay_sinh); if(a)p.tuoi=a; if(m.gioi_tinh&&!p.gioi_tinh)p.gioi_tinh=m.gioi_tinh; p._edited=true; queueChange(p); updated++; } }
      else fail++;
    }catch(e){ fail++; }
    if(i%2===0||i===list.length) toast("Đang đọc CMND… "+i+"/"+list.length+" · đã cập nhật "+updated);
  }
  try{ await worker.terminate(); }catch(e){}
  save(); render();
  toast("Xong: cập nhật "+updated+" ngày sinh, "+fail+" không đọc rõ. Kiểm tra rồi ☁️ Đồng bộ.");
}
function cleanAddressVi(text) {
  if (!text || typeof text !== "string") return "";
  let s = text.trim();

  // Bo nhan tieu de dia chi neu co
  s = s.replace(/^(?:địa\s*chỉ\s*(?:thường\s*trú|hiện\s*tại|nơi\s*ở|cư\s*trú)?|dia\s*chi\s*(?:thuong\s*tru|hien\s*tai)?|địa\s*chỉ|dia\s*chi)\s*[:：\-–—\/\\]\s*/i, "");

  // Loc bo thong tin chieu cao (chieu cao, cao, 1m..., 1.xx m, kich thuoc, height...)
  s = s.replace(/(?:^|[,\.;\n\r|–—\-\/\\])\s*(?:chiều\s*cao|chieu\s*cao|cao|kích\s*thước|kich\s*thuoc|height)\s*[:：\-–—\/\\]?\s*(?:\d+[\.,]\d+|\d+)?\s*(?:m|cm|met|mét)?\b[^\n\r,;|–—\-\/\\]*/gi, "");
  s = s.replace(/(?:^|[,\.;\n\r|–—\-\/\\])\s*(?:1[\.,]\d{1,2}\s*(?:m|cm|met|mét)?|1m\d{1,2}|\d{3}\s*cm)\s*(?=[,\.;\n\r|–—\-\/\\]|$)/gi, "");

  // Loc bo dac diem nhan dang / dau vet rieng / seo / not ruoi / tan nhang / bot / khong co dac diem
  s = s.replace(/(?:^|[,\.;\n\r|–—\-\/\\])\s*(?:đặc\s*điểm\s*(?:nhận\s*dạng|riêng|đặc\s*biệt)?|dấu\s*(?:vết|hiệu)\s*(?:riêng|đặc\s*biệt|nhận\s*dạng)?|nhận\s*dạng|dac\s*diem\s*(?:nhan\s*dang|rieng|dac\s*biet)?|dau\s*vet\s*rieng)\s*[:：\-–—\/\\]?\s*[^\n\r,;|–—\-\/\\]*/gi, "");
  s = s.replace(/(?:^|[,\.;\n\r|–—\-\/\\])\s*(?:nốt\s*ruồi|not\s*ruoi|vết\s*sẹo|vet\s*seo|sẹo|seo|tàn\s*nhang|vết\s*bớt|hình\s*xăm)\s*[^\n\r,;|–—\-\/\\]*/gi, "");
  s = s.replace(/(?:^|[,\.;\n\r|–—\-\/\\])\s*(?:không\s*có\s*(?:dấu\s*vết|đặc\s*điểm|vết\s*sẹo|dấu\s*hiệu|sẹo)?|không\s*(?:dấu\s*vết|đặc\s*điểm|vết\s*sẹo)|khong\s*co\s*(?:dac\s*diem|dau\s*vet))\s*[^\n\r,;|–—\-\/\\]*/gi, "");
  s = s.replace(/(?:^|[,\.;\n\r|–—\-\/\\])\s*(?:màu\s*mắt|nhóm\s*máu|màu\s*tóc|tóc\s*(?:đen|bạc|ngắn|dài)|mắt\s*(?:đen|nâu|xanh))\s*[:：\-–—\/\\]?\s*[^\n\r,;|–—\-\/\\]*/gi, "");

  // Loc bo cum tu tieng Khmer ve chieu cao va dac diem nhan dang neu bi lan vao
  s = s.replace(/(?:^|[,\.;\n\r|–—\-\/\\])\s*(?:កម្ពស់|កម្ពស|កំពស់)\s*[:：\-–—\/\\]?\s*[\d\.,\s០-៩]+(?:ម\.|ម|cm|m)?[^\n\r,;|–—\-\/\\]*/gu, "");
  s = s.replace(/(?:^|[,\.;\n\r|–—\-\/\\])\s*(?:សញ្ញាសម្គាល់ពិសេស|សញ្ញាសម្គាល់|ស្លាកស្នាម|ប្រជ្រុយ|គ្មានសញ្ញាសម្គាល់|គ្មានស្លាកស្នាម|គ្មាន)\s*[:：\-–—\/\\]?\s*[^\n\r,;|–—\-\/\\]*/gu, "");

  // Chuan hoa dau phan cach va khoang trang
  s = s.replace(/[\r\n]+/g, ", ");
  s = s.replace(/\s*[,;|\.–—\-\/\\]\s*[,;|\.–—\-\/\\]+/g, ", ");
  s = s.replace(/\s*,\s*/g, ", ");
  s = s.replace(/\s+/g, " ");
  s = s.replace(/^[\s,;:\-–—\.\/\\|]+|[\s,;:\-–—\.\/\\|]+$/g, "");

  return s;
}

function cleanAddressKhmer(text) {
  if (!text || typeof text !== "string") return "";
  let s = text.trim();

  // Bo nhan tieu de dia chi tieng Khmer
  s = s.replace(/^(?:អាសយដ្ឋានបច្ចុប្បន្ន|អាសយដ្ឋាន|ទីលំនៅបច្ចុប្បន្ន|ទីលំនៅ)\s*[:：\-–—\/\\]\s*/u, "");

  // Loc bo chieu cao
  s = s.replace(/(?:^|[,\.;\n\r|–—\-\/\\、។\s])\s*(?:កម្ពស់|កម្ពស|កំពស់|chiều\s*cao|height)\s*[:：\-–—\/\\]?\s*[\d\.,\s០-៩]+(?:\s*(?:ម\.|ម|cm|m))?[^\n\r,;|–—\-\/\\、។]*/giu, " ");

  // Loc bo dac diem nhan dang
  s = s.replace(/(?:^|[,\.;\n\r|–—\-\/\\、។\s])\s*(?:សញ្ញាសម្គាល់ពិសេស|សញ្ញាសម្គាល់|ស្លាកស្នាម|ប្រជ្រុយ|គ្មានសញ្ញាសម្គាល់|គ្មានស្លាកស្នាម|គ្មាន)\s*[:：\-–—\/\\]?\s*[^\n\r,;|–—\-\/\\、។]*/giu, " ");

  // Chuan hoa
  s = s.replace(/[\r\n]+/g, ", ");
  s = s.replace(/\s*[,;|\.–—\-\/\\។、]\s*[,;|\.–—\-\/\\។、]+/g, ", ");
  s = s.replace(/\s*,\s*/g, ", ");
  s = s.replace(/\s+/g, " ");
  s = s.replace(/^[\s,;:\-–—\.\/\\|។、]+|[\s,;:\-–—\.\/\\|។、]+$/g, "");

  return s;
}

function cleanExistingAddresses(){
  if(isGuest()){ toast("Chỉ Admin mới thực hiện chức năng này"); return; }
  let cleanedCount = 0;
  DATA.forEach(p => {
    let changed = false;
    if(p.dia_chi){
      const c = cleanAddressVi(p.dia_chi);
      if(c !== p.dia_chi){
        p.dia_chi = c;
        changed = true;
      }
    }
    if(p.chi_tiet_noi_o){
      const c = cleanAddressKhmer(p.chi_tiet_noi_o);
      if(c !== p.chi_tiet_noi_o){
        p.chi_tiet_noi_o = c;
        changed = true;
      }
    }
    if(p.noi_sinh){
      const c = cleanAddressVi(p.noi_sinh);
      if(c !== p.noi_sinh){
        p.noi_sinh = c;
        changed = true;
      }
    }
    if(changed){
      p._edited = true;
      queueChange(p);
      cleanedCount++;
    }
  });
  if(cleanedCount > 0){
    save();
    render();
    toast("Đã làm sạch địa chỉ của " + cleanedCount + " người ✓");
  } else {
    toast("Tất cả địa chỉ hiện tại đã sạch sẽ ✓");
  }
}

async function ocrAddr(id){
  const uri = getImg(id, "cmnd");
  if(!uri){ toast("Chưa có ảnh CMND"); return; }
  if(!CFG.url || !ROLE){ toast("Cần kết nối máy chủ (⚙️) để quét địa chỉ"); return; }
  toast("Đang quét địa chỉ (Google Drive OCR)…");
  try {
    const r = await api("ocrAddress", { id: id, dataUrl: uri });
    if(!r || !r.ok){ toast("Không đọc được" + (r && r.error ? ": " + r.error : "")); return; }
    
    // Tu dong loc sach cac dong thua ve chieu cao, dac diem nhan dang, seo, not ruoi
    const rawAddr = r.addrVi || r.fullVi || "";
    const addr = cleanAddressVi(rawAddr);
    const khmerAddr = cleanAddressKhmer(r.addrKhmer || "");
    const birth = cleanAddressVi(r.birthVi || "");
    
    if(!addr && !birth && !khmerAddr){ toast("Không tìm thấy địa chỉ trong ảnh"); return; }
    const q = s => document.querySelector('#sheet [data-k="' + s + '"]');
    if(addr && q("dia_chi")) q("dia_chi").value = addr;
    if(khmerAddr && q("chi_tiet_noi_o") && !q("chi_tiet_noi_o").value) q("chi_tiet_noi_o").value = khmerAddr;
    if(birth && q("noi_sinh") && !q("noi_sinh").value) q("noi_sinh").value = birth;
    toast("Đã đọc & làm sạch địa chỉ ✓ — kiểm tra rồi bấm Lưu");
  } catch(e){
    toast("Lỗi quét: " + e.message);
  }
}

async function batchOcrAddr(){
  if(isGuest()){ toast("Chỉ Admin mới chạy hàng loạt"); return; }
  if(!CFG.url || !ROLE){ toast("Cần kết nối máy chủ trước"); return; }
  const list = DATA.filter(p => getImg(p.id, "cmnd"));
  if(!list.length){ toast("Chưa có ảnh CMND nào"); return; }
  if(!confirm("Quét " + list.length + " ảnh CMND để lấy ĐỊA CHỈ thường trú (Google Drive OCR + tự dịch)?\n• Mỗi ảnh ~2-4 giây, tổng có thể nhiều phút.\n• Tự động lọc sạch chiều cao và đặc điểm nhận dạng.\n• Chỉ đổi khi đọc được; kiểm tra lại rồi Đồng bộ.")) return;
  let upd = 0, fail = 0, i = 0;
  for(const p of list){
    i++;
    try {
      const r = await api("ocrAddress", { id: p.id, dataUrl: getImg(p.id, "cmnd") });
      if(r && r.ok){
        const a = cleanAddressVi(r.addrVi || r.fullVi || "");
        let changed = false;
        if(a && a !== p.dia_chi){
          p.dia_chi = a;
          changed = true;
        }
        if(r.addrKhmer && !p.chi_tiet_noi_o){
          const kh = cleanAddressKhmer(r.addrKhmer);
          if(kh){ p.chi_tiet_noi_o = kh; changed = true; }
        }
        if(r.birthVi && !p.noi_sinh){
          const bi = cleanAddressVi(r.birthVi);
          if(bi){ p.noi_sinh = bi; changed = true; }
        }
        if(changed){
          p._edited = true;
          queueChange(p);
          upd++;
        } else if(!a){
          fail++;
        }
      } else {
        fail++;
      }
    } catch(e){
      fail++;
    }
    if(i % 2 === 0 || i === list.length) toast("Đang quét địa chỉ… " + i + "/" + list.length + " · cập nhật " + upd);
  }
  save();
  render();
  toast("Xong: cập nhật " + upd + " địa chỉ (đã làm sạch), " + fail + " không đọc rõ. Kiểm tra & ☁️ Đồng bộ.");
}
function descVN(p){
  const g=p.gioi_tinh==="M"?"Nam":(p.gioi_tinh==="F"?"Nữ":p.gioi_tinh);
  const L=[["Họ và tên (thật)",p.ten_that],["Tên trong hồ sơ",p.ten_ho_so],["CMND/CCCD",p.cmnd],
    ["Ngày sinh",p.ngay_sinh],["Tuổi",displayAge(p)],["Nơi sinh",p.noi_sinh],["Giới tính",g],["Quan hệ",p.quan_he],["Loại",p.loai],
    ["Tổ / Khu vực",[p.to,p.khu_vuc].filter(Boolean).join(" · ")],["Phần cây",p.phan_cay],
    ["Phòng ở",p.phong_o],["Số bảo hiểm",p.so_bao_hiem],["Số điện thoại",p.so_dt],
    ["Địa chỉ thường trú",p.dia_chi],["Ghi chú",p.ghi_chu]];
  return L.filter(x=>x[1]).map(x=>'<div class="dv"><span>'+x[0]+'</span><b>'+esc(x[1])+'</b></div>').join("");
}
function imgSlot(p,t,label){
  const uri=getImg(p.id,t); const fid=imgFileId(p.id,t);
  const view = uri ? '<img src="'+uri+'" class="thumbimg">' : '<div class="noimg">Chưa có ảnh</div>';
  return '<div class="islot"><div class="ilabel">'+label+'</div>'+view+
    '<div class="ibtns">'+
      '<label class="mini-b">📷 Chụp<input type="file" accept="image/*" capture="environment" data-img="'+t+'" style="display:none"></label>'+
      '<label class="mini-b">🖼 Chọn<input type="file" accept="image/*" data-img="'+t+'" style="display:none"></label>'+
      (t==="cmnd"&&uri?'<button class="mini-b" data-ocr="1">🔎 Tự đọc</button>':'')+
      (t==="cmnd"&&uri?'<button class="mini-b" data-ocraddr="1">🏠 Đọc địa chỉ</button>':'')+
      (uri?'<button class="mini-b" data-dl="'+t+'">⬇️ Tải về</button>':'')+
      (fid?'<a class="mini-b" style="text-decoration:none" href="https://drive.google.com/file/d/'+fid+'/view" target="_blank" rel="noopener">↗ Drive (gốc)</a>':'')+
      (uri?'<button class="mini-b" data-del="'+t+'">🗑 Xoá</button>':'')+
    '</div></div>';
}
function imgSectionHTML(p){
  return imgSlot(p,"photo","🧑 Ảnh chân dung")+imgSlot(p,"cmnd","🪪 Ảnh CMND/CCCD")+
    '<div class="vnbox"><div class="vntitle">📋 Thông tin (tiếng Việt)</div>'+descVN(p)+'</div>';
}
function bindImg(id){
  const sec=document.getElementById("imgSection"); if(!sec) return;
  sec.querySelectorAll('input[data-img]').forEach(inp=>inp.addEventListener("change",async e=>{
    const f=e.target.files[0]; if(!f) return; const t=e.target.dataset.img;
    try{ const uri=await compress(f, t==="cmnd"?1400:800, t==="cmnd"?0.8:0.7); setImg(id,t,uri);
      sec.innerHTML=imgSectionHTML(DATA.find(x=>x.id===id)); bindImg(id); toast("Đã lưu ảnh ✓"); }
    catch(err){ toast("Không xử lý được ảnh"); }
  }));
  sec.querySelectorAll('[data-dl]').forEach(b=>b.onclick=()=>downloadImg(id,b.dataset.dl, b.dataset.dl==="cmnd"?"CMND":"AnhChanDung"));
  sec.querySelectorAll('[data-ocr]').forEach(b=>b.onclick=()=>ocrCmnd(id));
  sec.querySelectorAll('[data-ocraddr]').forEach(b=>b.onclick=()=>ocrAddr(id));
  sec.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
    delImg(id,b.dataset.del); sec.innerHTML=imgSectionHTML(DATA.find(x=>x.id===id)); bindImg(id); toast("Đã xoá ảnh");
  });
}

/* ===================== ĐỒNG BỘ GOOGLE DRIVE (Apps Script) ===================== */
const CFG_KEY="cn_cfg_v1", OUTBOX_KEY="cn_outbox_v1", PENDIMG_KEY="cn_pendimg_v1", PENDDEL_KEY="cn_penddel_v1";
let CFG = JSON.parse(localStorage.getItem(CFG_KEY)||'null') || Object.assign({url:"",key:"",user:"",role:null}, (typeof window!=="undefined"&&window.__CFG_DEFAULT)||{});
let ROLE = CFG.role || null;        // 'admin' | 'guest' | null(offline)
function isGuest(){ return ROLE==="guest"; }
function saveCfg(){ localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); }
function getOutbox(){ try{return JSON.parse(localStorage.getItem(OUTBOX_KEY)||"[]");}catch(e){return[];} }
function setOutbox(a){ localStorage.setItem(OUTBOX_KEY, JSON.stringify(a)); }
function queueChange(rec, deleted){ const ob=getOutbox().filter(c=>String(c.rec.id)!==String(rec.id)); ob.push({rec:rec, deleted:!!deleted}); setOutbox(ob); updateSyncBadge(); }
function getPendImg(){ try{return JSON.parse(localStorage.getItem(PENDIMG_KEY)||"[]");}catch(e){return[];} }
function addPendImg(k){ const s=getPendImg(); if(s.indexOf(k)<0){ s.push(k); localStorage.setItem(PENDIMG_KEY,JSON.stringify(s)); } const d=getPendDel().filter(x=>x!==k); setPendDel(d); updateSyncBadge(); }
function setPendImg(s){ localStorage.setItem(PENDIMG_KEY,JSON.stringify(s)); }
function getPendDel(){ try{return JSON.parse(localStorage.getItem(PENDDEL_KEY)||"[]");}catch(e){return[];} }
function addPendDel(k){ const s=getPendDel(); if(s.indexOf(k)<0){ s.push(k); localStorage.setItem(PENDDEL_KEY,JSON.stringify(s)); } const p=getPendImg().filter(x=>x!==k); setPendImg(p); updateSyncBadge(); }
function setPendDel(s){ localStorage.setItem(PENDDEL_KEY,JSON.stringify(s)); }

async function api(action, extra){
  const body=JSON.stringify(Object.assign({action:action,key:CFG.key,user:CFG.user||""},extra||{}));
  const opts={method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:body};
  let r=await fetch(CFG.url,opts).then(x=>x.json()).catch(()=>null);
  const defUrl=(window.__CFG_DEFAULT||{}).url||"";
  if((!r||r.error==="unknown_action")&&defUrl&&CFG.url!==defUrl){
    const r2=await fetch(defUrl,opts).then(x=>x.json()).catch(()=>null);
    if(r2&&r2.error!=="unknown_action"){
      CFG.url=defUrl; saveCfg();
      toast("\u2705 \u0110\u00e3 t\u1ef1 c\u1eadp nh\u1eadt sang m\u00e1y ch\u1ee7 m\u1edbi!");
      r=r2;
    }
  }
  return r;
}
function online(){ return CFG.url && ROLE; }
function updateSyncBadge(){
  const b=document.getElementById("syncBadge"); if(!b) return;
  if(!CFG.url){ b.style.display="none"; return; }
  const pend=getOutbox().length+getPendImg().length+getPendDel().length;
  b.style.display=""; b.textContent=(ROLE==="admin"?"👑 Admin":ROLE==="guest"?"⭐ VIP":"⚠️ Chưa kết nối")+(pend?(" · "+pend+" chờ gửi"):" · đã đồng bộ");
}

async function connect(){
  if(!CFG.url||!CFG.key){ toast("Chưa nhập link & khoá"); return false; }
  try{ const r=await api("whoami"); if(r.ok&&r.role){ ROLE=r.role; CFG.role=r.role; saveCfg(); applyRole(); toast("Đã kết nối: "+(r.role==="admin"?"Admin":"VIP")); updateSyncBadge(); return true; }
    toast("Sai khoá truy cập"); return false; }
  catch(e){ toast("Không kết nối được máy chủ"); return false; }
}
function applyRole(){
  const ban=document.getElementById("roleBanner");
  if(isGuest()){ ban.style.display=""; ban.textContent="⭐ Chế độ VIP — được sửa: Phòng ở, Phần cây, Khu vực, Tổ và thêm ảnh, thêm người mới. Không sửa/xoá thông tin khác."; }
  else if(ROLE==="admin"){ ban.style.display="none"; }
  else ban.style.display="none";
  const lb=document.getElementById("bLog"); if(lb) lb.style.display=(ROLE==="admin")?"":"none";
  document.getElementById("bAdd").style.display=(state.view==="people")?"":"none";
}
async function syncNow(silent){
  if(!CFG.url){ if(!silent) toast("Chưa cấu hình máy chủ (⚙️ Cài đặt)"); return; }
  if(!ROLE){ const ok=await connect(); if(!ok) return; }
  // Silent version-check: triggers auto-migrate if VIP device is still on old server
  api("getLog",{limit:1}).catch(()=>{});
  if(!silent) toast("Đang đồng bộ…");
  try{
    // 1) đẩy ảnh chờ
    let pend=getPendImg(); const stillP=[];
    for(const k of pend){ const [t,id]=k.split(":"); const uri=getImg(id,t);
      if(!uri){ continue; } try{ const r=await api("uploadImage",{id:id,type:t,dataUrl:uri}); if(!r.ok) stillP.push(k); }catch(e){ stillP.push(k); } }
    setPendImg(stillP);
    // 1b) đẩy ảnh ĐÃ XOÁ
    let pdel=getPendDel(); const stillD=[];
    for(const k of pdel){ const [t,id]=k.split(":"); try{ const r=await api("deleteImage",{id:id,type:t}); if(!r.ok) stillD.push(k); }catch(e){ stillD.push(k); } }
    setPendDel(stillD);
    // 2) đẩy thay đổi dữ liệu
    const ob=getOutbox();
    if(ob.length){ const r=await api("push",{changes:ob}); if(r&&r.ok){ setOutbox([]); } }
    // 3) kéo về & hợp nhất
    let pl=await api("pull");
    if(pl&&pl.ok){
      if((!pl.rows||pl.rows.length===0) && DATA.length>0 && ROLE==="admin"){
        // Sheet trống & mình là admin -> tự nạp dữ liệu hiện có lên Drive (lần đầu)
        if(!silent) toast("Lần đầu: đang nạp "+DATA.length+" người lên Drive…");
        await api("seed",{rows:DATA, replace:true});
        pl=await api("pull");
      }
      if(pl&&pl.ok && pl.rows){
        DATA = pl.rows.map(normServerRec).filter(x=>!x.deleted);
        save();
        await fetchServerImages(pl.images||{}, pl.deleted||{});
        render(); updateSyncBadge();
        if(!silent) toast("Đồng bộ xong ✓ ("+DATA.length+" người)");
      }
    }
  }catch(e){ if(!silent) toast("Lỗi đồng bộ: "+e.message); }
}
function normServerRec(o){
  const r={}; for(const [k] of FIELDS) r[k]=o[k]!=null?o[k]:"";
  r.id = +o.id || o.id; r.chu_phong = (o.chu_phong===true||o.chu_phong==="true"||o.chu_phong==="x"); r.deleted=(o.deleted===true||o.deleted==="true"||o.deleted==="x");
  return r;
}
async function fetchServerImages(imgs, deleted){
  let map={}; try{ map=JSON.parse(localStorage.getItem("cn_imgfiles_v1")||"{}"); }catch(e){}
  let mapChanged=false;
  
  // 1. Cập nhật ngay tất cả fileId vào map để hiển thị trực tiếp từ Google Drive CDN
  for(const id in imgs){
    for(const t in imgs[id]){
      const key=t+":"+id; const fid=imgs[id][t];
      if(fid && map[key]!==fid){
        map[key]=fid;
        mapChanged=true;
      }
    }
  }
  if(deleted){
    for(const id in deleted){
      for(const t in deleted[id]){
        const key=t+":"+id;
        if(IMG_OVR[key]!==DEL){ IMG_OVR[key]=DEL; idbPut(key,DEL); }
        if(map[key]){ delete map[key]; mapChanged=true; }
      }
    }
  }
  if(mapChanged){
    try{ localStorage.setItem("cn_imgfiles_v1", JSON.stringify(map)); }catch(e){}
  }

  // 2. Tải song song (batch) các ảnh chưa có về bộ nhớ đệm (IndexedDB) để dùng offline
  const pendingKeys=[];
  for(const key in map){
    const fid=map[key];
    if(fid && !(key in IMG_OVR)){
      pendingKeys.push({key, fid});
    }
  }

  if(pendingKeys.length > 0){
    const BATCH_SIZE = 4;
    for(let i=0; i<pendingKeys.length; i+=BATCH_SIZE){
      const chunk = pendingKeys.slice(i, i+BATCH_SIZE);
      await Promise.all(chunk.map(async item=>{
        try{
          const r=await api("getImage", {fileId: item.fid});
          if(r && r.ok && r.dataUrl){
            IMG_OVR[item.key]=r.dataUrl;
            idbPut(item.key, r.dataUrl);
          }
        }catch(e){}
      }));
    }
  }
}
async function seedToDrive(){
  if(ROLE!=="admin"){ toast("Chỉ Admin mới khởi tạo"); return; }
  if(!confirm("Nạp toàn bộ "+DATA.length+" người hiện tại lên Drive (ghi đè dữ liệu trên Sheet)?")) return;
  toast("Đang nạp lên Drive…");
  try{ const r=await api("seed",{rows:DATA, replace:true}); toast(r.ok?("Đã nạp "+r.count+" người lên Drive ✓"):"Lỗi: "+(r.error||"")); }
  catch(e){ toast("Lỗi nạp: "+e.message); }
}

/* ---------- filtering ---------- */
function isMuon(p){ const a=(p.ten_that||"").trim().toUpperCase(), b=(p.ten_ho_so||"").trim().toUpperCase(); return !!(a&&b&&a!==b); }
function filtered(){
  const q = noAccent(state.q.trim());
  return DATA.filter(p=>{
    if(state.to && p.to!==state.to) return false;
    if(state.loai && p.loai!==state.loai) return false;
    if(state.muon && !isMuon(p)) return false;
    if(q){
      const hay = noAccent([p.ten_that,p.ten_ho_so,p.cmnd,p.so_dt,p.phong_o,p.phan_cay,p.khu_vuc,p.dia_chi,p.so_bao_hiem,p.quan_he].join(" "));
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ---------- gợi ý tên khi gõ ---------- */
function highlightName(name,q){ const nn=noAccent(name), nq=noAccent(q); const i=nq?nn.indexOf(nq):-1;
  if(i<0) return esc(name); return esc(name.slice(0,i))+'<span class="sghi">'+esc(name.slice(i,i+q.length))+'</span>'+esc(name.slice(i+q.length)); }
function renderSugg(){
  const el=document.getElementById("sugg"); if(!el) return;
  const q=state.q.trim();
  if(state.view!=="people" || q.length<1){ el.classList.remove("show"); el.innerHTML=""; return; }
  const nq=noAccent(q);
  const matches=DATA.filter(p=>{ const a=noAccent(p.ten_that), b=noAccent(p.ten_ho_so), c=noAccent(p.cmnd), d=noAccent(p.so_dt); return a.includes(nq)||b.includes(nq)||c.includes(nq)||d.includes(nq); })
    .sort((x,y)=>noAccent(x.ten_that).indexOf(nq)-noAccent(y.ten_that).indexOf(nq)).slice(0,8);
  if(!matches.length){ el.classList.remove("show"); el.innerHTML=""; return; }
  el.innerHTML=matches.map(p=>{ const av=avatar(p);
    const avh=av?'<img class="sgav" style="object-fit:cover" src="'+av+'">':'<div class="sgav">'+esc((p.ten_that||"?").trim().slice(0,1))+'</div>';
    const meta=[p.to, p.phong_o?("Phòng "+p.phong_o):"", p.so_dt?("SĐT: "+p.so_dt):"", isMuon(p)?("HS: "+p.ten_ho_so):""].filter(Boolean).join(" · ");
    return '<div class="sgrow" data-id="'+p.id+'">'+avh+
      '<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:700">'+highlightName(p.ten_that||"(chưa có tên)",q)+
      (p.chu_phong?' 👑':'')+'</div><div style="font-size:11.5px;color:var(--muted)">'+esc(meta)+'</div></div>'+
      '<span class="sgchev">›</span></div>'; }).join("");
  el.classList.add("show");
}
function hideSugg(){ const el=document.getElementById("sugg"); if(el) el.classList.remove("show"); }

/* ---------- render list ---------- */
function loaiTag(p){
  if(p.loai==="Gia thuộc") return '<span class="tag gt">Gia thuộc</span>';
  if(p.loai==="Lao động") return '<span class="tag">Lao động</span>';
  return '<span class="tag kh">'+esc(p.loai||"?")+'</span>';
}
function render(){ if(state.view==="rooms") renderRooms(); else renderPeople(); }

function renderRooms(){
  const groups = {};
  for(const p of filtered()){ const r=roomKey(p); (groups[r]=groups[r]||[]).push(p); }
  const keys = Object.keys(groups).sort((a,b)=>{ if(a===NO_ROOM)return 1; if(b===NO_ROOM)return -1; return a.localeCompare(b,'vi',{numeric:true}); });
  document.getElementById("count").textContent = keys.length+" phòng";
  const list = document.getElementById("list");
  if(!keys.length){ list.innerHTML='<div class="empty">Không có phòng nào khớp bộ lọc.</div>'; return; }
  let html="";
  for(const r of keys){
    const ppl=groups[r];
    const names=ppl.map(p=>esc(p.ten_that)).slice(0,6).join(", ")+(ppl.length>6?"…":"");
    html+='<div class="card" data-room="'+esc(r)+'">'+
      '<div class="nm">🏠 '+esc(r)+' <span class="tag">'+ppl.length+' người</span></div>'+
      '<div class="sub">'+names+'</div></div>';
  }
  list.innerHTML=html;
}

function openRoom(room){
  currentRoom=room;
  const ppl=DATA.filter(p=>roomKey(p)===room).sort((a,b)=>(b.chu_phong?1:0)-(a.chu_phong?1:0) || (a.ten_that||"").localeCompare(b.ten_that||"",'vi'));
  let rows="";
  for(const p of ppl){
    const av=avatar(p);
    const avHtml = av ? '<img class="avatar" src="'+av+'">' : '<div class="avatar" style="display:flex;align-items:center;justify-content:center;color:#9bb0a5">🧑</div>';
    rows+='<div class="occ" data-id="'+p.id+'">'+avHtml+
      '<div class="onm">'+esc(p.ten_that||"(chưa có tên)")+(p.chu_phong?' <span class="tag chu">👑</span>':'')+(isMuon(p)?' <span class="tag muon">⚑</span>':'')+
        '<div style="font-size:12px;color:var(--muted);font-weight:400">'+esc(p.loai)+(p.quan_he?' · '+esc(p.quan_he):'')+(p.so_dt?' · 📞 '+esc(p.so_dt):'')+(p.cmnd?' · CMND '+esc(p.cmnd):'')+'</div></div>'+
      '<button class="mini-b" data-act="chu" title="Đặt làm chủ phòng">'+(p.chu_phong?'★':'☆')+'</button>'+
      '<button class="mini-b" data-act="edit">Sửa</button>'+
      '<button class="mini-b move" data-act="move">Chuyển</button>'+
    '</div>';
  }
  const sheet=document.getElementById("sheet");
  sheet.innerHTML=
    '<div class="sheet-h"><h2>🏠 Phòng '+esc(room)+'</h2><button class="x" id="bClose">×</button></div>'+
    '<div class="sheet-b"><div class="roomhdr">'+ppl.length+' người đang ở phòng này</div>'+(rows||'<div class="empty">Phòng trống.</div>')+'</div>'+
    '<div class="sheet-f"><button class="btn" id="bCancel">Đóng</button><button class="btn primary" id="bAddHere">＋ Thêm người vào phòng</button></div>';
  document.getElementById("overlay").classList.add("show");
  document.getElementById("bClose").onclick=closeEdit;
  document.getElementById("bCancel").onclick=closeEdit;
  document.getElementById("bAddHere").onclick=()=>{ const pre=room===NO_ROOM?"":room; openEdit("__new__",pre); };
  sheet.querySelectorAll(".occ").forEach(el=>{
    const id=DATA.find(x=>""+x.id===el.dataset.id).id;
    el.querySelector('[data-act="edit"]').onclick=()=>openEdit(id,null,room);
    el.querySelector('[data-act="move"]').onclick=()=>openMove(id,room);
    el.querySelector('[data-act="chu"]').onclick=()=>{
      const p=DATA.find(x=>x.id===id); const becoming=!p.chu_phong;
      DATA.forEach(x=>{ if(roomKey(x)===room && x.chu_phong){ x.chu_phong=false; x._edited=true; queueChange(x); } });
      p.chu_phong=becoming; p._edited=true; queueChange(p); save(); render(); openRoom(room);
      toast(becoming?"Đã đặt chủ phòng 👑":"Đã bỏ chủ phòng");
    };
  });
}

function openMove(id, backRoom){
  const p=DATA.find(x=>x.id===id); if(!p) return;
  const rooms=allRooms();
  const sheet=document.getElementById("sheet");
  sheet.innerHTML=
    '<div class="sheet-h"><h2>Chuyển phòng</h2><button class="x" id="bClose">×</button></div>'+
    '<div class="sheet-b">'+
      '<div class="fld"><label>Người</label><input value="'+esc(p.ten_that)+'" disabled></div>'+
      '<div class="fld"><label>Phòng hiện tại</label><input value="'+esc(p.phong_o||"(chưa có)")+'" disabled></div>'+
      '<div class="fld"><label>Chuyển đến phòng</label><input id="moveTo" list="roomDL" placeholder="Gõ hoặc chọn mã phòng, vd A7" value=""></div>'+
      '<datalist id="roomDL">'+rooms.map(r=>'<option value="'+esc(r)+'">').join("")+'</datalist>'+
    '</div>'+
    '<div class="sheet-f"><button class="btn" id="bCancel">Đóng</button><button class="btn primary" id="bMove">Chuyển</button></div>';
  document.getElementById("overlay").classList.add("show");
  document.getElementById("bClose").onclick=()=>{ backRoom?openRoom(backRoom):render(); };
  document.getElementById("bCancel").onclick=()=>{ backRoom?openRoom(backRoom):render(); };
  document.getElementById("bMove").onclick=()=>{
    const nv=document.getElementById("moveTo").value.trim();
    if(!nv){ toast("Nhập phòng đích"); return; }
    p.phong_o=nv; p._edited=true; queueChange(p); save();
    toast("Đã chuyển "+(p.ten_that||"")+" → phòng "+nv);
    render();
    if(backRoom) openRoom(backRoom); else closeEdit();
  };
  setTimeout(()=>{ const el=document.getElementById("moveTo"); if(el) el.focus(); },50);
}

function renderPeople(){
  const rows = filtered();
  document.getElementById("count").textContent = rows.length+" / "+DATA.length;
  const list = document.getElementById("list");
  if(!rows.length){ list.innerHTML='<div class="empty">Không tìm thấy ai khớp với bộ lọc.</div>'; return; }
  let html="";
  for(const p of rows){
    const muon = isMuon(p);
    const sub = [];
    if(p.cmnd) sub.push('<span class="pill">CMND: '+esc(p.cmnd)+'</span>');
    if(p.so_dt) sub.push('<span class="pill">📞 '+esc(p.so_dt)+'</span>');
    if(p.to) sub.push('<span class="pill">'+esc(p.to)+'</span>');
    if(p.phong_o) sub.push('<span class="pill">🏠 '+esc(p.phong_o)+'</span>');
    if(p.phan_cay) sub.push('<span class="pill">🌳 '+esc(p.phan_cay)+'</span>');
    if(p.quan_he) sub.push('<span class="pill">'+esc(p.quan_he)+'</span>');
    const av=avatar(p);
    const avHtml = av ? '<img class="avatar" src="'+av+'">' : '<div class="avatar" style="display:flex;align-items:center;justify-content:center;color:#9bb0a5;font-size:18px;">🧑</div>';
    html += '<div class="card" data-id="'+p.id+'"><div class="cardrow">'+avHtml+'<div class="cbody">'+
      '<div class="nm">'+esc(p.ten_that||"(chưa có tên)")+
        (p.chu_phong?' <span class="tag chu">👑 Chủ phòng</span>':'')+
        (muon?' <span class="tag muon">⚑ HS: '+esc(p.ten_ho_so)+'</span>':'')+
        (p._edited?' <span class="tag edited">đã sửa</span>':'')+
        ' '+loaiTag(p)+
      '</div>'+
      '<div class="sub">'+sub.join(" ")+'</div>'+
    '</div></div></div>';
  }
  list.innerHTML = html;
}

/* ---------- detail / edit ---------- */
let editingId = null;
let editBackRoom = null;
function openEdit(id, prefillRoom, backRoom){
  editingId = id; editBackRoom = backRoom || null;
  const p = id==="__new__" ? blank(prefillRoom) : DATA.find(x=>x.id===id);
  if(!p){ return; }
  const cur = clone(p);
  let body="";
  const mkInput=(k,lbl,t)=>{
    const v = esc(cur[k]||"");
    if(t==="textarea") return '<div class="fld"><label>'+lbl+'</label><textarea rows="2" data-k="'+k+'">'+v+'</textarea></div>';
    if(t==="sel_gt") return selField(k,lbl,["","M","F"],cur[k],{ "":"—", "M":"Nam (M)","F":"Nữ (F)" });
    if(t==="sel_loai") return selField(k,lbl,["Lao động","Gia thuộc","Khác"],cur[k]||"Khác");
    if(t==="sel_to") return selField(k,lbl,[""].concat(TO_LIST),cur[k]);
    return '<div class="fld"><label>'+lbl+'</label><input data-k="'+k+'" value="'+v+'"></div>';
  };
  // ảnh (chỉ khi đã có id; người mới cần lưu trước)
  if(id==="__new__") body += '<div class="newnote">Lưu người này trước, mở lại để chụp/thêm ảnh chân dung & CMND.</div>';
  else body += '<div id="imgSection">'+imgSectionHTML(cur)+'</div>';
  // chủ phòng
  body += '<div class="fld"><label class="ckrow"><input type="checkbox" id="ckChu"'+(cur.chu_phong?" checked":"")+'> 👑 Là chủ phòng</label></div>';
  body += mkInput("ten_that","Họ và tên (tên thật)","input");
  body += mkInput("ten_ho_so","Tên trong hồ sơ (tên mượn)","input");
  body += '<div class="muon-note" id="muonNote"></div>';
  body += '<div class="row2"><div>'+mkInput("cmnd","CMND / CCCD","input")+'</div><div>'+mkInput("so_bao_hiem","Số bảo hiểm","input")+'</div></div>';
  body += '<div class="fld"><label>Mã ngày sinh trên CMND (6 số: YY-MM-DD, vd 931011 → 11/10/1993)</label><input id="khmerNS" inputmode="numeric" maxlength="6" placeholder="Nhập 6 số → tự điền Ngày sinh"></div>';
  body += '<div class="row2"><div>'+mkInput("ngay_sinh","Ngày sinh","input")+'</div><div>'+mkInput("tuoi","Tuổi (tự tính)","input")+'</div></div>';
  body += mkInput("noi_sinh","Nơi sinh","input");
  body += '<div class="row2"><div>'+mkInput("gioi_tinh","Giới tính","sel_gt")+'</div><div>'+mkInput("loai","Loại","sel_loai")+'</div></div>';
  body += '<div class="row2"><div>'+mkInput("to","Tổ","sel_to")+'</div><div>'+mkInput("khu_vuc","Khu vực","input")+'</div></div>';
  body += '<div class="row2"><div>'+mkInput("phan_cay","Phần cây hiện tại","input")+'</div><div>'+mkInput("phong_o","Phòng ở","input")+'</div></div>';
  body += mkInput("quan_he","Quan hệ","input");
  body += mkInput("chi_tiet_noi_o","Chi tiết nơi ở","input");
  body += mkInput("dia_chi","Địa chỉ thường trú","input");
  body += mkInput("so_dt","Số điện thoại","input");
  body += mkInput("ghi_chu","Ghi chú","textarea");

  const title = id==="__new__" ? "Thêm người mới" : esc(p.ten_that||"Chi tiết");
  const sheet = document.getElementById("sheet");
  sheet.innerHTML =
    '<div class="sheet-h"><h2>'+title+'</h2><button class="x" id="bClose">×</button></div>'+
    '<div class="sheet-b">'+body+'</div>'+
    '<div class="sheet-f">'+
      (id==="__new__"?'':'<button class="btn del" id="bDel">🗑 Xoá</button>')+
      '<button class="btn" id="bCancel">Đóng</button>'+
      '<button class="btn primary" id="bSave">💾 Lưu</button>'+
    '</div>';
  document.getElementById("overlay").classList.add("show");
  const back = ()=>{ if(editBackRoom) openRoom(editBackRoom); else closeEdit(); };
  document.getElementById("bClose").onclick = back;
  document.getElementById("bCancel").onclick = back;
  document.getElementById("bSave").onclick = ()=>saveEdit(id);
  const dB=document.getElementById("bDel"); if(dB) dB.onclick=()=>delRec(id);
  const upd=()=>{ const t=sheet.querySelector('[data-k="ten_that"]').value.trim().toUpperCase();
                  const h=sheet.querySelector('[data-k="ten_ho_so"]').value.trim().toUpperCase();
                  document.getElementById("muonNote").textContent = (t&&h&&t!==h)?"⚑ Tên hồ sơ khác tên thật → đánh dấu TÊN MƯỢN":""; };
  sheet.querySelector('[data-k="ten_that"]').addEventListener("input",upd);
  sheet.querySelector('[data-k="ten_ho_so"]').addEventListener("input",upd);
  upd();
  const nsEl=sheet.querySelector('[data-k="ngay_sinh"]'), tuEl=sheet.querySelector('[data-k="tuoi"]'), khEl=sheet.querySelector('#khmerNS');
  const syncAge=()=>{ if(nsEl&&tuEl){ const a=ageFromDOB(nsEl.value); if(a!=="") tuEl.value=a; } };
  if(nsEl) nsEl.addEventListener("input",syncAge);
  if(khEl) khEl.addEventListener("input",()=>{ const d=dobFromKHCode(khEl.value); if(d&&nsEl){ nsEl.value=d; syncAge(); } });
  syncAge();
  if(id!=="__new__") bindImg(id);
  // chế độ VIP: người ĐÃ CÓ chỉ cho sửa phòng ở + ảnh
  if(isGuest() && id!=="__new__"){
    const GUEST_EDIT = ['phong_o','phan_cay','khu_vuc','to','so_dt'];
    sheet.querySelectorAll('[data-k]').forEach(el=>{ if(!GUEST_EDIT.includes(el.dataset.k)){ el.setAttribute("disabled","disabled"); } });
    const ck=sheet.querySelector("#ckChu"); if(ck) ck.setAttribute("disabled","disabled");
    const db=document.getElementById("bDel"); if(db) db.style.display="none";
    const note=document.createElement("div"); note.className="newnote";
    note.textContent="⭐ VIP: được cập nhật Phòng ở, Phần cây, Khu vực, Tổ và thêm ảnh cho người này.";
    sheet.querySelector(".sheet-b").prepend(note);
  }
}
function selField(k,lbl,opts,val,labels){
  let o=""; for(const v of opts){ const t=labels&&labels[v]!=null?labels[v]:(v||"—"); o+='<option value="'+esc(v)+'"'+(v===(val||"")?" selected":"")+'>'+esc(t)+'</option>'; }
  return '<div class="fld"><label>'+lbl+'</label><select data-k="'+k+'">'+o+'</select></div>';
}
function blank(prefillRoom){ const o={id:"__new__"}; for(const [k] of FIELDS) o[k]=""; o.loai="Lao động"; o.to=state.to||""; o.phong_o=prefillRoom||""; return o; }
function closeEdit(){ document.getElementById("overlay").classList.remove("show"); editingId=null; }
function saveEdit(id){
  const sheet=document.getElementById("sheet");
  const vals={}; sheet.querySelectorAll("[data-k]").forEach(el=>vals[el.dataset.k]=el.value.trim());
  const ck=sheet.querySelector("#ckChu"); vals.chu_phong = ck?ck.checked:false;
  const ag=ageFromDOB(vals.ngay_sinh); if(ag!=="") vals.tuoi=ag;
  if(!vals.ten_that){ toast("Cần nhập Họ và tên"); return; }
  let savedId=id;
  if(id==="__new__"){
    savedId = (DATA.reduce((m,x)=>Math.max(m,+x.id||0),0))+1;
    DATA.unshift(Object.assign({id:savedId,_new:true,_edited:true},vals));
  }else{
    const p=DATA.find(x=>x.id===id); Object.assign(p,vals); p._edited=true;
  }
  if(vals.chu_phong && vals.phong_o){ DATA.forEach(x=>{ if(x.id!==savedId && (x.phong_o||"")===vals.phong_o && x.chu_phong){ x.chu_phong=false; x._edited=true; queueChange(x); } }); }
  queueChange(DATA.find(x=>x.id===savedId));
  save(); render(); toast("Đã lưu ✓"); if(editBackRoom) openRoom(editBackRoom); else closeEdit();
}
function delRec(id){
  if(!confirm("Xoá người này khỏi danh sách trong app? (File gốc không bị ảnh hưởng)")) return;
  queueChange({id:id}, true);
  DATA = DATA.filter(x=>x.id!==id); save(); render(); toast("Đã xoá"); if(editBackRoom) openRoom(editBackRoom); else closeEdit();
}

/* ---------- export ---------- */
const EXPORT_COLS = [
  ["STT", p=>""],
  ["CMND", "cmnd"],["HỌ VÀ TÊN (Tên thật)","ten_that"],["TÊN TRONG HỒ SƠ","ten_ho_so"],
  ["Tên mượn?", p=>isMuon(p)?"x":""],["Ngày sinh","ngay_sinh"],["Tuổi","tuoi"],["Nơi sinh","noi_sinh"],["Giới tính","gioi_tinh"],
  ["Loại","loai"],["Chủ phòng", p=>p.chu_phong?"x":""],["Tổ","to"],["Khu vực","khu_vuc"],["Phần cây hiện tại","phan_cay"],
  ["Quan hệ","quan_he"],["PHÒNG Ở","phong_o"],["Số bảo hiểm","so_bao_hiem"],["Số điện thoại","so_dt"],
  ["Chi tiết nơi ở","chi_tiet_noi_o"],["Địa chỉ thường trú","dia_chi"],["Ghi chú","ghi_chu"],
];
function exportXlsx(){
  const head = EXPORT_COLS.map(c=>c[0]);
  const aoa = [head];
  filtered().forEach((p,i)=>{
    aoa.push(EXPORT_COLS.map(c=>{
      if(c[0]==="STT") return i+1;
      const f=c[1]; return typeof f==="function"?f(p):(p[f]||"");
    }));
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = head.map((h,i)=>({wch: i===2||i===3||i===16||i===17?26:(i===18?30:12)}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tổng");
  const d=new Date(); const fn="Du lieu Cong nhan DSX02 - cap nhat "+d.getFullYear()+("0"+(d.getMonth()+1)).slice(-2)+("0"+d.getDate()).slice(-2)+".xlsx";
  XLSX.writeFile(wb, fn);
  toast("Đã xuất "+filtered().length+" dòng ra Excel");
}

/* ---------- import ---------- */
function importXlsx(file){
  const rd=new FileReader();
  rd.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:"binary"});
      const sh = wb.Sheets["Tổng"] || wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sh,{header:1,raw:false});
      // tìm dòng tiêu đề
      let hr=-1; for(let i=0;i<Math.min(aoa.length,15);i++){ const j=noAccent((aoa[i]||[]).join("|")); if(j.includes("cmnd")&&(j.includes("ho va ten")||j.includes("ten that"))){hr=i;break;} }
      if(hr<0){ toast("Không nhận ra cột tiêu đề"); return; }
      const H=aoa[hr].map(x=>noAccent(x));
      const find=(...keys)=>H.findIndex(h=>keys.some(k=>h.includes(k)));
      const idx={ cmnd:find("cmnd"), ten_that:find("ten that","ho va ten"), ten_ho_so:find("ho so"),
        ngay_sinh:find("ngay sinh"), tuoi:find("tuoi"), gioi_tinh:find("gioi"),
        phan_cay:find("phan cay"), khu_vuc:find("khu vuc"), to:H.findIndex(h=>h==="to"||h.startsWith("to ")),
        quan_he:find("quan he"), loai:find("loai"), phong_o:find("phong"),
        so_bao_hiem:find("bao hiem"), chi_tiet_noi_o:find("chi tiet"), dia_chi:find("dia chi"),
        so_dt:find("so dien thoai","dien thoai","sdt","so dt","phone","mobile","zalo"),
        ghi_chu:find("ghi chu") };
      const out=[]; let id=1;
      for(let i=hr+1;i<aoa.length;i++){
        const r=aoa[i]||[]; const g=k=> idx[k]>=0 ? (r[idx[k]]==null?"":(""+r[idx[k]]).trim()) : "";
        const ten=g("ten_that"); const cmnd=g("cmnd");
        if(!ten && !cmnd) continue;
        const rec={id:id++}; for(const [k] of FIELDS) rec[k]=g(k);
        // suy ra tổ nếu trống
        if(!rec.to){ const m=(rec.khu_vuc||"").toUpperCase().match(/KV\s*([1-8])/); if(m) rec.to="Tổ "+m[1]; }
        if(!rec.loai) rec.loai = rec.phan_cay? "Lao động":"Gia thuộc";
        out.push(rec);
      }
      if(!out.length){ toast("Không đọc được dòng dữ liệu nào"); return; }
      if(!confirm("Nhập "+out.length+" người từ file này? Dữ liệu hiện tại trong app sẽ được thay thế.")) return;
      DATA=out; save(); render(); toast("Đã nhập "+out.length+" người");
    }catch(err){ toast("Lỗi đọc file: "+err.message); }
  };
  rd.readAsBinaryString(file);
}

/* ---------- stats ---------- */
function showStats(){
  const byTo={}, byLoai={"Lao động":0,"Gia thuộc":0,"Khác":0}; let muon=0; const phong=new Set();
  DATA.forEach(p=>{ byTo[p.to||"(trống)"]=(byTo[p.to||"(trống)"]||0)+1; byLoai[p.loai]=(byLoai[p.loai]||0)+1; if(isMuon(p))muon++; if(p.phong_o)phong.add(p.phong_o); });
  let tt=""; Object.keys(byTo).sort().forEach(k=>tt+="<tr><td>"+esc(k)+"</td><td>"+byTo[k]+"</td></tr>");
  document.getElementById("sheet").innerHTML=
    '<div class="sheet-h"><h2>📊 Thống kê</h2><button class="x" id="bClose">×</button></div>'+
    '<div class="statbox"><div class="statgrid">'+
      '<div class="stat"><b>'+DATA.length+'</b><span>Tổng số người</span></div>'+
      '<div class="stat"><b>'+(byLoai["Lao động"]||0)+'</b><span>Lao động</span></div>'+
      '<div class="stat"><b>'+(byLoai["Gia thuộc"]||0)+'</b><span>Gia thuộc</span></div>'+
      '<div class="stat"><b>'+muon+'</b><span>Có tên mượn</span></div>'+
      '<div class="stat"><b>'+phong.size+'</b><span>Số phòng ở</span></div>'+
      '<div class="stat"><b>'+DATA.filter(p=>p._edited).length+'</b><span>Đã chỉnh sửa</span></div>'+
    '</div><table class="mini"><tr><td><b>Theo tổ</b></td><td></td></tr>'+tt+'</table></div>';
  document.getElementById("overlay").classList.add("show");
  document.getElementById("bClose").onclick=closeEdit;
}

function openSettings(){
  const s=document.getElementById("sheet");
  const v=k=>document.getElementById(k).value.trim();
  s.innerHTML='<div class="sheet-h"><h2>⚙️ Cài đặt đồng bộ</h2><button class="x" id="bClose">×</button></div>'+
   '<div class="sheet-b">'+
   '<div class="fld"><label>Link máy chủ (Apps Script, kết thúc bằng /exec)</label><input id="cfgUrl" value="'+esc(CFG.url)+'" placeholder="https://script.google.com/macros/s/.../exec"></div>'+
   '<div class="fld"><label>Khoá truy cập (Admin hoặc Khách)</label><input id="cfgKey" value="'+esc(CFG.key)+'"></div>'+
   '<div class="fld"><label>Tên của bạn (ghi nhật ký)</label><input id="cfgUser" value="'+esc(CFG.user)+'" placeholder="vd: Tony"></div>'+
   '<div class="vnbox"><div class="vntitle">Trạng thái</div>'+(ROLE?("Đã kết nối: <b>"+(ROLE==="admin"?"Admin 👑":"VIP ⭐")+"</b>"):"Chưa kết nối")+
     ' · chờ gửi: '+(getOutbox().length+getPendImg().length)+'</div>'+
   (ROLE==="admin"?'<button class="btn" id="bSeed">⬆️ Khởi tạo dữ liệu lên Drive (chạy 1 lần đầu)</button>':'')+
   '<div style="margin-top:8px"><button class="btn" id="bBatchDob">🔎 Cập nhật ngày sinh từ ảnh CMND (hàng loạt)</button></div>'+
   '<div style="margin-top:8px"><button class="btn" id="bBatchAddr">🏠 Cập nhật địa chỉ thường trú từ CMND (hàng loạt)</button></div>'+
   (ROLE==="admin"?'<div style="margin-top:8px"><button class="btn" id="bCleanAddr">🧹 Làm sạch địa chỉ (lọc bỏ chiều cao, đặc điểm nhận dạng)</button></div>':'')+

   '</div>'+
   '<div class="sheet-f"><button class="btn" id="bClose2">Đóng</button><button class="btn" id="bConn">🔌 Kết nối</button><button class="btn primary" id="bSyncNow">☁️ Đồng bộ ngay</button></div>';
  document.getElementById("overlay").classList.add("show");
  document.getElementById("bClose").onclick=closeEdit; document.getElementById("bClose2").onclick=closeEdit;
  document.getElementById("bConn").onclick=async()=>{ CFG.url=v("cfgUrl");CFG.key=v("cfgKey");CFG.user=v("cfgUser");saveCfg(); const ok=await connect(); if(ok){ await syncNow(false); } openSettings(); };
  document.getElementById("bSyncNow").onclick=async()=>{ CFG.url=v("cfgUrl");CFG.key=v("cfgKey");CFG.user=v("cfgUser");saveCfg(); await syncNow(false); };
  const sd=document.getElementById("bSeed"); if(sd) sd.onclick=seedToDrive;
  const bd=document.getElementById("bBatchDob"); if(bd) bd.onclick=batchOcrDOB;
  const ba=document.getElementById("bBatchAddr"); if(ba) ba.onclick=batchOcrAddr;
  const bcl=document.getElementById("bCleanAddr"); if(bcl) bcl.onclick=cleanExistingAddresses;
}

/* ---------- events ---------- */
function toast(m){ const t=document.getElementById("toast"); t.textContent=m; t.classList.add("show"); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),1900); }
function initTo(){ const s=document.getElementById("fTo"); s.innerHTML='<option value="">Tất cả tổ</option>'+TO_LIST.map(t=>'<option value="'+t+'">'+t+'</option>').join(""); }
document.getElementById("q").addEventListener("input",e=>{ state.q=e.target.value; render(); renderSugg(); });
document.getElementById("q").addEventListener("focus",()=>renderSugg());
document.getElementById("q").addEventListener("blur",()=>setTimeout(hideSugg,160));
document.getElementById("sugg").addEventListener("click",e=>{ const r=e.target.closest(".sgrow"); if(!r) return; const id=DATA.find(x=>""+x.id===r.dataset.id)?.id; hideSugg(); if(id!=null) openEdit(id); });
document.getElementById("fTo").addEventListener("change",e=>{ state.to=e.target.value; render(); });
document.getElementById("fLoai").addEventListener("change",e=>{ state.loai=e.target.value; render(); });
document.getElementById("cMuon").addEventListener("click",e=>{ state.muon=!state.muon; e.target.classList.toggle("on",state.muon); render(); });
document.getElementById("list").addEventListener("click",e=>{ const c=e.target.closest(".card"); if(!c) return; if(state.view==="rooms"){ openRoom(c.dataset.room); } else { const id=DATA.find(x=>""+x.id===c.dataset.id)?.id; openEdit(id); } });
function setView(v){ state.view=v; hideSugg(); document.getElementById("tabPeople").classList.toggle("on",v==="people"); document.getElementById("tabRooms").classList.toggle("on",v==="rooms"); document.getElementById("bAdd").style.display=v==="people"?"":"none"; document.getElementById("q").placeholder=v==="rooms"?"Tìm mã phòng hoặc tên người…":"Tìm tên, tên hồ sơ, CMND, phòng, phần cây…"; render(); }
document.getElementById("tabPeople").onclick=()=>setView("people");
document.getElementById("tabRooms").onclick=()=>setView("rooms");
document.getElementById("bAdd").onclick=()=>openEdit("__new__");
document.getElementById("bExport").onclick=exportXlsx;
document.getElementById("bStat").onclick=showStats;
document.getElementById("bImport").onclick=()=>document.getElementById("fileImport").click();
document.getElementById("fileImport").addEventListener("change",e=>{ if(e.target.files[0]) importXlsx(e.target.files[0]); e.target.value=""; });
document.getElementById("bReset").onclick=()=>{ if(confirm("Đặt lại về dữ liệu gốc ban đầu? Mọi chỉnh sửa trong app sẽ mất.")){ localStorage.removeItem(LS_KEY); DATA=clone(BASE_DATA); render(); toast("Đã đặt lại"); } };
/* ---------- nhật ký thay đổi (admin) ---------- */
async function showLog(){
  if(!online()){ toast("Cần kết nối máy chủ để xem nhật ký"); return; }
  toast("Đang tải nhật ký…");
  try{
    const r=await api("getLog",{limit:50});
    if(!r||!r.ok){ toast("Không tải được"+(r&&r.error?" – "+r.error:"")); return; }
    const rows=r.rows||[];
    const fmtTime=iso=>{ try{ const d=new Date(iso); return d.toLocaleDateString('vi-VN')+' '+d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}); }catch(e){return iso;} };
    const FL={phong_o:'Phòng ở',phan_cay:'Phần cây',khu_vuc:'Khu vực',to:'Tổ','[thêm mới]':'Thêm mới',deleted:'Xoá'};
    const html=rows.length ? rows.map(row=>
      '<div style="padding:9px 0;border-bottom:1px solid var(--line);font-size:13px;">'+
      '<div style="font-weight:700;color:#0f172a">'+esc(row.name||row.id)+'</div>'+
      '<div style="color:var(--muted);font-size:12px;margin:2px 0">'+esc(fmtTime(row.time))+' · '+esc(row.user)+'</div>'+
      '<div>'+(FL[row.field]||esc(row.field))+': <span style="color:#b91c1c">'+esc(row.oldVal||'(trống)')+'</span> → <span style="color:#15803d">'+esc(row.newVal||'(trống)')+'</span></div>'+
      '</div>').join("") : '<div class="empty">Chưa có thay đổi nào được ghi.</div>';
    document.getElementById("sheet").innerHTML=
      '<div class="sheet-h"><h2>🔔 Nhật ký thay đổi (50 mục gần nhất)</h2><button class="x" id="bClose">×</button></div>'+
      '<div class="sheet-b">'+html+'</div>'+
      '<div class="sheet-f"><button class="btn" id="bClose2">Đóng</button></div>';
    document.getElementById("overlay").classList.add("show");
    document.getElementById("bClose").onclick=closeEdit;
    document.getElementById("bClose2").onclick=closeEdit;
  }catch(e){ toast("Lỗi: "+e.message); }
}

document.getElementById("overlay").addEventListener("click",e=>{ if(e.target.id==="overlay") closeEdit(); });
document.getElementById("bSettings").onclick=openSettings;
document.getElementById("bSync").onclick=()=>syncNow(false);
document.getElementById("bLog").onclick=showLog;
try{ initTo(); applyRole(); updateSyncBadge(); render(); }catch(e){ console.error("Lỗi render ban đầu:", e); }
idbOpen().then(idbAll).then(()=>{ applyRole(); updateSyncBadge(); render(); if(online()) syncNow(true); }).catch(e=>{ console.warn("IDB warning:", e); render(); });
