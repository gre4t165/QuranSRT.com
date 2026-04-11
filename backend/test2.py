import asyncio, httpx
from core.models import RECITERS
from core.srt_generator import fetch_audio_timing, fetch_verses

async def test():
    async with httpx.AsyncClient() as c:
        timing = await fetch_audio_timing(RECITERS['alafasy']['api_id'], 1, 1, 7, c)
        verses = await fetch_verses(1, 1, 7, 33, c)
        print('Timing len:', len(timing))
        print('Verses len:', len(verses))
        print('Timing keys:', list(timing.keys()))
        print('Verses keys:', list(verses.keys()))

asyncio.run(test())
