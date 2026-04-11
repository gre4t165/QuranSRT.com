"""
QuranSRT Backend — FastAPI
Entry point aplikasi. Menginisialisasi app, middleware, dan routing.
"""

import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging

from api.routes import generate, quran, batch, user

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

# CORS: izinkan frontend memanggil API ini.
# Set env var CORS_ORIGINS (comma-separated) untuk override di production.
_raw_origins = os.environ.get("CORS_ORIGINS", "")
_env_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
_default_origins = [
    "https://quransrt.com",
    "https://www.quransrt.com",
    "http://localhost:3000",   # untuk development lokal
]
_allow_origins = _env_origins if _env_origins else _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Kompres response besar (file SRT bisa lumayan besar)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Routes ───────────────────────────────────────────────────────────────────

app.include_router(quran.router,    prefix="/api/quran",    tags=["Quran Data"])
app.include_router(generate.router, prefix="/api/generate", tags=["Generator"])
app.include_router(batch.router,    prefix="/api/batch",    tags=["Batch (Pro)"])
app.include_router(user.router,     prefix="/api/user",     tags=["User"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "QuranSRT API", "version": "2.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
