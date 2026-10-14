import { ImagePlus, X } from 'lucide-react';
import { ARABIC_FONTS, LAYER_IDS, TEMPLATES, type LayerCfg, type LayerId, type Ratio, type StyleSettings } from '~/lib/project';
import { useT } from '~/lib/i18n';

interface Props {
	style: StyleSettings;
	set: (patch: Partial<StyleSettings>) => void;
	bgName: string;
	onBgFile: (f: File) => void;
	onBgClear: () => void;
	mediaIsVideo: boolean;
	layer: LayerId | null;
	onSelectLayer: (id: LayerId | null) => void;
	onLayer: (id: LayerId, patch: LayerCfg | null) => void;
}

export function StylePanel({ style: s, set, bgName, onBgFile, onBgClear, mediaIsVideo, layer, onSelectLayer, onLayer }: Props) {
	const { t } = useT();
	const names: Record<LayerId, string> = { ar: t('Teks Arab', 'Arabic'), translit: t('Transliterasi', 'Transliteration'), trans: t('Terjemahan', 'Translation'), label: t('Label ayat', 'Verse label'), header: t('Nama surah', 'Surah name') };
	const lc = layer ? s.layers?.[layer] ?? {} : {};
	const defColor = (id: LayerId) => (id === 'ar' ? s.textColor : id === 'label' || id === 'header' ? s.accent : s.transColor);
	return (
		<div className="tab-body">
			<div className="group">
				<h3>{t('Template', 'Template')}</h3>
				<div className="templates">
					{TEMPLATES.map((tp) => {
						const st = tp.style;
						const bg = st.bgType === 'gradient' ? `radial-gradient(circle at 50% 40%, ${st.bg1}, ${st.bg2})` : st.bg1;
						return (
							<button key={tp.id} className="tpl" aria-pressed={s.template === tp.id} onClick={() => set({ ...tp.style, template: tp.id })}>
								<i style={{ background: bg, color: st.textColor, fontFamily: `"${st.arabicFont}", serif` }}>بِسۡمِ ٱللَّهِ</i>
								<span>{tp.name}</span>
							</button>
						);
					})}
				</div>
			</div>

			<div className="group">
				<h3>{t('Edit di layar', 'On-screen editing')}</h3>
				<p className="status-line">{t('Klik teks di pratinjau untuk memilih, tarik untuk menggeser, tarik sudut kotak untuk mengubah ukuran, klik ganda untuk mengetik ulang. Tombol panah menggeser halus (Shift = lebih jauh), + / − mengubah ukuran. Pengaturan berlaku untuk semua subtitle dan ikut ke video.', 'Click text in the preview to select it, drag to move, drag the box corner to resize, double-click to retype. Arrow keys nudge (Shift = bigger), + / − resize. Applies to all subtitles and carries into the exported video.')}</p>
				<div className="layer-list" role="group" aria-label={t('Lapisan teks', 'Text layers')}>
					{LAYER_IDS.map((id) => (
						<button key={id} aria-pressed={layer === id} onClick={() => onSelectLayer(layer === id ? null : id)}>
							{names[id]}{s.layers?.[id]?.hidden ? ' ⌀' : ''}
						</button>
					))}
				</div>
				{layer && (
					<div className="group">
						<label className="field">
							<span>{names[layer]} — {t('ukuran', 'size')} <b>{Math.round((lc.scale ?? 1) * 100)}%</b></span>
							<input type="range" min={30} max={300} value={Math.round((lc.scale ?? 1) * 100)} onChange={(e) => onLayer(layer, { scale: Number(e.target.value) / 100 })} />
						</label>
						<div className="grid-2">
							<label className="field">
								<span>{t('Geser mendatar', 'Horizontal')} <b>{Math.round((lc.dx ?? 0) * 100)}</b></span>
								<input type="range" min={-50} max={50} value={Math.round((lc.dx ?? 0) * 100)} onChange={(e) => onLayer(layer, { dx: Number(e.target.value) / 100 })} />
							</label>
							<label className="field">
								<span>{t('Geser tegak', 'Vertical')} <b>{Math.round((lc.dy ?? 0) * 100)}</b></span>
								<input type="range" min={-50} max={50} value={Math.round((lc.dy ?? 0) * 100)} onChange={(e) => onLayer(layer, { dy: Number(e.target.value) / 100 })} />
							</label>
						</div>
						<label className="color-row">{t('Warna', 'Color')}<input type="color" value={lc.color ?? defColor(layer)} onChange={(e) => onLayer(layer, { color: e.target.value })} /></label>
						<label className="check"><input type="checkbox" checked={!!lc.hidden} onChange={(e) => onLayer(layer, { hidden: e.target.checked })} /> {t('Sembunyikan lapisan ini', 'Hide this layer')}</label>
						<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
							<button className="btn btn-ghost btn-sm" onClick={() => onLayer(layer, null)}>{t('Reset lapisan ini', 'Reset this layer')}</button>
							<button className="btn btn-ghost btn-sm" onClick={() => { for (const id of LAYER_IDS) onLayer(id, null); }}>{t('Reset semua', 'Reset all')}</button>
						</div>
					</div>
				)}
			</div>

			<div className="group">
				<h3>{t('Rasio layar', 'Aspect ratio')}</h3>
				<div className="seg" role="group" aria-label={t('Rasio layar', 'Aspect ratio')}>
					{(['16:9', '9:16', '1:1'] as Ratio[]).map((r) => (
						<button key={r} aria-pressed={s.ratio === r} onClick={() => set({ ratio: r })}>
							{r} {r === '16:9' ? 'YouTube' : r === '9:16' ? 'Shorts/Reels' : 'Feed'}
						</button>
					))}
				</div>
			</div>

			<div className="group">
				<h3>{t('Huruf', 'Typography')}</h3>
				<label className="field">
					<span>{t('Huruf Arab', 'Arabic typeface')}</span>
					<select className="select" value={s.arabicFont} onChange={(e) => set({ arabicFont: e.target.value })}>
						{ARABIC_FONTS.map((f) => (
							<option key={f.id} value={f.id}>{f.label}</option>
						))}
					</select>
				</label>
				<label className="field">
					<span>{t('Ukuran Arab', 'Arabic size')} <b>{s.arabicSize}</b></span>
					<input type="range" min={32} max={110} value={s.arabicSize} onChange={(e) => set({ arabicSize: Number(e.target.value) })} />
				</label>
				<label className="field">
					<span>{t('Ukuran terjemahan', 'Translation size')} <b>{s.transSize}</b></span>
					<input type="range" min={18} max={64} value={s.transSize} onChange={(e) => set({ transSize: Number(e.target.value) })} />
				</label>
				<label className="field">
					<span>{t('Posisi teks', 'Text position')}</span>
					<div className="seg" role="group">
						{(['top', 'center', 'bottom'] as const).map((p) => (
							<button key={p} aria-pressed={s.position === p} onClick={() => set({ position: p })}>
								{p === 'top' ? t('Atas', 'Top') : p === 'center' ? t('Tengah', 'Middle') : t('Bawah', 'Bottom')}
							</button>
						))}
					</div>
				</label>
			</div>

			<div className="group">
				<h3>{t('Warna', 'Colors')}</h3>
				<div className="grid-2">
					<label className="color-row">{t('Teks Arab', 'Arabic text')}<input type="color" value={s.textColor} onChange={(e) => set({ textColor: e.target.value })} /></label>
					<label className="color-row">{t('Terjemahan', 'Translation')}<input type="color" value={s.transColor} onChange={(e) => set({ transColor: e.target.value })} /></label>
					<label className="color-row">{t('Aksen', 'Accent')}<input type="color" value={s.accent} onChange={(e) => set({ accent: e.target.value })} /></label>
					<label className="color-row">{t('Latar 1', 'Background 1')}<input type="color" value={s.bg1} onChange={(e) => set({ bg1: e.target.value })} /></label>
					<label className="color-row">{t('Latar 2', 'Background 2')}<input type="color" value={s.bg2} onChange={(e) => set({ bg2: e.target.value })} /></label>
				</div>
			</div>

			<div className="group">
				<h3>{t('Latar', 'Background')}</h3>
				<div className="seg" role="group" aria-label={t('Jenis latar', 'Background type')}>
					{(['solid', 'gradient', 'image', 'video'] as const).map((b) => (
						<button key={b} aria-pressed={s.bgType === b} onClick={() => set({ bgType: b })}>
							{b === 'solid' ? t('Polos', 'Solid') : b === 'gradient' ? 'Gradien' : b === 'image' ? t('Gambar', 'Image') : 'Video'}
						</button>
					))}
				</div>
				{(s.bgType === 'image' || s.bgType === 'video') && (
					<>
						{s.bgType === 'video' && mediaIsVideo && !bgName && <p className="status-line">{t('Memakai video yang Anda unggah sebagai latar.', 'Using your uploaded video as the background.')}</p>}
						<label className="drop">
							<ImagePlus size={18} />
							<b>{bgName || (s.bgType === 'image' ? t('Pilih gambar latar', 'Choose background image') : t('Pilih klip video latar (diulang)', 'Choose looping background clip'))}</b>
							<input type="file" accept={s.bgType === 'image' ? 'image/*' : 'video/*'} onChange={(e) => e.target.files?.[0] && onBgFile(e.target.files[0])} />
							{bgName && (
								<button className="btn btn-ghost btn-sm btn-icon" style={{ marginLeft: 'auto' }} onClick={(e) => { e.preventDefault(); onBgClear(); }} aria-label={t('Hapus latar', 'Remove background')}><X size={15} /></button>
							)}
						</label>
					</>
				)}
			</div>

			<div className="group">
				<h3>{t('Branding kreator', 'Creator branding')}</h3>
				<label className="field">
					<span>{t('Nama kanal / akun (tampil kecil di pojok kiri bawah)', 'Channel / handle (shown small, bottom left)')}</span>
					<input className="input" maxLength={40} value={s.brand} placeholder="@namakanal" onChange={(e) => set({ brand: e.target.value })} />
				</label>
			</div>

			<div className="group">
				<h3>{t('Efek', 'Effects')}</h3>
				<label className="check"><input type="checkbox" checked={s.header} onChange={(e) => set({ header: e.target.checked })} /> {t('Nama surah di layar', 'Surah name on screen')}</label>
				<label className="check"><input type="checkbox" checked={s.ornament} onChange={(e) => set({ ornament: e.target.checked })} /> {t('Bingkai ornamen', 'Ornamental frame')}</label>
				<label className="check"><input type="checkbox" checked={s.reciterName} onChange={(e) => set({ reciterName: e.target.checked })} disabled={!s.header} /> {t('Nama qari di bawah nama surah', 'Reciter name under the surah name')}</label>
				<label className="check"><input type="checkbox" checked={s.shadow} onChange={(e) => set({ shadow: e.target.checked })} /> {t('Bayangan teks', 'Text shadow')}</label>
				<label className="field">
					<span>{t('Garis tepi teks', 'Text outline')} <b>{s.outline ? s.outline : t('mati', 'off')}</b></span>
					<input type="range" min={0} max={8} step={1} value={s.outline} onChange={(e) => set({ outline: Number(e.target.value) })} />
				</label>
				{s.outline > 0 && <label className="color-row">{t('Warna garis tepi', 'Outline color')}<input type="color" value={s.outlineColor} onChange={(e) => set({ outlineColor: e.target.value })} /></label>}
				<label className="check"><input type="checkbox" checked={s.fade} onChange={(e) => set({ fade: e.target.checked })} /> {t('Muncul & hilang perlahan', 'Fade in & out')}</label>
				<label className="check"><input type="checkbox" checked={s.box} onChange={(e) => set({ box: e.target.checked })} /> {t('Kotak di belakang teks', 'Box behind text')}</label>
				{s.box && (
					<label className="field">
						<span>{t('Kepekatan kotak', 'Box opacity')} <b>{Math.round(s.boxOpacity * 100)}%</b></span>
						<input type="range" min={10} max={95} value={Math.round(s.boxOpacity * 100)} onChange={(e) => set({ boxOpacity: Number(e.target.value) / 100 })} />
					</label>
				)}
			</div>
		</div>
	);
}
