import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
	AudioLines, BookOpen, Download, FilePlus2, FolderOpen, HelpCircle, Keyboard, Loader2, Pause, Play, Plus, Redo2,
	RotateCcw, RotateCw, Save, Sparkles, SlidersHorizontal, Trash2, Undo2, Upload, Wand2, Hand, AlignJustify, X, Palette, Cloud, Scissors, Maximize2,
} from 'lucide-react';
import { SURAHS, getSurah } from '~/data/surahs';
import { useT } from '~/lib/i18n';
import { useAppConfig } from '~/lib/config';
import { useAuth } from '~/lib/useAuth';
import { RECITERS, ayahAudioUrl, getReciter } from '~/lib/reciters';
import { loadBasmalah, loadSurah } from '~/lib/quran';
import {
	newProject, normalizeProject, projectTitle, rowsFromAyat, shouldOfferBasmalah, taawudzRow, uid,
	type ContentSettings, type ExportSettings, type Project, type Row, type StyleSettings,
} from '~/lib/project';
import { buildCues, validateRows } from '~/lib/subtitles';
import { applyAlignment, fullOf, groupRange, mergeNext, partInfo, splitRow, unsplit } from '~/lib/parts';
import { splitArabic, splitArabicAt } from '~/lib/segment';
import { aiAlign, serverStatus, track } from '~/lib/api';
import { audioCtx, bufferToWav, computePeaks, concatBuffers, decodeBlob, fetchQari, type Peaks } from '~/lib/audio';
import { autoSync, distribute } from '~/lib/autosync';
import { TimelinePlayer, type Segment } from '~/lib/player';
import { cueAt, ensureFonts, makeFitTest, type FrameInput } from '~/lib/renderer';
import { getDraft, getLocal, saveDraft, saveLocal } from '~/lib/storage';
import { saveText } from '~/lib/download';
import { FREE_CLOUD_LIMIT, getCloud, listCloud, saveCloud } from '~/lib/cloud';
import { fmtClock } from '~/lib/time';
import { histReducer } from './history';
import { RowItem, type RowHandlers } from './RowItem';
import { Timeline } from './Timeline';
import { Preview } from './Preview';
import { StylePanel } from './StylePanel';
import { ExportPanel } from './ExportPanel';
import { AiPanel } from './AiPanel';
import { BatchDialog } from './BatchDialog';

type Meta = Omit<Project, 'rows'> & { cloudId?: string };
type AudioState = { kind: 'none' | 'file' | 'qari' | 'playlist'; name: string; buffer: AudioBuffer | null; peaks: Peaks | null; isVideo: boolean };
const NO_AUDIO: AudioState = { kind: 'none', name: '', buffer: null, peaks: null, isVideo: false };
type Tab = 'style' | 'export' | 'ai' | 'help';

function defaultTo(surah: number) {
	const n = getSurah(surah).verses;
	return n <= 40 ? n : 10;
}

function silentWavUrl(seconds: number) {
	const ctx = audioCtx();
	const b = ctx.createBuffer(1, Math.max(1, Math.round(ctx.sampleRate * seconds)), ctx.sampleRate);
	return URL.createObjectURL(bufferToWav(b));
}

export function Studio() {
	const { t, lang } = useT();
	const cfg = useAppConfig();
	const auth = useAuth();
	const navigate = useNavigate();
	const [params, setParams] = useSearchParams();

	const [meta, setMeta] = useState<Meta>(() => {
		const { rows: _rows, ...m } = newProject();
		return m;
	});
	const [hist, dispatch] = useReducer(histReducer, { rows: [], past: [], future: [], lastKey: null, lastAt: 0, rev: 0 });
	const rows = hist.rows;
	const rowsRef = useRef(rows);
	rowsRef.current = rows;

	const [player] = useState(() => new TimelinePlayer());
	const [audio, setAudio] = useState<AudioState>(NO_AUDIO);
	const mediaUrl = useRef<string | null>(null);
	const silentUrls = useRef<string[]>([]);
	const [mediaVideo, setMediaVideo] = useState<HTMLVideoElement | null>(null);
	const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
	const [bgClip, setBgClip] = useState<HTMLVideoElement | null>(null);
	const [bgName, setBgName] = useState('');

	const [selected, setSelected] = useState(0);
	const [now, setNow] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [rate, setRate] = useState(1);
	const [tapOn, setTapOn] = useState(false);
	const [tapIndex, setTapIndex] = useState(0);
	const ended = useRef(new Set<number>());
	const [loopRow, setLoopRow] = useState<number | null>(null);
	const playUntil = useRef<number | null>(null);
	const [followRows, setFollowRows] = useState(true);

	const [textBusy, setTextBusy] = useState(false);
	const [qariProg, setQariProg] = useState<{ done: number; total: number } | null>(null);
	const [decodeBusy, setDecodeBusy] = useState(false);
	const [status, setStatus] = useState<{ msg: string; err?: boolean } | null>(null);
	const [toastMsg, setToastMsg] = useState('');
	const [tab, setTab] = useState<Tab>('style');
	const [batchOpen, setBatchOpen] = useState(false);
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [sensitivity, setSensitivity] = useState(0.5);
	const [offset, setOffset] = useState('0.5');
	const [ready, setReady] = useState(false);
	const [fontsTick, setFontsTick] = useState(0);
	const [aiOn, setAiOn] = useState(false);
	const [aligning, setAligning] = useState<string | null>(null);
	const rowsBox = useRef<HTMLDivElement>(null);
	const importRef = useRef<HTMLInputElement>(null);

	const surahMeta = getSurah(meta.surah);
	const reciter = getReciter(meta.reciter);

	const toast = useCallback((m: string) => {
		setToastMsg(m);
		window.clearTimeout((toast as unknown as { h?: number }).h);
		(toast as unknown as { h?: number }).h = window.setTimeout(() => setToastMsg(''), 3800);
	}, []);

	const project: Project = useMemo(() => {
		const { cloudId: _c, ...m } = meta;
		return { ...m, rows };
	}, [meta, rows]);

	// ---------- Memuat ayat ----------
	const loadAyat = useCallback(
		async (surah: number, from: number, to: number, basmalah: boolean, keepAudio = false, taawudz = false) => {
			setTextBusy(true);
			setStatus(null);
			try {
				const [ayat, b] = await Promise.all([loadSurah(surah), basmalah ? loadBasmalah() : Promise.resolve(null)]);
				const a = Math.max(1, Math.min(from, to));
				const z = Math.min(ayat.length, Math.max(from, to));
				let next = rowsFromAyat(surah, ayat, a, z, b);
				if (taawudz) next = [taawudzRow(0), ...next.map((r) => ({ ...r, start: r.start + 4, end: r.end + 4 }))];
				dispatch({ type: 'reset', rows: next });
				setMeta((m) => ({ ...m, surah, from: a, to: z, basmalah, taawudz }));
				track('load_verses');
				setSelected(0);
				setTapIndex(0);
				setLoopRow(null);
				if (!keepAudio && (audio.kind === 'qari' || audio.kind === 'playlist')) clearAudio();
				player.seek(0);
				setStatus({ msg: t(`${getSurah(surah).latin} ayat ${a}–${z} dimuat dengan waktu perkiraan. Ambil audio qari atau unggah murotal untuk menyelaraskan.`, `${getSurah(surah).latin} ${a}–${z} loaded with estimated timing. Fetch a reciter or upload audio to sync.`) });
			} catch {
				setStatus({ msg: t('Gagal memuat teks ayat. Periksa koneksi lalu coba lagi.', 'Could not load verse text. Check your connection and try again.'), err: true });
			} finally {
				setTextBusy(false);
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[audio.kind, player, t],
	);

	const loadProject = useCallback((p: Project & { cloudId?: string }) => {
		const { rows: r, ...m } = p;
		setMeta(m);
		dispatch({ type: 'reset', rows: r });
		setSelected(0);
		setTapIndex(0);
		setSavedAt(p.updatedAt || null);
		if (!r.length) void loadAyat(p.surah, p.from, p.to, p.basmalah);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ---------- Inisialisasi dari URL / draf ----------
	useEffect(() => {
		if (ready) return;
		const pid = params.get('p');
		const cid = params.get('cloud');
		const qs = Number(params.get('surah'));
		if (cid) {
			if (!auth.ready) return;
			if (auth.user) {
				void getCloud(cid)
					.then((p) => loadProject({ ...p, cloudId: cid }))
					.catch(() => {
						toast(t('Proyek cloud tidak ditemukan.', 'Cloud project not found.'));
						void loadAyat(1, 1, 7, false);
					});
			} else {
				toast(t('Masuk dulu untuk membuka proyek cloud.', 'Sign in to open cloud projects.'));
				void loadAyat(1, 1, 7, false);
			}
		} else if (pid && getLocal(pid)) {
			loadProject(getLocal(pid)!);
		} else if (qs >= 1 && qs <= 114) {
			const from = Number(params.get('from')) || 1;
			const to = Number(params.get('to')) || defaultTo(qs);
			const { rows: _r, ...m } = newProject({ surah: qs, from, to, basmalah: shouldOfferBasmalah(qs, from) });
			setMeta(m);
			void loadAyat(qs, from, to, shouldOfferBasmalah(qs, from));
		} else if (!params.has('new') && getDraft()) {
			loadProject(getDraft()!);
		} else {
			void loadAyat(1, 1, 7, false);
		}
		setReady(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [auth.ready]);

	// Simpan draf otomatis
	useEffect(() => {
		if (!ready || !rows.length) return;
		const h = window.setTimeout(() => saveDraft(project), 700);
		return () => window.clearTimeout(h);
	}, [project, ready, rows.length]);

	// Durasi virtual (agar pratinjau bisa diputar tanpa audio)
	useEffect(() => {
		player.setVirtualDuration(rows.reduce((a, r) => Math.max(a, r.end), 0));
	}, [rows, player]);

	// ---------- Audio ----------
	function clearAudio() {
		player.clear();
		if (mediaUrl.current) URL.revokeObjectURL(mediaUrl.current);
		mediaUrl.current = null;
		silentUrls.current.forEach((u) => URL.revokeObjectURL(u));
		silentUrls.current = [];
		setMediaVideo(null);
		setAudio(NO_AUDIO);
	}

	const onUpload = async (file: File) => {
		clearAudio();
		const url = URL.createObjectURL(file);
		mediaUrl.current = url;
		const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name);
		if (isVideo) {
			const v = document.createElement('video');
			v.playsInline = true;
			v.preload = 'auto';
			v.crossOrigin = 'anonymous';
			player.loadSingle(url, v);
			setMediaVideo(v);
			setMeta((m) => ({ ...m, style: { ...m.style, bgType: 'video' } }));
		} else player.loadSingle(url);
		setAudio({ kind: 'file', name: file.name, buffer: null, peaks: null, isVideo });
		setMeta((m) => ({ ...m, audioName: file.name }));
		track('upload_audio');
		setDecodeBusy(true);
		setStatus({ msg: t('Menganalisis audio…', 'Analysing audio…') });
		try {
			const buffer = await decodeBlob(file);
			setAudio({ kind: 'file', name: file.name, buffer, peaks: computePeaks(buffer), isVideo });
			setStatus({ msg: t(`Audio siap (${fmtClock(buffer.duration, false)}). Lanjutkan dengan “Sinkron otomatis” atau “Tap-sync”.`, `Audio ready (${fmtClock(buffer.duration, false)}). Continue with “Auto-sync” or “Tap-sync”.`) });
		} catch {
			setStatus({ msg: t('Audio bisa diputar, tetapi tidak bisa dianalisis (gelombang suara, sinkron otomatis, dan ekspor video tidak tersedia). Coba format MP3/WAV/M4A.', 'Audio plays but cannot be analysed (waveform, auto-sync and video export unavailable). Try MP3/WAV/M4A.'), err: true });
		} finally {
			setDecodeBusy(false);
		}
	};

	const onFetchQari = async () => {
		let current = rowsRef.current;
		if (!current.length) return;
		const r = getReciter(meta.reciter);
		// Satu audio per ayat; potongan ayat (group sama) berbagi audio yang sama.
		const unitOf = (rs: Row[]) => {
			const map: number[] = [];
			let u = -1;
			rs.forEach((x, i) => {
				if (x.kind === 'custom') map.push(-1);
				else {
					if (!(x.group && rs[i - 1]?.group === x.group)) u++;
					map.push(u);
				}
			});
			return map;
		};
		const units = unitOf(current);
		const urls: string[] = [];
		current.forEach((x, i) => {
			if (units[i] >= 0 && urls.length === units[i]) urls.push(x.kind === 'basmalah' ? ayahAudioUrl(r, 1, 1) : ayahAudioUrl(r, x.surah ?? meta.surah, x.ayah ?? 1));
		});
		clearAudio();
		setQariProg({ done: 0, total: urls.length });
		setStatus({ msg: t(`Mengambil ${urls.length} audio dari ${r.name}…`, `Fetching ${urls.length} clips by ${r.name}…`) });
		track('fetch_qari');
		try {
			const res = await fetchQari(urls, (done, total) => setQariProg({ done, total }));
			current = rowsRef.current;
			const un = unitOf(current);
			// Bagian tiap baris dari audio ayatnya (proporsional panjang teks Arab untuk potongan).
			const share = current.map((x, i) => {
				if (un[i] < 0) return 0;
				const [a, b] = x.group ? groupRange(current, i) : [i, i];
				const tot = current.slice(a, b + 1).reduce((s2, y) => s2 + Math.max(1, y.ar.length), 0);
				return Math.max(1, x.ar.length) / tot;
			});
			let tt = 0;
			const segs: Segment[] = [];
			const ctx = audioCtx();
			const next = current.map((row, i) => {
				const isCustom = un[i] < 0;
				const d = isCustom ? Math.max(1, row.end - row.start) : res.durations[un[i]] * share[i];
				if (!res.buffer) {
					if (isCustom) {
						const url = silentWavUrl(d);
						silentUrls.current.push(url);
						segs.push({ url, offset: tt, dur: d });
					} else if (un[i - 1] !== un[i]) {
						segs.push({ url: res.urls[un[i]], offset: tt, dur: res.durations[un[i]] });
					}
				}
				const out = { ...row, start: Math.round(tt * 1000) / 1000, end: Math.round((tt + d) * 1000) / 1000 };
				tt += d;
				return out;
			});
			if (res.buffer) {
				let finalBuf = res.buffer;
				if (current.some((x) => x.kind === 'custom')) {
					const src = res.buffer;
					const parts: AudioBuffer[] = [];
					let off = 0;
					const rateHz = src.sampleRate;
					current.forEach((row, i) => {
						if (un[i] < 0) {
							parts.push(ctx.createBuffer(src.numberOfChannels, Math.round(Math.max(1, row.end - row.start) * rateHz), rateHz));
						} else if (un[i - 1] !== un[i]) {
							const len = Math.round(res.durations[un[i]] * rateHz);
							const piece = ctx.createBuffer(src.numberOfChannels, len, rateHz);
							for (let c = 0; c < src.numberOfChannels; c++) piece.getChannelData(c).set(src.getChannelData(c).subarray(off, off + len));
							parts.push(piece);
							off += len;
						}
					});
					finalBuf = concatBuffers(parts);
				}
				const url = URL.createObjectURL(bufferToWav(finalBuf));
				mediaUrl.current = url;
				player.loadSingle(url, undefined, finalBuf.duration);
				setAudio({ kind: 'qari', name: r.name, buffer: finalBuf, peaks: computePeaks(finalBuf), isVideo: false });
				setStatus({ msg: t('Audio qari dimuat. Waktu tiap ayat terisi otomatis dari durasi audio.', 'Recitation loaded. Each verse is timed from its audio length.') });
			} else {
				player.loadPlaylist(segs);
				setAudio({ kind: 'playlist', name: r.name, buffer: null, peaks: null, isVideo: false });
				setStatus({ msg: t('Audio qari dimuat dalam mode putar berurutan. Waktu sudah terisi; gelombang suara & ekspor video tidak tersedia di mode ini.', 'Recitation loaded in sequential mode. Timing is filled; waveform & video export are unavailable in this mode.') });
			}
			dispatch({ type: 'set', rows: next });
			setMeta((m) => ({ ...m, audioName: r.name }));
			player.seek(0);
		} catch {
			setStatus({ msg: t('Gagal mengambil audio qari. Periksa koneksi internet atau coba qari lain.', 'Could not fetch the recitation. Check your connection or try another reciter.'), err: true });
		} finally {
			setQariProg(null);
		}
	};

	const runAutoSync = () => {
		if (!audio.buffer || !rows.length) return;
		const next = autoSync(audio.buffer, rows, 0, rows.length - 1, 0, audio.buffer.duration, sensitivity);
		dispatch({ type: 'set', rows: next });
		track('auto_sync');
		toast(t('Waktu diperkirakan dari jeda audio. Dengarkan dan koreksi bila perlu.', 'Timing estimated from pauses in the audio. Listen and adjust as needed.'));
	};
	const runDistribute = () => {
		const dur = player.duration || rows.at(-1)?.end || 0;
		if (!dur || !rows.length) return;
		dispatch({ type: 'set', rows: distribute(rows, 0, rows.length - 1, 0, dur) });
		toast(t('Waktu dibagi rata sesuai panjang ayat.', 'Time split by verse length.'));
	};

	// ---------- Latar ----------
	const onBgFile = (f: File) => {
		const url = URL.createObjectURL(f);
		setBgName(f.name);
		if (f.type.startsWith('video/')) {
			const v = document.createElement('video');
			v.muted = true;
			v.loop = true;
			v.playsInline = true;
			v.src = url;
			v.load();
			setBgClip(v);
			setBgImage(null);
		} else {
			const img = new Image();
			img.onload = () => setBgImage(img);
			img.src = url;
			setBgClip(null);
		}
	};
	const bgVideo = bgClip ?? (audio.isVideo ? mediaVideo : null);

	// ---------- Turunan ----------
	useEffect(() => {
		let alive = true;
		void ensureFonts(meta.style.arabicFont).then(() => alive && setFontsTick((x) => x + 1));
		return () => {
			alive = false;
		};
	}, [meta.style.arabicFont]);
	useEffect(() => {
		void serverStatus().then((st) => setAiOn(st.ai));
		track('visit_studio');
	}, []);
	// Uji "muat di layar" mengikuti gaya aktif; dipakai untuk memecah ayat panjang otomatis.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const fit = useMemo(() => makeFitTest(meta.style, meta.style.header), [meta.style, fontsTick]);
	const cues = useMemo(() => buildCues(rows, meta.content, meta.exp, fit), [rows, meta.content, meta.exp, fit]);
	const issues = useMemo(() => validateRows(rows, player.duration, lang), [rows, lang, player.duration, audio]);
	const errorCount = [...issues.values()].filter((x) => x.some((y) => y.level === 'error')).length;
	const warnCount = [...issues.values()].filter((x) => x.every((y) => y.level === 'warn')).length;
	const reciterLabel = meta.style.reciterName ? (audio.kind === 'qari' || audio.kind === 'playlist' ? audio.name : audio.kind === 'none' ? reciter.name : '') : '';
	const header = useMemo(() => ({ ar: surahMeta.name, latin: `Surah ${surahMeta.latin}${reciterLabel ? ' · ' + reciterLabel : ''}` }), [surahMeta, reciterLabel]);
	const activeIndex = useMemo(() => rows.findIndex((r) => now >= r.start && now < r.end), [rows, now]);

	const frameAt = useCallback(
		(tt: number): FrameInput => {
			const { cue, alpha } = cueAt(cues, tt, meta.style.fade);
			return { style: meta.style, lines: cue?.lines ?? [], alpha: cue ? alpha : 1, header, bgImage, bgVideo };
		},
		[cues, meta.style, header, bgImage, bgVideo],
	);

	// ---------- Jam UI & aturan putar ----------
	useEffect(() => {
		let raf = 0;
		let last = 0;
		const loop = (ts: number) => {
			const tt = player.time();
			if (playUntil.current !== null && tt >= playUntil.current) {
				player.pause();
				playUntil.current = null;
			}
			if (loopRow !== null) {
				const r = rowsRef.current[loopRow];
				if (r && tt >= r.end) player.seek(r.start);
			}
			if (ts - last > 90) {
				last = ts;
				setNow(tt);
			}
			if (player.playing) raf = requestAnimationFrame(loop);
		};
		const sync = () => {
			setPlaying(player.playing);
			setNow(player.time());
			cancelAnimationFrame(raf);
			if (player.playing) raf = requestAnimationFrame(loop);
		};
		const off = player.on(sync);
		sync();
		return () => {
			off();
			cancelAnimationFrame(raf);
		};
	}, [player, loopRow]);

	useEffect(() => {
		if (!followRows || !playing || activeIndex < 0) return;
		const el = rowsBox.current?.querySelector<HTMLElement>(`[data-row="${activeIndex}"]`);
		const box = rowsBox.current;
		if (el && box) {
			const top = el.offsetTop - box.offsetTop;
			if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTo({ top: top - 40, behavior: 'smooth' });
		}
	}, [activeIndex, playing, followRows]);

	// ---------- Operasi baris ----------
	const setRows = useCallback((fn: (r: Row[]) => Row[], coalesce?: string) => dispatch({ type: 'set', rows: fn, coalesce }), []);
	const contentRef = useRef(meta.content);
	contentRef.current = meta.content;
	const expRef = useRef(meta.exp);
	expRef.current = meta.exp;
	const fitRef = useRef(fit);
	fitRef.current = fit;

	/** Claude memilih titik potong terjemahan untuk satu ayat yang dipotong. */
	const alignGroup = async (i: number): Promise<boolean> => {
		const rs = rowsRef.current;
		const r = rs[i];
		if (!r?.group) return false;
		const [a, b] = groupRange(rs, i);
		const full = fullOf(r);
		const group = r.group;
		setAligning(group);
		try {
			const res = await aiAlign({
				surah: getSurah(r.surah ?? meta.surah).latin,
				ayah: r.ayah ?? 0,
				ar: rs.slice(a, b + 1).map((x) => x.ar),
				translations: { id: full.id, en: full.en },
			});
			const cur = rowsRef.current;
			const k = cur.findIndex((x) => x.group === group);
			const out = k < 0 ? cur : applyAlignment(cur, k, res);
			if (out === cur) throw new Error(t('Hasil Claude tidak lolos verifikasi teks, jadi tidak dipakai.', 'Claude’s result failed text verification and was not used.'));
			rowsRef.current = out;
			dispatch({ type: 'set', rows: out });
			return true;
		} catch (e) {
			toast((e as Error).message || t('Gagal merapikan terjemahan.', 'Could not align the translation.'));
			return false;
		} finally {
			setAligning(null);
		}
	};
	const alignRef = useRef(alignGroup);
	alignRef.current = alignGroup;

	/** Pecah semua ayat yang tidak muat di layar menjadi potongan yang bisa diatur sendiri. */
	const splitAllLong = async () => {
		const rs = rowsRef.current;
		const out: Row[] = [];
		let count = 0;
		for (const r of rs) {
			if (r.group || r.kind === 'custom' || !fit) {
				out.push(r);
				continue;
			}
			const n = buildCues([r], meta.content, { ...meta.exp, autoFit: true, splitLong: false }, fit).length;
			const parts = n > 1 ? splitRow(r, splitArabic(r.ar, n)) : [r];
			if (parts.length > 1) count++;
			out.push(...parts);
		}
		if (!count) {
			toast(t('Semua ayat sudah muat di layar.', 'Every verse already fits on screen.'));
			return;
		}
		rowsRef.current = out;
		dispatch({ type: 'set', rows: out });
		track('split_verse');
		if (aiOn && window.confirm(t(`${count} ayat dipotong di tanda waqaf. Rapikan terjemahannya dengan Claude sekarang?`, `${count} verses were cut at waqf marks. Align their translations with Claude now?`))) {
			const groups = [...new Set(out.filter((x) => x.group && !x.aligned).map((x) => x.group!))];
			let ok = 0;
			for (const g of groups) {
				const k = rowsRef.current.findIndex((x) => x.group === g);
				if (k >= 0 && (await alignGroup(k))) ok++;
			}
			toast(t(`${ok} dari ${groups.length} ayat dirapikan Claude.`, `${ok} of ${groups.length} verses aligned by Claude.`));
		} else toast(t(`${count} ayat dipotong. Atur waktu tiap potongan di daftar ayat.`, `${count} verses were cut. Adjust each part’s timing in the list.`));
	};

	const handlers: RowHandlers = useMemo(
		() => ({
			select: (i, seek) => {
				setSelected(i);
				if (seek) player.seek(rowsRef.current[i]?.start ?? 0);
			},
			setTime: (i, edge, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [edge]: Math.max(0, v) } : r))),
			nudge: (i, edge, d) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [edge]: Math.max(0, Math.round((r[edge] + d) * 1000) / 1000) } : r)), `nudge-${i}-${edge}`),
			markNow: (i, edge) => {
				const tt = Math.round(player.time() * 1000) / 1000;
				setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [edge]: tt } : r)));
			},
			edit: (i, field, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: v } : r)), `edit-${i}-${field}`),
			remove: (i) => {
				setRows((rs) => rs.filter((_, j) => j !== i));
				setSelected((s) => Math.max(0, s > i ? s - 1 : Math.min(s, rowsRef.current.length - 2)));
			},
			insertAfter: (i) => {
				setRows((rs) => {
					const prev = rs[i];
					const nxt = rs[i + 1];
					const start = prev ? prev.end : 0;
					const end = nxt && nxt.start > start + 0.5 ? nxt.start : start + 3;
					const row: Row = { key: uid(), kind: 'custom', ar: '', tr: '', id: '', en: '', start, end };
					return [...rs.slice(0, i + 1), row, ...rs.slice(i + 1)];
				});
				setSelected(i + 1);
			},
			playRow: (i) => {
				const r = rowsRef.current[i];
				if (!r) return;
				setSelected(i);
				player.seek(r.start);
				playUntil.current = r.end;
				void player.play().catch(() => toast(t('Audio tidak bisa diputar.', 'Audio could not play.')));
			},
			splitAt: (i, w) => {
				setRows((rs) => {
					const r = rs[i];
					if (!r) return rs;
					const out = splitRow(r, splitArabicAt(r.ar, w));
					return out.length > 1 ? [...rs.slice(0, i), ...out, ...rs.slice(i + 1)] : rs;
				});
				track('split_verse');
			},
			autoSplit: (i) => {
				const r = rowsRef.current[i];
				if (!r) return;
				const n = Math.max(2, buildCues([{ ...r, group: undefined }], contentRef.current, { ...expRef.current, autoFit: true, splitLong: false }, fitRef.current).length);
				setRows((rs) => {
					const out = splitRow(rs[i], splitArabic(rs[i].ar, n));
					return out.length > 1 ? [...rs.slice(0, i), ...out, ...rs.slice(i + 1)] : rs;
				});
				track('split_verse');
			},
			mergeNext: (i) => setRows((rs) => mergeNext(rs, i)),
			unsplit: (i) => setRows((rs) => unsplit(rs, i)),
			align: (i) => void alignRef.current(i),
			loopRow: (i) => {
				setLoopRow((cur) => {
					if (cur === i) return null;
					const r = rowsRef.current[i];
					if (r) {
						player.seek(r.start);
						void player.play().catch(() => undefined);
					}
					return i;
				});
				setSelected(i);
			},
		}),
		[player, setRows, t, toast],
	);

	const onEdge = useCallback(
		(i: number, edge: 'start' | 'end', v: number) => {
			setRows((rs) => {
				const r = rs[i];
				if (!r) return rs;
				const out = rs.slice();
				if (edge === 'start') {
					const nv = Math.min(v, r.end - 0.1);
					const prev = rs[i - 1];
					if (prev && Math.abs(prev.end - r.start) < 0.02) out[i - 1] = { ...prev, end: Math.max(prev.start + 0.1, nv) };
					out[i] = { ...r, start: Math.max(0, nv) };
				} else {
					const nv = Math.max(v, r.start + 0.1);
					const nxt = rs[i + 1];
					if (nxt && Math.abs(nxt.start - r.end) < 0.02) out[i + 1] = { ...nxt, start: Math.min(nxt.end - 0.1, nv) };
					out[i] = { ...r, end: nv };
				}
				return out;
			}, `drag-${i}-${edge}`);
		},
		[setRows],
	);

	const fixIssues = () => {
		setRows((rs) => {
			const out = rs.map((r) => ({ ...r, start: Math.max(0, r.start) }));
			for (let i = 0; i < out.length; i++) {
				const r = out[i];
				const prev = out[i - 1];
				if (prev && r.start < prev.end) {
					if (r.start > prev.start + 0.2) prev.end = r.start;
					else r.start = prev.end;
				}
				if (r.end <= r.start) {
					const nxt = out[i + 1];
					r.end = nxt && nxt.start > r.start + 0.3 ? nxt.start : r.start + 2;
				}
			}
			return out;
		});
		toast(t('Waktu yang bermasalah sudah dirapikan.', 'Problem timings were fixed.'));
	};

	const shiftAll = (d: number) => {
		if (!Number.isFinite(d) || !d) return;
		setRows((rs) => rs.map((r) => ({ ...r, start: Math.max(0, Math.round((r.start + d) * 1000) / 1000), end: Math.max(0.1, Math.round((r.end + d) * 1000) / 1000) })));
		toast(t(`Semua waktu digeser ${d > 0 ? '+' : ''}${d} detik.`, `All times shifted by ${d > 0 ? '+' : ''}${d}s.`));
	};

	const addCustom = () => handlers.insertAfter(rows.length - 1);

	// ---------- Tap-sync ----------
	const startTap = () => {
		ended.current.clear();
		setTapIndex(selected);
		setTapOn(true);
		track('tap_sync');
		if (!player.playing) void player.play().catch(() => undefined);
	};
	const tap = useCallback(() => {
		const tt = Math.round(player.time() * 1000) / 1000;
		const k = tapIndex;
		const rs = rowsRef.current;
		if (k >= rs.length) {
			toast(t('Semua baris sudah ditandai. Tekan E untuk mengakhiri baris terakhir.', 'All rows marked. Press E to end the last row.'));
			return;
		}
		setRows((cur) =>
			cur.map((r, j) => {
				if (j === k) return { ...r, start: tt, end: r.end > tt ? r.end : tt + Math.max(1, r.end - r.start) };
				if (j === k - 1 && !ended.current.has(k - 1)) return { ...r, end: Math.max(r.start + 0.1, tt) };
				return r;
			}),
		);
		setSelected(k);
		setTapIndex(k + 1);
	}, [player, tapIndex, setRows, t, toast]);
	const tapEnd = useCallback(() => {
		const tt = Math.round(player.time() * 1000) / 1000;
		const k = tapIndex - 1;
		if (k < 0) return;
		ended.current.add(k);
		setRows((cur) => cur.map((r, j) => (j === k ? { ...r, end: Math.max(r.start + 0.1, tt) } : r)));
		if (tapIndex >= rowsRef.current.length) {
			setTapOn(false);
			player.pause();
			toast(t('Tap-sync selesai. Periksa hasilnya di linimasa.', 'Tap-sync finished. Review it on the timeline.'));
		}
	}, [player, tapIndex, setRows, t, toast]);

	// ---------- Simpan ----------
	const save = useCallback(async () => {
		const p = { ...project, updatedAt: Date.now() };
		const ok = saveLocal(p);
		track('save_project');
		if (!ok) {
			toast(t('Penyimpanan browser penuh. Ekspor proyek sebagai .json.', 'Browser storage is full. Export the project as .json.'));
			return;
		}
		setSavedAt(p.updatedAt);
		if (params.get('p') !== p.id) setParams({ p: p.id }, { replace: true });
		if (auth.user) {
			try {
				const id = await saveCloud(p, meta.cloudId);
				setMeta((m) => ({ ...m, cloudId: id }));
				toast(t('Tersimpan di perangkat dan cloud.', 'Saved on this device and in the cloud.'));
			} catch (e) {
				const code = (e as { code?: string }).code;
				if (code === 'limit') toast(t(`Tersimpan di perangkat ini. Batas cloud paket Gratis (${FREE_CLOUD_LIMIT} proyek) sudah tercapai; hapus satu atau upgrade ke Pro.`, `Saved on this device. Free cloud limit (${FREE_CLOUD_LIMIT} projects) reached; delete one or upgrade to Pro.`));
				else if (code === 'unverified') toast(t('Tersimpan di perangkat ini. Verifikasi email Anda agar bisa sinkron ke cloud.', 'Saved on this device. Verify your email to sync to the cloud.'));
				else toast(t('Tersimpan di perangkat ini. Sinkron cloud gagal.', 'Saved on this device. Cloud sync failed.'));
			}
		} else toast(t('Proyek tersimpan di browser ini.', 'Project saved in this browser.'));
	}, [project, auth.user, meta.cloudId, params, setParams, t, toast]);

	const exportProject = () => saveText(JSON.stringify(project, null, 1), `${projectTitle(meta).replace(/[^\w-]+/g, '_')}.qss.json`, 'application/json');

	const importProject = async (f: File) => {
		try {
			const p = normalizeProject(JSON.parse(await f.text()));
			clearAudio();
			loadProject({ ...p, id: uid() });
			toast(t('Proyek dibuka. Muat audionya lagi untuk melanjutkan sinkronisasi.', 'Project opened. Load its audio again to continue syncing.'));
		} catch {
			toast(t('File ini bukan proyek Quran SRT Studio yang valid.', 'This is not a valid Quran SRT Studio project file.'));
		}
	};

	const newOne = () => {
		if (rows.length && !window.confirm(t('Mulai proyek baru? Pastikan proyek ini sudah disimpan.', 'Start a new project? Make sure this one is saved.'))) return;
		clearAudio();
		const { rows: _r, ...m } = newProject();
		setMeta(m);
		setSavedAt(null);
		navigate('/studio?new=1', { replace: true });
		void loadAyat(1, 1, 7, false);
	};

	// ---------- Pintasan keyboard ----------
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const el = e.target as HTMLElement;
			const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
			const mod = e.ctrlKey || e.metaKey;
			if (mod && e.key.toLowerCase() === 's') {
				e.preventDefault();
				void save();
				return;
			}
			if (typing || document.querySelector('dialog[open]')) return;
			if (mod && e.key.toLowerCase() === 'z') {
				e.preventDefault();
				dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
				return;
			}
			if (mod && e.key.toLowerCase() === 'y') {
				e.preventDefault();
				dispatch({ type: 'redo' });
				return;
			}
			if (mod || e.altKey) return;
			const k = e.key.toLowerCase();
			if (e.code === 'Space') {
				e.preventDefault();
				if (tapOn) tap();
				else void player.toggle().catch(() => undefined);
			} else if (k === 'k') void player.toggle().catch(() => undefined);
			else if (k === 't') {
				if (tapOn) tap();
			} else if (k === 'e') {
				if (tapOn) tapEnd();
			} else if (k === 'j') player.seek(player.time() - 2);
			else if (k === 'l') player.seek(player.time() + 2);
			else if (k === ',') player.seek(player.time() - 0.1);
			else if (k === '.') player.seek(player.time() + 0.1);
			else if (e.key === 'ArrowDown') {
				e.preventDefault();
				setSelected((s) => Math.min(rowsRef.current.length - 1, s + 1));
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				setSelected((s) => Math.max(0, s - 1));
			} else if (k === 'p') handlers.playRow(selected);
			else if (k === '[') handlers.markNow(selected, 'start');
			else if (k === ']') handlers.markNow(selected, 'end');
			else if (e.key === 'Escape' && tapOn) setTapOn(false);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [tapOn, tap, tapEnd, player, save, handlers, selected]);

	// ---------- Turunan UI ----------
	const offerB = shouldOfferBasmalah(meta.surah, meta.from);
	const watermark = cfg.freeVideoWatermark && auth.enabled && (!auth.user || auth.user.plan === 'free') ? 'Quran SRT Studio' : '';
	const batchLocked = auth.enabled && (!auth.user || auth.user.plan === 'free');
	const duration = player.hasMedia ? player.duration : rows.reduce((a, r) => Math.max(a, r.end), 0);
	const setContent = (p: Partial<ContentSettings>) => setMeta((m) => ({ ...m, content: { ...m.content, ...p } }));
	const setExp = (p: Partial<ExportSettings>) => setMeta((m) => ({ ...m, exp: { ...m.exp, ...p } }));
	const setStyle = (p: Partial<StyleSettings>) => setMeta((m) => ({ ...m, style: { ...m.style, ...p, template: p.template ?? (Object.keys(p).some((k) => k !== 'ratio') ? 'custom' : m.style.template) } }));
	const busy = textBusy || !!qariProg || decodeBusy;

	return (
		<div className="studio">
			<div className="studio-bar">
				<label className="sr-only" htmlFor="pname">{t('Nama proyek', 'Project name')}</label>
				<input id="pname" className="title-input" value={meta.name} placeholder={projectTitle({ ...meta, name: '' })} onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))} />
				{savedAt && <span className="saved">{t('Disimpan', 'Saved')} {new Date(savedAt).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'id-ID', { hour: '2-digit', minute: '2-digit' })}{meta.cloudId ? ' ☁' : ''}</span>}
				<span className="spacer" />
				<button className="btn btn-sm" onClick={newOne} aria-label={t('Proyek baru', 'New project')}><FilePlus2 size={15} /> <span className="lbl">{t('Baru', 'New')}</span></button>
				<button className="btn btn-sm" onClick={() => importRef.current?.click()} aria-label={t('Buka file proyek', 'Open project file')}><FolderOpen size={15} /> <span className="lbl">{t('Buka file', 'Open file')}</span></button>
				<input ref={importRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importProject(f); e.target.value = ''; }} />
				<button className="btn btn-sm" onClick={() => navigate('/proyek')} aria-label={t('Proyek saya', 'My projects')}><BookOpen size={15} /> <span className="lbl">{t('Proyek saya', 'My projects')}</span></button>
				<button className="btn btn-sm btn-primary" onClick={() => void save()} title="Ctrl+S">{auth.user ? <Cloud size={15} /> : <Save size={15} />} {t('Simpan', 'Save')}</button>
			</div>

			<div className="sources">
				<section className="card src-card" aria-labelledby="src-ayat">
					<h2 id="src-ayat"><BookOpen size={17} /> {t('Pilih ayat', 'Choose verses')}</h2>
					<div className="src-row">
						<label className="field">
							<span>Surah</span>
							<select
								className="select"
								value={meta.surah}
								onChange={(e) => {
									const n = Number(e.target.value);
									setMeta((m) => ({ ...m, surah: n, from: 1, to: defaultTo(n), basmalah: shouldOfferBasmalah(n, 1) }));
								}}
							>
								{SURAHS.map((s) => (
									<option key={s.number} value={s.number}>
										{s.number}. {s.latin} ({lang === 'en' ? s.meaningEn : s.meaningId}) — {s.verses} {t('ayat', 'verses')}
									</option>
								))}
							</select>
						</label>
						<label className="field">
							<span>{t('Dari', 'From')}</span>
							<input className="input" type="number" min={1} max={surahMeta.verses} value={meta.from} onChange={(e) => { const v = Math.max(1, Math.min(surahMeta.verses, Number(e.target.value) || 1)); setMeta((m) => ({ ...m, from: v, to: Math.max(v, m.to), basmalah: v === 1 ? shouldOfferBasmalah(m.surah, 1) && m.basmalah : false })); }} />
						</label>
						<label className="field">
							<span>{t('Sampai', 'To')}</span>
							<input className="input" type="number" min={1} max={surahMeta.verses} value={meta.to} onChange={(e) => setMeta((m) => ({ ...m, to: Math.max(1, Math.min(surahMeta.verses, Number(e.target.value) || 1)) }))} />
						</label>
						<button
							className="btn btn-primary"
							disabled={busy}
							onClick={() => {
								if (hist.past.length && !window.confirm(t('Muat ulang ayat? Waktu dan suntingan saat ini akan diganti (masih bisa dibatalkan dengan Ctrl+Z).', 'Reload verses? Current timing and edits will be replaced.'))) return;
								void loadAyat(meta.surah, meta.from, meta.to, offerB && meta.basmalah, false, !!meta.taawudz);
							}}
						>
							{textBusy ? <Loader2 size={16} className="spin" /> : <Download size={16} />} {t('Muat ayat', 'Load verses')}
						</button>
					</div>
					<div className="src-foot">
						<label className="check" title={t('Bacaan isti‘adzah sebelum membaca; dimasukkan sebagai teks bebas, bukan ayat.', 'Isti‘adhah before reciting; added as custom text, not a verse.')}><input type="checkbox" checked={!!meta.taawudz} onChange={(e) => setMeta((m) => ({ ...m, taawudz: e.target.checked }))} /> {t('Ta‘awudz di awal', 'Ta‘awwudh first')}</label>
						{offerB && (
							<label className="check"><input type="checkbox" checked={meta.basmalah} onChange={(e) => setMeta((m) => ({ ...m, basmalah: e.target.checked }))} /> {t('Basmalah di awal', 'Basmalah first')}</label>
						)}
						<span className="status-line">{surahMeta.name && <span className="ar" style={{ fontSize: 20 }}>{surahMeta.name}</span>} {surahMeta.type === 'M' ? t('Makkiyah', 'Meccan') : t('Madaniyah', 'Medinan')}, {surahMeta.verses} {t('ayat', 'verses')}</span>
					</div>
				</section>

				<section className="card src-card" aria-labelledby="src-audio">
					<h2 id="src-audio"><AudioLines size={17} /> {t('Audio murotal', 'Recitation audio')}</h2>
					<div className="src-row audio">
						<label className="field">
							<span>Qari</span>
							<select className="select" value={meta.reciter} onChange={(e) => setMeta((m) => ({ ...m, reciter: e.target.value }))}>
								{RECITERS.map((r) => (
									<option key={r.id} value={r.id}>{r.name} — {r.style}</option>
								))}
							</select>
						</label>
						<button className="btn btn-primary" disabled={busy || !rows.length} onClick={onFetchQari}>
							{qariProg ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />} {t('Ambil & sinkronkan', 'Fetch & sync')}
						</button>
					</div>
					<label
						className="drop"
						onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('over'); }}
						onDragLeave={(e) => e.currentTarget.classList.remove('over')}
						onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('over'); const f = e.dataTransfer.files?.[0]; if (f) void onUpload(f); }}
					>
						<Upload size={18} />
						<b>{audio.kind === 'file' ? audio.name : t('atau unggah audio/video murotal sendiri', 'or upload your own recitation audio/video')}</b>
						<span className="hint" style={{ marginLeft: 'auto' }}>MP3, WAV, M4A, MP4</span>
						<input type="file" accept="audio/*,video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); e.target.value = ''; }} />
					</label>
					{qariProg && (
						<div className="progress" aria-label={t('Progres unduhan', 'Download progress')}><i style={{ width: `${(qariProg.done / Math.max(1, qariProg.total)) * 100}%` }} /></div>
					)}
					{status && <p className={`status-line${status.err ? ' err' : ''}`} role="status">{status.msg}</p>}
					{audio.kind !== 'none' && (
						<div className="src-foot">
							<span className="badge">{audio.kind === 'file' ? t('File unggahan', 'Uploaded file') : audio.kind === 'qari' ? 'Qari' : t('Qari (berurutan)', 'Reciter (sequential)')}: {audio.name}</span>
							{audio.buffer && audio.kind === 'file' && (
								<>
									<button className="btn btn-sm" onClick={runAutoSync} disabled={!rows.length}><Sparkles size={14} /> {t('Sinkron otomatis', 'Auto-sync')}</button>
									<label className="field" style={{ fontSize: 12, minWidth: 140 }}>
										<span>{t('Kepekaan jeda', 'Pause sensitivity')}</span>
										<input type="range" min={0} max={1} step={0.05} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} />
									</label>
								</>
							)}
							{audio.kind === 'file' && <button className="btn btn-sm" onClick={runDistribute}><AlignJustify size={14} /> {t('Bagi rata', 'Spread evenly')}</button>}
							<button className="btn btn-sm btn-ghost" onClick={clearAudio}><X size={14} /> {t('Lepas audio', 'Remove audio')}</button>
						</div>
					)}
				</section>
			</div>

			<div className="workbench">
				<div className="left-col">
					<section className="card transport" aria-label={t('Kontrol pemutaran', 'Playback controls')}>
						<button className="btn btn-primary play" onClick={() => void player.toggle().catch(() => toast(t('Audio tidak bisa diputar.', 'Audio could not play.')))} aria-label={playing ? t('Jeda', 'Pause') : t('Putar', 'Play')}>
							{playing ? <Pause size={20} /> : <Play size={20} />}
						</button>
						<button className="btn btn-ghost btn-icon" onClick={() => player.seek(player.time() - 2)} aria-label={t('Mundur 2 detik', 'Back 2 seconds')} title="J"><RotateCcw size={18} /></button>
						<button className="btn btn-ghost btn-icon" onClick={() => player.seek(player.time() + 2)} aria-label={t('Maju 2 detik', 'Forward 2 seconds')} title="L"><RotateCw size={18} /></button>
						<span className="clock" aria-live="off">{fmtClock(now)} <small>/ {fmtClock(duration, false)}</small></span>
						<label className="sr-only" htmlFor="rate">{t('Kecepatan', 'Speed')}</label>
						<select id="rate" className="select" style={{ width: 86, minHeight: 36 }} value={rate} onChange={(e) => { const r = Number(e.target.value); setRate(r); player.setRate(r); }}>
							{[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={r}>{r}×</option>)}
						</select>
						<span className="grow" />
						<button className="btn btn-ghost btn-icon" onClick={() => dispatch({ type: 'undo' })} disabled={!hist.past.length} aria-label={t('Batalkan', 'Undo')} title="Ctrl+Z"><Undo2 size={17} /></button>
						<button className="btn btn-ghost btn-icon" onClick={() => dispatch({ type: 'redo' })} disabled={!hist.future.length} aria-label={t('Ulangi', 'Redo')} title="Ctrl+Shift+Z"><Redo2 size={17} /></button>
						<button className="btn tap-btn" aria-pressed={tapOn} onClick={() => (tapOn ? setTapOn(false) : startTap())} disabled={!rows.length}>
							<Hand size={16} /> Tap-sync
						</button>
						<button className="btn btn-ghost btn-icon" onClick={() => setTab('help')} aria-label={t('Pintasan keyboard', 'Keyboard shortcuts')}><Keyboard size={17} /></button>
					</section>

					{tapOn && (
						<section className="card tap-panel" aria-live="polite">
							<button className="btn btn-primary big" onClick={tap} disabled={tapIndex >= rows.length}>
								{tapIndex < rows.length
									? t(`Tap: mulai ${rows[tapIndex].kind === 'ayah' ? 'ayat ' + rows[tapIndex].ayah : rows[tapIndex].kind === 'basmalah' ? 'basmalah' : 'teks'}`, `Tap: start ${rows[tapIndex].kind === 'ayah' ? 'verse ' + rows[tapIndex].ayah : rows[tapIndex].kind}`)
									: t('Semua sudah ditandai', 'All marked')}
								<kbd>Spasi</kbd>
							</button>
							<button className="btn big" onClick={tapEnd} disabled={tapIndex === 0}>{t('Akhiri baris', 'End row')} <kbd>E</kbd></button>
							<p>{t('Tekan Spasi tepat saat ayat mulai dibaca. Akhir ayat sebelumnya ikut terisi. Tekan E bila ada jeda panjang sebelum ayat berikutnya.', 'Press Space exactly when a verse starts; the previous verse ends there too. Press E if there is a long pause before the next verse.')}</p>
							<button className="btn btn-ghost btn-sm" onClick={() => setTapOn(false)}><X size={14} /> {t('Selesai', 'Done')}</button>
						</section>
					)}

					<Timeline player={player} peaks={audio.peaks} duration={duration} rows={rows} selected={selected} onSelect={setSelected} onEdge={onEdge} version={hist.rev} />

					<section className="card rows-card" aria-labelledby="rows-title">
						<div className="rows-head">
							<h2 id="rows-title">{t('Daftar ayat', 'Verses')} <span className="badge">{rows.length}</span></h2>
							<label className="check" style={{ fontSize: 13 }}><input type="checkbox" checked={followRows} onChange={(e) => setFollowRows(e.target.checked)} /> {t('Ikuti', 'Follow')}</label>
							<span className="time-box" title={t('Geser semua waktu', 'Shift all times')}>
								<label htmlFor="shift">{t('Geser', 'Shift')}</label>
								<input id="shift" value={offset} onChange={(e) => setOffset(e.target.value)} style={{ width: 52 }} inputMode="decimal" />
								<button onClick={() => shiftAll(-Number(offset.replace(',', '.')))} aria-label={t('Geser semua lebih awal', 'Shift all earlier')}>−</button>
								<button onClick={() => shiftAll(Number(offset.replace(',', '.')))} aria-label={t('Geser semua lebih lambat', 'Shift all later')}>+</button>
							</span>
							<button className="btn btn-sm" onClick={() => void splitAllLong()} disabled={!rows.length} title={t('Potong ayat yang terlalu panjang untuk satu layar menjadi beberapa baris (di tanda waqaf)', 'Cut verses too long for one screen into several rows (at waqf marks)')}><Scissors size={14} /> {t('Potong ayat panjang', 'Cut long verses')}</button>
							<button className="btn btn-sm" onClick={addCustom}><Plus size={14} /> {t('Teks bebas', 'Custom text')}</button>
							{rows.length > 0 && (
								<button className="btn btn-sm btn-ghost btn-danger" onClick={() => { if (window.confirm(t('Hapus semua baris?', 'Delete all rows?'))) dispatch({ type: 'set', rows: [] }); }} aria-label={t('Hapus semua baris', 'Delete all rows')}><Trash2 size={14} /></button>
							)}
						</div>
						<div className="rows" ref={rowsBox}>
							{textBusy && !rows.length ? (
								<div className="empty"><Loader2 className="spin" /> {t('Memuat ayat…', 'Loading verses…')}</div>
							) : !rows.length ? (
								<div className="empty">
									<h3>{t('Belum ada ayat', 'No verses yet')}</h3>
									<p>{t('Pilih surah dan rentang ayat di atas, lalu klik “Muat ayat”.', 'Pick a surah and range above, then click “Load verses”.')}</p>
								</div>
							) : (
								rows.map((r, i) => (
									<RowItem
										key={r.key}
										row={r}
										index={i}
										selected={i === selected}
										active={i === activeIndex}
										looping={loopRow === i}
										issues={issues.get(i)}
										lang={meta.content.translation === 'none' ? (lang === 'en' ? 'en' : 'id') : meta.content.translation}
										showTranslit={meta.content.translit}
										part={r.group ? partInfo(rows, i) : null}
										aiEnabled={aiOn}
										aligning={!!r.group && aligning === r.group}
										t={t}
										h={handlers}
									/>
								))
							)}
						</div>
					</section>
				</div>

				<div className="right-col">
					<section className="card preview-card" aria-label={t('Pratinjau', 'Preview')}>
						<Preview
							player={player}
							cues={cues}
							style={meta.style}
							header={header}
							bgImage={meta.style.bgType === 'image' ? bgImage : null}
							bgVideo={meta.style.bgType === 'video' ? bgVideo : null}
							bgVideoIsMedia={!bgClip && audio.isVideo}
							selectedRow={selected}
							placeholder={t('Subtitle akan tampil di sini', 'Subtitles appear here')}
							label={t('Pratinjau subtitle', 'Subtitle preview')}
						/>
						<div className="preview-bar">
							<div className="seg" role="group" aria-label={t('Rasio', 'Ratio')}>
								{(['16:9', '9:16', '1:1'] as const).map((r) => (
									<button key={r} aria-pressed={meta.style.ratio === r} onClick={() => setStyle({ ratio: r })}>{r}</button>
								))}
							</div>
								<button className="btn btn-ghost btn-sm btn-icon" onClick={() => void document.querySelector<HTMLElement>('.preview-frame')?.requestFullscreen?.().catch(() => undefined)} aria-label={t('Pratinjau layar penuh', 'Full-screen preview')} title={t('Layar penuh', 'Full screen')}><Maximize2 size={15} /></button>
								<span className="status-line">
									{activeIndex >= 0 ? (rows[activeIndex].kind === 'ayah' ? t(`Ayat ${rows[activeIndex].ayah}`, `Verse ${rows[activeIndex].ayah}`) : rows[activeIndex].kind === 'basmalah' ? 'Basmalah' : t('Teks bebas', 'Custom text')) : '—'}
							</span>
						</div>
					</section>

					<section className="card">
						<div className="tabs" role="tablist">
							{([
								['style', t('Tampilan', 'Style'), <Palette key="i" size={15} />],
								['export', t('Ekspor', 'Export'), <Download key="i" size={15} />],
								['ai', t('Asisten AI', 'AI assistant'), <Sparkles key="i" size={15} />],
								['help', t('Bantuan', 'Help'), <HelpCircle key="i" size={15} />],
							] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => (
								<button key={id} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} id={`tab-${id}`} onClick={() => setTab(id)}>
									{icon} {label}
									{id === 'export' && errorCount > 0 && <span className="badge" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{errorCount}</span>}
								</button>
							))}
						</div>
						<div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
							{tab === 'style' && (
								<StylePanel
									style={meta.style}
									set={setStyle}
									bgName={bgName}
									onBgFile={onBgFile}
									onBgClear={() => { setBgName(''); setBgImage(null); setBgClip(null); }}
									mediaIsVideo={audio.isVideo}
								/>
							)}
							{tab === 'export' && (
								<ExportPanel
									rows={rows}
									cues={cues}
									content={meta.content}
									setContent={setContent}
									exp={meta.exp}
									setExp={setExp}
									style={meta.style}
									surah={meta.surah}
									reciterName={audio.kind === 'qari' || audio.kind === 'playlist' ? reciter.name : ''}
									buffer={audio.buffer}
									audioKind={audio.kind}
									errorCount={errorCount}
									warnCount={warnCount}
									onFix={fixIssues}
									onExportProject={exportProject}
									frameAt={frameAt}
									bgVideo={bgVideo}
									bgLoop={!!bgClip}
									watermark={watermark}
									batchLocked={batchLocked}
									onBatch={() => setBatchOpen(true)}
									toast={toast}
									audioName={audio.name}
								/>
							)}
							{tab === 'ai' && <AiPanel rows={rows} surah={meta.surah} reciterName={audio.kind === 'none' ? '' : reciter.name} toast={toast} />}
							{tab === 'help' && <HelpPanel />}
						</div>
					</section>
				</div>
			</div>

			<BatchDialog fit={fit} open={batchOpen} onClose={() => setBatchOpen(false)} content={meta.content} exp={meta.exp} reciter={meta.reciter} locked={batchLocked} />
			{toastMsg && <div className="toast" role="status">{toastMsg}</div>}
		</div>
	);
}

function HelpPanel() {
	const { t } = useT();
	const keys: [string, string][] = [
		['Spasi / K', t('Putar / jeda (saat tap-sync: tandai mulai ayat)', 'Play / pause (in tap-sync: mark verse start)')],
		['E', t('Akhiri baris (saat tap-sync)', 'End row (in tap-sync)')],
		['J / L', t('Mundur / maju 2 detik', 'Back / forward 2 seconds')],
		[', / .', t('Mundur / maju 0,1 detik', 'Back / forward 0.1 second')],
		['↑ / ↓', t('Pilih baris sebelumnya / berikutnya', 'Select previous / next row')],
		['P', t('Putar baris terpilih', 'Play selected row')],
		['[ / ]', t('Set mulai / akhir baris terpilih ke posisi sekarang', 'Set selected row start / end to playhead')],
		['Ctrl+Z', t('Batalkan', 'Undo')],
		['Ctrl+Shift+Z', t('Ulangi', 'Redo')],
		['Ctrl+S', t('Simpan proyek', 'Save project')],
	];
	return (
		<div className="tab-body">
			<div className="group">
				<h3>{t('Pintasan keyboard', 'Keyboard shortcuts')}</h3>
				<div className="shortcuts">
					{keys.map(([k, d]) => (
						<Fragment key={k}>
							<kbd>{k}</kbd>
							<span>{d}</span>
						</Fragment>
					))}
				</div>
			</div>
			<div className="group">
				<h3>{t('Alur tercepat', 'Fastest workflow')}</h3>
				<ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
					<li>{t('Pilih surah & ayat, klik “Muat ayat”.', 'Pick surah & verses, click “Load verses”.')}</li>
					<li>{t('Pilih qari, klik “Ambil & sinkronkan” — waktu terisi otomatis.', 'Pick a reciter, click “Fetch & sync” — timing fills in.')}</li>
					<li>{t('Atur tampilan di tab Tampilan, lalu unduh .SRT atau buat video di tab Ekspor.', 'Style it in the Style tab, then download .SRT or render video in Export.')}</li>
				</ol>
			</div>
			<div className="group">
				<h3>{t('Pakai audio sendiri', 'Using your own audio')}</h3>
				<p>{t('Unggah file murotal, lalu coba “Sinkron otomatis”. Hasilnya perkiraan dari jeda bacaan — dengarkan dan rapikan dengan menarik tepi blok di linimasa, atau ulangi dengan Tap-sync.', 'Upload a recitation file, then try “Auto-sync”. It estimates from pauses — listen and refine by dragging block edges, or redo with Tap-sync.')}</p>
				<p><a href="/panduan" target="_blank" rel="noreferrer">{t('Buka panduan lengkap', 'Open the full guide')}</a></p>
			</div>
			<p className="status-line"><SlidersHorizontal size={14} /> {t('Teks Arab Al-Qur’an dikunci agar tidak berubah. Terjemahan & teks bebas bisa disunting.', 'Quran Arabic text is locked. Translations and custom text can be edited.')}</p>
		</div>
	);
}
