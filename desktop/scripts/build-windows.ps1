# =============================================================================
# QuranSRT Desktop — build installer Windows (.msi + .exe) end-to-end.
#
# Jalankan dari folder `desktop/`:
#     powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1
#
# Prasyarat (lihat desktop/README.md):
#   - Python 3.11+           (untuk build backend via PyInstaller)
#   - Node.js 18+            (untuk build frontend + Tauri CLI)
#   - Rust (stable, MSVC)    (toolchain Tauri)
#   - Visual Studio Build Tools + WebView2 Runtime
#   - ffmpeg.exe & ffprobe.exe di backend/vendor/  (agar ekspor video jalan)
# =============================================================================

$ErrorActionPreference = "Stop"
$root      = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)  # .../desktop
$repo      = Split-Path -Parent $root
$backend   = Join-Path $repo "backend"
$binaries  = Join-Path $root "src-tauri/binaries"

Write-Host "==> QuranSRT Desktop build" -ForegroundColor Cyan
Write-Host "    repo: $repo"

# 1. Target triple (mis. x86_64-pc-windows-msvc) dari rustc.
$triple = (rustc -Vv | Select-String "host:").ToString().Split(" ")[1]
Write-Host "==> Target triple: $triple" -ForegroundColor Cyan

# 2. Build backend jadi single executable (PyInstaller).
Write-Host "==> Membangun backend (PyInstaller)..." -ForegroundColor Cyan
Push-Location $backend
python -m pip install -r requirements.txt pyinstaller | Out-Null
pyinstaller quransrt-backend.spec --noconfirm --clean
Pop-Location

# 3. Salin backend exe ke folder sidecar dengan nama ber-triple.
New-Item -ItemType Directory -Force -Path $binaries | Out-Null
$src = Join-Path $backend "dist/quransrt-backend.exe"
$dst = Join-Path $binaries "quransrt-backend-$triple.exe"
Copy-Item $src $dst -Force
Write-Host "==> Sidecar: $dst" -ForegroundColor Green

# 4. Install dependensi Node desktop + generate ikon bila belum ada.
Write-Host "==> Menyiapkan Tauri CLI & ikon..." -ForegroundColor Cyan
Push-Location $root
npm install
if (-not (Test-Path "src-tauri/icons/icon.ico")) {
    npm run icon
}

# 5. Build installer (frontend static export dijalankan otomatis via
#    beforeBuildCommand di tauri.conf.json).
Write-Host "==> Membangun installer Tauri..." -ForegroundColor Cyan
npm run build
Pop-Location

Write-Host "==> Selesai! Installer ada di:" -ForegroundColor Green
Write-Host "    $root/src-tauri/target/release/bundle/msi/"
Write-Host "    $root/src-tauri/target/release/bundle/nsis/"
