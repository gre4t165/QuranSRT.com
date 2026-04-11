import asyncio, httpx
from core.models import RECITERS
from core.srt_generator import TIMING_API

async def test():
    reciter_id = RECITERS['alafasy']['api_id']
    url = TIMING_API.format(reciter_id=reciter_id)
    params = {
        "chapter_number": 1,
        "segments": "true",
    }
    async with httpx.AsyncClient() as c:
        resp = await c.get(url, params=params)
        print(resp.url)
        print(resp.status_code)
        data = resp.json()
        audio_files = data.get("audio_files", [])
        print("Total audio files:", len(audio_files))
        if audio_files:
            print("Sample 1st audio file keys:", audio_files[0].keys())

asyncio.run(test())
