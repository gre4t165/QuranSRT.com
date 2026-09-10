# QuranSRT Desktop (Tauri)

App QuranSRT yang **bisa di-install di PC**. Dibungkus dengan [Tauri](https://tauri.app):

- **Frontend** Next.js diekspor menjadi file statis dan dimuat oleh webview.
- **Backend** FastAPI dibundel menjadi satu `.exe` (PyInstaller) dan dijalankan
  otomatis sebagai *sidecar* saat app dibuka, lalu dimatikan saat app ditutup.
- **Standalone**: aset storyboard (gambar/audio/video) disimpan ke disk lokal
  (`%USERPROFILE%\.quransrt`), bukan ke cloud. FFmpeg ikut dibundel.

> Fitur AI (GPT & ElevenLabs) tetap butuh internet + API key milik pengguna —
> lihat bagian [Konfigurasi API key](#konfigurasi-api-key).

---

## Arsitektur

```
Tauri (Rust)  ──spawn──▶  quransrt-backend.exe  (FastAPI @ 127.0.0.1:8756)
     │                          │
     │ memuat                   ├─ /api/...        (SRT + Storyboard)
     ▼                          └─ /assets/...     (file lokal: gambar/audio/video)
frontend/out  (Next.js static, NEXT_PUBLIC_API_URL = http://127.0.0.1:8756)
```

Saat app dibuka: Rust menjalankan backend, menunggu port `8756` siap, lalu
menampilkan jendela. Saat app ditutup: proses backend dimatikan.

---

## Prasyarat (mesin build Windows)

| Alat | Catatan |
|------|---------|
| **Python 3.11+** | build backend via PyInstaller |
| **Node.js 18+** | build frontend + Tauri CLI |
| **Rust (stable, MSVC)** | `https://rustup.rs` — toolchain Tauri |
| **Visual Studio Build Tools** | C++ build tools (untuk Rust MSVC) |
| **WebView2 Runtime** | biasanya sudah ada di Windows 10/11 |
| **FFmpeg** | `ffmpeg.exe` + `ffprobe.exe` → taruh di `backend/vendor/` |

> **Build .msi/.exe Windows harus di mesin Windows.** Tauri tidak mendukung
> cross-compile ke Windows dari Linux/macOS secara praktis.

### Menyiapkan FFmpeg (agar ekspor video jalan)

1. Unduh build FFmpeg untuk Windows (mis. dari gyan.dev / BtbN).
2. Salin `ffmpeg.exe` dan `ffprobe.exe` ke `backend/vendor/`.

PyInstaller akan menyertakannya ke dalam `quransrt-backend.exe` secara otomatis
(lihat `backend/quransrt-backend.spec`). Tanpa ini, pipeline SRT & storyboard
tetap jalan; hanya *ekspor MP4* yang dinonaktifkan dengan pesan ramah.

---

## Build cepat (otomatis)

Dari folder `desktop/`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1
```

Script ini: build backend → salin sidecar → generate ikon → build installer.
Hasil akhir:

```
desktop/src-tauri/target/release/bundle/msi/QuranSRT_2.0.0_x64_en-US.msi
desktop/src-tauri/target/release/bundle/nsis/QuranSRT_2.0.0_x64-setup.exe
```

---

## Build manual (langkah per langkah)

```powershell
# 1) Backend -> quransrt-backend.exe
cd backend
python -m pip install -r requirements.txt pyinstaller
pyinstaller quransrt-backend.spec --noconfirm --clean

# 2) Salin ke folder sidecar dengan nama ber-"target triple"
#    Cek triple: rustc -Vv  (mis. x86_64-pc-windows-msvc)
copy dist\quransrt-backend.exe ..\desktop\src-tauri\binaries\quransrt-backend-x86_64-pc-windows-msvc.exe

# 3) Tauri
cd ..\desktop
npm install
npm run icon        # generate ikon dari src-tauri/icons/source-icon.png (sekali saja)
npm run build       # otomatis menjalankan "build:desktop" di frontend
```

---

## Menjalankan mode dev

Dev tidak butuh PyInstaller — backend bisa dijalankan langsung, dan Tauri
memuat Next dev server:

```powershell
# Terminal 1 — backend desktop (storage lokal, port 8756)
cd backend
set QURANSRT_DESKTOP=1
set QURANSRT_PORT=8756
python run_desktop.py

# Terminal 2 — Tauri (memuat http://localhost:3000 via beforeDevCommand)
cd desktop
npm install
npm run dev
```

> Di mode dev, backend sudah kamu jalankan sendiri; sidecar Tauri hanya relevan
> di build produksi.

---

## Konfigurasi API key

App membaca API key dari file `%USERPROFILE%\.quransrt\config.json`:

```json
{
  "OPENAI_API_KEY": "sk-...",
  "ELEVENLABS_API_KEY": "...",
  "ELEVENLABS_DEFAULT_VOICE": "21m00Tcm4TlvDq8ikWAM",
  "STORYBOARD_STYLE_TAG": "2D digital cartoon with thick marker-like line work and flat fills"
}
```

Tanpa key, fitur SRT tetap jalan; fitur AI mengembalikan pesan "belum
dikonfigurasi" sampai key diisi. (Environment variable juga tetap dihormati.)

---

## Catatan

- Port backend (`8756`) di-hardcode di tiga tempat yang harus konsisten:
  `src-tauri/src/main.rs`, `frontend/package.json` (`build:desktop`), dan default
  `backend/core/config.py`.
- Jika `npm run dev`/`build` melaporkan error kapabilitas shell/sidecar,
  jalankan `npm run tauri -- migrate` atau sesuaikan
  `src-tauri/capabilities/default.json` sesuai pesan yang muncul (skema
  permission Tauri v2 bisa berubah antar versi).
- `source-icon.png` saat ini placeholder. Ganti dengan logo asli lalu jalankan
  `npm run icon` untuk regenerate seluruh ukuran ikon.
