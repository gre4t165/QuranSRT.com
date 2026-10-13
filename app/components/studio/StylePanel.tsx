import { ImagePlus, X } from 'lucide-react';
import { ARABIC_FONTS, TEMPLATES, type Ratio, type StyleSettings } from '~/lib/project';
import { useT } from '~/lib/i18n';

interface Props {
	style: StyleSettings;
	set: (patch: Partial<StyleSettings>) => void;
	bgName: string;
	onBgFile: (f: File) => void;
	onBgClear: () => void;
	mediaIsVideo: boolean;
}

export function StylePanel({ style: s, set, bgName, onBgFile, onBgClear, mediaIsVideo }: Props) {
	const { t } = useT();
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
