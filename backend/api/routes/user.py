"""
QuranSRT — Route: /api/user

Endpoint untuk menyimpan dan mengambil riwayat generate milik pengguna.
Semua endpoint di sini membutuhkan autentikasi (JWT dari Supabase).
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from core.models import GenerateHistoryItem

router = APIRouter()


async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """
    Dependency: verifikasi JWT token dari Supabase.
    Dalam implementasi penuh, token diverifikasi ke Supabase Auth API.
    Return: user_id string.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token autentikasi diperlukan")
    token = authorization.split(" ")[1]
    # TODO: verifikasi token ke Supabase dan return user_id
    # Untuk sekarang, gunakan token sebagai user_id (ganti di production)
    return token


@router.post("/history")
async def save_history(
    item: GenerateHistoryItem,
    user_id: str = Depends(get_current_user)
):
    """Simpan satu entri riwayat generate ke database Supabase."""
    # TODO: insert ke tabel generate_history di Supabase
    return {"status": "saved", "user_id": user_id}


@router.get("/history")
async def get_history(
    limit: int = 20,
    user_id: str = Depends(get_current_user)
):
    """Ambil riwayat generate milik pengguna yang sedang login."""
    # TODO: query dari Supabase
    return {"history": [], "user_id": user_id, "limit": limit}


@router.get("/presets")
async def get_presets(user_id: str = Depends(get_current_user)):
    """Ambil daftar preset favorit pengguna."""
    # TODO: query dari Supabase
    return {"presets": []}


@router.post("/presets")
async def save_preset(
    preset: dict,
    user_id: str = Depends(get_current_user)
):
    """Simpan preset baru (kombinasi surah + reciter + bahasa yang sering dipakai)."""
    # TODO: insert ke Supabase
    return {"status": "saved"}
