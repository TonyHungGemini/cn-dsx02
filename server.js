import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Body parser for JSON with base64 images
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Lazy initialization of GoogleGenAI
let aiClient = null;
function getAI() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

const KHMER_MAP = {
  provinces: [
    { kh: 'កំពង់ធំ', en: 'Kampong Thom', vi: 'Tỉnh Kampong Thom' },
    { kh: 'កំពង់ចាម', en: 'Kampong Cham', vi: 'Tỉnh Kampong Cham' },
    { kh: 'ព្រៃវែង', en: 'Prey Veng', vi: 'Tỉnh Prey Veng' },
    { kh: 'ស្វាយរៀង', en: 'Svay Rieng', vi: 'Tỉnh Svay Rieng' },
    { kh: 'កណ្តាល', en: 'Kandal', vi: 'Tỉnh Kandal' },
    { kh: 'តាកែវ', en: 'Takeo', vi: 'Tỉnh Takeo' },
    { kh: 'បាត់ដំបង', en: 'Battambang', vi: 'Tỉnh Battambang' },
    { kh: 'សៀមរាប', en: 'Siem Reap', vi: 'Tỉnh Siem Reap' },
    { kh: 'ក្រចេះ', en: 'Kratie', vi: 'Tỉnh Kratie' },
    { kh: 'ស្ទឹងត្រែង', en: 'Stung Treng', vi: 'Tỉnh Stung Treng' },
    { kh: 'រតនគិរី', en: 'Ratanakiri', vi: 'Tỉnh Ratanakiri' },
    { kh: 'មណ្ឌលគិរី', en: 'Mondulkiri', vi: 'Tỉnh Mondulkiri' },
    { kh: 'បន្ទាយមានជ័យ', en: 'Banteay Meanchey', vi: 'Tỉnh Banteay Meanchey' },
    { kh: 'កំពត', en: 'Kampot', vi: 'Tỉnh Kampot' },
    { kh: 'កែប', en: 'Kep', vi: 'Tỉnh Kep' },
    { kh: 'កោះកុង', en: 'Koh Kong', vi: 'Tỉnh Koh Kong' },
    { kh: 'ពោធិ៍សាត់', en: 'Pursat', vi: 'Tỉnh Pursat' },
    { kh: 'កំពង់ឆ្នាំង', en: 'Kampong Chhnang', vi: 'Tỉnh Kampong Chhnang' },
    { kh: 'កំពង់ស្ពឺ', en: 'Kampong Speu', vi: 'Tỉnh Kampong Speu' },
    { kh: 'ព្រះសីហនុ', en: 'Preah Sihanouk', vi: 'Tỉnh Preah Sihanouk' },
    { kh: 'ព្រះវិហារ', en: 'Preah Vihear', vi: 'Tỉnh Preah Vihear' },
    { kh: 'ឧត្តរមានជ័យ', en: 'Oddar Meanchey', vi: 'Tỉnh Oddar Meanchey' },
    { kh: 'ប៉ៃលិន', en: 'Pailin', vi: 'Tỉnh Pailin' },
    { kh: 'ត្បូងឃ្មុំ', en: 'Tbong Khmum', vi: 'Tỉnh Tbong Khmum' },
    { kh: 'ភ្នំពេញ', en: 'Phnom Penh', vi: 'Thủ đô Phnom Penh' },
  ],
  districts: [
    { kh: 'ស្ទោង', en: 'Stoung', vi: 'Huyện Stoung' },
    { kh: 'បារាយណ៍', en: 'Baray', vi: 'Huyện Baray' },
    { kh: 'សន្ទុក', en: 'Santuk', vi: 'Huyện Santuk' },
    { kh: 'កំពង់ស្វាយ', en: 'Kampong Svay', vi: 'Huyện Kampong Svay' },
    { kh: 'ប្រាសាទសំបូរ', en: 'Prasat Sambour', vi: 'Huyện Prasat Sambour' },
    { kh: 'ប្រាសាទបាឡ័ង្ក', en: 'Prasat Balangk', vi: 'Huyện Prasat Balangk' },
    { kh: 'តាំងគោក', en: 'Tang Kok', vi: 'Huyện Tang Kok' },
  ],
  communes: [
    { kh: 'កំពង់ចិនជើង', en: 'Kampong Chen Cheung', vi: 'Xã Kampong Chen Cheung' },
    { kh: 'កំពង់ចិនត្បូង', en: 'Kampong Chen Tboung', vi: 'Xã Kampong Chen Tboung' },
    { kh: 'ចំណាក្រោម', en: 'Chamna Kraom', vi: 'Xã Chamna Kraom' },
    { kh: 'ចំណាលើ', en: 'Chamna Leu', vi: 'Xã Chamna Leu' },
    { kh: 'ម្សាក្រង', en: 'Msa Krang', vi: 'Xã Msa Krang' },
    { kh: 'ពាមបាង', en: 'Peam Bang', vi: 'Xã Peam Bang' },
    { kh: 'ពពក', en: 'Popok', vi: 'Xã Popok' },
    { kh: 'ប្រឡាយ', en: 'Pralay', vi: 'Xã Pralay' },
    { kh: 'ព្រះដំរី', en: 'Preah Damrei', vi: 'Xã Preah Damrei' },
    { kh: 'រូងឡើង', en: 'Rung Loeung', vi: 'Xã Rung Loeung' },
    { kh: 'សម្ប្រូច', en: 'Samprouch', vi: 'Xã Samprouch' },
    { kh: 'ទ្រា', en: 'Trea', vi: 'Xã Trea' },
  ],
  villages: [
    { kh: 'ចក', en: 'Chork', vi: 'Thôn Chork' },
  ],
};

function fallbackTranslateKhmer(raw) {
  if (!raw) return '';
  let text = raw.trim();

  text = text
    .replace(/ភូមិ\s*/g, 'Thôn ')
    .replace(/ឃុំ\s*/g, 'Xã ')
    .replace(/សង្កាត់\s*/g, 'Phường ')
    .replace(/ស្រុក\s*/g, 'Huyện ')
    .replace(/ខណ្ឌ\s*/g, 'Quận ')
    .replace(/ក្រុង\s*/g, 'Thị xã ')
    .replace(/ខេត្ត\s*/g, 'Tỉnh ')
    .replace(/រាជធានី\s*/g, 'Thành phố ');

  for (const c of KHMER_MAP.communes) {
    text = text.replace(new RegExp(c.kh, 'g'), c.en);
  }
  for (const d of KHMER_MAP.districts) {
    text = text.replace(new RegExp(d.kh, 'g'), d.en);
  }
  for (const p of KHMER_MAP.provinces) {
    text = text.replace(new RegExp(p.kh, 'g'), p.en);
  }
  for (const v of KHMER_MAP.villages) {
    text = text.replace(new RegExp(v.kh, 'g'), v.en);
  }

  // Format into clean comma-separated string if missing commas
  const parts = text.split(/\s+(?=(?:Thôn|Ấp|Xã|Phường|Huyện|Quận|Thị xã|Tỉnh|Thành phố)\b)/i);
  if (parts.length > 1) {
    return parts.map(p => p.trim()).filter(Boolean).join(', ');
  }
  return text.replace(/\s{2,}/g, ' ').trim();
}

function withTimeout(promise, ms = 7000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: !!process.env.GEMINI_API_KEY });
});

// API: Smart AI OCR & Cambodian/Vietnamese ID Reader + Address Translation
app.post('/api/ocr-cmnd', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ ok: false, error: 'Thiếu dữ liệu hình ảnh' });
    }

    const ai = getAI();
    if (ai) {
      let base64Data = image;
      let mimeType = 'image/jpeg';
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }

      const prompt = `Bạn là chuyên gia AI trích xuất thông tin giấy tờ tùy thân đa quốc gia (đặc biệt là Căn cước công dân Campuchia - Cambodian National ID Card, CCCD/CMND Việt Nam, Hộ chiếu).

Nhiệm vụ:
1. Đọc và trích xuất chính xác các thông tin trên thẻ căn cước:
   - Họ và tên (ten_that): Viết hoa chữ La-tinh (ví dụ: BOEURN YON).
   - Số CMND/CCCD (cmnd): Dãy số định danh (với thẻ Campuchia là 9 số như 150532961, với CCCD VN là 12 số hoặc 9 số).
   - Ngày sinh (ngay_sinh): Định dạng dd/mm/yyyy (ví dụ: 03/10/1981).
   - Tuổi (tuoi): Số tuổi tính đến năm hiện tại.
   - Giới tính (gioi_tinh): "M" (Nam/Male/ប្រុស) hoặc "F" (Nữ/Female/ស្រី).
   - Nơi sinh (noi_sinh): ទីកន្លែងកំណើត / Place of birth.
   - Địa chỉ thường trú (dia_chi): អាសយដ្ឋាន / Nơi thường trú / Residence.

2. ĐẶC BIỆT XỬ LÝ & DỊCH ĐỊA CHỈ, NƠI SINH CAMPUCHIA SANG TIẾNG VIỆT CHUẨN:
   - Dịch các cấp hành chính Campuchia sang tiếng Việt chuẩn:
     * ភូមិ (Phum) -> "Thôn" hoặc "Ấp" (ví dụ: ភូមិចក -> "Thôn Chork" hoặc "Ấp Chork")
     * ឃុំ (Khum) -> "Xã" (ví dụ: ឃុំកំពង់ចិនជើង -> "Xã Kampong Chen Cheung" hoặc "Xã Kampong Chen Bắc")
     * សង្កាត់ (Sangkat) -> "Phường"
     * ស្រុក (Srok) -> "Huyện" (ví dụ: ស្រុកស្ទោង -> "Huyện Stoung")
     * ខណ្ឌ (Khan) -> "Quận"
     * ក្រុង (Krong) -> "Thị xã" hoặc "Thành phố"
     * ខេត្ត (Khet) -> "Tỉnh" (ví dụ: ខេត្តកំពង់ធំ -> "Tỉnh Kampong Thom")
     * រាជធានី (Reach Theani) -> "Thủ đô" hoặc "Thành phố" (ví dụ: រាជធានីភ្នំពេញ -> "Thủ đô Phnom Penh")
   - Các từ chỉ phương hướng/đặc điểm trong tên địa danh: ជើង (Bắc/Cheung), ត្បូង (Nam/Tboung), កើត (Đông/Kaeut), លិច (Tây/Lich), លើ (Thượng/Leu), ក្រោម (Hạ/Kraom), ធំ (Lớn/Thom), តូច (Nhỏ/Toch), ថ្មី (Mới/Thmei), ចាស់ (Cũ/Chas).
   - Phiên âm La-tinh/tiếng Việt phổ biến và chính xác các tỉnh Campuchia: Kampong Thom, Kampong Cham, Prey Veng, Svay Rieng, Kandal, Takeo, Battambang, Siem Reap, Kratie, Stung Treng, Ratanakiri, Mondulkiri, Banteay Meanchey, Kampot, Kep, Koh Kong, Pursat, Kampong Chhnang, Kampong Speu, Preah Sihanouk, Preah Vihear, Oddar Meanchey, Pailin, Tbong Khmum, Phnom Penh.
   - Định dạng chuỗi nơi sinh và địa chỉ tiếng Việt chuẩn:
     * noi_sinh: "Xã Kampong Chen Cheung, Huyện Stoung, Tỉnh Kampong Thom"
     * dia_chi: "Thôn Chork, Xã Kampong Chen Cheung, Huyện Stoung, Tỉnh Kampong Thom"

3. Trả về JSON đúng cấu trúc.`;

      const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash'];
      for (const model of modelsToTry) {
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: model,
              contents: {
                parts: [
                  {
                    inlineData: {
                      data: base64Data,
                      mimeType: mimeType,
                    },
                  },
                  { text: prompt },
                ],
              },
              config: {
                thinkingConfig: { thinkingBudget: 0 },
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    ten_that: { type: Type.STRING },
                    cmnd: { type: Type.STRING },
                    ngay_sinh: { type: Type.STRING },
                    tuoi: { type: Type.STRING },
                    gioi_tinh: { type: Type.STRING },
                    noi_sinh: { type: Type.STRING },
                    dia_chi: { type: Type.STRING },
                    noi_sinh_goc: { type: Type.STRING },
                    dia_chi_goc: { type: Type.STRING },
                    loai_the: { type: Type.STRING },
                  },
                  required: ['ten_that'],
                },
              },
            }),
            12000
          );

          const result = JSON.parse(response.text || '{}');
          if (result.ten_that || result.cmnd) {
            return res.json({ ok: true, source: 'ai', data: result });
          }
        } catch (err) {
          // silently try next model
        }
      }
    }

    // Return fallback signal to let client run Tesseract OCR
    res.json({ ok: false, fallback: true });
  } catch (err) {
    res.json({ ok: false, fallback: true, error: err.message || String(err) });
  }
});

// API: Smart Address Translator (Khmer/foreign to Vietnamese)
app.post('/api/translate-address', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ ok: false, error: 'Thiếu nội dung địa chỉ' });
  }

  const ai = getAI();
  if (ai) {
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash'];
    for (const model of modelsToTry) {
      try {
        const prompt = `Bạn là chuyên gia phiên dịch địa danh và địa chỉ Campuchia / Khmer sang tiếng Việt chuẩn.
Dịch chuỗi sau sang tiếng Việt có đầy đủ cấp hành chính rõ ràng (Thôn/Ấp, Xã/Phường, Huyện/Quận, Tỉnh/TP): "${text}".
Trả về JSON: { "translated": "...", "original": "..." }`;

        const response = await withTimeout(
          ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingBudget: 0 },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  translated: { type: Type.STRING },
                  original: { type: Type.STRING },
                },
                required: ['translated'],
              },
            },
          }),
          7000
        );

        const result = JSON.parse(response.text || '{}');
        if (result.translated) {
          return res.json({ ok: true, source: 'ai', data: result });
        }
      } catch (err) {
        // silently try next model or fallback
      }
    }
  }

  // Fallback to built-in dictionary
  const fallbackTrans = fallbackTranslateKhmer(text);
  res.json({
    ok: true,
    source: 'fallback',
    data: { translated: fallbackTrans || text, original: text },
  });
});

// Proxy endpoint to bypass CORS / iframe restrictions when connecting to Google Apps Script
app.post('/api/sync-gas', async (req, res) => {
  try {
    const { url, payload, method } = req.body;
    if (!url) {
      return res.status(400).json({ ok: false, error: 'missing_url', msg: 'Thiếu Web App URL' });
    }
    const cleanUrl = url.trim();
    const httpMethod = (method || 'POST').toUpperCase();
    const fetchOptions = {
      method: httpMethod,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    };
    if (httpMethod !== 'GET' && httpMethod !== 'HEAD') {
      fetchOptions.body = JSON.stringify(payload || {});
    }

    const response = await fetch(cleanUrl, fetchOptions);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.json(data);
    } catch (parseErr) {
      return res.json({ ok: false, error: 'non_json_response', raw: text });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'proxy_error', msg: err.message });
  }
});

// Serve static assets from project root with no-cache headers for live dev
app.use(express.static(__dirname, {
  setHeaders: (res, path) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// Fallback to index.html for SPA/PWA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
