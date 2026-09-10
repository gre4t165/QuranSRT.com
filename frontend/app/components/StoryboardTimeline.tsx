"use client";

/**
 * StoryboardTimeline — komponen timeline flow linear untuk AI Storyboard Creator.
 *
 * Menampilkan panel-panel storyboard secara kronologis (back-to-back) dan
 * menyediakan aksi ekspor untuk mengkompilasi seluruh panel menjadi satu MP4
 * melalui backend (Pipeline 3). Semua logika berat ada di backend — komponen
 * ini hanya memanggil API dan menampilkan state.
 */

import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Design tokens (selaras dengan CLAUDE.md) ─────────────────────────────────
const C = {
  bg: "#080B14",
  gold: "#C9A84C",
  text: "#F5F5F0",
  surface: "#0F1523",
  border: "#1E2A42",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface Panel {
  id: string;
  order: number;
  narasi: string;
  prompt_gambar: string;
  timestamp: number;
  duration_seconds: number;
  image_url: string | null;
  voiceover_audio_url: string | null;
  voice_id: string | null;
}

interface Project {
  id: string;
  premise: string;
  style_tag: string;
  panels: Panel[];
  video_url: string | null;
  status: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    let detail = `Terjadi kesalahan (HTTP ${resp.status})`;
    try {
      const body = await resp.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* abaikan — pakai pesan default */
    }
    throw new Error(detail);
  }
  return resp.json() as Promise<T>;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function StoryboardTimeline() {
  const [premise, setPremise] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyPanel, setBusyPanel] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDuration = project
    ? project.panels.reduce((acc, p) => acc + (p.duration_seconds || 0), 0)
    : 0;

  // Pipeline 1 — buat proyek dari premis.
  const handleGenerate = useCallback(async () => {
    if (premise.trim().length < 3) {
      setError("Tuliskan premis cerita atau transkrip terlebih dahulu.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<Project>("/api/storyboard/projects", {
        method: "POST",
        body: JSON.stringify({
          premise,
          max_scenes: 8,
          generate_images: true,
          generate_voiceover: true,
        }),
      });
      setProject(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat storyboard.");
    } finally {
      setLoading(false);
    }
  }, [premise]);

  // Pipeline 2 — simpan narasi baru, voiceover otomatis di-regenerate.
  const handleSaveNarration = useCallback(
    async (panelId: string, narasi: string) => {
      if (!project) return;
      setBusyPanel(panelId);
      setError(null);
      try {
        const updated = await apiJson<Panel>(
          `/api/storyboard/projects/${project.id}/panels/${panelId}/narration`,
          { method: "PATCH", body: JSON.stringify({ narasi }) },
        );
        setProject((prev) =>
          prev
            ? { ...prev, panels: prev.panels.map((p) => (p.id === panelId ? updated : p)) }
            : prev,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memperbarui narasi.");
      } finally {
        setBusyPanel(null);
      }
    },
    [project],
  );

  // Pipeline 1 (image) — render ulang gambar panel.
  const handleRegenImage = useCallback(
    async (panelId: string) => {
      if (!project) return;
      setBusyPanel(panelId);
      setError(null);
      try {
        const updated = await apiJson<Panel>(
          `/api/storyboard/projects/${project.id}/panels/${panelId}/image`,
          { method: "POST", body: JSON.stringify({}) },
        );
        setProject((prev) =>
          prev
            ? { ...prev, panels: prev.panels.map((p) => (p.id === panelId ? updated : p)) }
            : prev,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal membuat gambar.");
      } finally {
        setBusyPanel(null);
      }
    },
    [project],
  );

  // Pipeline 3 — ekspor MP4 final.
  const handleExport = useCallback(async () => {
    if (!project) return;
    setExporting(true);
    setError(null);
    try {
      const res = await apiJson<{ video_url: string; status: string }>(
        `/api/storyboard/projects/${project.id}/export`,
        { method: "POST", body: JSON.stringify({ fps: 24, width: 1920, height: 1080 }) },
      );
      setProject((prev) => (prev ? { ...prev, video_url: res.video_url, status: res.status } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengekspor video.");
    } finally {
      setExporting(false);
    }
  }, [project]);

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100%", padding: "1.5rem" }}>
      <h2 style={{ color: C.gold, fontSize: "1.5rem", marginBottom: "1rem" }}>
        AI Storyboard Creator
      </h2>

      {/* Input premis */}
      <div style={{ marginBottom: "1.25rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
          Premis cerita atau transkrip
        </label>
        <textarea
          value={premise}
          onChange={(e) => setPremise(e.target.value)}
          rows={4}
          placeholder="Contoh: Kisah perjalanan hijrah Nabi Muhammad ﷺ dari Mekah ke Madinah…"
          style={{
            width: "100%",
            background: C.surface,
            color: C.text,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "0.75rem",
            resize: "vertical",
          }}
        />
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            marginTop: "0.75rem",
            background: C.gold,
            color: C.bg,
            border: "none",
            borderRadius: 8,
            padding: "0.6rem 1.2rem",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Membuat storyboard…" : "Generate Storyboard"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: "#2a1416",
            border: "1px solid #5c2327",
            color: "#ffb4b4",
            borderRadius: 8,
            padding: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Timeline flow */}
      {project && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>
              {project.panels.length} panel · durasi total {fmtTime(totalDuration)}
            </span>
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                background: "transparent",
                color: C.gold,
                border: `1px solid ${C.gold}`,
                borderRadius: 8,
                padding: "0.5rem 1rem",
                fontWeight: 600,
                cursor: exporting ? "not-allowed" : "pointer",
                opacity: exporting ? 0.6 : 1,
              }}
            >
              {exporting ? "Merender video…" : "⬇ Export MP4"}
            </button>
          </div>

          {project.video_url && (
            <video
              src={project.video_url}
              controls
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                marginBottom: "1rem",
              }}
            />
          )}

          {/* Panel-panel tersusun kronologis (linear, back-to-back) */}
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {project.panels.map((panel, i) => (
              <li key={panel.id}>
                <PanelCard
                  panel={panel}
                  index={i}
                  busy={busyPanel === panel.id}
                  onSaveNarration={handleSaveNarration}
                  onRegenImage={handleRegenImage}
                />
                {i < project.panels.length - 1 && (
                  <div
                    aria-hidden
                    style={{
                      width: 2,
                      height: 24,
                      background: C.border,
                      margin: "0 auto",
                    }}
                  />
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

// ── Panel Card ──────────────────────────────────────────────────────────────────

function PanelCard({
  panel,
  index,
  busy,
  onSaveNarration,
  onRegenImage,
}: {
  panel: Panel;
  index: number;
  busy: boolean;
  onSaveNarration: (panelId: string, narasi: string) => void;
  onRegenImage: (panelId: string) => void;
}) {
  const [draft, setDraft] = useState(panel.narasi);
  const dirty = draft.trim() !== panel.narasi.trim();

  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "0.9rem",
        position: "relative",
      }}
    >
      {/* Nomor + timestamp */}
      <div style={{ minWidth: 64, textAlign: "center" }}>
        <div style={{ color: C.gold, fontWeight: 700, fontSize: "1.1rem" }}>#{index + 1}</div>
        <div style={{ fontSize: "0.72rem", opacity: 0.7 }}>{fmtTime(panel.timestamp)}</div>
        <div style={{ fontSize: "0.68rem", opacity: 0.5 }}>
          {panel.duration_seconds ? `${panel.duration_seconds.toFixed(1)}s` : "—"}
        </div>
      </div>

      {/* Gambar panel */}
      <div style={{ width: 120, flexShrink: 0 }}>
        {panel.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={panel.image_url}
            alt={`Panel ${index + 1}`}
            style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}` }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: 8,
              border: `1px dashed ${C.border}`,
              display: "grid",
              placeItems: "center",
              fontSize: "0.7rem",
              opacity: 0.6,
            }}
          >
            belum ada gambar
          </div>
        )}
        <button
          onClick={() => onRegenImage(panel.id)}
          disabled={busy}
          style={{
            marginTop: 6,
            width: "100%",
            background: "transparent",
            color: C.text,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: "0.3rem",
            fontSize: "0.72rem",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "…" : panel.image_url ? "Ganti gambar" : "Buat gambar"}
        </button>
      </div>

      {/* Narasi + prompt */}
      <div style={{ flex: 1 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          style={{
            width: "100%",
            background: C.bg,
            color: C.text,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: "0.5rem",
            resize: "vertical",
          }}
        />
        <p style={{ fontSize: "0.72rem", opacity: 0.55, margin: "0.4rem 0" }}>
          🎨 {panel.prompt_gambar}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => onSaveNarration(panel.id, draft)}
            disabled={busy || !dirty}
            style={{
              background: dirty ? C.gold : "transparent",
              color: dirty ? C.bg : C.text,
              border: `1px solid ${dirty ? C.gold : C.border}`,
              borderRadius: 6,
              padding: "0.35rem 0.8rem",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: busy || !dirty ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Menyuarakan…" : "Simpan & suarakan"}
          </button>
          {panel.voiceover_audio_url && (
            <audio src={panel.voiceover_audio_url} controls style={{ height: 32 }} />
          )}
        </div>
      </div>
    </div>
  );
}
