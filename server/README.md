# QalamAI — backend (Node.js)

Fastify 5 asosidagi API: hisoblar, fayllar, 18 ta fayl vositasi (PDF ↔ Word/Excel/PowerPoint/rasm,
PDF muharriri, AI bilan fonni olib tashlash va boshqalar), hujjatlar, dizaynlar va tarif chegaralari.
Tashqi dastur (LibreOffice, Ghostscript, ImageMagick) **talab qilinmaydi** — hammasi npm paketlari bilan ishlaydi.

## Tez boshlash

```bash
cd server
npm install
cp .env.example .env      # ixtiyoriy — standart qiymatlar bilan ham ishlaydi
npm run dev               # http://localhost:4000  ·  API hujjatlari: http://localhost:4000/docs
```

Frontend (loyiha ildizida) `npm run dev` bilan ishga tushadi; Vite `/api` soʻrovlarini 4000-portga yoʻnaltiradi.

- **Maʼlumotlar bazasi:** `DATABASE_URL` boʻsh boʻlsa — oʻrnatilgan PGlite (WASM PostgreSQL) `./data/db` ga yozadi.
  Productionda haqiqiy PostgreSQL: `DATABASE_URL=postgres://…`. Migratsiyalar ishga tushganda avtomatik qoʻllanadi.
- **Fonni olib tashlash modeli** birinchi ishlatilganda `./models` ga yuklanadi (u2netp, 4.6 MB).
  Oldindan yuklash: `npm run models` yoki sifatliroq model: `BG_MODEL=isnet-general-use npm run models`.
  Bu vosita `onnxruntime-node` ga bogʻliq (ixtiyoriy paket, ~300 MB, barcha platformalar uchun binarlar).
  U oʻrnatilmagan boʻlsa, server baribir ishlaydi, vosita katalogda «Oʻrnatilmagan» deb koʻrinadi.

## Testlar

```bash
npm test     # 26 ta test: auth, fayllar, har bir vosita, limitlar, shriftlar, Link-in-Bio
```

Testlar haqiqiy serverni tasodifiy portda, xotiradagi bazada ishga tushiradi; fayllar (PDF, DOCX, rasm) test ichida yaratiladi.

## Arxitektura

```
src/
  index.js              ishga tushirish, tozalash rejalashtiruvchisi, graceful shutdown
  app.js                Fastify: plaginlar, auth dekoratorlari, /api/v1 marshrutlari
  config.js             .env → tekshirilgan sozlamalar (zod)
  db/                   Drizzle sxema + SQL migratsiyalar (PostgreSQL / PGlite)
  lib/                  xatolar, ID, scrypt parol, JWT, fayl turini aniqlash, saqlash
  modules/
    auth/               mehmon sessiyasi, roʻyxatdan oʻtish, kirish, refresh-token aylanishi
    users/              /me — profil (titul maʼlumotlari), foydalanish, parol, hisobni oʻchirish
    files/              yuklash, roʻyxat, imzolangan havolalar, kichik rasmlar (thumbnail)
    tools/catalog.js    vositalar katalogi: nima qabul qiladi, nima beradi, sozlamalar (zod → JSON Schema)
    jobs/               vazifalar navbati, kunlik limit, long-poll, qayta ishga tushganda tiklash
    documents/          hujjatlar va dizaynlar CRUD
    plans/              tarif chegaralari (bitta joyda)
  workers/              worker_threads puli — ogʻir ishlar asosiy oqimni bloklamaydi
  converters/           vositalar (faqat worker ichida yuklanadi)
    pdf/                to-docx, to-formats (rasm/matn/excel/pptx), edit, organize, compress, stamp
    image/              basic (format/siqish/oʻlcham), remove-bg (ONNX), to-pdf
    office/             typeset (HTML → sahifalangan PDF), to-pdf (DOCX/MD/TXT/HTML/CSV)
    lib/                pdf.js (matn+pozitsiya, rasm, render), layout (qator→paragraf), shriftlar
```

**Muhim qarorlar**

- *Fayl turi mazmundan aniqlanadi* (magic bytes), mijoz yuborgan MIME ga ishonilmaydi.
- *Imzolangan havolalar* (`/files/:id/content?exp&sig`) — `<img>`, `<a download>` va pdf.js sarlavhasiz ishlaydi; 2 soat amal qiladi.
- *Refresh token aylanadi*; eski token qayta ishlatilsa — butun sessiya oilasi bekor qilinadi (oʻgʻirlangan token himoyasi).
- *Mehmon → foydalanuvchi*: roʻyxatdan oʻtganda mehmon hisobi joyida yangilanadi, fayllar yoʻqolmaydi.
- *Shriftlar*: PDF ga Noto Sans/Serif (hinted) qisqartirib joylanadi — oʻ, gʻ, ʼ va kirill harflari toʻgʻri chiqadi.
- *Limit muvaffaqiyatsiz amal uchun qaytariladi* — server xatosi foydalanuvchining kunlik limitini yemaydi.
- *Link-in-Bio* mavzulari `../shared/bio.js` da — frontend preview va server renderer bitta manbadan oʻqiydi,
  shuning uchun eʼlon qilingan sahifa preview bilan bir xil. Server alohida joylashtirilsa, `shared/` papkasi ham birga boʻlsin.

## API qisqacha

Barcha javoblar JSON; xato: `{ "error": { "code": "QUOTA_EXCEEDED", "message": "…oʻzbekcha…" } }`.
Toʻliq hujjat va sinov: **`/docs`** (Swagger UI).

| Metod | Yoʻl | Tavsif |
|---|---|---|
| POST | `/api/v1/auth/guest` | Mehmon sessiyasi (cookie da refresh token) |
| POST | `/api/v1/auth/register` | `{ login: email yoki +998…, password, name }` |
| POST | `/api/v1/auth/login` · `/refresh` · `/logout` | Kirish, tokenni yangilash, chiqish |
| GET/PATCH | `/api/v1/me` | Profil va tarif chegaralari |
| GET | `/api/v1/me/usage` | Bugungi foydalanish |
| POST | `/api/v1/files` | Yuklash (multipart, `file` maydoni, bir nechta) |
| GET | `/api/v1/files` | Mening fayllarim |
| GET | `/api/v1/tools` | Vositalar katalogi (sozlamalar JSON Schema da) |
| POST | `/api/v1/tools/:tool/jobs` | `{ fileIds, options }` → vazifa (202) |
| GET | `/api/v1/jobs/:id?wait=20000` | Holat; `wait` — oʻzgarishgacha kutish (long-poll) |
| POST | `/api/v1/jobs/:id/cancel` | Bekor qilish |
| CRUD | `/api/v1/documents`, `/api/v1/designs` | Hujjatlar va dizaynlar |
| GET | `/api/v1/bio/check/:slug` | Link-in-Bio manzili boʻshmi |
| PUT / DELETE | `/api/v1/bio/:slug` | Sahifani eʼlon qilish / yangilash / olib tashlash (`{ designId, data }`) |
| GET | `/api/v1/bio/design/:designId` | Dizaynga bogʻlangan sahifa, koʻrishlar va bosishlar |
| POST | `/api/v1/bio/export` | Bitta faylli HTML |
| GET | `/b/:slug` · `/b/:slug/l/:linkId` | **Ommaviy sahifa** (JS siz, qatʼiy CSP) · hisoblanadigan yoʻnaltirish |
| GET | `/api/v1/plans` | Tariflar va chegaralar |

Misol — PDF ni Word ga:

```bash
TOKEN=$(curl -s -X POST localhost:4000/api/v1/auth/guest | jq -r .accessToken)
FILE=$(curl -s -H "authorization: Bearer $TOKEN" -F file=@kurs.pdf localhost:4000/api/v1/files | jq -r '.files[0].id')
JOB=$(curl -s -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d "{\"fileIds\":[\"$FILE\"]}" localhost:4000/api/v1/tools/pdf-to-docx/jobs | jq -r .id)
curl -s -H "authorization: Bearer $TOKEN" "localhost:4000/api/v1/jobs/$JOB?wait=20000" | jq '.status, .outputs[0].downloadUrl'
```

## Vositalar

| ID | Vazifa |
|---|---|
| `pdf-to-docx` | PDF → Word: sarlavha, roʻyxat, qalin/kursiv, ikki ustun, rasmlar; skan sahifalar rasm sifatida |
| `pdf-to-images` | Har sahifa JPG/PNG/WebP (50–300 dpi), koʻp sahifa — ZIP |
| `pdf-to-text` · `pdf-to-xlsx` · `pdf-to-pptx` | Matn, jadval (ustunlar, raqamlar), slaydlar (izohda matn) |
| `pdf-edit` | Mavjud matnni almashtirish, matn/rasm/imzo/shakl/belgilash/chizish, sahifa tartibi va burilishi |
| `pdf-merge` · `pdf-split` · `pdf-rotate` | Birlashtirish (rasmlar bilan), ajratish (har sahifa/oraliq/tanlangan), aylantirish |
| `pdf-compress` | Ichki rasmlarni qayta siqish (matn va vektor tegmaydi) |
| `pdf-watermark` · `pdf-page-numbers` | Suv belgisi (diagonal/markaz/takroriy), sahifa raqamlari (titulsiz) |
| `image-remove-bg` | AI (U²-Net/IS-Net, ONNX) — shaffof yoki rangli fon, obyekt boʻyicha qirqish |
| `image-convert` · `image-compress` · `image-resize` | JPG/PNG/WebP/AVIF/GIF/TIFF, siqish, oʻlcham |
| `images-to-pdf` · `doc-to-pdf` | Rasmlardan PDF; DOCX/MD/TXT/HTML/CSV → akademik standartdagi PDF |

## Production

```bash
NODE_ENV=production
DATABASE_URL=postgres://qalam:…@db:5432/qalam
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=https://qalam.uz
TRUST_PROXY=true
BG_MODEL=isnet-general-use        # sifatliroq fon ajratish
GOTENBERG_URL=http://gotenberg:3000   # ixtiyoriy: Word → PDF uchun LibreOffice aniqligi
```

- Frontend va API bitta domenda boʻlsa (nginx: `/api` → `localhost:4000`), cookie va CORS sozlash shart emas.
- `STORAGE_DIR` doimiy diskda boʻlsin; zaxira nusxa — baza + shu papka.
- Bir nechta server nusxasi kerak boʻlsa: S3 saqlash drayveri va Redis navbati (keyingi bosqich).

## Keyingi bosqichlar

1. **Toʻlovlar** — Payme (JSON-RPC Merchant API) va Click (prepare/complete) callbacklari, obunani faollashtirish.
2. **AI generatsiya** — prezentatsiya, referat, kurs ishi (Claude API), oqimli javob.
3. **OCR** — skanerlangan PDF/rasmdan matn (oʻzbek lotin/kirill).
4. **Frontend sinxronlash** — localStorage dagi hujjat va dizaynlarni `/documents`, `/designs` ga koʻchirish; kirish/roʻyxatdan oʻtish oynasi.
5. **Masshtab** — S3 saqlash, BullMQ/Redis navbati, admin panel.
