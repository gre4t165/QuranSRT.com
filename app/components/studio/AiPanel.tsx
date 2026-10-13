import { useEffect, useState } from 'react';
import { Copy, Info, Loader2, Sparkles } from 'lucide-react';
import { aiSuggest, serverStatus, type AiResult } from '~/lib/api';
import { copyText } from '~/lib/download';
import { getSurah } from '~/data/surahs';
import type { Row } from '~/lib/project';
import { useT } from '~/lib/i18n';

export function AiPanel({ rows, surah, reciterName, toast }: { rows: Row[]; surah: number; reciterName: string; toast: (m: string) => void }) {
	const { t, lang } = useT();
	const [enabled, setEnabled] = useState<boolean | null>(null);
	const [platform, setPlatform] = useState('YouTube');
	const [outLang, setOutLang] = useState<'id' | 'en'>(lang);
	const [busy, setBusy] = useState(false);
	const [res, setRes] = useState<AiResult | null>(null);
	const [err, setErr] = useState('');

	useEffect(() => {
		void serverStatus().then((s) => setEnabled(s.ai));
	}, []);

	const s = getSurah(surah);
	const ayat = rows.filter((r) => r.kind === 'ayah');
	const range = ayat.length ? `${ayat[0].ayah}${ayat.length > 1 ? '–' + ayat.at(-1)!.ayah : ''}` : '';

	const run = async () => {
		setBusy(true);
		setErr('');
		try {
			const r = await aiSuggest({
				surah: s.latin,
				meaning: outLang === 'en' ? s.meaningEn : s.meaningId,
				range,
				reciter: reciterName,
				translations: ayat.slice(0, 40).map((r) => `${r.ayah}. ${outLang === 'en' ? r.en : r.id}`),
				lang: outLang,
				platform,
			});
			setRes(r);
		} catch (e) {
			setErr((e as Error).message || t('Gagal menghubungi asisten.', 'Could not reach the assistant.'));
		} finally {
			setBusy(false);
		}
	};

	const copy = async (text: string) => toast((await copyText(text)) ? t('Disalin.', 'Copied.') : t('Gagal menyalin.', 'Copy failed.'));

	if (enabled === null) return <div className="tab-body"><p className="status-line"><Loader2 size={14} className="spin" /> {t('Memeriksa…', 'Checking…')}</p></div>;

	return (
		<div className="tab-body">
			<p>{t('Asisten Konten (ditenagai Claude) menulis judul, deskripsi, hashtag, dan ide teks thumbnail dari ayat yang Anda pilih.', 'The Content Assistant (powered by Claude) drafts titles, a description, hashtags and thumbnail text from your selected verses.')}</p>
			{!enabled ? (
				<div className="notice">
					<Info size={16} />
					<div>
						{t('Fitur ini belum diaktifkan di situs ini.', 'This feature is not enabled on this site yet.')}
						<br />
						<small>{t('Pemilik situs: isi API key Claude di api/config.php (lihat README).', 'Site owner: add a Claude API key in api/config.php (see README).')}</small>
					</div>
				</div>
			) : (
				<>
					<div className="grid-2">
						<label className="field"><span>Platform</span>
							<select className="select" value={platform} onChange={(e) => setPlatform(e.target.value)}>
								<option>YouTube</option>
								<option>YouTube Shorts</option>
								<option>TikTok</option>
								<option>Instagram Reels</option>
							</select>
						</label>
						<label className="field"><span>{t('Bahasa hasil', 'Output language')}</span>
							<select className="select" value={outLang} onChange={(e) => setOutLang(e.target.value as 'id' | 'en')}>
								<option value="id">Indonesia</option>
								<option value="en">English</option>
							</select>
						</label>
					</div>
					<button className="btn btn-primary" onClick={run} disabled={busy || !ayat.length}>
						{busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} {t('Buat saran konten', 'Draft content')}
					</button>
					{err && <div className="notice error">{err}</div>}
					{res && (
						<div className="ai-out">
							<div className="ai-item">
								<header>{t('Judul', 'Titles')}</header>
								{res.titles.map((x, i) => (
									<div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
										<span style={{ flex: 1 }}>{x}</span>
										<button className="btn btn-ghost btn-sm btn-icon" onClick={() => copy(x)} aria-label={t('Salin judul', 'Copy title')}><Copy size={14} /></button>
									</div>
								))}
							</div>
							<div className="ai-item">
								<header>{t('Deskripsi', 'Description')}<button className="btn btn-ghost btn-sm btn-icon" onClick={() => copy(res.description)} aria-label={t('Salin deskripsi', 'Copy description')}><Copy size={14} /></button></header>
								<pre>{res.description}</pre>
							</div>
							<div className="ai-item">
								<header>Hashtag<button className="btn btn-ghost btn-sm btn-icon" onClick={() => copy(res.hashtags.join(' '))} aria-label={t('Salin hashtag', 'Copy hashtags')}><Copy size={14} /></button></header>
								<pre>{res.hashtags.join(' ')}</pre>
							</div>
							{res.thumbnail?.length > 0 && (
								<div className="ai-item">
									<header>{t('Teks thumbnail', 'Thumbnail text')}</header>
									<pre>{res.thumbnail.join('\n')}</pre>
								</div>
							)}
							<p className="status-line">{t('Tulisan ini dibantu AI. Periksa kembali sebelum dipublikasikan. Teks ayat untuk deskripsi ambil dari tombol “Salin deskripsi” di tab Ekspor (verbatim dari sumber).', 'AI-assisted text. Review before publishing. For verse text, use “Copy description” in the Export tab (verbatim from source).')}</p>
						</div>
					)}
				</>
			)}
		</div>
	);
}
