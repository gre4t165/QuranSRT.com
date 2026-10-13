import { Fragment, memo, useEffect, useState } from 'react';
import { AlertTriangle, Pencil, Play, Plus, Repeat, Trash2, Check, CornerDownLeft, Scissors, Merge, Sparkles, Loader2, Wand2, X, Undo } from 'lucide-react';
import type { Row, TransLang } from '~/lib/project';
import type { RowIssue } from '~/lib/subtitles';
import { ayahMarker } from '~/lib/quran';
import { arabicWords } from '~/lib/segment';
import { fmtClock, parseClock } from '~/lib/time';

export interface RowHandlers {
	select: (i: number, seek?: boolean) => void;
	setTime: (i: number, edge: 'start' | 'end', v: number) => void;
	nudge: (i: number, edge: 'start' | 'end', d: number) => void;
	markNow: (i: number, edge: 'start' | 'end') => void;
	edit: (i: number, field: 'ar' | 'id' | 'en' | 'tr', v: string) => void;
	remove: (i: number) => void;
	insertAfter: (i: number) => void;
	playRow: (i: number) => void;
	loopRow: (i: number) => void;
	/** Potong ayat tepat setelah kata ke-w (0-based). */
	splitAt: (i: number, w: number) => void;
	/** Pecah otomatis sesuai ukuran layar (di tanda waqaf). */
	autoSplit: (i: number) => void;
	mergeNext: (i: number) => void;
	unsplit: (i: number) => void;
	/** Rapikan terjemahan potongan dengan Claude. */
	align: (i: number) => void;
}

interface Props {
	row: Row;
	index: number;
	selected: boolean;
	active: boolean;
	looping: boolean;
	issues?: RowIssue[];
	lang: TransLang;
	showTranslit: boolean;
	/** Info potongan ayat (n dari of), atau null. */
	part: { n: number; of: number } | null;
	aiEnabled: boolean;
	aligning: boolean;
	t: (id: string, en: string) => string;
	h: RowHandlers;
}

function TimeInput({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
	const [text, setText] = useState(fmtClock(value));
	const [focus, setFocus] = useState(false);
	useEffect(() => {
		if (!focus) setText(fmtClock(value));
	}, [value, focus]);
	const commit = () => {
		const v = parseClock(text);
		if (v !== null) onCommit(v);
		else setText(fmtClock(value));
	};
	return (
		<input
			aria-label={label}
			value={text}
			inputMode="decimal"
			onFocus={(e) => {
				setFocus(true);
				e.currentTarget.select();
			}}
			onBlur={() => {
				setFocus(false);
				commit();
			}}
			onChange={(e) => setText(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === 'Enter') e.currentTarget.blur();
				if (e.key === 'Escape') {
					setText(fmtClock(value));
					e.currentTarget.blur();
				}
			}}
		/>
	);
}

function RowItemBase({ row, index: i, selected, active, looping, issues, lang, showTranslit, part, aiEnabled, aligning, t, h }: Props) {
	const [editing, setEditing] = useState(false);
	const [cutting, setCutting] = useState(false);
	const words = cutting ? arabicWords(row.ar) : [];
	const isLast = !part || part.n === part.of;
	const canCut = (row.kind === 'ayah' || row.kind === 'basmalah') && arabicWords(row.ar).length > 1;
	const transKey: 'id' | 'en' = lang === 'en' ? 'en' : 'id';
	const isCustom = row.kind === 'custom';
	const err = issues?.some((x) => x.level === 'error');
	const label = row.kind === 'ayah' ? String(row.ayah) + (part ? String.fromCharCode(96 + part.n) : '') : row.kind === 'basmalah' ? 'B' : 'T';
	const kindTitle = row.kind === 'ayah' ? t(`Ayat ${row.ayah}`, `Verse ${row.ayah}`) : row.kind === 'basmalah' ? 'Basmalah' : t('Teks bebas', 'Custom text');

	return (
		<div className={`row${selected ? ' sel' : ''}${active ? ' active' : ''}${err ? ' has-err' : ''}`} data-row={i} aria-current={active ? 'true' : undefined}>
			<button className="row-num" onClick={() => h.select(i, true)} title={kindTitle} aria-label={`${kindTitle} — ${t('pilih dan lompat ke waktunya', 'select and jump to it')}`}>
				{label}
			</button>
			<div className="row-body">
				{editing && isCustom ? (
					<textarea className="row-edit ar-edit" dir="rtl" lang="ar" value={row.ar} placeholder={t('Teks Arab (opsional)', 'Arabic text (optional)')} onChange={(e) => h.edit(i, 'ar', e.target.value)} />
				) : cutting ? (
					<div className="cut-box">
						<div className="row-ar cut" lang="ar" dir="rtl">
							{words.map((w, k) => (
								<Fragment key={k}>
									<span className="w">{w}</span>
									{k < words.length - 1 && (
										<button className="cut-gap" onClick={() => { h.splitAt(i, k); setCutting(false); }} aria-label={t(`Potong setelah kata ke-${k + 1}`, `Cut after word ${k + 1}`)} title={t('Potong di sini', 'Cut here')}>
											<Scissors size={12} />
										</button>
									)}
								</Fragment>
							))}
						</div>
						<div className="cut-bar">
							<span className="hint">{t('Klik ikon gunting di antara kata untuk memotong ayat di titik itu.', 'Click a scissors icon between words to cut the verse there.')}</span>
							<button className="btn btn-sm" onClick={() => { h.autoSplit(i); setCutting(false); }}><Wand2 size={14} /> {t('Pecah otomatis (tanda waqaf)', 'Auto-split (waqf marks)')}</button>
							<button className="btn btn-sm btn-ghost" onClick={() => setCutting(false)}><X size={14} /> {t('Batal', 'Cancel')}</button>
						</div>
					</div>
				) : row.ar ? (
					<div className="row-ar" lang="ar" onClick={() => h.select(i, true)}>
						{row.ar}
						{row.kind === 'ayah' && row.ayah && isLast ? ' ' + ayahMarker(row.ayah) : part && !isLast ? ' …' : ''}
					</div>
				) : null}
				{part && (
					<div className="part-bar">
						<span className="badge">{t(`Potongan ${part.n} dari ${part.of}`, `Part ${part.n} of ${part.of}`)}</span>
						{row.aligned && <span className="badge ok" title={t('Terjemahan potongan ini dirapikan Claude dan sudah diverifikasi tidak mengubah teks.', 'Translation aligned by Claude and verified unchanged.')}><Check size={12} /> {t('Dirapikan Claude', 'Aligned by Claude')}</span>}
						{part.n === 1 && aiEnabled && (
							<button className="btn btn-sm btn-ghost" onClick={() => h.align(i)} disabled={aligning} title={t('Claude membagi terjemahan agar pas dengan potongan Arab. Teks tidak diubah.', 'Claude splits the translation to match the Arabic parts. Text is never changed.')}>
								{aligning ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {t('Rapikan terjemahan', 'Align translation')}
							</button>
						)}
						{!isLast && <button className="btn btn-sm btn-ghost" onClick={() => h.mergeNext(i)}><Merge size={14} /> {t('Gabung dengan berikutnya', 'Merge with next')}</button>}
						{part.n === 1 && <button className="btn btn-sm btn-ghost" onClick={() => h.unsplit(i)}><Undo size={14} /> {t('Satukan ayat', 'Rejoin verse')}</button>}
					</div>
				)}
				{showTranslit && row.tr && !editing && <div className="row-tl">{row.tr}</div>}
				{editing ? (
					<textarea className="row-edit" value={row[transKey]} placeholder={t('Terjemahan / teks', 'Translation / text')} onChange={(e) => h.edit(i, transKey, e.target.value)} aria-label={t('Ubah terjemahan', 'Edit translation')} />
				) : (
					lang !== 'none' && <div className="row-tr">{row[transKey] || <em>{t('(kosong)', '(empty)')}</em>}</div>
				)}
				<div className="row-times">
					<span className="time-box">
						<label>{t('Mulai', 'Start')}</label>
						<TimeInput value={row.start} label={`${t('Waktu mulai', 'Start time')} ${kindTitle}`} onCommit={(v) => h.setTime(i, 'start', v)} />
						<button onClick={() => h.nudge(i, 'start', -0.1)} aria-label={t('Mulai −0,1 detik', 'Start −0.1s')} title="−0,1 s">−</button>
						<button onClick={() => h.nudge(i, 'start', 0.1)} aria-label={t('Mulai +0,1 detik', 'Start +0.1s')} title="+0,1 s">+</button>
						<button onClick={() => h.markNow(i, 'start')} aria-label={t('Set mulai = posisi sekarang', 'Set start to playhead')} title={t('Set ke posisi sekarang', 'Set to playhead')}><CornerDownLeft size={13} /></button>
					</span>
					<span className="time-box">
						<label>{t('Akhir', 'End')}</label>
						<TimeInput value={row.end} label={`${t('Waktu akhir', 'End time')} ${kindTitle}`} onCommit={(v) => h.setTime(i, 'end', v)} />
						<button onClick={() => h.nudge(i, 'end', -0.1)} aria-label={t('Akhir −0,1 detik', 'End −0.1s')} title="−0,1 s">−</button>
						<button onClick={() => h.nudge(i, 'end', 0.1)} aria-label={t('Akhir +0,1 detik', 'End +0.1s')} title="+0,1 s">+</button>
						<button onClick={() => h.markNow(i, 'end')} aria-label={t('Set akhir = posisi sekarang', 'Set end to playhead')} title={t('Set ke posisi sekarang', 'Set to playhead')}><CornerDownLeft size={13} /></button>
					</span>
					<span className="badge">{(row.end - row.start).toFixed(1)} s</span>
					<span className="row-tools">
						<button className="btn btn-ghost btn-sm btn-icon" onClick={() => h.playRow(i)} aria-label={t('Putar baris ini', 'Play this row')} title={t('Putar baris ini', 'Play this row')}><Play size={15} /></button>
						<button className="btn btn-ghost btn-sm btn-icon" onClick={() => h.loopRow(i)} aria-pressed={looping} aria-label={t('Ulangi baris ini', 'Loop this row')} title={t('Ulangi baris ini', 'Loop this row')} style={looping ? { color: 'var(--action)' } : undefined}><Repeat size={15} /></button>
						{canCut && !editing && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCutting(!cutting)} aria-pressed={cutting} aria-label={t('Potong ayat ini', 'Cut this verse')} title={t('Potong ayat (mid-verse cut)', 'Cut verse (mid-verse)')}><Scissors size={15} /></button>}
						<button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing(!editing)} aria-pressed={editing} aria-label={editing ? t('Selesai mengubah', 'Done editing') : t('Ubah teks', 'Edit text')} title={editing ? t('Selesai', 'Done') : t('Ubah teks', 'Edit text')}>{editing ? <Check size={15} /> : <Pencil size={15} />}</button>
						<button className="btn btn-ghost btn-sm btn-icon" onClick={() => h.insertAfter(i)} aria-label={t('Sisipkan teks bebas setelah baris ini', 'Insert custom text after this row')} title={t('Sisipkan teks bebas', 'Insert custom text')}><Plus size={15} /></button>
						<button className="btn btn-ghost btn-sm btn-icon btn-danger" onClick={() => h.remove(i)} aria-label={t('Hapus baris', 'Delete row')} title={t('Hapus baris', 'Delete row')}><Trash2 size={15} /></button>
					</span>
				</div>
				{issues?.map((x, k) => (
					<div key={k} className={`issue ${x.level}`}>
						<AlertTriangle size={13} aria-hidden="true" /> {x.msg}
					</div>
				))}
			</div>
		</div>
	);
}

export const RowItem = memo(RowItemBase);
