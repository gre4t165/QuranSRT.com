import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Download, Loader2, Lock, X } from 'lucide-react';
import { SURAHS, getSurah } from '~/data/surahs';
import { RECITERS, ayahAudioUrl, getReciter } from '~/lib/reciters';
import { loadBasmalah, loadSurah } from '~/lib/quran';
import { probeDuration, pool } from '~/lib/audio';
import { rowsFromAyat, shouldOfferBasmalah, type ContentSettings, type ExportSettings } from '~/lib/project';
import { buildCues, fileBase, toDescription, toSRT, toVTT, type FitTest } from '~/lib/subtitles';
import { track } from '~/lib/api';
import { saveBlob } from '~/lib/download';
import { useT } from '~/lib/i18n';
import { Link } from 'react-router';

interface Props {
	open: boolean;
	onClose: () => void;
	content: ContentSettings;
	exp: ExportSettings;
	reciter: string;
	locked: boolean;
	fit?: FitTest;
}

const PRESETS = [
	{ label: "Juz 30 (An-Naba' – An-Nas)", from: 78, to: 114 },
	{ label: 'Juz 29 (Al-Mulk – Al-Mursalat)', from: 67, to: 77 },
	{ label: "Al-Kahf", from: 18, to: 18 },
	{ label: 'Al-Ikhlas – An-Nas', from: 112, to: 114 },
];

export function BatchDialog({ open, onClose, content, exp, reciter, locked, fit }: Props) {
	const { t, lang } = useT();
	const ref = useRef<HTMLDialogElement>(null);
	const [from, setFrom] = useState(112);
	const [to, setTo] = useState(114);
	const [rid, setRid] = useState(reciter);
	const [fmt, setFmt] = useState<'srt' | 'vtt' | 'both'>('srt');
	const [desc, setDesc] = useState(true);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState('');
	const [pct, setPct] = useState(0);
	const cancel = useRef(false);

	useEffect(() => {
		const d = ref.current;
		if (!d) return;
		if (open && !d.open) d.showModal();
		if (!open && d.open) d.close();
	}, [open]);
	useEffect(() => setRid(reciter), [reciter]);

	const a = Math.min(from, to);
	const b = Math.max(from, to);
	const totalAyat = SURAHS.slice(a - 1, b).reduce((s, x) => s + x.verses, 0);

	const run = async () => {
		setBusy(true);
		cancel.current = false;
		const zip = new JSZip();
		const r = getReciter(rid);
		const basm = await loadBasmalah();
		let done = 0;
		try {
			for (let n = a; n <= b; n++) {
				if (cancel.current) throw new Error(t('Dibatalkan', 'Cancelled'));
				const s = getSurah(n);
				setMsg(t(`Memproses ${s.latin}…`, `Processing ${s.latin}…`));
				const ayat = await loadSurah(n);
				const withB = shouldOfferBasmalah(n, 1);
				const urls = [...(withB ? [ayahAudioUrl(r, 1, 1)] : []), ...ayat.map((x) => ayahAudioUrl(r, n, x.n))];
				const durs = await pool(urls, 6, (u) => probeDuration(u), () => setPct(Math.round(((done += 1) / (totalAyat + (b - a + 1))) * 100)));
				const rows = rowsFromAyat(n, ayat, 1, ayat.length, withB ? basm : null, durs);
				const cues = buildCues(rows, content, exp, fit);
				const name = `${String(n).padStart(3, '0')}_${fileBase(n, rows, content.translation === 'none' ? 'ar' : content.translation)}`;
				if (fmt !== 'vtt') zip.file(`${name}.srt`, toSRT(cues, exp));
				if (fmt !== 'srt') zip.file(`${name}.vtt`, toVTT(cues, exp, s.latin));
				if (desc) zip.file(`${name}_deskripsi.txt`, toDescription(rows, content, { surah: n, reciter: r.name, lang }));
			}
			zip.file('BACA-SAYA.txt', `Subtitle dibuat dengan Quran SRT Studio\nQari: ${r.name}\nWaktu mengikuti durasi audio per ayat dari EveryAyah.com (${r.folder}).\nGabungkan audio per ayat secara berurutan agar subtitle pas.\n`);
			setMsg(t('Mengemas ZIP…', 'Packing ZIP…'));
			track('export_batch');
			const blob = await zip.generateAsync({ type: 'blob' });
			saveBlob(blob, `quran-srt_${a}-${b}_${r.id}.zip`);
			setMsg(t('Selesai. File ZIP sudah diunduh.', 'Done. ZIP downloaded.'));
		} catch (e) {
			setMsg((e as Error).message || t('Gagal memproses batch. Periksa koneksi internet.', 'Batch failed. Check your connection.'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="batch-title">
			<div className="dialog-head">
				<h2 id="batch-title">{t('Batch subtitle (ZIP)', 'Batch subtitles (ZIP)')}</h2>
				<button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('Tutup', 'Close')}><X size={18} /></button>
			</div>
			<div className="dialog-body">
				{locked ? (
					<div className="notice">
						<Lock size={16} />
						<div>
							{t('Batch tersedia di paket Pro.', 'Batch is available on the Pro plan.')} <Link to="/harga">{t('Lihat paket', 'See plans')}</Link>
						</div>
					</div>
				) : (
					<>
						<p className="status-line">{t('Buat subtitle untuk banyak surah sekaligus. Waktu tiap ayat diambil dari durasi audio qari per ayat.', 'Make subtitles for many surahs at once. Each verse is timed from the reciter’s per-verse audio length.')}</p>
						<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
							{PRESETS.map((p) => (
								<button key={p.label} className="btn btn-sm" onClick={() => { setFrom(p.from); setTo(p.to); }}>{p.label}</button>
							))}
						</div>
						<div className="grid-2">
							<label className="field"><span>{t('Dari surah', 'From surah')}</span>
								<select className="select" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
									{SURAHS.map((s) => <option key={s.number} value={s.number}>{s.number}. {s.latin}</option>)}
								</select>
							</label>
							<label className="field"><span>{t('Sampai surah', 'To surah')}</span>
								<select className="select" value={to} onChange={(e) => setTo(Number(e.target.value))}>
									{SURAHS.map((s) => <option key={s.number} value={s.number}>{s.number}. {s.latin}</option>)}
								</select>
							</label>
						</div>
						<label className="field"><span>Qari</span>
							<select className="select" value={rid} onChange={(e) => setRid(e.target.value)}>
								{RECITERS.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.style}</option>)}
							</select>
						</label>
						<div className="seg" role="group" aria-label="Format">
							{(['srt', 'vtt', 'both'] as const).map((f) => (
								<button key={f} aria-pressed={fmt === f} onClick={() => setFmt(f)}>{f === 'both' ? 'SRT + VTT' : f.toUpperCase()}</button>
							))}
						</div>
						<label className="check"><input type="checkbox" checked={desc} onChange={(e) => setDesc(e.target.checked)} /> {t('Sertakan deskripsi YouTube per surah', 'Include a YouTube description per surah')}</label>
						<p className="status-line">{t(`${b - a + 1} surah, ${totalAyat} ayat. Isi subtitle mengikuti pengaturan di tab Ekspor.`, `${b - a + 1} surahs, ${totalAyat} verses. Content follows your Export tab settings.`)}</p>
						{busy && <div className="progress"><i style={{ width: `${pct}%` }} /></div>}
						{msg && <p className="status-line">{msg}</p>}
					</>
				)}
			</div>
			<div className="dialog-foot">
				{busy ? (
					<button className="btn" onClick={() => (cancel.current = true)}>{t('Batal', 'Cancel')}</button>
				) : (
					<button className="btn" onClick={onClose}>{t('Tutup', 'Close')}</button>
				)}
				{!locked && (
					<button className="btn btn-primary" onClick={run} disabled={busy}>
						{busy ? <Loader2 size={16} className="spin" /> : <Download size={16} />} {t('Buat ZIP', 'Build ZIP')}
					</button>
				)}
			</div>
		</dialog>
	);
}
