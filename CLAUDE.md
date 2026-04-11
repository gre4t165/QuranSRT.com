# QuranSRT — CLAUDE.md
## Briefing dokumen untuk Claude Code. Baca ini sebelum mengerjakan apapun.

---

## Tentang Project

QuranSRT adalah platform web berbasis browser untuk generate file subtitle SRT Al-Quran
beserta audio MP3. Keunggulan utama vs kompetitor (QuranCaption): **zero install** —
pengguna cukup buka browser, tidak perlu download software apapun.

Project ini dibangun ulang dari nol (sebelumnya Streamlit + WordPress plugin).
Stack baru: FastAPI backend + Next.js frontend.

---

## Stack Teknologi

- **Backend:** FastAPI (Python 3.11+), dijalankan dengan Uvicorn
- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS
- **Database:** Supabase (PostgreSQL + Auth)
- **Deploy Backend:** Railway.app
- **Deploy Frontend:** Vercel
- **Domain:** quransrt.com

---

## Struktur Monorepo

```
quransrt/
├── CLAUDE.md              ← file ini
├── .gitignore
├── backend/               ← FastAPI app
│   ├── main.py
│   ├── requirements.txt
│   ├── Procfile           ← Railway start command
│   ├── railway.toml       ← Railway deploy config
│   ├── .env.example       ← template env vars
│   ├── core/
│   │   ├── models.py         ← semua data model + data statis (RECITERS, TRANSLATIONS, SURAH_DATA)
│   │   └── srt_generator.py  ← logika inti: generate SRT (single + multi-translation)
│   └── api/routes/
│       ├── generate.py  ← POST /api/generate/srt, /zip, /preview, /multi/srt, /multi/zip
│       ├── quran.py     ← GET /api/quran/surahs, /reciters, /translations
│       ├── batch.py     ← POST /api/batch/generate (Pro, SSE streaming)
│       └── user.py      ← GET/POST /api/user/history, /presets
└── frontend/              ← Next.js app
```

---

## Design System

| Token        | Value     |
|-------------|-----------|
| Background  | `#080B14` |
| Aksen emas  | `#C9A84C` |
| Teks utama  | `#F5F5F0` |
| Surface      | `#0F1523` |
| Border      | `#1E2A42` |
| Font heading | Amiri (Google Fonts) |
| Font body    | DM Sans (Google Fonts) |
| Tema         | Dark mode, premium, Islami + modern |

---

## Fitur Utama

1. Generate SRT dari 114 surah Al-Quran
2. 30+ reciter dengan audio preview
3. 50+ bahasa terjemahan + transliterasi
4. 4 mode subtitle: WAQOF (natural pause), VERSE (per ayat), STD (fixed chars), TEXT_ONLY (tanpa audio)
5. Bundle download SRT + MP3 ZIP
6. Multi-translation: generate beberapa bahasa sekaligus dalam satu ZIP (ala EveryPage Studio)
7. Live preview SRT sebelum download
8. Sistem akun (Supabase Auth): history, presets
9. Batch generate — fitur Pro (SSE streaming progress)
10. Fallback API: gunakan qurancdn.com + alquran.cloud sebagai sumber data

---

## Keputusan Arsitektur (Jangan Diubah Tanpa Diskusi)

- Semua logika bisnis ada di **backend** — frontend hanya memanggil API
- Audio fetched dari `quranicaudio.com` — tidak dihost sendiri
- Timing data dari `api.qurancdn.com` — sudah ada timing per kata (segmen)
- Fallback terjemahan dari `api.alquran.cloud` — untuk bahasa yang tidak ada di qurancdn
- Mode WAQOF: pecah ayat berdasarkan karakter tanda waqof dalam teks Arab
- Mode VERSE: satu ayat = satu blok SRT
- Mode STD: split terjemahan per 42 karakter per baris
- Mode TEXT_ONLY: timing berdasarkan panjang teks (tanpa audio), cocok untuk preview
- Multi-translation endpoint: logika dari EveryPage Studio Desktop, generate 1 SRT per bahasa
- Batch endpoint menggunakan SSE agar progress terlihat real-time

---

## Cara Menjalankan Lokal

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev   # jalan di localhost:3000
```

---

## API Sumber Data Eksternal

- Timing audio: `https://api.qurancdn.com/api/qdc/audio/reciters/{id}/audio_files`
- Teks ayat: `https://api.qurancdn.com/api/qdc/verses/by_chapter/{surah}`
- Audio MP3: `https://download.quranicaudio.com/quran/{reciter_path}/{surah}{verse}.mp3`

---

## Hal Penting yang Perlu Diperhatikan

- Selalu handle error dengan pesan yang ramah pengguna (bukan error teknis mentah)
- Semua text UI dalam bahasa Indonesia, kecuali nama teknis/kode
- Mobile-first: semua komponen harus responsive
- Hindari library besar yang tidak perlu (performa adalah prioritas)
- Teks Arab selalu menggunakan font yang support RTL
- Jangan hardcode URL API di frontend — gunakan environment variable `NEXT_PUBLIC_API_URL`
