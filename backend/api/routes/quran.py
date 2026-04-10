"""
QuranSRT — Route: /api/quran

Endpoint untuk data statis: daftar surah, reciter, dan terjemahan.
Data ini di-cache oleh frontend dan jarang berubah.
"""

from fastapi import APIRouter, HTTPException
from core.models import RECITERS, TRANSLATIONS, SURAH_DATA

router = APIRouter()


@router.get("/surahs")
async def get_surahs():
    """Daftar 114 surah dengan nama Arab, Latin, dan jumlah ayat."""
    return {
        "surahs": [
            {
                "number":       num,
                "name_arabic":  info["name_arabic"],
                "name_simple":  info["name_simple"],
                "verse_count":  info["verse_count"],
            }
            for num, info in SURAH_DATA.items()
        ]
    }


@router.get("/surahs/{surah_number}")
async def get_surah(surah_number: int):
    """Detail satu surah termasuk jumlah ayat untuk validasi range."""
    info = SURAH_DATA.get(surah_number)
    if not info:
        raise HTTPException(status_code=404, detail="Surah tidak ditemukan")
    return {"number": surah_number, **info}


@router.get("/reciters")
async def get_reciters():
    """Daftar semua reciter dengan nama, gaya, dan URL sample audio."""
    return {
        "reciters": [
            {
                "id":         key,
                "name":       val["name"],
                "name_ar":    val["name_ar"],
                "style":      val["style"],
                "sample_url": val["sample_url"],
            }
            for key, val in RECITERS.items()
        ]
    }


@router.get("/translations")
async def get_translations():
    """Daftar semua terjemahan yang tersedia dengan flag dan kode bahasa."""
    return {
        "translations": [
            {
                "key":  key,
                "name": val["name"],
                "flag": val["flag"],
                "lang": val["lang"],
            }
            for key, val in TRANSLATIONS.items()
        ]
    }
