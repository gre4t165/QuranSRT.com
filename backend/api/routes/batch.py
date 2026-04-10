"""
QuranSRT — Route: /api/batch  (Fitur Pro)

Batch generate: proses banyak surah/ayat sekaligus dalam satu request.
Menggunakan Server-Sent Events (SSE) untuk streaming progress ke frontend
sehingga pengguna bisa melihat proses berjalan secara real-time,
bukan menunggu di layar kosong.
"""

import json
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from core.models import BatchRequest, GenerateRequest, SURAH_DATA
from core.srt_generator import generate_srt

router = APIRouter()


@router.post("/generate")
async def batch_generate(request: BatchRequest):
    """
    Generate SRT untuk banyak surah/ayat sekaligus.
    Response berupa Server-Sent Events — frontend menerima update
    per item yang selesai, bukan menunggu semua selesai.

    Format SSE event:
      data: {"type": "progress", "index": 1, "total": 5, "filename": "..."}
      data: {"type": "done", "files": [...]}
      data: {"type": "error", "message": "..."}
    """

    async def event_stream():
        results = []
        total = len(request.items)

        for i, item in enumerate(request.items):
            # Validasi item
            surah_info = SURAH_DATA.get(item.surah)
            if not surah_info or item.end_verse > surah_info["verse_count"]:
                event = {
                    "type":    "skip",
                    "index":   i + 1,
                    "total":   total,
                    "reason":  f"Surah {item.surah} ayat {item.end_verse} tidak valid",
                }
                yield f"data: {json.dumps(event)}\n\n"
                continue

            # Buat GenerateRequest dari BatchItem
            gen_request = GenerateRequest(
                surah=item.surah,
                start_verse=item.start_verse,
                end_verse=item.end_verse,
                reciter_id=request.reciter_id,
                translation_key=request.translation_key,
                mode=request.mode,
                show_arabic=request.show_arabic,
                include_mp3=request.include_mp3,
            )

            try:
                result = await generate_srt(gen_request)

                results.append({
                    "filename":    result.filename,
                    "srt_content": result.srt_content,
                    "block_count": result.block_count,
                    "surah_name":  result.surah_name_latin,
                })

                # Kirim progress update ke frontend
                progress_event = {
                    "type":        "progress",
                    "index":       i + 1,
                    "total":       total,
                    "filename":    result.filename,
                    "block_count": result.block_count,
                }
                yield f"data: {json.dumps(progress_event)}\n\n"

            except Exception as e:
                error_event = {
                    "type":    "error",
                    "index":   i + 1,
                    "total":   total,
                    "message": str(e),
                }
                yield f"data: {json.dumps(error_event)}\n\n"

            # Jeda kecil agar tidak membanjiri API qurancdn
            await asyncio.sleep(0.3)

        # Semua item selesai — kirim event final
        done_event = {
            "type":        "done",
            "total_files": len(results),
            "files":       results,
        }
        yield f"data: {json.dumps(done_event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # penting untuk Nginx agar SSE tidak di-buffer
        }
    )
