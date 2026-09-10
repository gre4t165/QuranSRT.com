"""
QuranSRT — Route: /api/storyboard

Endpoint orkestrasi untuk AI Storyboard Creator. Menghubungkan tiga pipeline
(GPT scene generation, ElevenLabs voiceover, FFmpeg video compile) dengan state
management proyek.

Alur umum:
  1. POST /projects                 -> buat proyek dari premis (pipeline 1)
  2. PATCH .../panels/{id}/narration-> edit narasi, voiceover auto-regenerate (pipeline 2)
  3. POST .../panels/{id}/image     -> render gambar panel (pipeline 1, image)
  4. POST .../export                -> kompilasi MP4 final (pipeline 3)
"""

import logging

from fastapi import APIRouter, HTTPException

from core.config import settings
from core.models import (
    StoryboardGenerateRequest,
    PanelNarrationUpdate,
    PanelImageRequest,
    VoiceoverRequest,
    VideoExportRequest,
    StoryboardPanel,
    StoryboardProject,
)
from core import storyboard as sb

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helper: terjemahkan RuntimeError ke HTTP error yang tepat ────────────────────

# Frasa yang menandai masalah konfigurasi/kapabilitas server (bukan kesalahan user).
_UNAVAILABLE_HINTS = ("belum dikonfigurasi", "tidak terpasang", "tidak tersedia")


def _raise_http(error: RuntimeError) -> None:
    """Ubah RuntimeError pipeline menjadi HTTPException dengan status sesuai."""
    message = str(error)
    if any(hint in message for hint in _UNAVAILABLE_HINTS):
        # Layanan eksternal belum siap / tidak terpasang di server.
        raise HTTPException(status_code=503, detail=message)
    # Kegagalan saat memanggil layanan eksternal (upstream).
    raise HTTPException(status_code=502, detail=message)


async def _get_project_or_404(project_id: str) -> StoryboardProject:
    project = await sb.store.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyek storyboard tidak ditemukan")
    return project


def _get_panel_or_404(project: StoryboardProject, panel_id: str) -> StoryboardPanel:
    panel = sb.store.find_panel(project, panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel tidak ditemukan dalam proyek")
    return panel


# ─────────────────────────────────────────────────────────────────────────────────
# PIPELINE 1 — buat proyek storyboard dari premis
# ─────────────────────────────────────────────────────────────────────────────────

@router.post("/projects")
async def create_project(request: StoryboardGenerateRequest):
    """Generate storyboard dari premis/transkrip (pipeline 1).

    Opsional langsung menghasilkan gambar & voiceover tiap panel. Mengembalikan
    state proyek lengkap beserta semua panel yang sudah terbentuk.
    """
    style_tag = request.style_tag or settings.GLOBAL_STYLE_TAG
    project = await sb.store.create(premise=request.premise, style_tag=style_tag)
    project.status = "generating"

    try:
        scenes = await sb.generate_storyboard_scenes(
            premise=request.premise,
            style_tag=style_tag,
            max_scenes=request.max_scenes,
            reading_speed_wpm=request.reading_speed_wpm,
        )
    except RuntimeError as e:
        project.status = "error"
        await sb.store.save(project)
        _raise_http(e)

    # Scene -> panel.
    project.panels = [
        StoryboardPanel(
            order=i,
            narasi=scene.narasi,
            prompt_gambar=scene.prompt_gambar,
            timestamp=scene.timestamp,
            voice_id=request.voice_id,
        )
        for i, scene in enumerate(scenes)
    ]

    # Opsional: voiceover tiap panel (pipeline 2) — update durasi untuk sinkronisasi.
    if request.generate_voiceover:
        try:
            for panel in project.panels:
                result = await sb.synthesize_voiceover(
                    text=panel.narasi,
                    dest_path=f"{project.id}/audio/{panel.id}.mp3",
                    voice_id=request.voice_id,
                )
                panel.voiceover_audio_url = result.audio_url
                panel.duration_seconds = result.duration_seconds
                panel.voice_id = result.voice_id
        except RuntimeError as e:
            project.status = "error"
            await sb.store.save(project)
            _raise_http(e)

    # Opsional: gambar tiap panel (pipeline 1, image model).
    if request.generate_images:
        try:
            for panel in project.panels:
                panel.image_url = await sb.generate_scene_image(
                    prompt_gambar=panel.prompt_gambar,
                    dest_path=f"{project.id}/images/{panel.id}.png",
                )
        except RuntimeError as e:
            project.status = "error"
            await sb.store.save(project)
            _raise_http(e)

    # Rapikan timestamp memakai durasi audio asli bila tersedia.
    sb.reflow_timestamps(project.panels, request.reading_speed_wpm)
    project.status = "ready"
    await sb.store.save(project)

    return project.model_dump()


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Ambil state lengkap sebuah proyek storyboard."""
    project = await _get_project_or_404(project_id)
    return project.model_dump()


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Hapus proyek storyboard dari state store."""
    deleted = await sb.store.delete(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Proyek storyboard tidak ditemukan")
    return {"status": "deleted", "project_id": project_id}


# ─────────────────────────────────────────────────────────────────────────────────
# PIPELINE 2 — voiceover panel & utilitas TTS lepas
# ─────────────────────────────────────────────────────────────────────────────────

@router.patch("/projects/{project_id}/panels/{panel_id}/narration")
async def update_panel_narration(
    project_id: str, panel_id: str, request: PanelNarrationUpdate
):
    """Update narasi panel; voiceover otomatis di-regenerate (pipeline 2).

    Durasi panel (duration_seconds) diperbarui dari durasi audio baru dan seluruh
    timestamp timeline disusun ulang agar tetap sinkron.
    """
    project = await _get_project_or_404(project_id)
    panel = _get_panel_or_404(project, panel_id)

    panel.narasi = request.narasi
    if request.voice_id:
        panel.voice_id = request.voice_id

    try:
        result = await sb.synthesize_voiceover(
            text=panel.narasi,
            dest_path=f"{project.id}/audio/{panel.id}.mp3",
            voice_id=panel.voice_id,
        )
    except RuntimeError as e:
        _raise_http(e)

    panel.voiceover_audio_url = result.audio_url
    panel.duration_seconds = result.duration_seconds
    panel.voice_id = result.voice_id

    sb.reflow_timestamps(sorted(project.panels, key=lambda p: p.order))
    await sb.store.save(project)

    return panel.model_dump()


@router.post("/projects/{project_id}/panels/{panel_id}/voiceover")
async def regenerate_panel_voiceover(project_id: str, panel_id: str):
    """Regenerate voiceover panel dari narasi yang ada sekarang (pipeline 2)."""
    project = await _get_project_or_404(project_id)
    panel = _get_panel_or_404(project, panel_id)

    try:
        result = await sb.synthesize_voiceover(
            text=panel.narasi,
            dest_path=f"{project.id}/audio/{panel.id}.mp3",
            voice_id=panel.voice_id,
        )
    except RuntimeError as e:
        _raise_http(e)

    panel.voiceover_audio_url = result.audio_url
    panel.duration_seconds = result.duration_seconds
    panel.voice_id = result.voice_id

    sb.reflow_timestamps(sorted(project.panels, key=lambda p: p.order))
    await sb.store.save(project)

    return panel.model_dump()


@router.post("/voiceover")
async def voiceover_utility(request: VoiceoverRequest):
    """Utilitas TTS lepas (tidak terikat panel) — pipeline 2.

    Berguna untuk preview suara sebelum membuat proyek penuh.
    """
    import uuid
    try:
        result = await sb.synthesize_voiceover(
            text=request.text,
            dest_path=f"adhoc/{uuid.uuid4().hex}.mp3",
            voice_id=request.voice_id,
        )
    except RuntimeError as e:
        _raise_http(e)
    return result.model_dump()


# ─────────────────────────────────────────────────────────────────────────────────
# PIPELINE 1 (image) — render gambar panel
# ─────────────────────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/panels/{panel_id}/image")
async def generate_panel_image(
    project_id: str, panel_id: str, request: PanelImageRequest
):
    """Render (atau regenerate) gambar untuk satu panel.

    Bila `prompt_gambar` dikirim, prompt panel ikut diperbarui sebelum render.
    """
    project = await _get_project_or_404(project_id)
    panel = _get_panel_or_404(project, panel_id)

    if request.prompt_gambar:
        panel.prompt_gambar = request.prompt_gambar

    try:
        panel.image_url = await sb.generate_scene_image(
            prompt_gambar=panel.prompt_gambar,
            dest_path=f"{project.id}/images/{panel.id}.png",
        )
    except RuntimeError as e:
        _raise_http(e)

    await sb.store.save(project)
    return panel.model_dump()


# ─────────────────────────────────────────────────────────────────────────────────
# PIPELINE 3 — ekspor video timeline
# ─────────────────────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/export")
async def export_video(project_id: str, request: VideoExportRequest):
    """Kompilasi semua panel menjadi satu MP4 tersinkronisasi (pipeline 3).

    Mengagregasi image_url + voiceover_audio_url setiap panel, merendernya via
    FFmpeg, lalu mengunggah hasilnya ke storage dan mengembalikan URL video.
    """
    project = await _get_project_or_404(project_id)

    if not project.panels:
        raise HTTPException(
            status_code=400, detail="Storyboard belum punya panel untuk diekspor"
        )

    project.status = "rendering"
    await sb.store.save(project)

    try:
        video_url = await sb.compile_timeline_video(
            project=project,
            fps=request.fps,
            width=request.width,
            height=request.height,
        )
    except RuntimeError as e:
        project.status = "error"
        await sb.store.save(project)
        _raise_http(e)

    project.video_url = video_url
    project.status = "completed"
    await sb.store.save(project)

    return {"project_id": project.id, "video_url": video_url, "status": project.status}
