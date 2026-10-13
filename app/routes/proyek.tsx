import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Cloud, Copy, Download, FilePlus2, LogOut, Trash2, Upload } from 'lucide-react';
import type { Route } from './+types/proyek';
import { seo } from '~/lib/seo';
import { useT } from '~/lib/i18n';
import { deleteLocal, getLocal, listLocal, saveLocal, type ProjectMeta } from '~/lib/storage';
import { normalizeProject, projectTitle, uid } from '~/lib/project';
import { getSurah } from '~/data/surahs';
import { saveText } from '~/lib/download';
import { useAuth } from '~/lib/useAuth';
import { deleteCloud, listCloud, type CloudMeta } from '~/lib/cloud';
import { signOut } from '~/lib/useAuth';

export const meta: Route.MetaFunction = () => seo({ title: 'Proyek saya', description: 'Buka, duplikat, ekspor, dan hapus proyek subtitle Al-Qur’an Anda.', path: '/proyek', noindex: true });

export default function Proyek() {
	const { t, lang } = useT();
	const nav = useNavigate();
	const auth = useAuth();
	const [items, setItems] = useState<ProjectMeta[]>([]);
	const [cloud, setCloud] = useState<CloudMeta[] | null>(null);
	const [msg, setMsg] = useState('');
	const fileRef = useRef<HTMLInputElement>(null);
	const refresh = () => setItems(listLocal());
	useEffect(refresh, []);
	useEffect(() => {
		if (auth.user) void listCloud().then(setCloud).catch(() => setCloud([]));
		else setCloud(null);
	}, [auth.user]);

	const fmt = (ts: number) => new Date(ts).toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID', { dateStyle: 'medium', timeStyle: 'short' });

	const importFile = async (f: File) => {
		try {
			const p = normalizeProject(JSON.parse(await f.text()));
			saveLocal({ ...p, id: uid() });
			refresh();
			setMsg(t('Proyek diimpor.', 'Project imported.'));
		} catch {
			setMsg(t('File bukan proyek Quran SRT Studio yang valid.', 'Not a valid Quran SRT Studio project file.'));
		}
	};

	return (
		<div className="page" style={{ paddingTop: 48, maxWidth: 900 }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
				<h1 style={{ fontSize: '2rem', marginRight: 'auto' }}>{t('Proyek saya', 'My projects')}</h1>
				<button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> {t('Impor .json', 'Import .json')}</button>
				<input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
				<Link className="btn btn-primary" to="/studio?new=1"><FilePlus2 size={16} /> {t('Proyek baru', 'New project')}</Link>
			</div>
			{msg && <div className="notice ok" style={{ marginBottom: 16 }}>{msg}</div>}

			{auth.enabled && (
				<section style={{ marginBottom: 36 }}>
					<h2 style={{ fontSize: '1.2rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Cloud size={18} /> Cloud</h2>
					{!auth.user ? (
						<div className="notice">{t('Masuk untuk menyimpan proyek di cloud dan membukanya dari perangkat lain.', 'Sign in to keep projects in the cloud and open them anywhere.')} <Link to="/masuk">{t('Masuk', 'Sign in')}</Link></div>
					) : (
						<>
							<p className="status-line" style={{ marginBottom: 10 }}>
								<Link to="/akun">{auth.user.email}</Link> · {t('Paket', 'Plan')} {auth.user.plan === 'free' ? t('Gratis', 'Free') : auth.user.plan === 'pro' ? 'Pro' : t('Lembaga', 'Organisation')}
								<button className="btn btn-ghost btn-sm" onClick={() => void signOut()}><LogOut size={14} /> {t('Keluar', 'Sign out')}</button>
							</p>
							<div className="proj-list">
								{cloud === null ? <p className="status-line">{t('Memuat…', 'Loading…')}</p> : !cloud.length ? <p className="status-line">{t('Belum ada proyek di cloud. Klik Simpan di Studio saat masuk.', 'No cloud projects yet. Click Save in the Studio while signed in.')}</p> : cloud.map((c) => (
									<div className="card proj" key={c.id}>
										<span className="ar">{getSurah(c.surah).name}</span>
										<div className="meta"><b>{c.title}</b><span>{fmt(c.updatedAt)}</span></div>
										<Link className="btn btn-sm btn-primary" to={`/studio?cloud=${c.id}`}>{t('Buka', 'Open')}</Link>
										<button className="btn btn-sm btn-icon btn-danger" aria-label={t('Hapus', 'Delete')} onClick={async () => { if (!window.confirm(t('Hapus proyek cloud ini?', 'Delete this cloud project?'))) return; await deleteCloud(c.id); setCloud((x) => x?.filter((y) => y.id !== c.id) ?? null); }}><Trash2 size={15} /></button>
									</div>
								))}
							</div>
						</>
					)}
				</section>
			)}

			<h2 style={{ fontSize: '1.2rem', marginBottom: 12 }}>{t('Di browser ini', 'In this browser')}</h2>
			{!items.length ? (
				<div className="card empty">
					<h3>{t('Belum ada proyek tersimpan', 'No saved projects yet')}</h3>
					<p>{t('Klik Simpan (Ctrl+S) di Studio untuk menyimpan proyek di sini.', 'Click Save (Ctrl+S) in the Studio to keep a project here.')}</p>
				</div>
			) : (
				<div className="proj-list">
					{items.map((m) => (
						<div className="card proj" key={m.id}>
							<span className="ar">{getSurah(m.surah).name}</span>
							<div className="meta">
								<b>{m.title}</b>
								<span>{m.rows} {t('baris', 'rows')} · {fmt(m.updatedAt)}</span>
							</div>
							<button className="btn btn-sm btn-primary" onClick={() => nav(`/studio?p=${m.id}`)}>{t('Buka', 'Open')}</button>
							<button className="btn btn-sm btn-icon" aria-label={t('Duplikat', 'Duplicate')} title={t('Duplikat', 'Duplicate')} onClick={() => { const p = getLocal(m.id); if (p) { saveLocal({ ...p, id: uid(), name: projectTitle(p) + t(' (salinan)', ' (copy)') }); refresh(); } }}><Copy size={15} /></button>
							<button className="btn btn-sm btn-icon" aria-label={t('Ekspor', 'Export')} title={t('Ekspor .json', 'Export .json')} onClick={() => { const p = getLocal(m.id); if (p) saveText(JSON.stringify(p, null, 1), `${m.title.replace(/[^\w-]+/g, '_')}.qss.json`, 'application/json'); }}><Download size={15} /></button>
							<button className="btn btn-sm btn-icon btn-danger" aria-label={t('Hapus', 'Delete')} title={t('Hapus', 'Delete')} onClick={() => { if (window.confirm(t(`Hapus “${m.title}”?`, `Delete “${m.title}”?`))) { deleteLocal(m.id); refresh(); } }}><Trash2 size={15} /></button>
						</div>
					))}
				</div>
			)}
			<p className="status-line" style={{ marginTop: 16 }}>{t('Proyek menyimpan teks, waktu, dan gaya — tidak termasuk file audio.', 'Projects store text, timing and style — not the audio file.')}</p>
		</div>
	);
}
