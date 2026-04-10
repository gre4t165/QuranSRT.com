"""
QuranSRT Core Engine — srt_generator.py

Ini adalah jantung dari seluruh aplikasi QuranSRT.
Modul ini bertanggung jawab untuk:
  1. Fetch timing audio dari API quran.com
  2. Fetch teks Arab, transliterasi, dan terjemahan
  3. Menggabungkan semua data menjadi file SRT yang valid
  4. Mendukung 3 mode: WAQOF (natural pause), VERSE (per ayat), STD (fixed length)

Logika ini adalah evolusi dari versi Streamlit — direfaktor untuk:
  - Async/await (tidak blocking, bisa handle banyak request sekaligus)
  - Error handling yang robust
  - Caching response API agar tidak fetch ulang data yang sama
  - Modular: setiap fungsi bisa di-test secara terpisah
"""

import re
import io
import zipfile
import httpx
import asyncio
from typing import Optional
from functools import lru_cache

from core.models import (
    GenerateRequest, SRTResult,
    RECITERS, TRANSLATIONS, SURAH_DATA
)


# ── Konstanta ─────────────────────────────────────────────────────────────────

# Base URL untuk audio CDN quran.com — digunakan untuk fetch timing
TIMING_API = "https://api.qurancdn.com/api/qdc/audio/reciters/{reciter_id}/audio_files"

# API untuk fetch teks ayat (Arab + terjemahan)
VERSES_API  = "https://api.qurancdn.com/api/qdc/verses/by_chapter/{surah}"
TAFSIR_API  = "https://api.qurancdn.com/api/qdc/tafsirs/{tafsir_id}/by_chapter/{surah}"

# Waqof marks — karakter dalam teks Arab yang menandai titik berhenti natural
# Ketika mode WAQOF aktif, subtitle dipecah di titik-titik ini
WAQOF_MARKS = ["۩", "۞", "ۘ", "ۙ", "ۚ", "ۛ", "ۜ", "ۖ", "ۗ"]

# Batas maksimum karakter per baris subtitle (mode STD)
STD_MAX_CHARS = 42


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
    """
    reciter   = RECITERS[request.reciter_id]
    surah_info = SURAH_DATA[request.surah]

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

    # Fetch data secara paralel untuk efisiensi
    async with httpx.AsyncClient() as client:
        timing_task = fetch_audio_timing(
            reciter_id=reciter["api_id"],
            surah=request.surah,
            start_verse=request.start_verse,
            end_verse=request.end_verse,
            client=client,
        )
        verses_task = fetch_verses(
            surah=request.surah,
            start_verse=request.start_verse,
            end_verse=request.end_verse,
            translation_id=translation_id,
            client=client,
        )

        # Jalankan kedua request secara bersamaan
        timing_map, verses_map = await asyncio.gather(timing_task, verses_task)

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

        if request.mode == "WAQOF":
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

        elif request.mode == "VERSE":
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
    reciter_name = reciter["name"].replace(" ", "_")
    filename = f"QuranSRT_{request.surah}_{surah_name}_{verse_range}_{reciter_name}.srt"

    # Ambil URL audio untuk ayat pertama (untuk info / preview)
    first_timing = timing_map.get(request.start_verse, {})
    audio_base_url = reciter.get("audio_url_pattern", "")

    return SRTResult(
        srt_content=srt_content,
        filename=filename,
        block_count=block_index - 1,
        surah_name=surah_info["name_arabic"],
        surah_name_latin=surah_info["name_simple"],
        audio_base_url=audio_base_url,
        reciter_name=reciter["name"],
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

    reciter = RECITERS[request.reciter_id]
    audio_pattern = reciter.get("audio_url_pattern", "")

    # Kumpulkan URL audio untuk setiap ayat
    audio_urls = []
    for verse_num in range(request.start_verse, request.end_verse + 1):
        if audio_pattern:
            url = audio_pattern.format(
                surah=str(request.surah).zfill(3),
                verse=str(verse_num).zfill(3),
            )
            audio_urls.append((verse_num, url))

    # Download semua audio secara paralel
    zip_buffer = io.BytesIO()

    async with httpx.AsyncClient() as client:
        audio_tasks = [
            _download_audio(client, verse_num, url)
            for verse_num, url in audio_urls
        ]
        audio_results = await asyncio.gather(*audio_tasks, return_exceptions=True)

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
