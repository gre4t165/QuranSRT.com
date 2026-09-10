"""
QuranSRT Backend — FastAPI
Entry point aplikasi. Menginisialisasi app, middleware, dan routing.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
import logging

from api.routes import generate, quran, batch, user, storyboard
from core.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events — dijalankan saat app start dan shutdown."""
    logger.info("QuranSRT API starting up...")
    yield
    logger.info("QuranSRT API shutting down...")


app = FastAPI(
    title="QuranSRT API",
    description="Backend API untuk generate file SRT subtitle Al-Quran",
    version="2.0.0",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────

# CORS. Di mode desktop (Tauri) origin webview bervariasi (tauri://localhost,
# http(s)://tauri.localhost), jadi izinkan semua origin. Di mode web, batasi
# ke domain resmi quransrt.com.
if settings.DESKTOP_MODE:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://quransrt.com",
            "https://www.quransrt.com",
            "http://localhost:3000",   # untuk development lokal
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Kompres response besar (file SRT bisa lumayan besar)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Static assets (mode desktop / local storage) ────────────────────────────────
# Sajikan aset storyboard (gambar/audio/video) yang disimpan di disk lokal
# sehingga webview bisa memuatnya lewat URL http://host:port/assets/...
if settings.use_local_storage:
    _assets_dir = Path(settings.LOCAL_STORAGE_DIR)
    _assets_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

# ── Routes ───────────────────────────────────────────────────────────────────

app.include_router(quran.router,    prefix="/api/quran",    tags=["Quran Data"])
app.include_router(generate.router, prefix="/api/generate", tags=["Generator"])
app.include_router(batch.router,    prefix="/api/batch",    tags=["Batch (Pro)"])
app.include_router(user.router,     prefix="/api/user",     tags=["User"])
app.include_router(storyboard.router, prefix="/api/storyboard", tags=["Storyboard Creator"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "QuranSRT API", "version": "2.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
