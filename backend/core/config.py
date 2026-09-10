"""
QuranSRT Config — config.py

Pusat konfigurasi untuk pipeline Storyboard Creator (GPT, ElevenLabs,
penyimpanan cloud, dan FFmpeg). Semua nilai dibaca dari environment variable
sehingga kredensial tidak pernah di-hardcode ke dalam kode.

Pola penggunaan:
    from core.config import settings
    settings.require_openai()          # raise error ramah jika belum dikonfigurasi
    key = settings.OPENAI_API_KEY
"""

import os
from functools import lru_cache

# python-dotenv opsional — di production (Railway/Vercel) env var sudah di-inject.
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:  # pragma: no cover - dotenv tidak wajib ada
    pass


def _get(key: str, default: str = "") -> str:
    """Ambil env var, selalu di-strip agar aman dari spasi tak sengaja."""
    return os.getenv(key, default).strip()


class Settings:
    """Konfigurasi aplikasi yang dibaca sekali dari environment."""

    def __init__(self) -> None:
        # ── OpenAI (Pipeline 1: GPT Picture & Story) ──────────────────────
        self.OPENAI_API_KEY: str = _get("OPENAI_API_KEY")
        self.OPENAI_BASE_URL: str = _get("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.OPENAI_TEXT_MODEL: str = _get("OPENAI_TEXT_MODEL", "gpt-4o")
        self.OPENAI_IMAGE_MODEL: str = _get("OPENAI_IMAGE_MODEL", "gpt-image-1")

        # Global style tag yang diappend ke setiap prompt gambar.
        self.GLOBAL_STYLE_TAG: str = _get(
            "STORYBOARD_STYLE_TAG",
            "2D digital cartoon with thick marker-like line work and flat fills",
        )

        # ── ElevenLabs (Pipeline 2: Voiceover) ────────────────────────────
        self.ELEVENLABS_API_KEY: str = _get("ELEVENLABS_API_KEY")
        self.ELEVENLABS_BASE_URL: str = _get(
            "ELEVENLABS_BASE_URL", "https://api.elevenlabs.io/v1"
        )
        # Model premium default — kualitas tertinggi + dukungan multibahasa.
        self.ELEVENLABS_MODEL: str = _get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
        self.ELEVENLABS_DEFAULT_VOICE: str = _get(
            "ELEVENLABS_DEFAULT_VOICE", "21m00Tcm4TlvDq8ikWAM"
        )
        self.ELEVENLABS_OUTPUT_FORMAT: str = _get(
            "ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128"
        )

        # ── Penyimpanan Cloud (Supabase Storage) ──────────────────────────
        self.SUPABASE_URL: str = _get("SUPABASE_URL")
        # Service role key diperlukan untuk upload (bypass RLS di sisi server).
        self.SUPABASE_SERVICE_KEY: str = _get("SUPABASE_SERVICE_KEY") or _get("SUPABASE_KEY")
        self.STORAGE_BUCKET: str = _get("STORYBOARD_BUCKET", "storyboard-assets")

        # ── FFmpeg (Pipeline 3: Kompilasi Video) ──────────────────────────
        self.FFMPEG_BIN: str = _get("FFMPEG_BIN", "ffmpeg")
        self.FFPROBE_BIN: str = _get("FFPROBE_BIN", "ffprobe")

    # ── Guard helpers ─────────────────────────────────────────────────────
    # Masing-masing melempar RuntimeError dengan pesan ramah pengguna (bahasa
    # Indonesia) agar route bisa menerjemahkannya langsung ke HTTP 502/503.

    def require_openai(self) -> None:
        if not self.OPENAI_API_KEY:
            raise RuntimeError(
                "Layanan AI belum dikonfigurasi (OPENAI_API_KEY belum diset). "
                "Hubungi administrator untuk mengaktifkan fitur storyboard."
            )

    def require_elevenlabs(self) -> None:
        if not self.ELEVENLABS_API_KEY:
            raise RuntimeError(
                "Layanan voiceover belum dikonfigurasi (ELEVENLABS_API_KEY belum diset)."
            )

    def require_storage(self) -> None:
        if not (self.SUPABASE_URL and self.SUPABASE_SERVICE_KEY):
            raise RuntimeError(
                "Penyimpanan cloud belum dikonfigurasi (SUPABASE_URL / "
                "SUPABASE_SERVICE_KEY belum diset)."
            )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton settings — dibaca sekali lalu di-cache."""
    return Settings()


# Instance global yang dipakai di seluruh modul storyboard.
settings = get_settings()
