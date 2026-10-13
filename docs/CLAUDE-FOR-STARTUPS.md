# Persiapan Claude for Startups: Quran SRT Studio

Dokumen ini berisi bekal pendaftaran Quran SRT Studio ke program **Claude for Startups** dari Anthropic. Isinya: apa saja yang dinilai reviewer, daftar yang perlu disiapkan, dan draf jawaban formulir dalam bahasa Inggris (formulirnya berbahasa Inggris).

> Tidak ada pihak yang bisa menjamin lolos. Keputusan sepenuhnya di tangan Anthropic dan dinilai bergilir. Yang bisa kita lakukan adalah membuat bukti selengkap mungkin.

## 1. Yang dinilai reviewer

Menurut panduan pihak ketiga yang merangkum halaman program, ada empat hal yang dinilai:

| Kriteria | Bukti yang kita punya / siapkan |
|---|---|
| **Integrasi Claude** | Dua fitur produksi: *Translation Aligner* (`api/align.php`) dan *Content Assistant* (`api/claude.php`). Keduanya dijelaskan di beranda, halaman Tentang, dan Privasi. |
| **Pemakaian Claude** | `api/stats.php` mencatat jumlah panggilan Claude serta total token input/output per bulan. |
| **Traksi bisnis** | `api/stats.php` mencatat kunjungan Studio, ayat dimuat, unduhan SRT/VTT/ASS, dan video dibuat per hari (anonim). |
| **Pendanaan** | Saat ini *bootstrapped*. Lihat catatan di bawah. |

**Catatan penting soal kredit API.** Menurut sumber yang sama, siapa saja boleh mendaftar program ini. Namun *kredit* API biasanya hanya untuk startup yang sudah punya pendanaan ekuitas dari investor institusional, berdiri kurang dari 4 tahun, dan belum pernah menerima kredit startup Anthropic. Karena zanfonts belum didanai, kemungkinan besar Anda tetap bisa bergabung dengan program, tapi kreditnya belum tentu cair. Cek lagi syarat terbaru di halaman resmi saat mendaftar.

## 2. Daftar persiapan sebelum mendaftar

- [ ] Situs tayang di domain sendiri dengan HTTPS (mis. `quransrt.com` atau `studio.zanfonts.com`), dan semua halaman bisa dibuka: Beranda, Studio, Panduan, Harga, Tentang, Privasi, Syarat.
- [ ] Akun **Claude Console** memakai email perusahaan, misalnya `info@zanfonts.com`. Jangan pakai Gmail pribadi.
- [ ] API key produksi sudah terisi di `api/config.php`, dan tab **Asisten AI** serta tombol **Rapikan terjemahan** benar-benar jalan di situs live.
- [ ] Isi `stats_key` di `api/config.php`. Biarkan statistik berjalan **minimal 2–4 minggu** sebelum mendaftar agar ada angka nyata.
- [ ] Kumpulkan pengguna awal: bagikan ke grup kreator dakwah, takmir masjid, dan guru TPQ/tahfidz. Catat testimoni asli (dengan izin), jangan dikarang.
- [ ] Siapkan video demo 60–90 detik: pilih surah → ambil qari → potong ayat panjang → *Rapikan terjemahan* dengan Claude → ekspor video.
- [ ] Siapkan tangkapan layar Studio (16:9 dan 9:16) serta contoh video hasil ekspor.
- [ ] Periksa ketentuan pemakaian terjemahan dan audio (QuranEnc, Tanzil, EveryAyah) untuk layanan berbayar, lalu cantumkan atribusinya (sudah ada di halaman Tentang).

## 3. Angka yang diambil dari `api/stats.php`

Buka `https://DOMAIN-ANDA/api/stats.php?key=ISI_STATS_KEY`. Isinya JSON per bulan:

- `events.visit_studio`: sesi Studio dibuka
- `events.load_verses`, `events.fetch_qari`, `events.upload_audio`: aktivitas inti
- `events.export_srt`, `export_vtt`, `export_ass`, `export_video`, `export_batch`: hasil nyata yang diunduh pengguna
- `events.split_verse`, `events.ai_align`, `events.ai_content`: pemakaian fitur Claude
- `events.claude_calls`, `sums.input_tokens`, `sums.output_tokens`: volume pemakaian Claude API
- `days.YYYY-MM-DD`: tren harian, berguna untuk grafik pertumbuhan

## 4. Draf jawaban formulir (bahasa Inggris)

Ganti bagian `[...]` dengan angka asli. Jangan menulis angka perkiraan.

**Company / product description**

> Quran SRT Studio (by zanfonts) is a browser-based studio that turns Quran recitations into accurate, perfectly timed subtitles and ready-to-post videos. Creators pick a surah and a reciter; every verse is timed automatically from per-verse audio, or synced to their own recording with pause detection and tap-sync. It exports SRT/VTT/ASS, YouTube descriptions with chapters, and 16:9 / 9:16 / 1:1 videos rendered in the browser. Our users are Muslim content creators, mosques (screens during prayers and lectures) and Quran teachers, starting with Indonesia, the country with the largest Muslim population. Since launch on [date], [N] creators have exported [N] subtitle files and [N] videos.

**How we use Claude (integration)**

> Claude runs two production features. (1) Translation Aligner: long verses must be split into several on-screen subtitles, and the translation has to be cut so each part matches its Arabic segment — a slow manual task for editors. We send Claude the Arabic segments and the translation as numbered words; Claude returns only the cut positions as JSON. Our server cuts the original text itself and verifies that the parts join back to the exact source, retrying once on invalid output, so Claude can never alter scripture or translation. (2) Content Assistant: Claude drafts respectful titles, descriptions, hashtags and thumbnail text for YouTube, Shorts, TikTok and Reels in Indonesian or English, with a system prompt that forbids quoting or inventing verses. All calls go through our PHP backend with per-IP rate limits; no key is exposed to the browser. Current usage: [N] Claude calls and [N]M tokens per month (Claude Haiku 5.5, with Sonnet 5.5 for higher-quality alignment).

**Traction**

> [N] monthly active Studio sessions, [N] subtitle exports and [N] video renders in [month]. Growth: [X]% month over month. Early users include [mosque/creator names, only with permission].

**Funding**

> Bootstrapped by the founder; no outside funding yet. *(Ubah bila nanti sudah ada investor. Sebutkan nama investor jika termasuk mitra Anthropic.)*

**What we will build with more Claude capacity**

> Claude-assisted alignment for all 6,236 verses across more translation languages, automatic quality review of user timing before export, and a mosque mode that prepares a full prayer-night playlist with subtitles. *(Tulis hanya rencana yang memang akan Anda kerjakan.)*

## 5. Yang sebaiknya dihindari

- Mengaku sebagai "partner" atau memakai logo Anthropic/Claude di situs tanpa izin. Cukup tulis "ditenagai Claude dari Anthropic".
- Mengklaim angka pengguna, testimoni, atau pendanaan yang belum ada.
- Menyalin kode dari proyek berlisensi non-komersial (misalnya QuranCaption, CC BY-NC 4.0). Semua kode di repo ini ditulis sendiri.

## Sumber

- [How to Apply to Claude for Startups in 2026 (Causo)](https://hub.causo.ai/guides/how-to-apply-to-claude-for-startups-2026)
- [Anthropic Claude for Startups: Credits, Tiers, and Eligibility (Deepak Gupta)](https://guptadeepak.com/anthropic-claude-for-startups-the-complete-guide-to-credits-tiers-and-eligibility-2026/)
