/* ===== Nhận diện an ninh: đối chiếu khuôn mặt cục bộ bằng face-api.js =====
   Toàn bộ ảnh và đặc trưng khuôn mặt được xử lý/lưu trên thiết bị người dùng.
   Kết quả chỉ là chỉ số tương đồng kỹ thuật, không phải kết luận danh tính. */
(function(){
  "use strict";

  var MODEL_BASE = "vendor/face-api/model";
  var LIB_SRC = "vendor/face-api/face-api.js";
  var DB_NAME = "cn_face_v1";
  var STORE = "desc";
  var KEY_PREFIX = "sec2|";
  var BAND_HIGH = 75, BAND_MID = 60, BAND_LOW = 45;
  var DIST_FLOOR = 0.85;

  var F = {
    apiP: null,
    dbP: null,
    cache: null,
    refs: null,
    query: null,
    match: null,
    selected: 0,
    topN: 10,
    cancel: 0,
    busy: false,
    objUrl: null
  };

  /* ---------- tiện ích ---------- */
  function el(id){ return document.getElementById(id); }
  function esc2(v){
    return (v == null ? "" : "" + v).replace(/[&<>"]/g, function(c){
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }

  function injectStyle(){
    if(el("secFaceStyle")) return;
    var st = document.createElement("style");
    st.id = "secFaceStyle";
    st.textContent = [
      ".sec-hero{display:flex;gap:12px;align-items:flex-start;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;border-radius:14px;padding:14px;margin-bottom:10px;}",
      ".sec-hero-icon{font-size:26px;line-height:1;}",
      ".sec-hero b{font-size:15.5px;}",
      ".sec-hero p{margin:3px 0 0;font-size:12.5px;opacity:.78;line-height:1.45;}",
      ".sec-warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:10px 12px;font-size:12.5px;line-height:1.5;margin-bottom:10px;}",
      ".sec-priv{background:#f0fdfa;border:1px solid #99f6e4;color:#115e59;border-radius:12px;padding:9px 12px;font-size:12px;line-height:1.45;margin-bottom:12px;}",
      ".sec-drop{border:2px dashed #cbd5e1;border-radius:14px;background:#f8fafc;text-align:center;padding:18px 12px;transition:background .15s,border-color .15s;}",
      ".sec-drop.drag{border-color:#0d9488;background:#ecfdf5;}",
      ".sec-drop b{display:block;font-size:14px;margin:4px 0 2px;color:#0f172a;}",
      ".sec-drop small{display:block;color:#64748b;font-size:11.5px;line-height:1.45;}",
      ".sec-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px;}",
      ".sec-stat{font-size:12px;color:#475569;line-height:1.55;margin:10px 2px 0;}",
      ".sec-stat b{color:#0f172a;}",
      ".sec-progress{height:9px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:10px 0 8px;}",
      ".sec-progress > i{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#0d9488);transition:width .2s;}",
      ".sec-stage{font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;}",
      ".sec-sub{font-size:12px;color:#64748b;margin-top:3px;line-height:1.45;}",
      ".sec-query{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px;}",
      ".sec-query canvas{max-width:100%;border-radius:12px;border:1px solid #e2e8f0;background:#f8fafc;}",
      "#secQueryPrev{text-align:center;margin-bottom:8px;}",
      "#secQueryPrev canvas{max-width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;background:#f8fafc;}",
      ".sec-face-pick{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 2px;}",
      ".sec-face-chip{width:54px;height:54px;padding:0;border-radius:10px;border:2px solid #e2e8f0;background:#fff;overflow:hidden;cursor:pointer;}",
      ".sec-face-chip img{width:100%;height:100%;object-fit:cover;display:block;}",
      ".sec-face-chip.on{border-color:#7c3aed;box-shadow:0 0 0 2px #ede9fe;}",
      ".sec-summary{font-size:12.5px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px;margin-bottom:10px;line-height:1.5;}",
      ".sec-card{display:flex;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:8px;margin-bottom:8px;background:#fff;}",
      ".sec-card.top{border-color:#c4b5fd;background:linear-gradient(135deg,#faf5ff,#ffffff);}",
      ".sec-rank{flex:0 0 22px;text-align:center;font-weight:900;font-size:15px;color:#94a3b8;}",
      ".sec-card.top .sec-rank{color:#7c3aed;}",
      ".sec-thumb{flex:0 0 52px;width:52px;height:66px;object-fit:cover;border-radius:8px;background:#f1f5f9;border:1px solid #e2e8f0;}",
      ".sec-main{flex:1;min-width:0;}",
      ".sec-name{font-size:13.5px;font-weight:800;color:#0f172a;line-height:1.3;display:flex;gap:6px;align-items:center;flex-wrap:wrap;}",
      ".sec-badge{font-size:10px;font-weight:800;border-radius:999px;padding:2px 7px;white-space:nowrap;}",
      ".sec-meta{font-size:11.5px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".sec-bar{height:6px;background:#eef2f7;border-radius:999px;overflow:hidden;margin-top:6px;}",
      ".sec-bar > i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#8b5cf6,#0d9488);}",
      ".sec-scoreline{display:flex;justify-content:space-between;font-size:11px;color:#475569;margin-top:3px;}",
      ".sec-open{flex:0 0 auto;padding:7px 9px;font-size:11.5px;font-weight:700;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;cursor:pointer;}",
      ".sec-open:hover{background:#f8fafc;}",
      ".sec-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px;}",
      ".sec-actions .btn{flex:1;min-width:130px;justify-content:center;}",
      ".sec-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px;font-size:13px;line-height:1.5;}",
      ".sec-link{background:none;border:0;color:#0d9488;font-size:12px;font-weight:700;cursor:pointer;padding:4px 0;text-decoration:underline;}",
      ".sec-topn{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#334155;margin:4px 0 10px;}",
      ".sec-topn select{padding:6px 8px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-size:12.5px;}"
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ---------- tải thư viện / model ---------- */
  function loadScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function(){ res(); };
      s.onerror = function(){ rej(new Error("Không tải được " + src)); };
      document.head.appendChild(s);
    });
  }

  function loadEngine(onStage){
    if(window.faceapi && window.faceapi.nets.faceRecognitionNet.isLoaded) return Promise.resolve(window.faceapi);
    if(F.apiP) return F.apiP;
    F.apiP = (async function(){
      if(!window.faceapi){
        onStage && onStage("Đang tải bộ máy nhận diện (lần đầu ~7 MB, chỉ tải một lần)...");
        await loadScript(LIB_SRC);
      }
      var api = window.faceapi;
      try{
        if(api.tf && api.tf.setBackend){
          await api.tf.setBackend("webgl");
          await api.tf.ready();
        }
      }catch(e){ console.warn("Không dùng được WebGL, chuyển CPU:", e); }
      onStage && onStage("Đang nạp model khuôn mặt...");
      await api.nets.tinyFaceDetector.loadFromUri(MODEL_BASE);
      await api.nets.faceLandmark68Net.loadFromUri(MODEL_BASE);
      await api.nets.faceRecognitionNet.loadFromUri(MODEL_BASE);
      return api;
    })();
    return F.apiP.then(function(api){ return api; }, function(err){ F.apiP = null; throw err; });
  }

  /* ---------- ảnh ---------- */
  function loadImage(src){
    return new Promise(function(res, rej){
      var im = new Image();
      if(/^https?:/i.test(src)) im.crossOrigin = "anonymous";
      var to = setTimeout(function(){ rej(new Error("Hết thời gian tải ảnh")); }, 8000);
      im.onload = function(){ clearTimeout(to); res(im); };
      im.onerror = async function(){
        clearTimeout(to);
        var err = new Error("Không đọc được ảnh");
        if(/^https?:/i.test(src)){
          try{
            var r = await fetch(src, { mode: "cors" });
            if(r.status === 404 || r.status === 410) err.permanent = true;
          }catch(e){}
        }
        rej(err);
      };
      im.src = src;
    });
  }

  function fitCanvas(im, maxSide){
    var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    if(!w || !h) return null;
    var k = Math.min(1, maxSide / Math.max(w, h));
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    return c;
  }

  async function describeSrc(src, maxSide){
    var api = window.faceapi;
    var im = await loadImage(src);
    var input = fitCanvas(im, maxSide || 560) || im;
    var opts = new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 });
    var r = await api.detectSingleFace(input, opts).withFaceLandmarks().withFaceDescriptor();
    return r ? r.descriptor : null;
  }

  async function detectQuery(canvas){
    var api = window.faceapi;
    var opts = new api.TinyFaceDetectorOptions({ inputSize: 640, scoreThreshold: 0.3 });
    var res = await api.detectAllFaces(canvas, opts).withFaceLandmarks().withFaceDescriptors();
    if(!res.length){
      opts = new api.TinyFaceDetectorOptions({ inputSize: 800, scoreThreshold: 0.18 });
      res = await api.detectAllFaces(canvas, opts).withFaceLandmarks().withFaceDescriptors();
    }
    return res;
  }

  function fileToCanvas(file){
    return new Promise(function(res, rej){
      var url = URL.createObjectURL(file);
      F.objUrl = url;
      var im = new Image();
      im.onload = function(){
        var c = fitCanvas(im, 1200);
        URL.revokeObjectURL(url);
        F.objUrl = null;
        c ? res(c) : rej(new Error("Ảnh không hợp lệ"));
      };
      im.onerror = function(){
        URL.revokeObjectURL(url);
        F.objUrl = null;
        rej(new Error("Không đọc được file ảnh"));
      };
      im.src = url;
    });
  }

  function cropFace(canvas, box, size){
    var s = size || 120;
    var c = document.createElement("canvas");
    c.width = c.height = s;
    var pad = Math.round(Math.max(box.width, box.height) * 0.3);
    var x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
    var w = Math.min(canvas.width - x, box.width + pad * 2);
    var h = Math.min(canvas.height - y, box.height + pad * 2);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, s, s);
    if(w > 0 && h > 0) ctx.drawImage(canvas, x, y, w, h, 0, 0, s, s);
    return c.toDataURL("image/jpeg", 0.82);
  }

  function previewWithBoxes(canvas, dets, selected){
    var maxW = 560;
    var k = Math.min(1, maxW / canvas.width);
    var out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(canvas.width * k));
    out.height = Math.max(1, Math.round(canvas.height * k));
    var ctx = out.getContext("2d");
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    dets.forEach(function(d, i){
      var b = d.detection.box;
      var on = i === selected;
      ctx.lineWidth = on ? 3 : 2;
      ctx.strokeStyle = on ? "#7c3aed" : "#f59e0b";
      ctx.strokeRect(b.x * k, b.y * k, b.width * k, b.height * k);
      ctx.fillStyle = on ? "#7c3aed" : "#f59e0b";
      ctx.font = "bold 13px sans-serif";
      var label = String(i + 1);
      ctx.fillText(label, b.x * k + 5, Math.max(14, b.y * k - 5));
    });
    return out;
  }

  /* ---------- nguồn ảnh hồ sơ ---------- */
  function srcKey(src){
    if(!src) return "";
    if(src.indexOf("data:") === 0){
      var h = 0, n = src.length;
      for(var i = 0; i < 160 && i < n; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
      for(var j = Math.max(0, n - 160); j < n; j++) h = (h * 31 + src.charCodeAt(j)) | 0;
      return "d" + n + "_" + h;
    }
    return "u" + src;
  }

  function refCacheKey(w, alt){
    var overridden = false;
    try{ overridden = (typeof IMG_OVR !== "undefined") && ((alt.kind + ":" + w.id) in IMG_OVR); }catch(e){}
    if(!overridden){
      try{
        var fid = imgFileId(w.id, alt.kind);
        if(fid) return KEY_PREFIX + w.id + "|" + alt.kind + "|fid:" + fid;
      }catch(e){}
      var st = (typeof window !== "undefined" && window.__IMG_STATIC) ? window.__IMG_STATIC : null;
      if(st && st[alt.kind + ":" + w.id]) return KEY_PREFIX + w.id + "|" + alt.kind + "|st:" + st[alt.kind + ":" + w.id];
    }
    return KEY_PREFIX + w.id + "|" + alt.kind + "|src:" + srcKey(alt.src);
  }

  function buildRefs(){
    var data = (typeof DATA !== "undefined" && Array.isArray(DATA)) ? DATA : [];
    var out = [];
    var seen = {};
    data.forEach(function(p){
      if(!p || p.id == null || p.id === "__new__" || p.deleted) return;
      if(seen[p.id]) return;
      var alts = [];
      try{
        var ph = getImg(p.id, "photo");
        if(ph) alts.push({ kind: "photo", src: ph });
        var cm = getImg(p.id, "cmnd");
        if(cm) alts.push({ kind: "cmnd", src: cm });
      }catch(e){}
      if(!alts.length) return;
      seen[p.id] = 1;
      out.push({
        id: p.id,
        name: (p.ten_that || p.ten_ho_so || "").trim() || ("#" + p.id),
        to: p.to || "",
        room: p.phong_o || "",
        alts: alts,
        desc: null,
        used: null,
        tempFail: false
      });
    });
    return out;
  }

  /* ---------- IndexedDB ---------- */
  function openDb(){
    if(F.dbP) return F.dbP;
    F.dbP = new Promise(function(res){
      try{
        var r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = function(e){
          var db = e.target.result;
          if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
        };
        r.onsuccess = function(e){ res(e.target.result); };
        r.onerror = function(){ res(null); };
        r.onblocked = function(){ res(null); };
      }catch(e){ res(null); }
    });
    return F.dbP;
  }

  function cacheAll(db){
    return new Promise(function(res){
      if(!db) return res(new Map());
      try{
        var st = db.transaction(STORE, "readonly").objectStore(STORE);
        var out = new Map();
        var cur = st.openCursor();
        cur.onsuccess = function(e){
          var c = e.target.result;
          if(c){ out.set(c.key, c.value); c.continue(); }
          else res(out);
        };
        cur.onerror = function(){ res(out); };
      }catch(e){ res(new Map()); }
    });
  }

  function cachePut(db, rec){
    if(!db) return;
    try{ db.transaction(STORE, "readwrite").objectStore(STORE).put(rec); }catch(e){}
  }

  function cachedWorkerCount(){
    if(!F.cache) return 0;
    var ids = {};
    F.cache.forEach(function(rec){ if(rec.ok) ids[rec.id] = 1; });
    return Object.keys(ids).length;
  }

  async function clearCache(){
    try{
      var db = await openDb();
      if(db) db.close();
    }catch(e){}
    await new Promise(function(res){
      try{
        var r = indexedDB.deleteDatabase(DB_NAME);
        r.onsuccess = r.onerror = r.onblocked = function(){ res(); };
      }catch(e){ res(); }
    });
    F.dbP = null;
    F.cache = null;
    if(F.refs) F.refs.forEach(function(w){ w.desc = null; w.used = null; });
    return true;
  }

  /* ---------- so khớp ---------- */
  function toF32(arr){
    if(arr instanceof Float32Array) return arr;
    return Float32Array.from(arr || []);
  }

  function distance(a, b){
    var s = 0;
    var n = Math.min(a.length, b.length);
    for(var i = 0; i < n; i++){
      var d = a[i] - b[i];
      s += d * d;
    }
    return Math.sqrt(s);
  }

  function scoreOf(dist){
    return Math.max(0, Math.min(100, 100 * (1 - dist / DIST_FLOOR)));
  }

  function band(sim){
    if(sim >= BAND_HIGH) return { label: "Rất cao", bg: "#ede9fe", fg: "#6d28d9" };
    if(sim >= BAND_MID) return { label: "Cao", bg: "#e0f2fe", fg: "#0369a1" };
    if(sim >= BAND_LOW) return { label: "Trung bình", bg: "#fef9c3", fg: "#a16207" };
    return { label: "Thấp", bg: "#f1f5f9", fg: "#64748b" };
  }

  async function indexGallery(token, onStage, onProgress){
    await loadEngine(function(msg){ onStage(msg); });
    if(F.cancel !== token) return null;

    var db = await openDb();
    if(!F.cache) F.cache = await cacheAll(db);
    var firstIndex = !F.cache || F.cache.size === 0;
    if(!F.refs) F.refs = buildRefs();
    var refs = F.refs;
    var total = refs.length;
    var done = 0, hits = 0, noface = 0;
    var cursor = 0;

    onProgress({ done: 0, total: total, hits: 0, noface: 0 });

    async function resolveRef(w){
      if(w.desc) return true;
      var got = null, used = null, loadErrAny = false;
      for(var a = 0; a < w.alts.length; a++){
        if(F.cancel !== token) return false;
        var alt = w.alts[a];
        var key = refCacheKey(w, alt);
        var failKey = KEY_PREFIX + "fail|" + w.id + "|" + alt.kind + "|" + srcKey(alt.src);
        if(F.cache && F.cache.get(failKey)) continue;
        var rec = F.cache ? F.cache.get(key) : null;
        if(rec){
          if(rec.ok && rec.desc){ got = toF32(rec.desc); used = alt; }
          if(got) break;
          continue;
        }
        var desc = null, loadErr = false, permanent = false;
        try{ desc = await describeSrc(alt.src, 560); }catch(e){
          if(e && e.permanent){
            permanent = true;
            var frec = { key: failKey, id: w.id, kind: alt.kind, ok: false, fail: true, at: Date.now() };
            if(F.cache) F.cache.set(failKey, frec);
            cachePut(db, frec);
          } else {
            loadErr = true;
          }
        }
        if(F.cancel !== token) return false;
        if(permanent) continue;
        if(loadErr){
          loadErrAny = true;
        } else {
          var ok = !!desc;
          rec = { key: key, id: w.id, kind: alt.kind, ok: ok, desc: ok ? Array.from(desc) : null, at: Date.now() };
          if(F.cache) F.cache.set(key, rec);
          cachePut(db, rec);
          if(ok){ got = desc; used = alt; break; }
        }
      }
      if(got){ w.desc = got; w.used = used; w.tempFail = false; return true; }
      w.tempFail = loadErrAny;
      return false;
    }

    async function worker(){
      while(true){
        if(F.cancel !== token) return;
        var i = cursor++;
        if(i >= total) return;
        var w = refs[i];
        if(w.desc){ done++; hits++; onProgress({ done: done, total: total, hits: hits, noface: noface }); continue; }
        var ok = await resolveRef(w);
        if(F.cancel !== token) return;
        if(ok) hits++;
        done++;
        onProgress({ done: done, total: total, hits: hits, noface: noface });
        await new Promise(function(r){ setTimeout(r, 0); });
      }
    }

    await Promise.all([worker(), worker()]);
    if(F.cancel !== token) return null;

    var retry = refs.filter(function(w){ return !w.desc && w.tempFail; });
    if(retry.length && firstIndex){
      onStage("Đang thử lại " + retry.length + " ảnh bị lỗi tải...");
      await new Promise(function(r){ setTimeout(r, 800); });
      for(var ri = 0; ri < retry.length; ri++){
        if(F.cancel !== token) return null;
        await resolveRef(retry[ri]);
        if((ri + 1) % 5 === 0 || ri === retry.length - 1) onStage("Đang thử lại ảnh lỗi tải " + (ri + 1) + "/" + retry.length + "...");
      }
      if(F.cancel !== token) return null;
    }

    var indexed = refs.filter(function(w){ return !!w.desc; }).length;
    return { total: total, hits: indexed, noface: total - indexed };
  }

  function currentMatches(){
    if(!F.query || !F.refs) return [];
    var det = F.query.dets[F.selected];
    if(!det) return [];
    var q = det.descriptor;
    var scored = [];
    F.refs.forEach(function(r){
      if(!r.desc) return;
      var d = distance(q, r.desc);
      scored.push({ ref: r, dist: d, sim: scoreOf(d) });
    });
    scored.sort(function(a, b){ return a.dist - b.dist; });
    return scored;
  }

  /* ---------- giao diện ---------- */
  function header(){
    return '<div class="sheet-h">' +
      '<span style="font-size:20px;">🛡️</span>' +
      '<h2>Nhận diện an ninh</h2>' +
      '<button class="x" id="secClose" type="button" aria-label="Đóng">×</button>' +
      '</div>';
  }

  function renderIntro(){
    var body = el("secBody");
    if(!body) return;
    var refs = F.refs || buildRefs();
    F.refs = refs;
    body.innerHTML =
      '<div class="sec-hero">' +
        '<div class="sec-hero-icon">🔎</div>' +
        '<div><b>Đối chiếu ảnh an ninh</b>' +
        '<p>Đưa ảnh từ camera an ninh, ảnh người dân cung cấp hoặc ảnh chụp màn hình vào để tìm những hồ sơ công nhân có khuôn mặt tương đồng nhất.</p></div>' +
      '</div>' +
      '<div class="sec-warn"><b>⚠️ Chỉ dùng để tham khảo, không kết luận vi phạm.</b><br>' +
        'Điểm tương đồng là chỉ số kỹ thuật và có thể sai khi ảnh mờ, bị che mặt, ngược sáng hoặc khác góc chụp. Luôn xác minh bằng người thật và bằng chứng khác.</div>' +
      '<div class="sec-priv">🔒 Ảnh của bạn <b>không được tải lên máy chủ nào</b>. Việc phân tích chạy ngay trong trình duyệt; đặc trưng khuôn mặt chỉ lưu trên thiết bị này.</div>' +
      '<div class="sec-drop" id="secDrop">' +
        '<div style="font-size:30px;">📷</div>' +
        '<b>Kéo ảnh vào đây hoặc chọn ảnh</b>' +
        '<small>JPG / PNG · Có thể dán ảnh chụp màn hình bằng Ctrl+V (⌘+V trên Mac)</small>' +
        '<div class="sec-row">' +
          '<button class="btn" id="secPick" type="button">Chọn ảnh</button>' +
          '<button class="btn" id="secCam" type="button">Chụp từ camera</button>' +
        '</div>' +
      '</div>' +
      '<div class="sec-stat" id="secStat">Kho hồ sơ: <b>' + refs.length + '</b> người có ảnh · Đã lập chỉ mục trên máy: <b>' + cachedWorkerCount() + '</b> hồ sơ.</div>' +
      '<div class="sec-actions">' +
        '<button class="btn" id="secClear" type="button">Xóa dữ liệu nhận diện trên máy</button>' +
      '</div>' +
      '<input type="file" id="secFileInput" accept="image/*" style="display:none">' +
      '<input type="file" id="secCamInput" accept="image/*" capture="environment" style="display:none">';

    el("secFileInput").addEventListener("change", function(e){
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if(f) secStart(f);
    });
    el("secCamInput").addEventListener("change", function(e){
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if(f) secStart(f);
    });
    el("secPick").onclick = function(){ el("secFileInput").click(); };
    el("secCam").onclick = function(){ el("secCamInput").click(); };
    el("secClear").onclick = function(){
      if(!confirm("Xóa toàn bộ đặc trưng khuôn mặt đã lưu trên máy này? Lần quét sau sẽ phải phân tích lại từ đầu.")) return;
      clearCache().then(function(){
        toast("Đã xóa dữ liệu nhận diện trên máy");
        renderIntro();
      });
    };

    var drop = el("secDrop");
    ["dragenter", "dragover"].forEach(function(ev){
      drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add("drag"); });
    });
    ["dragleave", "drop"].forEach(function(ev){
      drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove("drag"); });
    });
    drop.addEventListener("drop", function(e){
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if(f) secStart(f);
    });
    drop.addEventListener("click", function(e){
      if(e.target && e.target.closest && e.target.closest("button")) return;
      el("secFileInput").click();
    });

    openDb().then(function(db){
      return F.cache ? F.cache : cacheAll(db);
    }).then(function(cache){
      if(!F.cache) F.cache = cache;
      var stat = el("secStat");
      if(stat) stat.innerHTML = 'Kho hồ sơ: <b>' + refs.length + '</b> người có ảnh · Đã lập chỉ mục trên máy: <b>' + cachedWorkerCount() + '</b> hồ sơ.';
    }).catch(function(){});
  }

  function busyView(){
    var body = el("secBody");
    if(!body) return;
    body.innerHTML =
      '<div class="sec-hero">' +
        '<div class="sec-hero-icon">🧠</div>' +
        '<div><b>Đang phân tích</b><p>Giữ màn hình sáng trong lúc quét. Lần đầu có thể mất 1–2 phút để lập chỉ mục toàn bộ hồ sơ.</p></div>' +
      '</div>' +
      '<div class="sec-stage" id="secStage">Đang chuẩn bị...</div>' +
      '<div class="sec-progress"><i id="secFill"></i></div>' +
      '<div class="sec-sub" id="secSub">Ảnh chỉ được xử lý trên thiết bị này.</div>' +
      '<div class="sec-actions"><button class="btn" id="secStop" type="button">Dừng quét</button></div>';
    el("secStop").onclick = function(){
      F.cancel++;
      F.busy = false;
      toast("Đã dừng quét");
      renderIntro();
    };
  }

  function setStage(msg){
    var stage = el("secStage"), sub = el("secSub");
    if(stage) stage.textContent = msg;
    if(sub && msg.indexOf("Đang lập chỉ mục") !== 0) sub.textContent = "Ảnh chỉ được xử lý trên thiết bị này.";
  }

  function setProgress(p){
    var fill = el("secFill"), stage = el("secStage"), sub = el("secSub");
    if(!fill) return;
    var pct = p.total ? Math.round(p.done / p.total * 100) : 0;
    fill.style.width = pct + "%";
    if(stage) stage.textContent = "Đang lập chỉ mục khuôn mặt " + p.done + "/" + p.total;
    if(sub) sub.textContent = "Nhận diện được " + p.hits + " hồ sơ · Chưa rõ khuôn mặt " + p.noface + " · " + pct + "%";
  }

  function errorView(msg, retryLabel){
    var body = el("secBody");
    if(!body) return;
    body.innerHTML =
      '<div class="sec-hero"><div class="sec-hero-icon">🛡️</div><div><b>Nhận diện an ninh</b><p>Đối chiếu ảnh với hồ sơ công nhân.</p></div></div>' +
      '<div class="sec-err">' + esc2(msg) + '</div>' +
      '<div class="sec-actions"><button class="btn" id="secBack" type="button">' + esc2(retryLabel || "Quay lại") + '</button></div>';
    el("secBack").onclick = renderIntro;
  }

  function renderQuery(q, selected){
    var chips = "";
    if(q.dets.length > 1){
      chips = '<div style="font-size:12px;color:#475569;margin-top:8px;">Phát hiện <b>' + q.dets.length + '</b> khuôn mặt. Chọn khuôn mặt cần đối chiếu:</div><div class="sec-face-pick" id="secFacePick">';
      q.dets.forEach(function(d, i){
        var src = cropFace(q.canvas, d.detection.box, 108);
        chips += '<button class="sec-face-chip' + (i === selected ? " on" : "") + '" type="button" data-i="' + i + '"><img src="' + src + '" alt="Khuôn mặt ' + (i + 1) + '"></button>';
      });
      chips += '</div>';
    }
    return '<div class="sec-query"><div>' + chips + '</div></div>' +
      '<div id="secQueryPrev"></div>';
  }

  function renderResults(data, stats){
    var body = el("secBody");
    if(!body) return;
    var det = F.query.dets[F.selected];
    var q = F.query;
    var cards = "";
    data.forEach(function(item, idx){
      var r = item.ref;
      var sim = Math.max(0, Math.min(100, item.sim));
      var b = band(sim);
      var thumb = (r.used && r.used.src) || "";
      var meta = "#" + esc2(r.id) + (r.to ? " · " + esc2(r.to) : "") + (r.room ? " · Phòng " + esc2(r.room) : "");
      cards += '<div class="sec-card' + (idx === 0 ? " top" : "") + '">' +
        '<div class="sec-rank">' + (idx + 1) + '</div>' +
        (thumb ? '<img class="sec-thumb" src="' + thumb + '" alt="" onerror="this.src=\'icon-192.png\'">' : '<div class="sec-thumb"></div>') +
        '<div class="sec-main">' +
          '<div class="sec-name">' + esc2(r.name) + '<span class="sec-badge" style="background:' + b.bg + ';color:' + b.fg + ';">' + b.label + '</span></div>' +
          '<div class="sec-meta">' + meta + '</div>' +
          '<div class="sec-bar"><i style="width:' + sim.toFixed(1) + '%"></i></div>' +
          '<div class="sec-scoreline"><span>Điểm tương đồng (0–100)</span><b>' + sim.toFixed(0) + '</b></div>' +
        '</div>' +
        '<button class="sec-open" type="button" data-id="' + esc2(r.id) + '">Hồ sơ</button>' +
      '</div>';
    });
    if(!cards) cards = '<div class="sec-err">Không có hồ sơ nào đủ dữ liệu khuôn mặt để so khớp.</div>';

    body.innerHTML =
      '<div class="sec-hero"><div class="sec-hero-icon">🔎</div><div><b>Kết quả đối chiếu</b><p>Sắp xếp theo chỉ số tương đồng khuôn mặt. Danh sách chỉ là gợi ý để con người kiểm tra.</p></div></div>' +
      renderQuery(q, F.selected) +
      '<div class="sec-summary">Đã so khớp <b>' + stats.scored + '</b> hồ sơ có dữ liệu khuôn mặt' +
        (stats.noface ? ' · <b>' + stats.noface + '</b> hồ sơ chưa nhận diện được khuôn mặt' : '') +
        ' · Điểm càng cao càng giống, đây không phải xác suất danh tính. Ảnh không được gửi đi đâu.</div>' +
      '<div class="sec-topn"><label for="secTopN">Số người hiển thị:</label>' +
        '<select id="secTopN">' + [5, 10, 20, 50].map(function(n){ return '<option value="' + n + '"' + (n === F.topN ? " selected" : "") + '>' + n + '</option>'; }).join("") + '</select>' +
      '</div>' +
      '<div id="secCards">' + cards + '</div>' +
      '<div class="sec-warn" style="margin-top:12px;">Kết quả có thể trùng người thân hoặc người có nét giống. Không dùng chỉ số này để buộc tội; cần đối chiếu thêm thời gian, vị trí camera và lời khai.</div>' +
      '<div class="sec-actions">' +
        '<button class="btn" id="secAgain" type="button">Quét ảnh khác</button>' +
        '<button class="btn" id="secClear2" type="button">Xóa dữ liệu nhận diện</button>' +
      '</div>';

    var prevHost = el("secQueryPrev");
    if(prevHost && q) prevHost.appendChild(previewWithBoxes(q.canvas, q.dets, F.selected));

    body.querySelectorAll(".sec-open").forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute("data-id");
        secClose();
        setTimeout(function(){
          try{ openEdit(isNaN(+id) ? id : +id); }catch(e){ toast("Không mở được hồ sơ"); }
        }, 30);
      };
    });
    var again = el("secAgain");
    if(again) again.onclick = renderIntro;
    var clr = el("secClear2");
    if(clr) clr.onclick = function(){
      if(!confirm("Xóa toàn bộ đặc trưng khuôn mặt đã lưu trên máy này?")) return;
      clearCache().then(function(){ toast("Đã xóa dữ liệu nhận diện trên máy"); renderIntro(); });
    };
    var sel = el("secTopN");
    if(sel) sel.onchange = function(){
      F.topN = parseInt(sel.value, 10) || 10;
      applyMatches();
    };
    var pick = el("secFacePick");
    if(pick){
      pick.querySelectorAll(".sec-face-chip").forEach(function(btn){
        btn.onclick = function(){
          F.selected = parseInt(btn.getAttribute("data-i"), 10) || 0;
          applyMatches();
        };
      });
    }
  }

  function applyMatches(){
    var all = currentMatches();
    var stats = { scored: all.length, noface: F.refs ? F.refs.filter(function(r){ return !r.desc; }).length : 0 };
    F.match = all;
    renderResults(all.slice(0, F.topN), stats);
  }

  async function secStart(file){
    if(F.busy) return;
    if(!file || !/^image\//.test(file.type || "")){
      toast("Vui lòng chọn một file ảnh");
      return;
    }
    injectStyle();
    F.busy = true;
    var token = ++F.cancel;
    F.query = null;
    F.selected = 0;
    busyView();
    try{
      setStage("Đang đọc ảnh...");
      var canvas = await fileToCanvas(file);
      if(F.cancel !== token) return;
      await loadEngine(setStage);
      if(F.cancel !== token) return;
      setStage("Đang tìm khuôn mặt trong ảnh...");
      var dets = await detectQuery(canvas);
      if(F.cancel !== token) return;
      if(!dets.length){
        F.busy = false;
        errorView("Không phát hiện khuôn mặt trong ảnh. Hãy dùng ảnh rõ hơn, khuôn mặt chiếm phần lớn khung hình, không bị che hoặc ngược sáng.", "Chọn ảnh khác");
        return;
      }
      var largest = 0;
      dets.forEach(function(d, i){
        if(d.detection.box.area > dets[largest].detection.box.area) largest = i;
      });
      F.query = { canvas: canvas, dets: dets };
      F.selected = largest;

      setStage("Đang chuẩn bị kho ảnh hồ sơ...");
      var stats = await indexGallery(token, setStage, setProgress);
      if(F.cancel !== token || !stats) { F.busy = false; return; }
      if(!stats.hits){
        F.busy = false;
        errorView("Chưa lập được chỉ mục khuôn mặt nào từ hồ sơ. Kiểm tra kết nối mạng để tải ảnh Drive rồi thử lại.", "Quay lại");
        return;
      }
      setStage("Đang so khớp...");
      var all = currentMatches();
      F.busy = false;
      if(!all.length){
        errorView("Không có hồ sơ nào để so khớp.", "Quay lại");
        return;
      }
      F.match = all;
      renderResults(all.slice(0, F.topN), { scored: all.length, noface: stats.noface });
    }catch(e){
      F.busy = false;
      if(F.cancel !== token) return;
      console.error(e);
      errorView("Không thể phân tích ảnh: " + (e && e.message ? e.message : "lỗi không xác định") + ". Kiểm tra kết nối mạng rồi thử lại.", "Quay lại");
    }
  }

  function secClose(){
    F.cancel++;
    F.busy = false;
    if(F.objUrl){ try{ URL.revokeObjectURL(F.objUrl); }catch(e){} F.objUrl = null; }
    document.removeEventListener("paste", secPaste);
    var ov = el("overlay");
    if(ov) ov.classList.remove("show");
  }

  function secPaste(e){
    if(!el("secBody")) return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for(var i = 0; i < items.length; i++){
      if(items[i].type && items[i].type.indexOf("image/") === 0){
        var f = items[i].getAsFile();
        if(f){ e.preventDefault(); secStart(f); return; }
      }
    }
  }

  function openSecurityPanel(){
    injectStyle();
    var s = el("sheet");
    if(!s) return;
    F.cancel++;
    F.busy = false;
    F.query = null;
    F.selected = 0;
    F.refs = null;
    s.innerHTML = header() + '<div class="sheet-b" id="secBody"></div>';
    el("overlay").classList.add("show");
    el("secClose").onclick = secClose;
    document.removeEventListener("paste", secPaste);
    document.addEventListener("paste", secPaste);
    renderIntro();
  }

  window.openSecurityPanel = openSecurityPanel;
})();
