"""
Test offline untuk helper pipeline storyboard (tanpa jaringan / API key).

Jalankan: python test_storyboard.py
Menguji fungsi-fungsi murni: parsing scene, estimasi durasi, reflow timestamp,
dan fallback kalkulasi durasi audio.
"""

import json

from core.models import StoryboardPanel
from core import storyboard as sb

STYLE = "2D digital cartoon with thick marker-like line work and flat fills"


def test_parse_scenes_handles_code_fence_and_appends_style():
    raw = (
        "```json\n"
        '{"scenes": ['
        '{"narasi": "Kisah bermula di padang pasir.", "prompt_gambar": "A vast desert at dawn", "timestamp": 0},'
        '{"narasi": "Seorang musafir berjalan.", "prompt_gambar": "A lone traveler walking", "timestamp": 5}'
        "]}\n```"
    )
    scenes = sb._parse_scenes_payload(raw, STYLE)
    assert len(scenes) == 2
    assert all(STYLE in s.prompt_gambar for s in scenes)
    assert scenes[0].narasi.startswith("Kisah")


def test_parse_scenes_accepts_bare_array():
    raw = json.dumps([{"narasi": "x", "prompt_gambar": "scene y"}])
    scenes = sb._parse_scenes_payload(raw, "STYLE")
    assert scenes[0].prompt_gambar.endswith("STYLE")


def test_parse_scenes_does_not_double_append_style():
    raw = json.dumps([{"narasi": "x", "prompt_gambar": f"already has {STYLE}"}])
    scenes = sb._parse_scenes_payload(raw, STYLE)
    assert scenes[0].prompt_gambar.count(STYLE) == 1


def test_estimate_narration_seconds():
    assert sb.estimate_narration_seconds("word " * 150, 150) == 60.0
    # Teks kosong -> durasi default minimal.
    assert sb.estimate_narration_seconds("", 150) == sb.DEFAULT_PANEL_DURATION


def test_reflow_timestamps_is_chronological():
    panels = [
        StoryboardPanel(order=0, narasi="a " * 150),               # ~60s estimasi
        StoryboardPanel(order=1, narasi="b", duration_seconds=5.0),  # durasi asli 5s
        StoryboardPanel(order=2, narasi="c", duration_seconds=3.0),
    ]
    sb.reflow_timestamps(panels, 150)
    assert panels[0].timestamp == 0.0
    assert panels[1].timestamp == 60.0
    assert panels[2].timestamp == 65.0


def test_calculate_audio_duration_fallback_never_zero():
    # Bytes sampah -> ffprobe/mutagen gagal -> estimasi bitrate, minimal default.
    dur = sb.calculate_audio_duration(b"x" * 32000, ".mp3")
    assert dur >= sb.DEFAULT_PANEL_DURATION


def _run_all():
    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    passed = 0
    for t in tests:
        t()
        print(f"  ✓ {t.__name__}")
        passed += 1
    print(f"\n{passed}/{len(tests)} test lulus.")


if __name__ == "__main__":
    _run_all()
