# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec — membundel backend QuranSRT menjadi satu executable
(quransrt-backend) untuk dipakai sebagai sidecar oleh app desktop Tauri.

Build (jalankan dari folder backend/):
    pip install -r requirements.txt pyinstaller
    pyinstaller quransrt-backend.spec --noconfirm

Hasil: dist/quransrt-backend(.exe)

Untuk menyertakan FFmpeg ke dalam executable, letakkan ffmpeg(.exe) dan
ffprobe(.exe) di folder backend/vendor/ sebelum build (lihat desktop/README.md).
"""

import os
from PyInstaller.utils.hooks import collect_submodules

# Uvicorn & Starlette memuat banyak modul secara dinamis — kumpulkan submodulnya
# agar tidak hilang saat dibundel.
hidden = []
for pkg in ("uvicorn", "fastapi", "starlette", "anyio", "httpx", "h11", "pydantic"):
    hidden += collect_submodules(pkg)

# Modul aplikasi yang dimuat lewat import-string "main:app" (tidak terdeteksi
# otomatis oleh PyInstaller) harus didaftarkan manual.
hidden += [
    "main",
    "api.routes.generate",
    "api.routes.quran",
    "api.routes.batch",
    "api.routes.user",
    "api.routes.storyboard",
    "core.config",
    "core.models",
    "core.storyboard",
    "core.srt_generator",
]

# Sertakan FFmpeg bila tersedia di vendor/.
binaries = []
_vendor = os.path.join(os.getcwd(), "vendor")
for _name in ("ffmpeg.exe", "ffprobe.exe", "ffmpeg", "ffprobe"):
    _path = os.path.join(_vendor, _name)
    if os.path.exists(_path):
        binaries.append((_path, "."))

a = Analysis(
    ["run_desktop.py"],
    pathex=[os.getcwd()],
    binaries=binaries,
    datas=[],
    hiddenimports=hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Paket yang tak dipakai di mode desktop (storage lokal) — dikecualikan
    # agar ukuran executable lebih kecil.
    excludes=["supabase", "pytest", "pytest_asyncio"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="quransrt-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,           # server CLI — jendela disembunyikan oleh Tauri
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
