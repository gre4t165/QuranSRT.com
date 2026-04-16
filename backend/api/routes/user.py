"""
QuranSRT — Route: /api/user

Endpoint untuk menyimpan dan mengambil riwayat generate milik pengguna.
Semua endpoint di sini membutuhkan autentikasi (JWT dari Supabase).
"""

import os
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional, List
from core.models import GenerateHistoryItem
from supabase import create_client, Client

router = APIRouter()

# Initialize Supabase client
_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """Get or create Supabase client singleton."""
    global _supabase_client
    if _supabase_client is None:
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_KEY")
        
        if not supabase_url or not supabase_key:
            raise HTTPException(
                status_code=500, 
                detail="Supabase configuration missing. Set SUPABASE_URL and SUPABASE_KEY environment variables."
            )
        
        _supabase_client = create_client(supabase_url, supabase_key)
    
    return _supabase_client


async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """
    Dependency: verifikasi JWT token dari Supabase.
    Return: user_id string.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token autentikasi diperlukan")
    
    token = authorization.split(" ")[1]
    
    # Verifikasi token dengan Supabase Auth
    try:
        supabase = get_supabase_client()
        user_response = supabase.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Token tidak valid atau sudah kadaluarsa")
        
        return user_response.user.id
    
    except Exception as e:
        raise HTTPException(
            status_code=401, 
            detail=f"Autentikasi gagal: {str(e)}"
        )


@router.post("/history")
async def save_history(
    item: GenerateHistoryItem,
    user_id: str = Depends(get_current_user)
):
    """Simpan satu entri riwayat generate ke database Supabase."""
    try:
        supabase = get_supabase_client()
        
        # Insert ke tabel generate_history
        data = {
            "user_id": user_id,
            "surah": item.surah,
            "start_verse": item.start_verse,
            "end_verse": item.end_verse,
            "reciter_id": item.reciter_id,
            "translation_key": item.translation_key,
            "mode": item.mode,
            "filename": item.filename,
        }
        
        response = supabase.table("generate_history").insert(data).execute()
        
        return {"status": "saved", "id": response.data[0]["id"] if response.data else None}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan riwayat: {str(e)}")


@router.get("/history")
async def get_history(
    limit: int = 20,
    user_id: str = Depends(get_current_user)
):
    """Ambil riwayat generate milik pengguna yang sedang login."""
    try:
        supabase = get_supabase_client()
        
        # Query dari Supabase, urutkan berdasarkan created_at DESC
        response = (
            supabase.table("generate_history")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        
        return {"history": response.data, "user_id": user_id, "limit": limit}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil riwayat: {str(e)}")


@router.get("/presets")
async def get_presets(user_id: str = Depends(get_current_user)):
    """Ambil daftar preset favorit pengguna."""
    try:
        supabase = get_supabase_client()
        
        response = (
            supabase.table("user_presets")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        
        return {"presets": response.data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil preset: {str(e)}")


@router.post("/presets")
async def save_preset(
    preset: dict,
    user_id: str = Depends(get_current_user)
):
    """Simpan preset baru (kombinasi surah + reciter + bahasa yang sering dipakai)."""
    try:
        supabase = get_supabase_client()
        
        data = {
            "user_id": user_id,
            **preset
        }
        
        response = supabase.table("user_presets").insert(data).execute()
        
        return {"status": "saved", "id": response.data[0]["id"] if response.data else None}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan preset: {str(e)}")


@router.delete("/history/{history_id}")
async def delete_history(
    history_id: int,
    user_id: str = Depends(get_current_user)
):
    """Hapus satu entri riwayat."""
    try:
        supabase = get_supabase_client()
        
        # Pastikan hanya bisa hapus riwayat sendiri
        response = (
            supabase.table("generate_history")
            .delete()
            .eq("id", history_id)
            .eq("user_id", user_id)
            .execute()
        )
        
        return {"status": "deleted", "id": history_id}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menghapus riwayat: {str(e)}")


@router.delete("/presets/{preset_id}")
async def delete_preset(
    preset_id: int,
    user_id: str = Depends(get_current_user)
):
    """Hapus satu preset."""
    try:
        supabase = get_supabase_client()
        
        response = (
            supabase.table("user_presets")
            .delete()
            .eq("id", preset_id)
            .eq("user_id", user_id)
            .execute()
        )
        
        return {"status": "deleted", "id": preset_id}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menghapus preset: {str(e)}")
