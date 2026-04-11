"""
QuranSRT Core Engine — srt_generator.py

Ini adalah jantung dari seluruh aplikasi QuranSRT.
Modul ini bertanggung jawab untuk:
  1. Fetch timing audio dari API quran.com
  2. Fetch teks Arab, transliterasi, dan terjemahan
  3. Menggabungkan semua data menjadi file SRT yang valid
  4. Mendukung 4 mode: WAQOF (natural pause), VERSE (per ayat), STD (fixed length), TEXT_ONLY (tanpa audio)
  5. Multi-translation: generate beberapa SRT sekaligus (ala EveryPage Studio)

Logika ini adalah evolusi dari versi Streamlit + EveryPage Studio — direfaktor untuk:
  - Async/await (tidak blocking, bisa handle banyak request sekaligus)
  - Error handling yang robust
  - Fallback ke alquran.cloud API jika qurancdn.com tidak punya data
  - Modular: setiap fungsi bisa di-test secara terpisah
"""

import re
import io
import zipfile
import httpx
import asyncio
import textwrap
from typing import Optional
from functools import lru_cache

from core.models import (
    GenerateRequest, SRTResult, MultiGenerateRequest, MultiSRTResult,
    RECITERS, TRANSLATIONS, SURAH_DATA, SRTMode
)


# ── Konstanta ─────────────────────────────────────────────────────────────────

# Base URL untuk audio CDN quran.com — digunakan untuk fetch timing
TIMING_API = "https://api.qurancdn.com/api/qdc/audio/reciters/{reciter_id}/audio_files"

# API untuk fetch teks ayat (Arab + terjemahan)
VERSES_API  = "https://api.qurancdn.com/api/qdc/verses/by_chapter/{surah}"
TAFSIR_API  = "https://api.qurancdn.com/api/qdc/tafsirs/{tafsir_id}/by_chapter/{surah}"

# Fallback: alquran.cloud API (sumber data EveryPage Studio)
CLOUD_API = "http://api.alquran.cloud/v1/ayah/{surah}:{verse}/{edition}"
CLOUD_ARABIC_API = "http://api.alquran.cloud/v1/ayah/{surah}:{verse}/quran-simple"

# Waqof marks — karakter dalam teks Arab yang menandai titik berhenti natural
# Ketika mode WAQOF aktif, subtitle dipecah di titik-titik ini
WAQOF_MARKS = ["۩", "۞", "ۘ", "ۙ", "ۚ", "ۛ", "ۜ", "ۖ", "ۗ"]

# Batas maksimum karakter per baris subtitle (mode STD)
STD_MAX_CHARS = 42

# Durasi per karakter untuk mode TEXT_ONLY (detik)
TEXT_ONLY_CHAR_RATE = 0.13
TEXT_ONLY_MIN_DURATION = 3.0


# ── Fetch Audio Timing ────────────────────────────────────────────────────────

async def fetch_audio_timing(
    reciter_id: int,
    surah: int,
    start_verse: int,
    end_verse: int,
    client: httpx.AsyncClient
) -> dict[int, dict]:
    """
    Fetch timing data dari quran.com CDN untuk reciter dan surah tertentu.

    Timing data berisi informasi kapan (dalam milidetik) setiap segmen audio
    dimulai dan berakhir. Data ini yang menjadi dasar timestamps di file SRT.

    Return dict: {verse_number: {"start_ms": int, "end_ms": int, "segments": list}}
    """
    url = TIMING_API.format(reciter_id=reciter_id)
    params = {
        "chapter_number": surah,
        "segments": "true",    # minta data segmen per kata (untuk mode WAQOF)
    }

    try:
        resp = await client.get(url, params=params, timeout=15.0)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError as e:
        raise RuntimeError(f"Gagal fetch timing audio: {e}") from e

    # Parse response menjadi dict yang mudah diakses per nomor ayat
    timing_map: dict[int, dict] = {}

    audio_files = data.get("audio_files", [])
    for af in audio_files:
        verse_key = af.get("verse_key", "")  # format: "1:1", "2:255", dst
        if not verse_key:
            continue

        _, verse_num_str = verse_key.split(":")
        verse_num = int(verse_num_str)

        if not (start_verse <= verse_num <= end_verse):
            continue

        # Timing dalam milidetik
        timing_map[verse_num] = {
            "start_ms": af.get("timestamp_from", 0),
            "end_ms":   af.get("timestamp_to", 0),
            "segments": af.get("segments", []),   # [[word_idx, start_ms, end_ms], ...]
            "audio_url": af.get("audio_url", ""),
        }

    return timing_map


# ── Generate Text-Only Timing ────────────────────────────────────────────────

def generate_text_only_timing(
    arabic_texts: dict[int, str],
    start_verse: int,
    end_verse: int,
) -> dict[int, dict]:
    """
    Generate timing palsu berdasarkan panjang teks Arab untuk mode TEXT_ONLY.
    Sama seperti logika di EveryPage Studio: durasi = max(3.0, len(text) * 0.13)
    
    Return dict: {verse_number: {"start_ms": int, "end_ms": int, "segments": []}}
    """
    timing_map: dict[int, dict] = {}
    current_ms = 0

    for verse_num in range(start_verse, end_verse + 1):
        arabic = arabic_texts.get(verse_num, "")
        duration_sec = max(TEXT_ONLY_MIN_DURATION, len(arabic) * TEXT_ONLY_CHAR_RATE)
        duration_ms = int(duration_sec * 1000)

        timing_map[verse_num] = {
            "start_ms": current_ms,
            "end_ms":   current_ms + duration_ms,
            "segments": [],
            "audio_url": "",
        }
        current_ms += duration_ms

    return timing_map


# ── Fetch Teks Ayat ───────────────────────────────────────────────────────────

async def fetch_verses(
    surah: int,
    start_verse: int,
    end_verse: int,
    translation_id: Optional[int],
    client: httpx.AsyncClient
) -> dict[int, dict]:
    """
    Fetch teks Arab dan terjemahan dari quran.com API.

    Return dict: {verse_number: {"arabic": str, "translation": str, "transliteration": str}}
    """
    params = {
        "chapter_number": surah,
        "per_page": 300,          # ambil semua ayat sekaligus (max 300 per request)
        "fields": "text_uthmani", # teks Arab dengan harakat penuh (Uthmani)
        "word_fields": "transliteration",
    }

    if translation_id:
        params["translations"] = translation_id

    try:
        resp = await client.get(
            VERSES_API.format(surah=surah),
            params=params,
            timeout=15.0
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError as e:
        raise RuntimeError(f"Gagal fetch teks ayat: {e}") from e

    verses_map: dict[int, dict] = {}

    for verse in data.get("verses", []):
        verse_num = verse.get("verse_number")
        if not (start_verse <= verse_num <= end_verse):
            continue

        # Ambil teks Arab
        arabic = verse.get("text_uthmani", "")

        # Ambil terjemahan (jika ada)
        translation = ""
        translations_list = verse.get("translations", [])
        if translations_list:
            translation = translations_list[0].get("text", "")
            # Bersihkan HTML tag yang kadang ada di response
            translation = re.sub(r"<[^>]+>", "", translation).strip()

        # Ambil transliterasi dari words
        words = verse.get("words", [])
        transliteration = " ".join(
            w.get("transliteration", {}).get("text", "")
            for w in words
            if w.get("char_type_name") != "end"
        ).strip()

        verses_map[verse_num] = {
            "arabic":          arabic,
            "translation":     translation,
            "transliteration": transliteration,
            "verse_key":       verse.get("verse_key", f"{surah}:{verse_num}"),
        }

    return verses_map


# ── Fetch dari AlQuran Cloud (Fallback / EveryPage Studio data source) ───────

async def fetch_verses_cloud(
    surah: int,
    start_verse: int,
    end_verse: int,
    edition: str,
    client: httpx.AsyncClient
) -> dict[int, str]:
    """
    Fetch teks dari api.alquran.cloud — fallback ketika qurancdn.com
    tidak menyediakan terjemahan tertentu. Ini adalah API yang digunakan
    oleh EveryPage Studio.
    
    Return dict: {verse_number: text_string}
    """
    results: dict[int, str] = {}
    
    tasks = []
    for verse_num in range(start_verse, end_verse + 1):
        url = CLOUD_API.format(surah=surah, verse=verse_num, edition=edition)
        tasks.append(_fetch_single_cloud_verse(client, url, verse_num))
    
    fetched = await asyncio.gather(*tasks, return_exceptions=True)
    for item in fetched:
        if isinstance(item, tuple):
            verse_num, text = item
            results[verse_num] = text
    
    return results


async def _fetch_single_cloud_verse(
    client: httpx.AsyncClient,
    url: str,
    verse_num: int
) -> tuple[int, str]:
    """Fetch satu ayat dari alquran.cloud API."""
    try:
        resp = await client.get(url, timeout=10.0)
        if resp.status_code == 200:
            data = resp.json()
            text = data.get("data", {}).get("text", "")
            return (verse_num, text)
    except Exception:
        pass
    return (verse_num, "")


async def fetch_arabic_cloud(
    surah: int,
    start_verse: int,
    end_verse: int,
    client: httpx.AsyncClient
) -> dict[int, str]:
    """Fetch teks Arab dari alquran.cloud (quran-simple edition)."""
    results: dict[int, str] = {}
    
    tasks = []
    for verse_num in range(start_verse, end_verse + 1):
        url = CLOUD_ARABIC_API.format(surah=surah, verse=verse_num)
        tasks.append(_fetch_single_cloud_verse(client, url, verse_num))
    
    fetched = await asyncio.gather(*tasks, return_exceptions=True)
    for item in fetched:
        if isinstance(item, tuple):
            verse_num, text = item
            results[verse_num] = text
    
    return results


# ── Format Timestamp SRT ──────────────────────────────────────────────────────

def ms_to_srt_timestamp(ms: int) -> str:
    """
    Konversi milidetik ke format timestamp SRT.
    Contoh: 63500 → "00:01:03,500"
    """
    ms = max(0, ms)
    hours, remainder = divmod(ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, millis = divmod(remainder, 1_000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def build_srt_block(index: int, start_ms: int, end_ms: int, lines: list[str]) -> str:
    """
    Buat satu blok SRT dari komponen-komponennya.

    Format SRT:
      1
      00:00:01,000 --> 00:00:04,000
      Baris teks pertama
      Baris teks kedua (opsional)

    """
    # Pastikan end selalu lebih besar dari start (minimal 500ms)
    if end_ms <= start_ms:
        end_ms = start_ms + 500

    timestamp = f"{ms_to_srt_timestamp(start_ms)} --> {ms_to_srt_timestamp(end_ms)}"
    text = "\n".join(line for line in lines if line.strip())
    return f"{index}\n{timestamp}\n{text}\n"


# ── Smart Split (dari EveryPage Studio) ──────────────────────────────────────

def smart_split(text: str, total_duration_ms: int, max_chars: int = 120) -> list[dict]:
    """
    Pecah teks panjang menjadi beberapa chunk dengan durasi proporsional.
    Logika sama persis dengan EveryPage Studio smart_split().
    
    Return: list of {"text": str, "start_ms": int, "end_ms": int}
    """
    chunks = textwrap.wrap(text, width=max_chars)
    if not chunks:
        return []
    
    results = []
    current_ms = 0
    total_chars = sum(len(c) for c in chunks)
    
    for i, chunk in enumerate(chunks):
        ratio = len(chunk) / total_chars if total_chars > 0 else 1 / len(chunks)
        chunk_duration = int(total_duration_ms * ratio)
        
        if i == len(chunks) - 1:
            chunk_end = total_duration_ms
        else:
            chunk_end = current_ms + chunk_duration
            
        results.append({
            "text": chunk,
            "start_ms": current_ms,
            "end_ms": chunk_end,
        })
        current_ms = chunk_end
    
    return results


# ── Mode WAQOF ────────────────────────────────────────────────────────────────

def split_by_waqof(
    arabic: str,
    segments: list,
    start_ms: int,
    end_ms: int
) -> list[dict]:
    """
    Pecah satu ayat menjadi beberapa subtitle berdasarkan tanda waqof.

    Tanda waqof (seperti ۖ ۗ ۘ) menandai titik berhenti natural dalam bacaan
    Al-Quran — seperti koma atau titik dalam bahasa biasa. Mode ini menghasilkan
    subtitle yang lebih natural mengikuti irama bacaan.

    Return: list of {"text": str, "start_ms": int, "end_ms": int}
    """
    # Cari posisi waqof marks dalam string
    split_points = []
    for i, char in enumerate(arabic):
        if char in WAQOF_MARKS:
            split_points.append(i + 1)  # split setelah tanda waqof

    if not split_points:
        # Tidak ada waqof mark — kembalikan sebagai satu segment
        return [{"text": arabic, "start_ms": start_ms, "end_ms": end_ms}]

    # Pecah teks di titik-titik waqof
    parts = []
    prev = 0
    for point in split_points:
        parts.append(arabic[prev:point].strip())
        prev = point
    # Tambahkan sisa teks setelah waqof terakhir
    if prev < len(arabic):
        remaining = arabic[prev:].strip()
        if remaining:
            parts.append(remaining)

    # Distribusikan timing secara proporsional berdasarkan panjang teks
    total_chars = sum(len(p) for p in parts)
    total_duration = end_ms - start_ms

    result = []
    current_ms = start_ms
    for i, part in enumerate(parts):
        if not part:
            continue
        proportion = len(part) / total_chars if total_chars > 0 else 1 / len(parts)
        duration = int(total_duration * proportion)
        part_end = current_ms + duration if i < len(parts) - 1 else end_ms
        result.append({
            "text": part,
            "start_ms": current_ms,
            "end_ms": part_end,
        })
        current_ms = part_end

    return result


# ── Mode STD: Split panjang teks ─────────────────────────────────────────────

def split_long_text(text: str, max_chars: int = STD_MAX_CHARS) -> list[str]:
    """
    Pecah teks panjang menjadi beberapa baris dengan batas karakter per baris.
    Digunakan untuk terjemahan yang panjang agar tidak meluap di layar video.
    """
    if len(text) <= max_chars:
        return [text]

    words = text.split()
    lines = []
    current_line = []
    current_len = 0

    for word in words:
        word_len = len(word) + (1 if current_line else 0)
        if current_len + word_len > max_chars and current_line:
            lines.append(" ".join(current_line))
            current_line = [word]
            current_len = len(word)
        else:
            current_line.append(word)
            current_len += word_len

    if current_line:
        lines.append(" ".join(current_line))

    return lines


# ── Generator Utama ───────────────────────────────────────────────────────────

async def generate_srt(request: GenerateRequest) -> SRTResult:
    """
    Fungsi utama: generate file SRT dari parameter request.

    Alur kerja:
      1. Fetch timing audio dan teks ayat secara paralel (lebih cepat)
      2. Gabungkan data timing + teks per ayat
      3. Buat blok SRT sesuai mode yang dipilih
      4. Return hasil sebagai string SRT + metadata
    
    Mode TEXT_ONLY: tidak fetch timing audio — timing berdasarkan panjang teks
    """
    surah_info = SURAH_DATA[request.surah]
    is_text_only = request.mode == SRTMode.TEXT_ONLY

    # Resolve reciter (bisa None untuk TEXT_ONLY)
    reciter = RECITERS.get(request.reciter_id) if not is_text_only else None
    reciter_name = reciter["name"] if reciter else "Text Only"

    # Resolve translation ID
    translation_id = None
    show_arabic    = request.show_arabic
    show_translation = False
    show_transliteration = False

    if request.translation_key == "transliteration":
        show_transliteration = True
    elif request.translation_key and request.translation_key != "none":
        translation_config = TRANSLATIONS.get(request.translation_key)
        if translation_config:
            translation_id = translation_config["id"]
            show_translation = True

    # Fetch data
    async with httpx.AsyncClient() as client:
        # Always fetch verses
        verses_task = fetch_verses(
            surah=request.surah,
            start_verse=request.start_verse,
            end_verse=request.end_verse,
            translation_id=translation_id,
            client=client,
        )

        if is_text_only:
            # TEXT_ONLY: hanya fetch teks, timing akan digenerate
            verses_map = await verses_task
            
            # Generate timing berdasarkan panjang teks Arab
            arabic_texts = {v: data["arabic"] for v, data in verses_map.items()}
            timing_map = generate_text_only_timing(
                arabic_texts, request.start_verse, request.end_verse
            )
        else:
            # Normal mode: fetch timing + teks secara paralel
            timing_task = fetch_audio_timing(
                reciter_id=reciter["api_id"],
                surah=request.surah,
                start_verse=request.start_verse,
                end_verse=request.end_verse,
                client=client,
            )
            timing_map, verses_map = await asyncio.gather(timing_task, verses_task)

        # Fallback: jika terjemahan tidak tersedia di qurancdn, coba alquran.cloud
        if show_translation and translation_id is None:
            translation_config = TRANSLATIONS.get(request.translation_key, {})
            cloud_id = translation_config.get("cloud_id")
            if cloud_id:
                cloud_translations = await fetch_verses_cloud(
                    surah=request.surah,
                    start_verse=request.start_verse,
                    end_verse=request.end_verse,
                    edition=cloud_id,
                    client=client,
                )
                for v_num, text in cloud_translations.items():
                    if v_num in verses_map:
                        verses_map[v_num]["translation"] = text
                    else:
                        verses_map[v_num] = {
                            "arabic": "", "translation": text,
                            "transliteration": "", "verse_key": f"{request.surah}:{v_num}",
                        }

    # Build SRT
    srt_blocks = []
    block_index = 1

    for verse_num in range(request.start_verse, request.end_verse + 1):
        timing = timing_map.get(verse_num)
        verse  = verses_map.get(verse_num)

        if not timing or not verse:
            continue

        start_ms = timing["start_ms"]
        end_ms   = timing["end_ms"]
        arabic   = verse["arabic"]
        segments = timing.get("segments", [])

        effective_mode = request.mode
        if is_text_only:
            effective_mode = SRTMode.VERSE  # TEXT_ONLY internally uses VERSE layout

        if effective_mode == SRTMode.WAQOF:
            # Pecah per tanda waqof
            waqof_parts = split_by_waqof(arabic, segments, start_ms, end_ms)
            for part in waqof_parts:
                lines = []
                if show_arabic:
                    lines.append(part["text"])
                if show_transliteration:
                    # Untuk waqof, tampilkan transliterasi keseluruhan ayat
                    lines.extend(split_long_text(verse["transliteration"]))
                if show_translation:
                    lines.extend(split_long_text(verse["translation"]))

                srt_blocks.append(
                    build_srt_block(block_index, part["start_ms"], part["end_ms"], lines)
                )
                block_index += 1

        elif effective_mode in (SRTMode.VERSE, SRTMode.TEXT_ONLY):
            # Satu ayat = satu subtitle
            lines = []
            if show_arabic:
                lines.append(arabic)
            if show_transliteration:
                lines.extend(split_long_text(verse["transliteration"]))
            if show_translation:
                lines.extend(split_long_text(verse["translation"]))

            srt_blocks.append(build_srt_block(block_index, start_ms, end_ms, lines))
            block_index += 1

        else:  # STD — Standard, terjemahan dengan fixed line length
            lines = []
            if show_arabic:
                lines.append(arabic)
            if show_transliteration:
                lines.extend(split_long_text(verse["transliteration"], STD_MAX_CHARS))
            if show_translation:
                lines.extend(split_long_text(verse["translation"], STD_MAX_CHARS))

            srt_blocks.append(build_srt_block(block_index, start_ms, end_ms, lines))
            block_index += 1

    srt_content = "\n".join(srt_blocks)

    # Buat nama file yang deskriptif
    surah_name  = surah_info["name_simple"].replace(" ", "_")
    verse_range = f"{request.start_verse}-{request.end_verse}"
    filename = f"QuranSRT_{request.surah}_{surah_name}_{verse_range}_{reciter_name.replace(' ', '_')}.srt"

    # Ambil URL audio (kosong jika TEXT_ONLY)
    audio_base_url = reciter.get("audio_url_pattern", "") if reciter else ""

    return SRTResult(
        srt_content=srt_content,
        filename=filename,
        block_count=block_index - 1,
        surah_name=surah_info["name_arabic"],
        surah_name_latin=surah_info["name_simple"],
        audio_base_url=audio_base_url,
        reciter_name=reciter_name,
    )


# ── Multi-Translation Generator (ala EveryPage Studio) ───────────────────────

async def generate_multi_srt(request: MultiGenerateRequest) -> MultiSRTResult:
    """
    Generate beberapa file SRT sekaligus — satu per terjemahan yang dipilih,
    plus satu SRT khusus teks Arab (00_ARABIC.srt).
    
    Logika ini mereplikasi fitur utama EveryPage Studio: pengguna memilih
    beberapa bahasa, lalu setiap bahasa mendapat file SRT-nya sendiri.
    """
    surah_info = SURAH_DATA[request.surah]
    is_text_only = request.mode == SRTMode.TEXT_ONLY

    reciter = RECITERS.get(request.reciter_id) if not is_text_only else None
    reciter_name = reciter["name"] if reciter else "Text Only"

    async with httpx.AsyncClient() as client:
        # 1. Fetch Arabic text (selalu dibutuhkan)
        verses_map = await fetch_verses(
            surah=request.surah,
            start_verse=request.start_verse,
            end_verse=request.end_verse,
            translation_id=None,
            client=client,
        )

        # 2. Fetch timing
        if is_text_only:
            arabic_texts = {v: data["arabic"] for v, data in verses_map.items()}
            timing_map = generate_text_only_timing(
                arabic_texts, request.start_verse, request.end_verse
            )
        else:
            timing_map = await fetch_audio_timing(
                reciter_id=reciter["api_id"],
                surah=request.surah,
                start_verse=request.start_verse,
                end_verse=request.end_verse,
                client=client,
            )

        # 3. Fetch translations secara paralel untuk semua bahasa yang dipilih
        translation_results: dict[str, dict[int, str]] = {}
        
        for t_key in request.translation_keys:
            t_config = TRANSLATIONS.get(t_key)
            if not t_config:
                continue
            
            if t_key == "transliteration":
                # Transliterasi sudah ada di verses_map
                translation_results[t_key] = {
                    v: data.get("transliteration", "") for v, data in verses_map.items()
                }
            elif t_config.get("id"):
                # Fetch dari qurancdn.com
                t_verses = await fetch_verses(
                    surah=request.surah,
                    start_verse=request.start_verse,
                    end_verse=request.end_verse,
                    translation_id=t_config["id"],
                    client=client,
                )
                translation_results[t_key] = {
                    v: data.get("translation", "") for v, data in t_verses.items()
                }
            elif t_config.get("cloud_id"):
                # Fallback: fetch dari alquran.cloud
                cloud_texts = await fetch_verses_cloud(
                    surah=request.surah,
                    start_verse=request.start_verse,
                    end_verse=request.end_verse,
                    edition=t_config["cloud_id"],
                    client=client,
                )
                translation_results[t_key] = cloud_texts

    # 4. Build Arabic SRT
    arabic_blocks = []
    block_index = 1

    for verse_num in range(request.start_verse, request.end_verse + 1):
        timing = timing_map.get(verse_num)
        verse = verses_map.get(verse_num)
        if not timing or not verse:
            continue

        start_ms = timing["start_ms"]
        end_ms = timing["end_ms"]
        arabic = verse["arabic"]
        segments = timing.get("segments", [])

        effective_mode = request.mode
        if is_text_only:
            effective_mode = SRTMode.VERSE

        if effective_mode == SRTMode.WAQOF:
            parts = split_by_waqof(arabic, segments, start_ms, end_ms)
            for part in parts:
                arabic_blocks.append(
                    build_srt_block(block_index, part["start_ms"], part["end_ms"], [part["text"]])
                )
                block_index += 1
        else:
            arabic_blocks.append(
                build_srt_block(block_index, start_ms, end_ms, [arabic])
            )
            block_index += 1

    arabic_srt = "\n".join(arabic_blocks)
    surah_name = surah_info["name_simple"].replace(" ", "_")
    verse_range = f"{request.start_verse}-{request.end_verse}"
    arabic_filename = f"00_ARABIC_S{request.surah}_{surah_name}_{verse_range}.srt"

    # 5. Build per-translation SRT files
    files = []
    for t_key in request.translation_keys:
        t_config = TRANSLATIONS.get(t_key)
        if not t_config:
            continue

        t_texts = translation_results.get(t_key, {})
        t_blocks = []
        t_block_index = 1

        for verse_num in range(request.start_verse, request.end_verse + 1):
            timing = timing_map.get(verse_num)
            verse = verses_map.get(verse_num)
            if not timing or not verse:
                continue

            start_ms = timing["start_ms"]
            end_ms = timing["end_ms"]
            arabic = verse["arabic"]
            segments = timing.get("segments", [])
            translation_text = t_texts.get(verse_num, "")

            effective_mode = request.mode
            if is_text_only:
                effective_mode = SRTMode.VERSE

            if effective_mode == SRTMode.WAQOF:
                parts = split_by_waqof(arabic, segments, start_ms, end_ms)
                t_chunks = textwrap.wrap(translation_text, width=90) if translation_text else []
                
                for i, part in enumerate(parts):
                    lines = []
                    if request.show_arabic:
                        lines.append(part["text"])
                    # Split translation across waqof segments
                    chunk_text = ""
                    if i < len(t_chunks):
                        chunk_text = t_chunks[i]
                    elif i == len(parts) - 1 and len(t_chunks) > len(parts):
                        chunk_text = " ".join(t_chunks[i:])
                    if chunk_text:
                        lines.append(chunk_text)
                    
                    t_blocks.append(
                        build_srt_block(t_block_index, part["start_ms"], part["end_ms"], lines)
                    )
                    t_block_index += 1
            else:
                lines = []
                if request.show_arabic:
                    lines.append(arabic)
                if translation_text:
                    lines.extend(split_long_text(translation_text))
                
                t_blocks.append(
                    build_srt_block(t_block_index, start_ms, end_ms, lines)
                )
                t_block_index += 1

        t_srt_content = "\n".join(t_blocks)
        
        # Clean filename
        clean_name = "".join(
            c for c in t_config["name"] if c.isalnum() or c in (' ', '_', '-')
        ).strip().replace(" ", "_")
        t_filename = f"01_{clean_name}_S{request.surah}_{surah_name}_{verse_range}.srt"

        files.append({
            "filename": t_filename,
            "srt_content": t_srt_content,
            "translation_name": t_config["name"],
            "translation_key": t_key,
        })

    return MultiSRTResult(
        files=files,
        arabic_srt=arabic_srt,
        arabic_filename=arabic_filename,
        surah_name=surah_info["name_arabic"],
        surah_name_latin=surah_info["name_simple"],
    )


# ── Bundle ZIP (SRT + MP3) ────────────────────────────────────────────────────

async def generate_zip(request: GenerateRequest) -> tuple[bytes, str]:
    """
    Generate ZIP berisi file SRT + semua file MP3 per ayat.

    Diunduh sebagai satu paket sehingga pengguna langsung punya
    subtitle + audio yang sudah tersinkronisasi.
    """
    # Generate SRT terlebih dahulu
    result = await generate_srt(request)

    reciter = RECITERS.get(request.reciter_id)
    audio_pattern = reciter.get("audio_url_pattern", "") if reciter else ""

    # Kumpulkan URL audio untuk setiap ayat (skip jika TEXT_ONLY)
    audio_urls = []
    if request.mode != SRTMode.TEXT_ONLY and audio_pattern:
        for verse_num in range(request.start_verse, request.end_verse + 1):
            url = audio_pattern.format(
                surah=str(request.surah).zfill(3),
                verse=str(verse_num).zfill(3),
            )
            audio_urls.append((verse_num, url))

    # Download semua audio secara paralel
    zip_buffer = io.BytesIO()

    if audio_urls:
        async with httpx.AsyncClient() as client:
            audio_tasks = [
                _download_audio(client, verse_num, url)
                for verse_num, url in audio_urls
            ]
            audio_results = await asyncio.gather(*audio_tasks, return_exceptions=True)
    else:
        audio_results = []

    # Tulis ke ZIP
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Tulis file SRT
        zf.writestr(result.filename, result.srt_content)

        # Tulis file MP3 per ayat
        for verse_num, audio_data in zip(
            [v for v, _ in audio_urls], audio_results
        ):
            if isinstance(audio_data, Exception) or audio_data is None:
                continue  # Skip ayat yang gagal di-download
            mp3_filename = f"audio/{str(verse_num).zfill(3)}.mp3"
            zf.writestr(mp3_filename, audio_data)

        # Tambahkan README singkat dalam ZIP
        readme = _build_zip_readme(result, request)
        zf.writestr("README.txt", readme)

    zip_filename = result.filename.replace(".srt", ".zip")
    return zip_buffer.getvalue(), zip_filename


# ── Multi-Translation ZIP ────────────────────────────────────────────────────

async def generate_multi_zip(request: MultiGenerateRequest) -> tuple[bytes, str]:
    """
    Generate ZIP berisi semua file SRT (satu per terjemahan + Arab) + MP3.
    Replikasi output EveryPage Studio dalam format web.
    """
    result = await generate_multi_srt(request)
    
    is_text_only = request.mode == SRTMode.TEXT_ONLY
    reciter = RECITERS.get(request.reciter_id) if not is_text_only else None
    audio_pattern = reciter.get("audio_url_pattern", "") if reciter else ""
    
    # Kumpulkan URL audio
    audio_urls = []
    if not is_text_only and audio_pattern:
        for verse_num in range(request.start_verse, request.end_verse + 1):
            url = audio_pattern.format(
                surah=str(request.surah).zfill(3),
                verse=str(verse_num).zfill(3),
            )
            audio_urls.append((verse_num, url))
    
    # Download audio
    if audio_urls:
        async with httpx.AsyncClient() as client:
            audio_tasks = [
                _download_audio(client, v, url) for v, url in audio_urls
            ]
            audio_results = await asyncio.gather(*audio_tasks, return_exceptions=True)
    else:
        audio_results = []
    
    # Build ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Arabic SRT
        zf.writestr(result.arabic_filename, result.arabic_srt)
        
        # Translation SRTs
        for f in result.files:
            zf.writestr(f["filename"], f["srt_content"])

        # Audio MP3s
        for verse_num, audio_data in zip(
            [v for v, _ in audio_urls], audio_results
        ):
            if isinstance(audio_data, Exception) or audio_data is None:
                continue
            mp3_filename = f"audio/{str(verse_num).zfill(3)}.mp3"
            zf.writestr(mp3_filename, audio_data)
        
        # README
        surah_info = SURAH_DATA[request.surah]
        lang_list = ", ".join(f["translation_name"] for f in result.files)
        readme = f"""QuranSRT — Paket Multi-Bahasa Subtitle Al-Quran
================================================

Surah   : {result.surah_name} ({result.surah_name_latin})
Ayat    : {request.start_verse} – {request.end_verse}
Qari    : {reciter["name"] if reciter else "Text Only"}
Bahasa  : {lang_list}
Mode    : {request.mode}
File    : {len(result.files) + 1} file SRT (1 Arab + {len(result.files)} terjemahan)

Dibuat dengan QuranSRT — https://quransrt.com
"""
        zf.writestr("README.txt", readme)
    
    surah_name = surah_info["name_simple"].replace(" ", "_")
    zip_filename = f"QuranSRT_Multi_S{request.surah}_{surah_name}.zip"
    return zip_buffer.getvalue(), zip_filename


async def _download_audio(
    client: httpx.AsyncClient,
    verse_num: int,
    url: str
) -> Optional[bytes]:
    """Download satu file MP3. Return None jika gagal."""
    try:
        resp = await client.get(url, timeout=20.0)
        resp.raise_for_status()
        return resp.content
    except Exception:
        return None


def _build_zip_readme(result: SRTResult, request: GenerateRequest) -> str:
    """Buat file README untuk ZIP yang menjelaskan isi paket."""
    return f"""QuranSRT — Paket Subtitle & Audio Al-Quran
==========================================

Surah   : {result.surah_name} ({result.surah_name_latin})
Ayat    : {request.start_verse} – {request.end_verse}
Reciter : {result.reciter_name}
Mode    : {request.mode}
File SRT: {result.filename}
Total   : {result.block_count} blok subtitle

Cara Penggunaan
---------------
1. Import file .srt ke software editing video kamu
   (CapCut, Premiere Pro, DaVinci Resolve, dll)
2. File MP3 ada di folder /audio/ — urutkan sesuai nomor ayat
3. Sinkronisasi SRT dengan audio menggunakan timestamps yang ada

Dibuat dengan QuranSRT — https://quransrt.com
"""
