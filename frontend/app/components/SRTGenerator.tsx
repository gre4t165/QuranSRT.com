"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

interface Surah {
  number: number;
  name_arabic: string;
  name_simple: string;
  verse_count: number;
}

interface Reciter {
  id: string;
  name: string;
  name_ar: string;
  style: string;
  sample_url: string;
}

interface Translation {
  key: string;
  name: string;
  flag: string;
  lang: string;
}

interface PreviewBlock {
  index: string;
  timestamp: string;
  text: string;
}

interface PreviewResult {
  preview_blocks: PreviewBlock[];
  total_blocks: number;
  filename: string;
  surah_name: string;
  reciter_name: string;
}

// Group translations by region for better UI
const REGION_ORDER = [
  { key: "id", label: "🇮🇩 Indonesia" },
  { key: "ms", label: "🇲🇾 Melayu" },
  { key: "en", label: "🇬🇧 English" },
  { key: "ar", label: "🇸🇦 Arabic" },
  { key: "eu", label: "🇪🇺 Eropa" },
  { key: "sa", label: "🌏 Asia Selatan" },
  { key: "me", label: "🕌 Timur Tengah" },
  { key: "ea", label: "🏯 Asia Timur" },
  { key: "af", label: "🌍 Afrika" },
  { key: "xx", label: "🔤 Lainnya" },
];

function getRegionKey(t: Translation): string {
  if (t.lang === "xx") return "xx";
  if (t.lang === "id") return "id";
  if (t.lang === "ms") return "ms";
  if (t.lang === "en") return "en";
  if (t.lang === "ar") return "ar";
  if (["fr", "de", "es", "it", "pt", "nl", "sv", "no", "ru", "bs", "sq", "pl", "cs", "ro", "bg"].includes(t.lang)) return "eu";
  if (["ur", "hi", "bn", "ta", "ml", "te", "gu"].includes(t.lang)) return "sa";
  if (["tr", "fa", "uz", "az", "ku", "ps", "tg", "kk"].includes(t.lang)) return "me";
  if (["zh", "ja", "ko", "th"].includes(t.lang)) return "ea";
  if (["so", "sw", "ha", "am"].includes(t.lang)) return "af";
  if (["tl", "vi"].includes(t.lang)) return "eu"; // group with general
  return "xx";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SRTGenerator() {
  // Data dari API
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);

  // Form state
  const [surah, setSurah] = useState(1);
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(7);
  const [reciterId, setReciterId] = useState("alafasy");
  const [mode, setMode] = useState<"WAQOF" | "VERSE" | "STD" | "TEXT_ONLY">("WAQOF");
  const [showArabic, setShowArabic] = useState(true);

  // Multi-translation mode
  const [singleTranslation, setSingleTranslation] = useState("id_kemenag");
  const [selectedTranslations, setSelectedTranslations] = useState<Set<string>>(
    new Set(["id_kemenag"])
  );
  const [translationSearch, setTranslationSearch] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"single" | "multi">("single");

  // ── Fetch data on mount ──────────────────────────────────────────────────

  useEffect(() => {
    async function fetchData() {
      try {
        const [surahRes, reciterRes, transRes] = await Promise.all([
          fetch(`${API_URL}/api/quran/surahs`),
          fetch(`${API_URL}/api/quran/reciters`),
          fetch(`${API_URL}/api/quran/translations`),
        ]);

        if (!surahRes.ok || !reciterRes.ok || !transRes.ok) {
          throw new Error("Gagal memuat data dari server");
        }

        const surahData = await surahRes.json();
        const reciterData = await reciterRes.json();
        const transData = await transRes.json();

        setSurahs(surahData.surahs);
        setReciters(reciterData.reciters);
        setTranslations(transData.translations);
      } catch (err) {
        setError("Tidak dapat terhubung ke server. Pastikan backend sudah berjalan.");
        console.error(err);
      } finally {
        setDataLoading(false);
      }
    }
    fetchData();
  }, []);

  // ── Update verse range when surah changes ────────────────────────────────

  const selectedSurah = surahs.find((s) => s.number === surah);

  useEffect(() => {
    if (selectedSurah) {
      setStartVerse(1);
      setEndVerse(selectedSurah.verse_count);
    }
  }, [surah, selectedSurah]);

  // ── Grouped translations for multi-select ────────────────────────────────

  const filteredTranslations = useMemo(() => {
    if (!translationSearch.trim()) return translations;
    const q = translationSearch.toLowerCase();
    return translations.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.flag.includes(q) ||
        t.lang.includes(q)
    );
  }, [translations, translationSearch]);

  const groupedTranslations = useMemo(() => {
    const groups: Record<string, Translation[]> = {};
    for (const t of filteredTranslations) {
      const region = getRegionKey(t);
      if (!groups[region]) groups[region] = [];
      groups[region].push(t);
    }
    return groups;
  }, [filteredTranslations]);

  // ── Toggle translation selection ─────────────────────────────────────────

  function toggleTranslation(key: string) {
    setSelectedTranslations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= 10) return prev; // max 10
        next.add(key);
      }
      return next;
    });
  }

  function selectAllInRegion(regionTranslations: Translation[]) {
    setSelectedTranslations((prev) => {
      const next = new Set(prev);
      const allSelected = regionTranslations.every((t) => next.has(t.key));
      if (allSelected) {
        regionTranslations.forEach((t) => next.delete(t.key));
      } else {
        regionTranslations.forEach((t) => {
          if (next.size < 10) next.add(t.key);
        });
      }
      return next;
    });
  }

  // ── Generate request body ────────────────────────────────────────────────

  const getSingleRequestBody = useCallback(
    () => ({
      surah,
      start_verse: startVerse,
      end_verse: endVerse,
      reciter_id: mode === "TEXT_ONLY" ? "alafasy" : reciterId,
      translation_key: singleTranslation,
      mode,
      show_arabic: showArabic,
      include_mp3: false,
    }),
    [surah, startVerse, endVerse, reciterId, singleTranslation, mode, showArabic]
  );

  const getMultiRequestBody = useCallback(
    () => ({
      surah,
      start_verse: startVerse,
      end_verse: endVerse,
      reciter_id: mode === "TEXT_ONLY" ? "alafasy" : reciterId,
      translation_keys: Array.from(selectedTranslations),
      mode,
      show_arabic: showArabic,
    }),
    [surah, startVerse, endVerse, reciterId, selectedTranslations, mode, showArabic]
  );

  // ── Preview ──────────────────────────────────────────────────────────────

  async function handlePreview() {
    setPreviewLoading(true);
    setError("");
    setPreview(null);

    try {
      const res = await fetch(`${API_URL}/api/generate/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getSingleRequestBody()),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Error ${res.status}`);
      }

      const data: PreviewResult = await res.json();
      setPreview(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat preview";
      setError(message);
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Download SRT (Single) ────────────────────────────────────────────────

  async function handleDownloadSRT() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/generate/srt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getSingleRequestBody()),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Error ${res.status}`);
      }

      const blob = await res.blob();
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        "subtitle.srt";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal download SRT";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Download ZIP (Single — SRT + MP3) ────────────────────────────────────

  async function handleDownloadZIP() {
    setLoading(true);
    setError("");

    try {
      const body = { ...getSingleRequestBody(), include_mp3: true };
      const res = await fetch(`${API_URL}/api/generate/zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Error ${res.status}`);
      }

      const blob = await res.blob();
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        "quransrt.zip";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal download ZIP";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Download Multi-Translation ZIP ───────────────────────────────────────

  async function handleDownloadMultiZIP() {
    if (selectedTranslations.size === 0) {
      setError("Pilih minimal 1 bahasa terjemahan");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/generate/multi/zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getMultiRequestBody()),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Error ${res.status}`);
      }

      const blob = await res.blob();
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        "quransrt_multi.zip";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gagal download Multi ZIP";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Mode descriptions ────────────────────────────────────────────────────

  const modeDescriptions: Record<string, string> = {
    WAQOF: "Pecah ayat di tanda waqof (jeda natural) — paling natural untuk video",
    VERSE: "Satu ayat = satu blok subtitle — simpel dan rapi",
    STD: "Split per 42 karakter per baris — standar subtitle TV",
    TEXT_ONLY:
      "Tanpa audio — timing otomatis dari panjang teks, hanya file SRT",
  };

  const modeIcons: Record<string, string> = {
    WAQOF: "⏸️",
    VERSE: "📄",
    STD: "📺",
    TEXT_ONLY: "✏️",
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <section id="generate" className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 text-text-secondary">
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Memuat data surah & reciter...
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="generate" className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-center text-text-primary mb-4">
          Generate <span className="text-gold">SRT</span>
        </h2>
        <p className="text-text-secondary text-center max-w-xl mx-auto mb-10">
          Pilih surah, qari, dan mode subtitle. Preview hasilnya, lalu download.
        </p>

        {/* Form Container */}
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Row 1: Surah Selection */}
          <div>
            <label
              htmlFor="surah-select"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              📖 Pilih Surah
            </label>
            <select
              id="surah-select"
              value={surah}
              onChange={(e) => setSurah(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors appearance-none cursor-pointer"
            >
              {surahs.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.number}. {s.name_simple} ({s.name_arabic}) —{" "}
                  {s.verse_count} ayat
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: Verse Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="start-verse"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                Ayat Awal
              </label>
              <input
                id="start-verse"
                type="number"
                min={1}
                max={selectedSurah?.verse_count || 1}
                value={startVerse}
                onChange={(e) => setStartVerse(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="end-verse"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                Ayat Akhir
              </label>
              <input
                id="end-verse"
                type="number"
                min={1}
                max={selectedSurah?.verse_count || 1}
                value={endVerse}
                onChange={(e) => setEndVerse(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
              />
            </div>
          </div>

          {/* Row 3: Mode Selection (now includes TEXT_ONLY) */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">
              ⏱️ Mode Subtitle
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(["WAQOF", "VERSE", "STD", "TEXT_ONLY"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`relative px-4 py-3 rounded-xl border text-left transition-all ${
                    mode === m
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border bg-background text-text-secondary hover:border-gold/30"
                  }`}
                >
                  <span className="font-semibold text-sm">
                    {modeIcons[m]} {m === "TEXT_ONLY" ? "TEXT" : m}
                  </span>
                  <p className="text-xs mt-1 opacity-80 leading-snug">
                    {modeDescriptions[m]}
                  </p>
                  {mode === m && (
                    <div className="absolute top-3 right-3 w-2 h-2 bg-gold rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Row 4: Reciter (hidden when TEXT_ONLY) */}
          {mode !== "TEXT_ONLY" && (
            <div className="animate-fadeIn">
              <label
                htmlFor="reciter-select"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                🎙️ Qari / Reciter
              </label>
              <select
                id="reciter-select"
                value={reciterId}
                onChange={(e) => setReciterId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors appearance-none cursor-pointer"
              >
                {reciters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.style})
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === "TEXT_ONLY" && (
            <div className="bg-gold/5 border border-gold/20 rounded-xl px-4 py-3 text-sm text-gold/80">
              ✏️ Mode Text Only — SRT akan dibuat tanpa audio. Timing otomatis
              berdasarkan panjang teks Arab. Cocok untuk membuat subtitle
              preview atau dipakai dengan audio lokal.
            </div>
          )}

          {/* Row 5: Translation Tab (Single vs Multi) */}
          <div>
            <div className="flex items-center gap-4 mb-3">
              <label className="block text-sm font-medium text-text-secondary">
                🌍 Terjemahan
              </label>
              <div className="flex bg-background border border-border rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("single")}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${
                    activeTab === "single"
                      ? "bg-gold/15 text-gold"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  1 Bahasa
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("multi")}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${
                    activeTab === "multi"
                      ? "bg-gold/15 text-gold"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Multi Bahasa
                </button>
              </div>
              {activeTab === "multi" && (
                <span className="text-xs text-gold/60">
                  {selectedTranslations.size}/10 dipilih
                </span>
              )}
            </div>

            {activeTab === "single" ? (
              /* Single Translation Dropdown */
              <select
                id="translation-select"
                value={singleTranslation}
                onChange={(e) => setSingleTranslation(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors appearance-none cursor-pointer"
              >
                <option value="none">Tanpa Terjemahan</option>
                {translations.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.flag} {t.name}
                  </option>
                ))}
              </select>
            ) : (
              /* Multi Translation Checkboxes */
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari bahasa..."
                    value={translationSearch}
                    onChange={(e) => setTranslationSearch(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 pl-9 text-sm text-text-primary focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                    🔍
                  </span>
                </div>

                {/* Grouped Checkboxes */}
                <div className="max-h-[280px] overflow-y-auto bg-background border border-border rounded-xl custom-scrollbar">
                  {REGION_ORDER.map((region) => {
                    const items = groupedTranslations[region.key];
                    if (!items || items.length === 0) return null;

                    const allChecked = items.every((t) =>
                      selectedTranslations.has(t.key)
                    );

                    return (
                      <div key={region.key} className="border-b border-border/50 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => selectAllInRegion(items)}
                          className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-surface/50 transition-colors ${
                            allChecked ? "text-gold" : "text-text-muted"
                          }`}
                        >
                          <span>{region.label}</span>
                          <span className="text-[10px] font-normal normal-case">
                            {allChecked ? "Hapus semua" : "Pilih semua"}
                          </span>
                        </button>
                        <div className="px-2 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {items.map((t) => (
                            <label
                              key={t.key}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                                selectedTranslations.has(t.key)
                                  ? "bg-gold/10 text-gold border border-gold/20"
                                  : "text-text-secondary hover:bg-surface/50 border border-transparent"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTranslations.has(t.key)}
                                onChange={() => toggleTranslation(t.key)}
                                className="sr-only"
                              />
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  selectedTranslations.has(t.key)
                                    ? "bg-gold border-gold"
                                    : "border-border"
                                }`}
                              >
                                {selectedTranslations.has(t.key) && (
                                  <svg
                                    className="w-2.5 h-2.5 text-background"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={4}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </div>
                              <span className="truncate">
                                {t.flag} {t.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected summary */}
                {selectedTranslations.size > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(selectedTranslations).map((key) => {
                      const t = translations.find((tr) => tr.key === key);
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 bg-gold/10 text-gold text-xs px-2.5 py-1 rounded-lg border border-gold/20"
                        >
                          {t?.flag} {t?.name}
                          <button
                            type="button"
                            onClick={() => toggleTranslation(key)}
                            className="hover:text-red-400 transition-colors ml-0.5"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 6: Options */}
          <div className="flex items-center gap-6 pt-2">
            <label
              htmlFor="show-arabic"
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="relative">
                <input
                  id="show-arabic"
                  type="checkbox"
                  checked={showArabic}
                  onChange={(e) => setShowArabic(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 rounded-full bg-border peer-checked:bg-gold transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
              </div>
              <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                Tampilkan teks Arab
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Action Buttons */}
          {activeTab === "single" ? (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                id="btn-preview"
                type="button"
                onClick={handlePreview}
                disabled={previewLoading || loading}
                className="flex-1 border border-border text-text-primary font-semibold px-6 py-3.5 rounded-xl hover:bg-surface hover:border-gold/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {previewLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Memuat Preview...
                  </span>
                ) : (
                  "👁️ Preview SRT"
                )}
              </button>

              <button
                id="btn-download-srt"
                type="button"
                onClick={handleDownloadSRT}
                disabled={loading}
                className="flex-1 bg-gold text-background font-semibold px-6 py-3.5 rounded-xl hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  "📥 Download SRT"
                )}
              </button>

              {mode !== "TEXT_ONLY" && (
                <button
                  id="btn-download-zip"
                  type="button"
                  onClick={handleDownloadZIP}
                  disabled={loading}
                  className="flex-1 bg-gold/20 text-gold font-semibold px-6 py-3.5 rounded-xl border border-gold/30 hover:bg-gold/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📦 Download ZIP (SRT + MP3)
                </button>
              )}
            </div>
          ) : (
            /* Multi-Translation Actions */
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                id="btn-download-multi-zip"
                type="button"
                onClick={handleDownloadMultiZIP}
                disabled={loading || selectedTranslations.size === 0}
                className="flex-1 bg-gold text-background font-semibold px-6 py-3.5 rounded-xl hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Generating {selectedTranslations.size} SRT...
                  </span>
                ) : (
                  `📦 Download ${selectedTranslations.size} Bahasa (ZIP)`
                )}
              </button>
            </div>
          )}
        </div>

        {/* Preview Section */}
        {preview && (
          <div className="mt-8 bg-surface border border-border rounded-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading text-xl font-bold text-text-primary">
                  Preview: {preview.surah_name}
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  Qari: {preview.reciter_name} · {preview.total_blocks} blok
                  subtitle · {preview.filename}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-text-muted hover:text-text-primary transition-colors text-xl"
                aria-label="Tutup preview"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {preview.preview_blocks.map((block, i) => (
                <div
                  key={i}
                  className="bg-background border border-border/50 rounded-xl p-4 hover:border-gold/20 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono bg-gold/10 text-gold px-2 py-0.5 rounded">
                      #{block.index}
                    </span>
                    <span className="text-xs font-mono text-text-muted">
                      {block.timestamp}
                    </span>
                  </div>
                  <pre className="text-sm text-text-primary whitespace-pre-wrap font-body leading-relaxed">
                    {block.text}
                  </pre>
                </div>
              ))}
            </div>

            {preview.preview_blocks.length < preview.total_blocks && (
              <p className="text-center text-text-muted text-sm mt-4">
                Menampilkan {preview.preview_blocks.length} dari{" "}
                {preview.total_blocks} blok
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
