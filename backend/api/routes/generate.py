"""
QuranSRT — Route: /api/generate

Endpoint utama yang menerima parameter dari frontend,
memanggil core engine, dan mengembalikan file SRT atau ZIP.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from core.models import GenerateRequest, SURAH_DATA
from core.srt_generator import generate_srt, generate_zip

router = APIRouter()


@router.post("/srt")
async def generate_srt_endpoint(request: GenerateRequest):
    """
    Generate file SRT dan kembalikan sebagai file download.

    Validasi jumlah ayat terlebih dahulu agar tidak memproses
    request yang sudah jelas tidak valid (misal: end_verse > total ayat surah).
    """
    surah_info = SURAH_DATA.get(request.surah)
    if not surah_info:
        raise HTTPException(status_code=400, detail="Nomor surah tidak valid")

    max_verse = surah_info["verse_count"]
    if request.end_verse > max_verse:
        raise HTTPException(
            status_code=400,
            detail=f"Surah {surah_info['name_simple']} hanya memiliki {max_verse} ayat"
        )

    try:
        result = await generate_srt(request)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Return sebagai file download dengan proper headers
    return Response(
        content=result.srt_content.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{result.filename}"',
            "X-Block-Count": str(result.block_count),
            "X-Surah-Name": result.surah_name_latin,
        }
    )


@router.post("/zip")
async def generate_zip_endpoint(request: GenerateRequest):
    """
    Generate ZIP berisi file SRT + MP3 per ayat.
    Lebih lambat dari /srt karena harus download semua audio.
    Ditangani dengan timeout yang lebih panjang.
    """
    surah_info = SURAH_DATA.get(request.surah)
    if not surah_info:
        raise HTTPException(status_code=400, detail="Nomor surah tidak valid")

    max_verse = surah_info["verse_count"]
    if request.end_verse > max_verse:
        raise HTTPException(
            status_code=400,
            detail=f"Surah {surah_info['name_simple']} hanya memiliki {max_verse} ayat"
        )

    # Batasi range ayat untuk ZIP agar tidak timeout (max 50 ayat per request)
    verse_count = request.end_verse - request.start_verse + 1
    if verse_count > 50:
        raise HTTPException(
            status_code=400,
            detail="Download ZIP maksimal 50 ayat per request. Gunakan batch untuk lebih banyak."
        )

    try:
        zip_bytes, zip_filename = await generate_zip(request)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_filename}"',
        }
    )


@router.post("/preview")
async def preview_srt_endpoint(request: GenerateRequest):
    """
    Generate preview SRT dan kembalikan sebagai JSON (bukan file download).
    Digunakan oleh frontend untuk menampilkan live preview sebelum download.
    Dibatasi maksimal 10 ayat agar cepat.
    """
    verse_count = request.end_verse - request.start_verse + 1
    if verse_count > 10:
        # Untuk preview, batasi ke 10 ayat pertama
        request.end_verse = request.start_verse + 9

    try:
        result = await generate_srt(request)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Return sebagai JSON untuk ditampilkan di UI
    lines = result.srt_content.strip().split("\n\n")
    blocks = []
    for block in lines[:20]:  # tampilkan maksimal 20 blok di preview
        parts = block.strip().split("\n")
        if len(parts) >= 3:
            blocks.append({
                "index":     parts[0],
                "timestamp": parts[1],
                "text":      "\n".join(parts[2:]),
            })

    return {
        "preview_blocks": blocks,
        "total_blocks":   result.block_count,
        "filename":       result.filename,
        "surah_name":     result.surah_name_latin,
        "reciter_name":   result.reciter_name,
    }
