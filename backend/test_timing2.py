import asyncio, httpx, json
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
        data = resp.json()
        audio_files = data.get("audio_files", [])
        if audio_files:
            af = audio_files[0]
            print(json.dumps(af, indent=2))

asyncio.run(test())
