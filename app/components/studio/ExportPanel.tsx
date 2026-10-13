import { useRef, useState } from 'react';
import { AlertTriangle, Clapperboard, Copy, FileJson, FileText, Film, Layers, Lock, Music, Subtitles, Wand2, X } from 'lucide-react';
import type { ContentSettings, ExportSettings, Row, StyleSettings, TransLang } from '~/lib/project';
import { fileBase, toASS, toDescription, toSRT, toVTT, type Cue } from '~/lib/subtitles';
import { track } from '~/lib/api';
import { canvasSize, drawFrame, type FrameInput } from '~/lib/renderer';
import { pickMime, renderVideo } from '~/lib/video';
import { bufferToWav } from '~/lib/audio';
import { copyText, saveBlob, saveText } from '~/lib/download';
import { useT } from '~/lib/i18n';

interface Props {
	rows: Row[];
	/** Cue yang sama persis dengan pratinjau (termasuk pemecahan otomatis). */
	cues: Cue[];
	content: ContentSettings;
	setContent: (p: Partial<ContentSettings>) => void;
	exp: ExportSettings;
	setExp: (p: Partial<ExportSettings>) => void;
	style: StyleSettings;
	surah: number;
	reciterName: string;
	buffer: AudioBuffer | null;
	audioKind: 'none' | 'file' | 'qari' | 'playlist';
	errorCount: number;
	warnCount: number;
	onFix: () => void;
	onExportProject: () => void;
	frameAt: (t: number) => FrameInput;
	bgVideo: HTMLVideoElement | null;
	bgLoop: boolean;
	watermark: string;
	batchLocked: boolean;
	onBatch: () => void;
	toast: (m: string) => void;
	audioName: string;
}

export function ExportPanel(p: Props) {
	const { t, lang } = useT();
	const c = p.content;
	const e = p.exp;
	const cues = p.cues;
	const langCode = c.translation === 'none' ? 'ar' : c.translation;
	const base = fileBase(p.surah, p.rows, langCode);
	const [res, setRes] = useState<720 | 1080>(1080);
	const [range, setRange] = useState<'all' | 'subs'>('all');
	const [monitor, setMonitor] = useState(false);
	const [prog, setProg] = useState<number | null>(null);
	const abort = useRef<AbortController | null>(null);
	const mime = typeof window !== 'undefined' ? pickMime() : null;

	const guard = () => {
		if (p.errorCount) {
			p.toast(t(`Ada ${p.errorCount} masalah waktu. Perbaiki dulu atau klik “Perbaiki otomatis”.`, `${p.errorCount} timing problems. Fix them first or use “Auto-fix”.`));
			return false;
		}
		if (!cues.length) {
			p.toast(t('Belum ada subtitle untuk diekspor.', 'Nothing to export yet.'));
			return false;
		}
		return true;
	};

	const exportText = (kind: 'srt' | 'vtt' | 'ass') => {
		if (!guard()) return;
		const title = base.replace(/_/g, ' ');
		const text = kind === 'srt' ? toSRT(cues, e) : kind === 'vtt' ? toVTT(cues, e, title) : toASS(cues, p.style, title);
		saveText(text, `${base}.${kind}`, kind === 'vtt' ? 'text/vtt' : 'text/plain');
		track(`export_${kind}`);
		p.toast(t(`File .${kind} diunduh. Cek kembali teks dan waktunya sebelum dipublikasikan.`, `.${kind} downloaded. Review text and timing before publishing.`));
	};

	const desc = () => toDescription(p.rows, c, { surah: p.surah, reciter: p.reciterName || undefined, lang });

	const startVideo = async () => {
		if (!p.buffer || !guard()) return;
		const [W, H] = canvasSize(p.style.ratio, res === 1080 ? 1920 : 1280);
		const from = range === 'subs' ? Math.max(0, cues[0].start - 0.6) : 0;
		const to = range === 'subs' ? Math.min(p.buffer.duration, cues[cues.length - 1].end + 1) : p.buffer.duration;
		abort.current = new AbortController();
		setProg(0);
		try {
			const out = await renderVideo({
				buffer: p.buffer,
				from,
				to,
				width: W,
				height: H,
				bitrate: res === 1080 ? 10_000_000 : 6_000_000,
				draw: (ctx, tt) => drawFrame(ctx, W, H, { ...p.frameAt(tt), watermark: p.watermark || undefined }),
				bgVideo: p.style.bgType === 'video' ? p.bgVideo : null,
				bgLoop: p.bgLoop,
				onProgress: setProg,
				signal: abort.current.signal,
				monitor,
			});
			saveBlob(out.blob, `${base}_${p.style.ratio.replace(':', 'x')}.${out.ext}`);
			track('export_video');
			p.toast(t('Video selesai dan diunduh.', 'Video finished and downloaded.'));
		} catch (err) {
			if ((err as Error).name !== 'AbortError') p.toast((err as Error).message || t('Gagal membuat video.', 'Video export failed.'));
		} finally {
			setProg(null);
			abort.current = null;
		}
	};

	return (
		<div className="tab-body">
			<div className="group">
				<h3>{t('Isi subtitle', 'Subtitle content')}</h3>
				<label className="check"><input type="checkbox" checked={c.arabic} onChange={(ev) => p.setContent({ arabic: ev.target.checked })} /> {t('Teks Arab', 'Arabic text')}</label>
				<label className="check"><input type="checkbox" checked={c.translit} onChange={(ev) => p.setContent({ translit: ev.target.checked })} /> {t('Transliterasi Latin', 'Latin transliteration')}</label>
				<label className="field">
					<span>{t('Terjemahan', 'Translation')}</span>
					<select className="select" value={c.translation} onChange={(ev) => p.setContent({ translation: ev.target.value as TransLang })}>
						<option value="id">Bahasa Indonesia</option>
						<option value="en">English (Saheeh International)</option>
						<option value="none">{t('Tanpa terjemahan', 'No translation')}</option>
					</select>
				</label>
				<label className="check"><input type="checkbox" checked={!c.arabicFirst} onChange={(ev) => p.setContent({ arabicFirst: !ev.target.checked })} /> {t('Terjemahan di atas teks Arab', 'Translation above Arabic')}</label>
				<label className="check"><input type="checkbox" checked={c.verseNumber} onChange={(ev) => p.setContent({ verseNumber: ev.target.checked })} /> {t('Nomor ayat ﴿١﴾', 'Verse number ﴿١﴾')}</label>
				<label className="check"><input type="checkbox" checked={c.surahLabel} onChange={(ev) => p.setContent({ surahLabel: ev.target.checked })} /> {t('Keterangan surah, mis. (QS. Al-Fatihah [1]: 1)', 'Reference line, e.g. (Quran Al-Fatihah 1:1)')}</label>
			</div>

			<div className="group">
				<h3>{t('Pengaturan waktu', 'Timing options')}</h3>
				<label className="check"><input type="checkbox" checked={e.closeGaps} onChange={(ev) => p.setExp({ closeGaps: ev.target.checked })} /> {t('Tutup jeda pendek antar-ayat', 'Close short gaps between verses')}</label>
				{e.closeGaps && (
					<label className="field"><span>{t('Jeda maksimal yang ditutup', 'Max gap to close')} <b>{e.maxGap.toFixed(1)} s</b></span><input type="range" min={0.2} max={4} step={0.1} value={e.maxGap} onChange={(ev) => p.setExp({ maxGap: Number(ev.target.value) })} /></label>
				)}
				<label className="check"><input type="checkbox" checked={e.autoFit} onChange={(ev) => p.setExp({ autoFit: ev.target.checked })} /> {t('Pecah otomatis ayat yang tidak muat di layar (di tanda waqaf) — disarankan', 'Auto-split verses that don’t fit on screen (at waqf marks) — recommended')}</label>
				<label className="check"><input type="checkbox" checked={e.splitLong} onChange={(ev) => p.setExp({ splitLong: ev.target.checked })} /> {t('Batasi juga jumlah karakter per subtitle', 'Also limit characters per subtitle')}</label>
				{e.splitLong && (
					<label className="field"><span>{t('Maksimal karakter per subtitle', 'Max characters per subtitle')} <b>{e.maxChars}</b></span><input type="range" min={40} max={200} step={5} value={e.maxChars} onChange={(ev) => p.setExp({ maxChars: Number(ev.target.value) })} /></label>
				)}
				<label className="check"><input type="checkbox" checked={e.rtlMark} onChange={(ev) => p.setExp({ rtlMark: ev.target.checked })} /> {t('Tambah penanda arah kanan-ke-kiri (untuk pemutar yang mengacak urutan teks Arab)', 'Add right-to-left marks (for players that scramble Arabic order)')}</label>
				<p className="status-line">{t(`${cues.length} subtitle akan diekspor.`, `${cues.length} subtitles will be exported.`)}</p>
			</div>

			{(p.errorCount > 0 || p.warnCount > 0) && (
				<div className={`notice ${p.errorCount ? 'error' : 'warn'}`}>
					<AlertTriangle size={16} />
					<div>
						{p.errorCount > 0 ? t(`${p.errorCount} masalah waktu harus diperbaiki sebelum ekspor.`, `${p.errorCount} timing problems must be fixed before export.`) : t(`${p.warnCount} peringatan — subtitle tetap bisa diekspor.`, `${p.warnCount} warnings — you can still export.`)}
						{p.errorCount > 0 && (
							<div style={{ marginTop: 8 }}>
								<button className="btn btn-sm" onClick={p.onFix}><Wand2 size={14} /> {t('Perbaiki otomatis', 'Auto-fix')}</button>
							</div>
						)}
					</div>
				</div>
			)}

			<div className="group">
				<h3>{t('Unduh subtitle', 'Download subtitles')}</h3>
				<div className="export-grid">
					<button className="btn export-btn btn-primary" onClick={() => exportText('srt')}><Subtitles size={20} /><b>.SRT</b><small style={{ color: 'inherit', opacity: 0.85 }}>CapCut, Premiere, YouTube</small></button>
					<button className="btn export-btn" onClick={() => exportText('vtt')}><Subtitles size={20} /><b>.VTT</b><small>{t('Web & pemutar HTML5', 'Web & HTML5 players')}</small></button>
					<button className="btn export-btn" onClick={() => exportText('ass')}><Subtitles size={20} /><b>.ASS</b><small>{t('Bergaya: Aegisub, VLC, ffmpeg', 'Styled: Aegisub, VLC, ffmpeg')}</small></button>
					<button className="btn export-btn" onClick={() => { saveText(desc(), `${base}_deskripsi.txt`); track('export_desc'); p.toast(t('Deskripsi diunduh.', 'Description downloaded.')); }}><FileText size={20} /><b>{t('Deskripsi .TXT', 'Description .TXT')}</b><small>{t('Bab YouTube + teks ayat', 'YouTube chapters + verses')}</small></button>
					<button className="btn export-btn" onClick={async () => p.toast((await copyText(desc())) ? t('Deskripsi disalin.', 'Description copied.') : t('Gagal menyalin.', 'Copy failed.'))}><Copy size={20} /><b>{t('Salin deskripsi', 'Copy description')}</b><small>{t('Untuk kolom deskripsi', 'For the description box')}</small></button>
					<button className="btn export-btn" onClick={() => { p.onExportProject(); track('export_json'); }}><FileJson size={20} /><b>{t('Proyek .JSON', 'Project .JSON')}</b><small>{t('Cadangan / pindah perangkat', 'Backup / move devices')}</small></button>
					{p.buffer && (
						<button className="btn export-btn" onClick={() => { saveBlob(bufferToWav(p.buffer!), `${base}_audio.wav`); track('export_wav'); }}><Music size={20} /><b>{t('Audio .WAV', 'Audio .WAV')}</b><small>{t('Audio qari yang sudah digabung', 'Merged recitation audio')}</small></button>
					)}
					<button className="btn export-btn" onClick={p.onBatch}>{p.batchLocked ? <Lock size={20} /> : <Layers size={20} />}<b>{t('Batch ZIP', 'Batch ZIP')}</b><small>{t('Banyak surah sekaligus', 'Many surahs at once')}</small></button>
				</div>
			</div>

			<div className="group">
				<h3><Film size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('Ekspor video', 'Video export')}</h3>
				{!mime ? (
					<div className="notice warn"><AlertTriangle size={16} /> {t('Browser ini belum bisa merekam video. Gunakan Chrome atau Edge terbaru di komputer.', 'This browser cannot record video. Use the latest Chrome or Edge on desktop.')}</div>
				) : !p.buffer ? (
					<div className="notice">
						<AlertTriangle size={16} />
						{p.audioKind === 'playlist'
							? t('Server audio qari tidak mengizinkan audio diunduh, jadi video tidak bisa dibuat dari mode ini. Unggah file audio murotal sendiri untuk ekspor video.', 'The recitation server does not allow downloading, so video export is unavailable in this mode. Upload your own recitation file to export video.')
							: t('Muat audio dulu (qari atau unggah file) untuk membuat video.', 'Load audio first (reciter or upload) to make a video.')}
					</div>
				) : (
					<>
						<div className="grid-2">
							<label className="field"><span>{t('Resolusi', 'Resolution')}</span>
								<select className="select" value={res} onChange={(ev) => setRes(Number(ev.target.value) as 720 | 1080)}>
									<option value={1080}>1080p</option>
									<option value={720}>720p ({t('lebih cepat', 'faster')})</option>
								</select>
							</label>
							<label className="field"><span>{t('Rentang', 'Range')}</span>
								<select className="select" value={range} onChange={(ev) => setRange(ev.target.value as 'all' | 'subs')}>
									<option value="all">{t('Seluruh audio', 'Whole audio')}</option>
									<option value="subs">{t('Hanya bagian bersubtitle', 'Subtitled part only')}</option>
								</select>
							</label>
						</div>
						<label className="check"><input type="checkbox" checked={monitor} onChange={(ev) => setMonitor(ev.target.checked)} /> {t('Dengarkan audio selama proses', 'Listen while rendering')}</label>
						{prog === null ? (
							<button className="btn btn-primary btn-block" onClick={startVideo}><Clapperboard size={17} /> {t(`Buat video ${mime.ext.toUpperCase()} (${p.style.ratio})`, `Render ${mime.ext.toUpperCase()} video (${p.style.ratio})`)}</button>
						) : (
							<div className="group">
								<div className="progress" aria-label={t('Progres video', 'Video progress')}><i style={{ width: `${Math.round(prog * 100)}%` }} /></div>
								<div className="status-line">
									{t(`Merekam… ${Math.round(prog * 100)}%. Biarkan tab ini tetap terbuka dan terlihat.`, `Recording… ${Math.round(prog * 100)}%. Keep this tab open and visible.`)}
									<button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => abort.current?.abort()}><X size={14} /> {t('Batal', 'Cancel')}</button>
								</div>
							</div>
						)}
						<p className="status-line">{t('Video direkam secara real-time (durasi proses = durasi audio).', 'Video records in real time (render time = audio length).')}{p.watermark ? ' ' + t('Paket gratis menambahkan tanda air kecil.', 'Free plan adds a small watermark.') : ''}</p>
					</>
				)}
			</div>
		</div>
	);
}
