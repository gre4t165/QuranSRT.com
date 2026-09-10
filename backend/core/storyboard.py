"""
QuranSRT — Storyboard Creator Engine (core/storyboard.py)

Orkestrasi tiga pipeline otomatis untuk AI Storyboard Creator:

  PIPELINE 1 — GPT Picture & Story Generation
      Premis/transkrip  ->  GPT (JSON terstruktur)  ->  daftar scene
      Tiap scene: narasi, prompt_gambar (+ global style tag), timestamp.
      Opsional: render gambar tiap scene (image model).

  PIPELINE 2 — ElevenLabs Voiceover
      Teks narasi  ->  ElevenLabs TTS  ->  audio MP3
      Hitung durasi audio  ->  update duration_seconds panel
      Upload audio ke cloud storage  ->  attach URL ke panel.

  PIPELINE 3 — Video Timeline Flow
      Agregasi image_url + voiceover_audio_url semua panel
      ->  FFmpeg  ->  satu MP4 tersinkronisasi  ->  upload ke storage.

Konvensi modul (mengikuti srt_generator.py):
  - async/await, httpx sebagai HTTP client
  - setiap kegagalan eksternal dilempar sebagai RuntimeError dengan pesan
    ramah pengguna (bahasa Indonesia); route menerjemahkannya ke HTTP error
  - tidak ada kredensial yang di-hardcode — semua dari core.config.settings
"""

import os
import re
import json
import uuid
import base64
import shutil
import asyncio
import logging
import tempfile
import subprocess

import httpx

from core.config import settings
from core.models import (
    StoryboardScene,
    StoryboardPanel,
    StoryboardProject,
    VoiceoverResult,
)

logger = logging.getLogger(__name__)

# ── Konstanta ──────────────────────────────────────────────────────────────────

# Durasi default (detik) sebuah panel bila narasi kosong / durasi audio tak diketahui.
DEFAULT_PANEL_DURATION = 4.0

# Timeout longgar untuk panggilan LLM (bisa lambat saat beban tinggi).
LLM_TIMEOUT = 90.0
TTS_TIMEOUT = 120.0
IMAGE_TIMEOUT = 120.0
DOWNLOAD_TIMEOUT = 60.0


# ── Estimasi Durasi Narasi ──────────────────────────────────────────────────────

def estimate_narration_seconds(text: str, reading_speed_wpm: int = 150) -> float:
    """Perkiraan durasi baca sebuah teks (detik) berdasarkan kecepatan baca.

    Dipakai untuk estimasi timestamp awal (sebelum voiceover asli tersedia).
    """
    words = len([w for w in re.split(r"\s+", text.strip()) if w])
    if words == 0 or reading_speed_wpm <= 0:
        return DEFAULT_PANEL_DURATION
    seconds = (words / reading_speed_wpm) * 60.0
    return round(max(seconds, 1.5), 2)


def reflow_timestamps(panels: list[StoryboardPanel], reading_speed_wpm: int = 150) -> None:
    """Susun ulang timestamp panel agar kronologis & tidak tumpang tindih.

    Memakai durasi audio asli bila sudah ada (duration_seconds > 0), jika belum
    pakai estimasi dari panjang narasi. Mutasi list panel secara in-place.
    """
    cursor = 0.0
    for panel in panels:
        panel.timestamp = round(cursor, 2)
        dur = panel.duration_seconds or estimate_narration_seconds(
            panel.narasi, reading_speed_wpm
        )
        cursor += dur


# ── Cloud Storage (Supabase Storage) ─────────────────────────────────────────────

async def upload_to_storage(
    data: bytes,
    path: str,
    content_type: str,
    client: httpx.AsyncClient | None = None,
) -> str:
    """Upload bytes ke Supabase Storage bucket dan kembalikan URL publik.

    `path` adalah path relatif dalam bucket, mis. "proj_ab12/audio/panel_1.mp3".
    Melempar RuntimeError (pesan ramah) bila storage belum dikonfigurasi / gagal.
    """
    settings.require_storage()

    bucket = settings.STORAGE_BUCKET
    base = settings.SUPABASE_URL.rstrip("/")
    upload_url = f"{base}/storage/v1/object/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": content_type,
        # Timpa bila file dengan path sama sudah ada (mis. regenerasi panel).
        "x-upsert": "true",
    }

    owns_client = client is None
    client = client or httpx.AsyncClient()
    try:
        resp = await client.post(upload_url, content=data, headers=headers, timeout=DOWNLOAD_TIMEOUT)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise RuntimeError(f"Gagal mengunggah aset ke penyimpanan cloud: {e}") from e
    finally:
        if owns_client:
            await client.aclose()

    # URL publik Supabase Storage.
    return f"{base}/storage/v1/object/public/{bucket}/{path}"


async def _download_bytes(client: httpx.AsyncClient, url: str) -> bytes:
    """Unduh konten biner dari URL (aset storyboard)."""
    try:
        resp = await client.get(url, timeout=DOWNLOAD_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
        return resp.content
    except httpx.HTTPError as e:
        raise RuntimeError(f"Gagal mengunduh aset: {url} ({e})") from e


# ── Durasi Audio ─────────────────────────────────────────────────────────────────

def _probe_duration_seconds(file_path: str) -> float | None:
    """Hitung durasi audio via ffprobe (paling akurat). None bila tidak tersedia."""
    if not shutil.which(settings.FFPROBE_BIN):
        return None
    try:
        out = subprocess.run(
            [
                settings.FFPROBE_BIN, "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                file_path,
            ],
            capture_output=True, text=True, timeout=30,
        )
        if out.returncode == 0 and out.stdout.strip():
            return round(float(out.stdout.strip()), 3)
    except (ValueError, subprocess.SubprocessError):
        return None
    return None


def _mutagen_duration_seconds(file_path: str) -> float | None:
    """Fallback durasi via mutagen (pure-python, tanpa ffprobe)."""
    try:
        from mutagen import File as MutagenFile  # import lokal — dependency opsional
        audio = MutagenFile(file_path)
        if audio is not None and audio.info and audio.info.length:
            return round(float(audio.info.length), 3)
    except Exception:  # pragma: no cover - best-effort fallback
        return None
    return None


def calculate_audio_duration(audio_bytes: bytes, suffix: str = ".mp3") -> float:
    """Hitung durasi file audio secara programatik.

    Urutan usaha: ffprobe (akurat) -> mutagen (fallback) -> estimasi bitrate.
    Selalu mengembalikan angka > 0 agar sinkronisasi timeline tidak pernah 0.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(audio_bytes)
        tmp.flush()
        tmp.close()

        duration = _probe_duration_seconds(tmp.name) or _mutagen_duration_seconds(tmp.name)
        if duration and duration > 0:
            return duration

        # Estimasi kasar terakhir: asumsi 128 kbps MP3 (16 KB/detik).
        return round(max(len(audio_bytes) / 16000.0, DEFAULT_PANEL_DURATION), 2)
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


# ─────────────────────────────────────────────────────────────────────────────────
# PIPELINE 1 — GPT Picture & Story Generation
# ─────────────────────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are an expert storyboard director and visual scriptwriter. You turn a raw \
story premise or transcript into a chronological storyboard for a short narrated \
video.

Rules:
- Break the topic into clear, chronological scenes (one beat per scene).
- Keep narration concise, impactful, and in the SAME language as the user input.
- For every scene return exactly these fields:
  - "narasi": a single concise, impactful narration line for the voiceover.
  - "prompt_gambar": a highly detailed visual description of the scene for an \
image-generation model (subject, composition, setting, lighting, mood). Do NOT \
include the global style tag yourself; it is appended automatically.
  - "timestamp": estimated start position in SECONDS on the timeline, based on a \
reading speed of about {wpm} words per minute. The first scene starts at 0 and \
timestamps must be strictly increasing.
- Produce at most {max_scenes} scenes.

Return ONLY a JSON object of the form:
{{ "scenes": [ {{ "narasi": "...", "prompt_gambar": "...", "timestamp": 0 }} ] }}
No markdown, no commentary."""


def _parse_scenes_payload(raw: str, style_tag: str) -> list[StoryboardScene]:
    """Parse JSON dari LLM menjadi list StoryboardScene, menempelkan style tag.

    Toleran terhadap pembungkus ```json dan variasi bentuk (array / {scenes:[]}).
    """
    text = raw.strip()
    # Bersihkan code fence bila model menyertakannya.
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", text).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            "Respons AI tidak dalam format JSON yang valid. Coba lagi."
        ) from e

    # Terima {"scenes": [...]}, {"storyboard": [...]}, atau langsung [...].
    if isinstance(data, dict):
        items = data.get("scenes") or data.get("storyboard") or data.get("panels") or []
    elif isinstance(data, list):
        items = data
    else:
        items = []

    if not items:
        raise RuntimeError("AI tidak menghasilkan scene apa pun. Coba perjelas premis.")

    scenes: list[StoryboardScene] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        narasi = str(item.get("narasi") or item.get("narration") or "").strip()
        prompt = str(item.get("prompt_gambar") or item.get("image_prompt") or "").strip()
        if not narasi and not prompt:
            continue

        # Tempelkan global style tag ke prompt gambar (tidak ditempel dobel).
        if style_tag and style_tag.lower() not in prompt.lower():
            prompt = f"{prompt}, {style_tag}" if prompt else style_tag

        try:
            timestamp = float(item.get("timestamp", 0) or 0)
        except (TypeError, ValueError):
            timestamp = 0.0

        scenes.append(StoryboardScene(
            narasi=narasi,
            prompt_gambar=prompt,
            timestamp=max(timestamp, 0.0),
        ))

    if not scenes:
        raise RuntimeError("AI tidak menghasilkan scene yang valid. Coba lagi.")
    return scenes


async def generate_storyboard_scenes(
    premise: str,
    style_tag: str,
    max_scenes: int = 8,
    reading_speed_wpm: int = 150,
    client: httpx.AsyncClient | None = None,
) -> list[StoryboardScene]:
    """PIPELINE 1 — kirim premis/transkrip ke GPT, kembalikan daftar scene.

    Menggunakan chat completion dengan JSON mode untuk output terstruktur,
    lalu menempelkan global style tag ke setiap prompt gambar dan menormalkan
    timestamp agar kronologis.
    """
    settings.require_openai()

    system_prompt = _SYSTEM_PROMPT.format(wpm=reading_speed_wpm, max_scenes=max_scenes)
    payload = {
        "model": settings.OPENAI_TEXT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": premise.strip()},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.8,
    }
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    url = f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions"

    owns_client = client is None
    client = client or httpx.AsyncClient()
    try:
        resp = await client.post(url, json=payload, headers=headers, timeout=LLM_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as e:
        raise RuntimeError(
            f"Layanan AI menolak permintaan (HTTP {e.response.status_code}). "
            "Periksa API key / kuota."
        ) from e
    except httpx.HTTPError as e:
        raise RuntimeError(f"Gagal menghubungi layanan AI: {e}") from e
    finally:
        if owns_client:
            await client.aclose()

    try:
        raw = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError("Respons AI kosong atau tidak terduga. Coba lagi.") from e

    scenes = _parse_scenes_payload(raw, style_tag)

    # Normalisasi timestamp menjadi kumulatif berbasis kecepatan baca agar
    # selalu kronologis & tidak tumpang tindih (tidak bergantung akurasi LLM).
    cursor = 0.0
    for scene in scenes:
        scene.timestamp = round(cursor, 2)
        cursor += estimate_narration_seconds(scene.narasi, reading_speed_wpm)

    return scenes[:max_scenes]


async def generate_scene_image(
    prompt_gambar: str,
    dest_path: str,
    client: httpx.AsyncClient | None = None,
) -> str:
    """Render gambar dari prompt (image model) lalu upload ke storage.

    Mengembalikan URL publik gambar. Dipakai oleh pipeline 1 (opsional) dan
    endpoint regenerasi gambar panel.
    """
    settings.require_openai()
    settings.require_storage()

    payload = {
        "model": settings.OPENAI_IMAGE_MODEL,
        "prompt": prompt_gambar,
        "n": 1,
        "size": "1024x1024",
    }
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    url = f"{settings.OPENAI_BASE_URL.rstrip('/')}/images/generations"

    owns_client = client is None
    client = client or httpx.AsyncClient()
    try:
        resp = await client.post(url, json=payload, headers=headers, timeout=IMAGE_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        entry = (data.get("data") or [{}])[0]
        if entry.get("b64_json"):
            image_bytes = base64.b64decode(entry["b64_json"])
        elif entry.get("url"):
            image_bytes = await _download_bytes(client, entry["url"])
        else:
            raise RuntimeError("Layanan gambar tidak mengembalikan data gambar.")

        return await upload_to_storage(image_bytes, dest_path, "image/png", client=client)
    except httpx.HTTPStatusError as e:
        raise RuntimeError(
            f"Layanan gambar menolak permintaan (HTTP {e.response.status_code})."
        ) from e
    except httpx.HTTPError as e:
        raise RuntimeError(f"Gagal membuat gambar: {e}") from e
    finally:
        if owns_client:
            await client.aclose()


# ─────────────────────────────────────────────────────────────────────────────────
# PIPELINE 2 — ElevenLabs Voiceover
# ─────────────────────────────────────────────────────────────────────────────────

async def synthesize_voiceover(
    text: str,
    dest_path: str,
    voice_id: str | None = None,
    client: httpx.AsyncClient | None = None,
) -> VoiceoverResult:
    """PIPELINE 2 — ubah teks narasi menjadi voiceover via ElevenLabs.

    Langkah:
      1. POST ke /v1/text-to-speech/{voice_id} dengan model premium.
      2. Terima stream audio (MP3).
      3. Hitung durasi audio secara programatik.
      4. Upload audio ke cloud storage.
      5. Kembalikan URL + durasi untuk update panel (duration_seconds).
    """
    settings.require_elevenlabs()

    if not text or not text.strip():
        raise RuntimeError("Teks narasi kosong — tidak ada yang bisa disuarakan.")

    voice = voice_id or settings.ELEVENLABS_DEFAULT_VOICE
    base = settings.ELEVENLABS_BASE_URL.rstrip("/")
    url = f"{base}/text-to-speech/{voice}"
    payload = {
        "text": text.strip(),
        "model_id": settings.ELEVENLABS_MODEL,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }
    headers = {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    params = {"output_format": settings.ELEVENLABS_OUTPUT_FORMAT}

    owns_client = client is None
    client = client or httpx.AsyncClient()
    try:
        resp = await client.post(
            url, json=payload, headers=headers, params=params, timeout=TTS_TIMEOUT
        )
        resp.raise_for_status()
        audio_bytes = resp.content
    except httpx.HTTPStatusError as e:
        raise RuntimeError(
            f"Layanan voiceover menolak permintaan (HTTP {e.response.status_code}). "
            "Periksa API key / voice ID / kuota."
        ) from e
    except httpx.HTTPError as e:
        raise RuntimeError(f"Gagal menghubungi layanan voiceover: {e}") from e
    finally:
        if owns_client:
            await client.aclose()

    if not audio_bytes:
        raise RuntimeError("Layanan voiceover mengembalikan audio kosong.")

    # Hitung durasi (blocking) di thread terpisah agar event loop tidak terhambat.
    duration = await asyncio.to_thread(calculate_audio_duration, audio_bytes, ".mp3")

    audio_url = await upload_to_storage(audio_bytes, dest_path, "audio/mpeg")

    return VoiceoverResult(
        audio_url=audio_url,
        duration_seconds=duration,
        voice_id=voice,
        model=settings.ELEVENLABS_MODEL,
    )


# ─────────────────────────────────────────────────────────────────────────────────
# PIPELINE 3 — Video Timeline Flow (FFmpeg)
# ─────────────────────────────────────────────────────────────────────────────────

def _run_ffmpeg(cmd: list[str]) -> None:
    """Jalankan FFmpeg (blocking). Melempar RuntimeError ramah bila gagal."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except FileNotFoundError as e:
        raise RuntimeError(
            "FFmpeg tidak ditemukan di server. Fitur ekspor video tidak tersedia."
        ) from e
    except subprocess.TimeoutExpired as e:
        raise RuntimeError("Proses render video melebihi batas waktu.") from e

    if result.returncode != 0:
        # Ambil beberapa baris terakhir stderr untuk diagnosa (tanpa membocorkan path penuh).
        tail = "\n".join(result.stderr.strip().splitlines()[-3:])
        raise RuntimeError(f"Render video gagal: {tail}")


def _build_panel_segment(
    workdir: str,
    index: int,
    image_path: str | None,
    audio_path: str | None,
    duration: float,
    width: int,
    height: int,
    fps: int,
) -> str:
    """Bangun satu segmen MP4 dari satu panel (gambar + audio).

    Setiap segmen selalu punya track video + audio dengan parameter identik
    sehingga bisa digabung dengan concat demuxer secara aman. Panel tanpa audio
    mendapat audio senyap sepanjang `duration`.
    """
    seg_path = os.path.join(workdir, f"seg_{index:04d}.mp4")
    scale_filter = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
    )

    cmd = [settings.FFMPEG_BIN, "-y"]

    # Sumber video: gambar panel (loop) atau latar hitam polos bila tak ada gambar.
    if image_path:
        cmd += ["-loop", "1", "-i", image_path]
    else:
        cmd += ["-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r={fps}"]

    # Sumber audio: voiceover panel atau audio senyap.
    if audio_path:
        cmd += ["-i", audio_path]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]

    # `-t duration` membatasi kedua track ke durasi panel. Karena
    # duration_seconds panel sudah diset dari durasi audio asli (pipeline 2),
    # video dan audio tersinkronisasi. Selalu map 1 track video + 1 track audio
    # agar semua segmen homogen dan bisa di-concat dengan stream copy.
    cmd += [
        "-t", f"{duration:.3f}",
        "-vf", scale_filter,
        "-r", str(fps),
        "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
        "-map", "0:v:0", "-map", "1:a:0",
        seg_path,
    ]

    _run_ffmpeg(cmd)
    return seg_path


async def compile_timeline_video(
    project: StoryboardProject,
    fps: int = 24,
    width: int = 1920,
    height: int = 1080,
) -> str:
    """PIPELINE 3 — gabungkan semua panel menjadi satu MP4 tersinkronisasi.

    Mengagregasi image_url + voiceover_audio_url tiap panel (urut kronologis),
    merender tiap panel jadi segmen, lalu menggabungkannya (concat) menjadi satu
    video. Hasil akhir diunggah ke storage dan URL-nya dikembalikan.
    """
    if not shutil.which(settings.FFMPEG_BIN):
        raise RuntimeError(
            "FFmpeg tidak terpasang di server. Fitur ekspor video tidak tersedia."
        )

    panels = sorted(project.panels, key=lambda p: p.order)
    if not panels:
        raise RuntimeError("Storyboard belum memiliki panel untuk dirender.")

    workdir = tempfile.mkdtemp(prefix="storyboard_")
    try:
        # 1. Unduh semua aset (gambar + audio) secara paralel.
        async with httpx.AsyncClient() as client:
            async def fetch_assets(idx: int, panel: StoryboardPanel):
                img_path = None
                aud_path = None
                if panel.image_url:
                    img_bytes = await _download_bytes(client, panel.image_url)
                    img_path = os.path.join(workdir, f"img_{idx:04d}")
                    with open(img_path, "wb") as f:
                        f.write(img_bytes)
                if panel.voiceover_audio_url:
                    aud_bytes = await _download_bytes(client, panel.voiceover_audio_url)
                    aud_path = os.path.join(workdir, f"aud_{idx:04d}.mp3")
                    with open(aud_path, "wb") as f:
                        f.write(aud_bytes)
                return idx, img_path, aud_path

            fetched = await asyncio.gather(
                *(fetch_assets(i, p) for i, p in enumerate(panels))
            )

        assets = {idx: (img, aud) for idx, img, aud in fetched}

        # 2. Render tiap panel menjadi segmen (blocking FFmpeg -> thread).
        segments: list[str] = []
        for i, panel in enumerate(panels):
            img_path, aud_path = assets[i]
            duration = panel.duration_seconds or estimate_narration_seconds(panel.narasi)
            seg = await asyncio.to_thread(
                _build_panel_segment,
                workdir, i, img_path, aud_path, duration, width, height, fps,
            )
            segments.append(seg)

        # 3. Gabungkan semua segmen dengan concat demuxer (stream copy).
        list_file = os.path.join(workdir, "segments.txt")
        with open(list_file, "w") as f:
            for seg in segments:
                f.write(f"file '{seg}'\n")

        output_path = os.path.join(workdir, "storyboard.mp4")
        await asyncio.to_thread(
            _run_ffmpeg,
            [
                settings.FFMPEG_BIN, "-y",
                "-f", "concat", "-safe", "0", "-i", list_file,
                "-c", "copy",
                "-movflags", "+faststart",
                output_path,
            ],
        )

        # 4. Upload hasil akhir ke storage.
        with open(output_path, "rb") as f:
            video_bytes = f.read()

        dest_path = f"{project.id}/video/storyboard_{uuid.uuid4().hex[:6]}.mp4"
        return await upload_to_storage(video_bytes, dest_path, "video/mp4")
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


# ─────────────────────────────────────────────────────────────────────────────────
# STATE MANAGEMENT — in-memory project store
# ─────────────────────────────────────────────────────────────────────────────────
# Untuk produksi, store ini diganti persistensi Supabase (tabel storyboard_projects).
# Antarmuka async dipertahankan agar penggantian ke DB tidak mengubah pemanggil.

class ProjectStore:
    """Penyimpanan proyek storyboard di memori, aman untuk akses konkuren."""

    def __init__(self) -> None:
        self._projects: dict[str, StoryboardProject] = {}
        self._lock = asyncio.Lock()

    async def create(self, premise: str, style_tag: str) -> StoryboardProject:
        project = StoryboardProject(premise=premise, style_tag=style_tag)
        async with self._lock:
            self._projects[project.id] = project
        return project

    async def get(self, project_id: str) -> StoryboardProject | None:
        async with self._lock:
            return self._projects.get(project_id)

    async def save(self, project: StoryboardProject) -> StoryboardProject:
        from core.models import _now_iso
        project.updated_at = _now_iso()
        async with self._lock:
            self._projects[project.id] = project
        return project

    async def delete(self, project_id: str) -> bool:
        async with self._lock:
            return self._projects.pop(project_id, None) is not None

    async def list_ids(self) -> list[str]:
        async with self._lock:
            return list(self._projects.keys())

    def find_panel(
        self, project: StoryboardProject, panel_id: str
    ) -> StoryboardPanel | None:
        """Cari panel dalam proyek berdasarkan id (helper sinkron)."""
        for panel in project.panels:
            if panel.id == panel_id:
                return panel
        return None


# Singleton store dipakai oleh route layer.
store = ProjectStore()
