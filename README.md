# Quran SRT Studio

Aplikasi web untuk membuat subtitle Al-Qur'an (SRT, VTT, ASS) dan video ayat yang sinkron dengan murotal. Semuanya berjalan di browser. Hosting cukup paket Hostinger biasa (statis + PHP), tanpa Node.js dan tanpa server tambahan.

## Fitur

**Studio**
- 114 surah (6.236 ayat): teks Utsmani, terjemahan Indonesia & Inggris, transliterasi. Datanya ikut di-hosting bersama situs, jadi tidak bergantung pada API luar.
- Opsi basmalah otomatis (tidak muncul untuk Al-Fatihah dan At-Taubah).
- 21 qari dari EveryAyah.com. Waktu tiap ayat terisi otomatis dari durasi audionya. Kalau server audio menolak unduhan lintas domain, Studio otomatis pindah ke mode putar berurutan.
- Unggah audio/video murotal sendiri (MP3, WAV, M4A, MP4). File diproses di perangkat dan tidak pernah diunggah.
- **Sinkron otomatis**: mendeteksi jeda bacaan lalu mencocokkannya dengan panjang ayat. Kepekaannya bisa diatur.
- **Tap-sync**: tekan Spasi saat ayat mulai dibaca, tekan E untuk mengakhiri baris.
- Linimasa dengan gelombang suara asli. Bisa di-zoom, tepi blok bisa ditarik, klik untuk melompat.
- Edit waktu langsung, geser ±0,1 detik, isi dari posisi playhead, geser semua waktu, putar atau ulangi satu baris.
- Undo/redo, validasi waktu (tumpang tindih, durasi terlalu pendek) dan tombol **Perbaiki otomatis**.
- Teks Arab dikunci. Terjemahan bisa disunting, dan baris teks bebas bisa ditambahkan (judul, pembuka, dsb.).
- **Ayat panjang tidak lagi kekecilan atau terpotong**: ayat yang tak muat satu layar otomatis dipecah menjadi beberapa subtitle. Titik potongnya mengutamakan tanda waqaf (ۘ ۗ ۚ ۖ), dan ukuran huruf dijaga tetap terbaca.
- **Potong ayat (mid-verse cut)**: klik ikon gunting lalu pilih kata, atau klik "Potong ayat panjang" untuk semua ayat. Tiap potongan punya waktu sendiri, dan nomor ayat hanya muncul di potongan terakhir. Ada tombol Gabung/Satukan yang mengembalikan teks persis seperti semula. Audio qari dibagi otomatis ke tiap potongan.
- **Penyelaras terjemahan berbasis Claude**: menentukan di kata mana terjemahan dipotong agar pas dengan potongan Arab. Claude hanya memilih nomor kata, server yang memotong teks asli, lalu hasilnya diverifikasi sama persis dengan sumber.
- Opsi ta'awudz dan basmalah di awal.

**Tampilan & ekspor**
- Pratinjau canvas yang sama persis dengan hasil video. Rasio 16:9, 9:16, dan 1:1.
- 8 template, 4 huruf Arab (Amiri Quran, Scheherazade New, Noto Naskh Arabic, Reem Kufi), warna, posisi, kotak, bayangan, **garis tepi teks**, fade, bingkai ornamen, latar gambar/video, **nama qari** di bawah nama surah, **branding kanal** (@namakanal), dan pratinjau layar penuh.
- Pilihan isi subtitle: Arab, terjemahan ID/EN, transliterasi, urutan baris, nomor ayat ﴿١﴾, dan keterangan "(QS. Al-Fatihah [1]: 1)".
- Pecah ayat panjang, tutup jeda pendek, penanda arah kanan-ke-kiri.
- Format ekspor: **.SRT**, **.VTT**, **.ASS** (bergaya), **deskripsi YouTube** (bab/chapters otomatis + teks ayat + sumber), **proyek .JSON**, **audio .WAV**.
- **Ekspor video MP4/WebM** langsung di browser (720p/1080p).
- **Batch ZIP**: SRT/VTT + deskripsi untuk banyak surah sekaligus (misalnya Juz 30).

**Situs**
- Halaman beranda, Studio, Panduan, Harga, Tentang, Kontak, Privasi, Syarat, Proyek saya, Masuk/Daftar, dan 404.
- Bahasa Indonesia & Inggris, mode gelap, tampilan responsif di HP.
- SEO: halaman di-prerender ke HTML, meta & Open Graph, JSON-LD (SoftwareApplication, FAQPage, HowTo), serta sitemap.xml & robots.txt yang menyesuaikan domain secara otomatis.
- **Asisten Konten berbasis Claude** (opsional, lewat PHP): saran judul, deskripsi, hashtag, dan teks thumbnail.
- Formulir kontak (opsional, lewat PHP `mail()`), dengan perlindungan spam dan batas jumlah kiriman.
- Akun & sinkron cloud (opsional, lewat PocketBase), dengan paket Gratis/Pro/Lembaga.

---

## 1. Deploy ke Hostinger (tanpa coding)

Yang Anda butuhkan hanya file **`quran-srt-studio-hostinger.zip`**.

> ⚠️ Situs ini harus dipasang di **root domain atau subdomain** (contoh: `studio.domainanda.com`), bukan di subfolder WordPress (`domainanda.com/studio`). Situs WordPress Anda tidak akan terganggu.

1. **Buat subdomain.** Di hPanel → **Domain** → **Subdomain**, buat misalnya `studio`. Catat folder tujuannya (biasanya `public_html/studio` atau `domains/studio.domainanda.com/public_html`).
2. **Unggah.** Buka **File Manager** → masuk ke folder subdomain tadi → **Upload** → pilih `quran-srt-studio-hostinger.zip`.
3. **Ekstrak.** Klik kanan file ZIP → **Extract** → ekstrak ke folder itu juga. Pastikan `index.html`, `.htaccess`, `assets/`, `data/`, dan `api/` berada **langsung** di folder subdomain (bukan di dalam subfolder lain). Setelah itu, hapus file ZIP-nya.
4. **SSL.** Di hPanel → **Keamanan** → **SSL**, pastikan subdomain sudah memakai HTTPS. Biasanya ini sudah otomatis.
5. Buka `https://studio.domainanda.com`. Selesai.

> Tidak melihat `.htaccess`? Di File Manager, aktifkan **Show hidden files**. Tanpa file ini, membuka ulang halaman seperti `/studio` bisa menghasilkan 404.

## 2. Pengaturan setelah deploy (tanpa build ulang)

Edit **`app-config.json`** lewat File Manager:

```json
{
  "contactEmail": "admin@domainanda.com",
  "whatsapp": "6281234567890",
  "announcement": "Ramadan: template layar masjid baru!",
  "freeVideoWatermark": true,
  "plans": []
}
```

- `whatsapp` & `contactEmail` dipakai untuk tombol di halaman Harga dan Kontak.
- `announcement` menampilkan pita pengumuman di atas situs. Biarkan kosong kalau tidak dipakai.
- `plans` dipakai untuk mengganti isi paket di halaman Harga. Kosongkan untuk memakai bawaan. Contoh satu paket:
  `{ "id": "pro", "name": "Pro", "price": "Rp49.000", "period": "/bulan", "highlight": true, "features": ["..."], "cta": "Berlangganan" }`

## 3. Mengaktifkan Asisten AI (Claude) & formulir kontak

1. Di File Manager, buka folder `api/`, salin `config.sample.php`, lalu beri nama `config.php`.
2. Isi nilai berikut:
   - `anthropic_api_key`: API key dari https://console.anthropic.com
   - `anthropic_model`: bawaannya `claude-haiku-5-5` (cepat & hemat). Ganti ke `claude-sonnet-5-5` kalau ingin hasil yang lebih kaya.
   - `contact_to`: email penerima pesan dari formulir kontak.
   - `contact_from`: email pengirim di domain Anda sendiri (misalnya `noreply@domainanda.com`) supaya tidak masuk spam.
   - `stats_key`: teks acak panjang. Dengan kunci ini Anda bisa membuka `https://domainanda.com/api/stats.php?key=ISI_KUNCI` untuk melihat statistik pemakaian anonim, seperti jumlah unduhan SRT, video, pemakaian Claude, dan token. Data ini berguna sebagai bukti traksi saat mendaftar program startup.
3. Simpan. Tab **Asisten AI**, tombol **Rapikan terjemahan**, dan formulir kontak akan aktif dengan sendirinya.

`config.php` tidak bisa dibuka dari browser (diblokir `.htaccess`), jadi API key tetap aman di server. Jumlah permintaan per IP juga dibatasi supaya kuota tidak disalahgunakan.

## 4. Akun, pembayaran, donasi, dan email otomatis

Semuanya berjalan di hosting biasa (PHP + MySQL + Cron), tanpa VPS. Fitur ini opsional: selama bagian database di `config.php` kosong, situs tetap berjalan seperti biasa tanpa akun.

### 4.1 Akun (daftar, masuk, lupa sandi, proyek cloud)

1. hPanel → **Databases → MySQL Databases**: buat database + user, lalu isi `db_host`, `db_name`, `db_user`, `db_pass` di `api/config.php`. Tabel dibuat otomatis saat pertama dipakai.
2. Isi `site_url` (mis. `https://quransrt.com`, tanpa garis miring di akhir).
3. Menu **Masuk/Daftar** muncul sendiri. Alurnya: daftar → email verifikasi → akun aktif. Kata sandi disimpan ter-hash (bcrypt), sesi memakai cookie HttpOnly, login dibatasi 8 percobaan gagal per 15 menit.
4. Paket Gratis: 3 proyek cloud, video bertanda air kecil, Batch dikunci. Paket Pro/Lembaga membuka semuanya. Paket kembali ke Gratis otomatis saat masa aktif habis (proyek tidak dihapus).

### 4.2 Email (Brevo, gratis 300 email/hari)

1. Daftar di https://app.brevo.com, verifikasi alamat pengirim (`mail_from`) dan domain (SPF/DKIM) di menu Senders & Domains.
2. SMTP & API → API Keys → buat key → isi `brevo_api_key`.
3. Tanpa key, sistem memakai `mail()` bawaan hosting (kurang andal, sering masuk spam).

Email yang dikirim: verifikasi, reset sandi, kuitansi, sambutan; **promosi** (tips hari ke-2, ajakan upgrade hari ke-5) hanya untuk yang mencentang persetujuan saat daftar, selalu dengan tautan berhenti berlangganan satu klik; **layanan** (pengingat 3 hari sebelum paket habis dan pemberitahuan setelah habis).

### 4.3 Cron untuk corong email

hPanel → **Advanced → Cron Jobs**, tiap 30 menit:

```
php /home/USER/domains/DOMAIN/public_html/api/cron.php
```

(Sesuaikan path; lihat File Manager.) Alternatif lewat web: isi `cron_key`, lalu panggil `https://DOMAIN/api/cron.php?key=ISI`. Cron juga mengirim ulang email yang gagal dan membersihkan data lama.

### 4.4 Pembayaran Xendit (Rupiah: QRIS, VA bank, e-wallet)

1. Daftar di https://dashboard.xendit.co, aktifkan mode Test dulu.
2. Settings → Developers → API Keys → buat **Secret key** (izin Money-in write) → `xendit_secret_key`.
3. Settings → Webhooks: URL **Invoices paid** dan **Invoices expired** = `https://DOMAIN/api/webhook-xendit.php`. Salin *Verification token* → `xendit_callback_token`.
4. Uji dengan kunci test (`xnd_development_…`), baru ganti ke `xnd_production_…` setelah akun Xendit terverifikasi.

### 4.5 Pembayaran PayPal (USD)

1. https://developer.paypal.com → Apps & Credentials → buat app (Sandbox dulu) → isi `paypal_client_id`, `paypal_secret`, `paypal_env` = `sandbox`.
2. Webhooks → URL `https://DOMAIN/api/webhook-paypal.php`, event **Payment capture completed** → salin Webhook ID ke `paypal_webhook_id`.
3. Untuk live: buat app Live, ganti kunci, `paypal_env` = `live`.

### 4.6 Harga, donasi, keamanan

- Harga paket ada di server (`products` di `config.php`, bawaan: Pro Rp49.000/bln, Rp490.000/thn, Lembaga Rp1.490.000/thn). Harga dari browser **tidak pernah dipercaya**.
- Pembayaran baru dianggap lunas setelah server mengecek ulang ke Xendit/PayPal (status, jumlah, nomor transaksi). Webhook ganda tidak menggandakan masa aktif. Webhook palsu ditolak.
- Donasi (`/donasi`) bisa tanpa akun, tidak mengubah paket. `donation_url` opsional untuk tautan Trakteer/Saweria.
- Tidak ada tagihan berulang otomatis; pengguna memperpanjang sendiri. Kuitansi dikirim lewat email.
- Semua file `_*.php`, `config.php`, dan `storage/` diblokir `.htaccess`.

## 5. Untuk developer: mengubah & build ulang

Butuh Node.js 20+ (dan PHP kalau ingin mencoba API secara lokal).

```bash
npm install
npm run dev          # mode pengembangan di http://localhost:5173
npm run build        # hasil di build/client + ZIP siap unggah di dist/
npm run preview      # server lokal yang meniru Hostinger (butuh PHP) di http://localhost:8080
npm run typecheck
node scripts/run-tests.mjs   # uji pemecahan ayat pada seluruh 6.236 ayat
npm run data         # bangun ulang data Al-Qur'an dari paket quran-json
npm run images       # bangun ulang og.png & ikon (butuh Python + Playwright)
```

Opsional: salin `.env.example` menjadi `.env`, lalu isi `VITE_SITE_URL=https://studio.domainanda.com` sebelum build agar tag canonical tertulis langsung di HTML.

### Struktur

```
app/
  components/studio/   Studio: Timeline, RowItem, Preview, StylePanel, ExportPanel, AiPanel, BatchDialog
  lib/                 logika: subtitles (SRT/VTT/ASS), autosync, audio, player, renderer, video, storage, cloud
  routes/              halaman situs
  data/surahs.ts       metadata 114 surah (dibuat otomatis)
public/
  data/quran/*.json    teks & terjemahan per surah
  api/*.php            AI, akun (auth/projects), pembayaran (pay, webhook-*), cron, kontak, status
  .htaccess            aturan rewrite, HTTPS, cache, keamanan
  app-config.json      pengaturan yang bisa diubah setelah deploy
scripts/               build data, postbuild (ZIP), router PHP lokal, pembuat gambar
```

## Masalah umum

| Gejala | Solusi |
|---|---|
| Halaman 404 saat di-refresh | `.htaccess` belum ikut terunggah atau terekstrak. Aktifkan **Show hidden files**, lalu cek file tersebut. |
| Tampilan berantakan / file tidak ditemukan | Situs terpasang di subfolder. Pindahkan ke root domain/subdomain. |
| Audio qari gagal dimuat | Periksa koneksi. Kalau EveryAyah menolak unduhan langsung, Studio memakai mode putar berurutan (ekspor video perlu audio unggahan sendiri). |
| Tab Asisten AI bilang "belum diaktifkan" | `api/config.php` belum dibuat atau API key masih kosong. Hosting juga harus mendukung PHP cURL (Hostinger sudah mendukung). |
| Email kontak tidak sampai | Isi `contact_from` dengan email di domain Anda sendiri, lalu cek folder spam. |
| Hasil video WebM, bukan MP4 | Browser tidak mendukung perekaman H.264. Pakai Chrome/Edge terbaru di komputer. |

## Catatan lisensi kode

Seluruh kode aplikasi ini ditulis khusus untuk Quran SRT Studio. Beberapa ide fitur (potong ayat, penyelarasan terjemahan, garis tepi, nama qari, branding) terinspirasi dari editor caption Al-Qur'an lain. Namun **tidak ada kode yang disalin** dari proyek berlisensi non-komersial (misalnya CC BY-NC 4.0), jadi aplikasi ini aman dipakai untuk layanan berbayar.

## Sumber data & lisensi

- Teks Utsmani & terjemahan Indonesia: [QuranEnc.com](https://quranenc.com). Terjemahan Inggris: Saheeh International (QuranEnc.com).
- Transliterasi: [Tanzil.net](https://tanzil.net).
- Audio per ayat: [EveryAyah.com](https://everyayah.com).
- Data dikemas dari paket npm [`quran-json`](https://www.npmjs.com/package/quran-json).
- Huruf: Plus Jakarta Sans, Amiri Quran, Scheherazade New, Noto Naskh Arabic, Reem Kufi (SIL Open Font License, via Fontsource).

Selalu periksa kembali teks, terjemahan, dan waktu sebelum dipublikasikan.

## 6. Deploy otomatis dari GitHub

Lihat [`docs/DEPLOY.md`](docs/DEPLOY.md): setiap `git push` ke `main` otomatis build dan terkirim ke Hostinger (file `.github/workflows/deploy.yml`).
