# CLAUDE.md — AksaraTrace Project Intelligence

> Panduan ini adalah sumber kebenaran tunggal untuk AI assistant maupun developer yang bekerja di proyek AksaraTrace. Baca seluruh dokumen ini sebelum menyentuh kode apapun.

---

## 🎯 Visi Proyek

**AksaraTrace** adalah platform edukasi web untuk melestarikan Aksara Jawa Hanacaraka melalui latihan menulis interaktif berbasis HTML5 Canvas. Dibangun oleh Sendy, mahasiswa Universitas Teknologi Yogyakarta.

**Misi inti:** Buat pengguna bisa *merasakan* cara menulis aksara — bukan sekadar melihatnya.

---

## 🏗️ Arsitektur Proyek

```
AksaraTrace/
├── index.html          # Entry point tunggal, semua struktur halaman
├── style.css           # Semua styling, CSS variables, tema
├── script.js           # Semua logika: canvas, transliterasi, navigasi
└── data/
    └── aksara.json     # Data 20 aksara Hanacaraka (sumber kebenaran data)
```

**Aturan keras: 4 file saja. Tidak boleh ada folder tambahan, tidak ada dependencies NPM, tidak ada build step.**

---

## ⚙️ Stack Teknis

| Layer | Pilihan | Alasan |
|---|---|---|
| Markup | HTML5 Semantik | Zero framework overhead |
| Styling | Pure CSS3 + Custom Properties | Tidak ada Tailwind, tidak ada Bootstrap |
| Logika | Vanilla ES6+ JavaScript | Modules native, tidak ada bundler |
| Canvas | HTML5 Canvas API | Drawing engine utama |
| Font | Noto Serif Javanese (Google Fonts) | Satu-satunya external resource yang diizinkan |
| Data | JSON statis lokal | Zero database, zero latency |

**DILARANG KERAS menggunakan:** React, Vue, Angular, jQuery, Tailwind, Bootstrap, Lodash, atau library apapun selain font Google Fonts di atas.

---

## 📐 Tiga Modul Utama

### 1. Edukasi (`#section-edukasi`)
- Tampilkan 20 kartu aksara dalam grid responsif
- Setiap kartu menampilkan: karakter unicode besar, nama latin, bunyi, gatra, makna gatra, dan filosofi
- Kartu harus interaktif (hover effect, bisa diklik untuk pilih aksara di tracing canvas)
- Data bersumber 100% dari `aksara.json`

### 2. Tracing Canvas (`#section-tracing`)
- **Guide overlay:** Render unicode aksara menggunakan `ctx.fillText()` dengan `globalAlpha = 0.12` sebagai panduan trace
- **User stroke:** Layer di atas guide, warna solid, line width ~4-6px
- **Touch support:** Bind ke `pointerdown`, `pointermove`, `pointerup` — BUKAN `mousedown/touchstart` terpisah
- **Zero-scroll interference:** Set `touch-action: none` pada elemen canvas via CSS
- **Retina/HiDPI:** Scale canvas dengan `devicePixelRatio`, tampilan CSS tetap normal
- **60 FPS:** Throttle render loop jika perlu, jangan render setiap pixel event mentah
- Tombol: Clear canvas, Toggle guide on/off, Export PNG transparan

### 3. Transliterasi (`#section-transliterasi`)
- Input teks latin → output aksara Jawa unicode real-time
- Proses di sisi klien, tanpa API call, tanpa database
- Parser berbasis syllabary: petakan kombinasi konsonan + vokal sesuai aturan Hanacaraka
- Urutan pemetaan penting: cek string panjang dulu (`nga`, `nya`, `dha`, `tha`) sebelum string pendek (`na`, `da`, `ta`)

---

## 📊 Data Aksara (`data/aksara.json`)

Struktur tiap entri:

```json
{
  "id": 1,
  "latin": "ha",
  "unicode": "ꦲ",
  "unicode_code": "U+A9B2",
  "gatra": 1,
  "gatra_makna": "Ana utusan (Ada utusan yang datang)",
  "bunyi": "ha",
  "filosofi": "Simbol nafas kehidupan, awal dari segala sesuatu yang ada di alam semesta."
}
```

**20 aksara terbagi dalam 4 gatra (baris puisi Hanacaraka):**

| Gatra | Aksara | Makna |
|---|---|---|
| 1 | ha, na, ca, ra, ka | Ana utusan |
| 2 | da, ta, sa, wa, la | Padha wira-wiri |
| 3 | pa, dha, ja, ya, nya | Padha sakti mandraguna |
| 4 | ma, ga, ba, tha, nga | Mati ing palagan |

---

## 🎨 Desain & Tema Visual

Ikuti palet yang sudah ditetapkan dari presentasi:

```css
:root {
  --color-bg: #F5F0E8;           /* Krem hangat, seperti kertas tua */
  --color-surface: #EDE8DC;      /* Kartu & panel */
  --color-accent: #8B2E0F;       /* Merah bata — warna brand utama */
  --color-accent-light: #C4622D; /* Aksen sekunder */
  --color-text-primary: #2C2416; /* Hampir hitam, warm */
  --color-text-secondary: #5C4A32; /* Coklat medium */
  --color-stroke: #8B2E0F;       /* Warna tinta user di canvas */
  --color-guide: rgba(139, 46, 15, 0.12); /* Guide overlay aksara */
  --font-display: 'Playfair Display', serif; /* Judul, headings */
  --font-body: Georgia, 'Times New Roman', serif; /* Body text */
  --font-javanese: 'Noto Serif Javanese', serif; /* Aksara unicode */
}
```

**Prinsip visual:**
- Nuansa antik, seperti manuskrip keraton
- Tidak ada warna cerah neon, tidak ada gradien modern
- Typography serif yang berat dan berkarakter
- Gunakan `letter-spacing` longgar untuk heading
- Border radius kecil (4-8px), bukan rounded penuh

---

## 🖊️ Canvas — Implementasi Guide Overlay

Ini adalah inovasi inti proyek. **Jangan gunakan file gambar untuk guide.**

```javascript
function renderGuide(ctx, unicodeChar, canvasWidth, canvasHeight) {
  const fontSize = Math.min(canvasWidth, canvasHeight) * 0.75;
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#8B2E0F';
  ctx.font = `${fontSize}px 'Noto Serif Javanese', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(unicodeChar, canvasWidth / 2, canvasHeight / 2);
  ctx.restore();
}
```

Guide harus:
- Re-render setiap kali aksara berganti
- Tidak terhapus saat user menggambar (pisahkan ke layer/urutan render yang benar)
- Bisa di-toggle visibility-nya

---

## 🔤 Syllabary Parser — Aturan Transliterasi

Urutan deteksi (dari paling panjang ke terpendek, sangat penting):

```javascript
const syllabaryMap = {
  // 3 karakter dulu
  'nga': 'ꦔ', 'nya': 'ꦚ', 'dha': 'ꦝ', 'tha': 'ꦛ',
  // 2 karakter
  'ha': 'ꦲ', 'na': 'ꦤ', 'ca': 'ꦕ', 'ra': 'ꦫ', 'ka': 'ꦏ',
  'da': 'ꦢ', 'ta': 'ꦠ', 'sa': 'ꦱ', 'wa': 'ꦮ', 'la': 'ꦭ',
  'pa': 'ꦥ', 'ja': 'ꦗ', 'ya': 'ꦪ', 'ma': 'ꦩ', 'ga': 'ꦒ',
  'ba': 'ꦧ',
};
```

```
json

{
  "aksara": [
    { "id": 1,  "latin": "ha",  "unicode": "ꦲ", "unicode_code": "U+A9B2", "gatra": 1, "gatra_makna": "Ana utusan (Ada utusan yang datang)", "bunyi": "ha",  "filosofi": "Simbol nafas kehidupan, awal dari segala sesuatu yang ada di alam semesta." },
    { "id": 2,  "latin": "na",  "unicode": "ꦤ", "unicode_code": "U+A9A4", "gatra": 1, "gatra_makna": "Ana utusan (Ada utusan yang datang)", "bunyi": "na",  "filosofi": "Melambangkan keberanian dan keteguhan dalam menjalankan tugas mulia." },
    { "id": 3,  "latin": "ca",  "unicode": "ꦕ", "unicode_code": "U+A995", "gatra": 1, "gatra_makna": "Ana utusan (Ada utusan yang datang)", "bunyi": "ca",  "filosofi": "Simbol kecerdasan dan kemampuan berpikir yang tajam dan jernih." },
    { "id": 4,  "latin": "ra",  "unicode": "ꦫ", "unicode_code": "U+A9AB", "gatra": 1, "gatra_makna": "Ana utusan (Ada utusan yang datang)", "bunyi": "ra",  "filosofi": "Melambangkan rasa dan kepekaan terhadap lingkungan sekitar." },
    { "id": 5,  "latin": "ka",  "unicode": "ꦏ", "unicode_code": "U+A98F", "gatra": 1, "gatra_makna": "Ana utusan (Ada utusan yang datang)", "bunyi": "ka",  "filosofi": "Simbol kekuatan dan kehendak yang teguh dalam bertindak." },
    { "id": 6,  "latin": "da",  "unicode": "ꦢ", "unicode_code": "U+A9A2", "gatra": 2, "gatra_makna": "Padha wira-wiri (Saling berselisih paham)", "bunyi": "da",  "filosofi": "Melambangkan pertentangan dua kekuatan yang seimbang di dunia." },
    { "id": 7,  "latin": "ta",  "unicode": "ꦠ", "unicode_code": "U+A9A0", "gatra": 2, "gatra_makna": "Padha wira-wiri (Saling berselisih paham)", "bunyi": "ta",  "filosofi": "Simbol ketegasan dan keputusan yang tidak bisa diganggu gugat." },
    { "id": 8,  "latin": "sa",  "unicode": "ꦱ", "unicode_code": "U+A9B1", "gatra": 2, "gatra_makna": "Padha wira-wiri (Saling berselisih paham)", "bunyi": "sa",  "filosofi": "Melambangkan kesucian dan kemurnian jiwa yang selalu dijaga." },
    { "id": 9,  "latin": "wa",  "unicode": "ꦮ", "unicode_code": "U+A9AE", "gatra": 2, "gatra_makna": "Padha wira-wiri (Saling berselisih paham)", "bunyi": "wa",  "filosofi": "Simbol kesetiaan dan pengabdian tanpa pamrih kepada sesama." },
    { "id": 10, "latin": "la",  "unicode": "ꦭ", "unicode_code": "U+A9AD", "gatra": 2, "gatra_makna": "Padha wira-wiri (Saling berselisih paham)", "bunyi": "la",  "filosofi": "Melambangkan kelembutan dan keluwesan dalam menghadapi rintangan." },
    { "id": 11, "latin": "pa",  "unicode": "ꦥ", "unicode_code": "U+A9A5", "gatra": 3, "gatra_makna": "Padha sakti mandraguna (Sama-sama sakti)", "bunyi": "pa",  "filosofi": "Simbol kesamaan derajat dan kesetaraan antara semua makhluk hidup." },
    { "id": 12, "latin": "dha", "unicode": "ꦝ", "unicode_code": "U+A99D", "gatra": 3, "gatra_makna": "Padha sakti mandraguna (Sama-sama sakti)", "bunyi": "dha", "filosofi": "Melambangkan kearifan dan kebijaksanaan lokal yang turun-temurun." },
    { "id": 13, "latin": "ja",  "unicode": "ꦗ", "unicode_code": "U+A997", "gatra": 3, "gatra_makna": "Padha sakti mandraguna (Sama-sama sakti)", "bunyi": "ja",  "filosofi": "Simbol kejayaan dan kemuliaan yang diraih dengan kerja keras." },
    { "id": 14, "latin": "ya",  "unicode": "ꦪ", "unicode_code": "U+A9AA", "gatra": 3, "gatra_makna": "Padha sakti mandraguna (Sama-sama sakti)", "bunyi": "ya",  "filosofi": "Melambangkan keyakinan dan kepercayaan diri dalam setiap langkah." },
    { "id": 15, "latin": "nya", "unicode": "ꦚ", "unicode_code": "U+A99A", "gatra": 3, "gatra_makna": "Padha sakti mandraguna (Sama-sama sakti)", "bunyi": "nya", "filosofi": "Simbol kenyataan dan kebenaran yang harus selalu dijunjung tinggi." },
    { "id": 16, "latin": "ma",  "unicode": "ꦩ", "unicode_code": "U+A9A9", "gatra": 4, "gatra_makna": "Mati ing palagan (Keduanya gugur di medan laga)", "bunyi": "ma",  "filosofi": "Melambangkan kematian sebagai akhir siklus dan awal kehidupan baru." },
    { "id": 17, "latin": "ga",  "unicode": "ꦒ", "unicode_code": "U+A992", "gatra": 4, "gatra_makna": "Mati ing palagan (Keduanya gugur di medan laga)", "bunyi": "ga",  "filosofi": "Simbol perjalanan dan petualangan jiwa menuju kesempurnaan." },
    { "id": 18, "latin": "ba",  "unicode": "ꦧ", "unicode_code": "U+A9A7", "gatra": 4, "gatra_makna": "Mati ing palagan (Keduanya gugur di medan laga)", "bunyi": "ba",  "filosofi": "Melambangkan benih dan asal-usul segala kehidupan yang ada." },
    { "id": 19, "latin": "tha", "unicode": "ꦛ", "unicode_code": "U+A99B", "gatra": 4, "gatra_makna": "Mati ing palagan (Keduanya gugur di medan laga)", "bunyi": "tha", "filosofi": "Simbol pengorbanan luhur demi nilai yang lebih tinggi dari diri sendiri." },
    { "id": 20, "latin": "nga", "unicode": "ꦔ", "unicode_code": "U+A994", "gatra": 4, "gatra_makna": "Mati ing palagan (Keduanya gugur di medan laga)", "bunyi": "nga", "filosofi": "Melambangkan kehancuran yang membuka ruang bagi kelahiran kembali." }
  ]
}
```

Implementasi parser: iterasi string input dari kiri, cek substring 3 karakter → 2 karakter → 1 karakter, append unicode yang cocok.

---

## 📱 Responsivitas

| Breakpoint | Layout |
|---|---|
| < 480px | Single column, canvas full-width |
| 480–768px | Single column, padding lebih besar |
| 768–1024px | 2 kolom untuk grid kartu |
| > 1024px | 3-4 kolom untuk grid kartu, layout split untuk tracing |

Canvas harus selalu mengisi lebar container-nya dan menjaga rasio aspek 1:1 atau 4:3.

---

## ⚡ Target Performa

| Metrik | Target |
|---|---|
| Total bundle size | < 200KB (tanpa font) |
| Lighthouse Performance | 100 |
| Load time (3G) | < 200ms |
| Canvas frame rate | 60 FPS |
| Waktu transliterasi | < 1ms (client-side) |

**Cara menjaga performa:**
- Tidak ada `console.log` di production path
- Throttle pointer events dengan `requestAnimationFrame`
- Jangan attach event listener berulang (gunakan flag atau `removeEventListener`)
- Muat `aksara.json` sekali saat init, simpan di memory

---

## 🧪 Test Cases Wajib Lulus

Sebelum dianggap selesai, pastikan semua ini berjalan:

1. **Multi-touch tracing** — menggambar di layar sentuh tidak memicu scroll halaman
2. **HiDPI/Retina** — stroke tidak blur di layar >1x pixel ratio
3. **Syllabary extreme input** — teks panjang dengan kombinasi `nga`, `nya`, `dha` tidak error
4. **Responsive canvas** — resize window tidak memecah layout atau menghilangkan drawing
5. **Export PNG** — hasil download adalah gambar transparan dengan stroke user saja (tanpa guide)
6. **Offline** — semua fitur berjalan tanpa koneksi internet (kecuali font load pertama kali)

---

## 🚫 Hal yang Tidak Boleh Dilakukan

- ❌ Menginstall package NPM apapun
- ❌ Menggunakan `innerHTML` dengan user input tanpa sanitasi
- ❌ Menyimpan state di URL params atau localStorage (tidak perlu)
- ❌ Membuat file gambar untuk aksara — selalu gunakan unicode + canvas
- ❌ Menggunakan `alert()`, `confirm()`, atau `prompt()`
- ❌ Menambah file CSS atau JS tambahan di luar struktur yang sudah ditetapkan
- ❌ Menggunakan `setTimeout` untuk animasi — gunakan `requestAnimationFrame`
- ❌ Font selain Noto Serif Javanese untuk rendering karakter unicode aksara

---

## ✅ Checklist Sebelum Submit

- [ ] Semua 20 aksara tampil dan bisa dipilih
- [ ] Guide canvas muncul dengan opacity rendah dan bisa di-toggle
- [ ] User bisa menggambar di atas guide dengan jari/mouse
- [ ] Tombol clear berfungsi
- [ ] Export PNG menghasilkan file yang bisa didownload
- [ ] Transliterasi real-time berjalan tanpa lag
- [ ] Layout responsif di mobile (320px) dan desktop (1440px)
- [ ] Tidak ada error di browser console
- [ ] Tidak ada dependency eksternal selain Google Font

---

*Dokumen ini dibuat untuk proyek AksaraTrace oleh Sendy, Universitas Teknologi Yogyakarta. Perbarui dokumen ini setiap kali ada keputusan arsitektur baru.*