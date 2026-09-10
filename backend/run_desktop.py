"""
QuranSRT — Desktop backend launcher (run_desktop.py)

Entry point yang dipakai saat backend dijalankan sebagai bagian dari app
desktop Tauri (dibundel jadi executable oleh PyInstaller). Tugasnya:

  1. Aktifkan mode desktop (storage lokal, CORS permisif).
  2. Temukan binari ffmpeg/ffprobe yang ikut dibundel.
  3. Muat API key dari ~/.quransrt/config.json bila ada (agar user tidak perlu
     mengeset environment variable secara manual).
  4. Jalankan server Uvicorn di 127.0.0.1:<port>.

Dijalankan oleh proses Tauri sebagai "sidecar"; Tauri yang mematikannya saat
aplikasi ditutup.
"""

import os
import sys
import json
import shutil
from pathlib import Path


def _candidate_dirs() -> list[Path]:
    """Kandidat folder tempat binari pendamping (ffmpeg) mungkin berada."""
    dirs: list[Path] = []
    # PyInstaller onefile mengekstrak data ke _MEIPASS saat runtime.
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        dirs.append(Path(meipass))
    # Folder tempat executable berada (onedir / di sebelah exe).
    if getattr(sys, "frozen", False):
        dirs.append(Path(sys.executable).parent)
    else:
        dirs.append(Path(__file__).parent)
    # Sub-folder umum.
    dirs += [d / "bin" for d in list(dirs)] + [d / "vendor" for d in list(dirs)]
    return dirs


def _find_binary(names: list[str]) -> str | None:
    """Cari salah satu nama binari di folder kandidat, lalu di PATH sistem."""
    exe = ".exe" if os.name == "nt" else ""
    for d in _candidate_dirs():
        for name in names:
            cand = d / f"{name}{exe}"
            if cand.exists():
                return str(cand)
    # Fallback: binari yang sudah ada di PATH.
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    return None


def _setup_env() -> None:
    os.environ.setdefault("QURANSRT_DESKTOP", "1")

    # Direktori data user (aset + config).
    data_dir = Path(os.environ.get("QURANSRT_DATA_DIR", str(Path.home() / ".quransrt")))
    data_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("LOCAL_STORAGE_DIR", str(data_dir / "storyboard-assets"))

    # ffmpeg / ffprobe yang dibundel.
    ffmpeg = _find_binary(["ffmpeg"])
    ffprobe = _find_binary(["ffprobe"])
    if ffmpeg:
        os.environ.setdefault("FFMPEG_BIN", ffmpeg)
    if ffprobe:
        os.environ.setdefault("FFPROBE_BIN", ffprobe)

    # Muat API key & preferensi dari config.json (opsional).
    cfg_file = data_dir / "config.json"
    if cfg_file.exists():
        try:
            cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
            allowed = (
                "OPENAI_API_KEY", "OPENAI_TEXT_MODEL", "OPENAI_IMAGE_MODEL",
                "OPENAI_BASE_URL", "STORYBOARD_STYLE_TAG",
                "ELEVENLABS_API_KEY", "ELEVENLABS_MODEL", "ELEVENLABS_DEFAULT_VOICE",
            )
            for key in allowed:
                val = cfg.get(key)
                if val:
                    os.environ.setdefault(key, str(val))
        except (json.JSONDecodeError, OSError):
            # Config rusak — abaikan, biarkan user mengeset via env.
            pass


def main() -> None:
    _setup_env()

    # Import setelah env di-set agar core.config membaca nilai yang benar.
    import uvicorn

    host = os.environ.get("QURANSRT_HOST", "127.0.0.1")
    try:
        port = int(os.environ.get("QURANSRT_PORT", "8756"))
    except ValueError:
        port = 8756

    uvicorn.run("main:app", host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
