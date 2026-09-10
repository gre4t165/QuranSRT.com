# Sidecar binaries

Folder ini menampung executable backend yang dibundel Tauri sebagai **sidecar**.

Tauri mensyaratkan nama file diakhiri dengan *target triple* platform:

| Platform            | Nama file yang diharapkan                          |
|---------------------|----------------------------------------------------|
| Windows (x64)       | `quransrt-backend-x86_64-pc-windows-msvc.exe`      |
| macOS (Apple)       | `quransrt-backend-aarch64-apple-darwin`            |
| macOS (Intel)       | `quransrt-backend-x86_64-apple-darwin`             |
| Linux (x64)         | `quransrt-backend-x86_64-unknown-linux-gnu`        |

Cara mengisi (Windows):

1. Build backend dengan PyInstaller (lihat `desktop/README.md`).
2. Salin `backend/dist/quransrt-backend.exe` ke sini dengan nama ber-triple di atas.

Script `desktop/scripts/build-windows.ps1` melakukan langkah ini otomatis.

> File `.exe`/binari **tidak di-commit** ke git (lihat `.gitignore`). Hanya
> README ini yang di-track agar folder tetap ada.
