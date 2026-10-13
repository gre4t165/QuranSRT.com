import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Loader2, Mail, MessageCircle, Send } from 'lucide-react';
import type { Route } from './+types/kontak';
import { seo } from '~/lib/seo';
import { useT } from '~/lib/i18n';
import { useAppConfig, waLink } from '~/lib/config';
import { sendContact, serverStatus } from '~/lib/api';

export const meta: Route.MetaFunction = () => seo({ title: 'Kontak', description: 'Hubungi tim Quran SRT Studio untuk pertanyaan, laporan kesalahan teks, kerja sama lembaga, atau paket Pro.', path: '/kontak' });

export default function Kontak() {
	const { t } = useT();
	const cfg = useAppConfig();
	const [params] = useSearchParams();
	const [canSend, setCanSend] = useState(false);
	const [f, setF] = useState({ name: '', email: '', topic: params.get('topik') ?? 'Pertanyaan umum', message: '', website: '' });
	const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
	const [err, setErr] = useState('');
	useEffect(() => {
		void serverStatus().then((s) => setCanSend(s.contact));
	}, []);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!canSend) {
			const body = `${f.message}\n\n— ${f.name} (${f.email})`;
			if (cfg.contactEmail) window.location.href = `mailto:${cfg.contactEmail}?subject=${encodeURIComponent('[Quran SRT Studio] ' + f.topic)}&body=${encodeURIComponent(body)}`;
			return;
		}
		setState('busy');
		try {
			await sendContact(f);
			setState('ok');
			setF((x) => ({ ...x, message: '' }));
		} catch (e2) {
			setErr((e2 as Error).message);
			setState('err');
		}
	};

	return (
		<div className="prose-page">
			<h1>{t('Hubungi kami', 'Contact us')}</h1>
			<p className="lead">{t('Pertanyaan, saran fitur, laporan kesalahan teks, atau kerja sama lembaga — kami senang mendengarnya.', 'Questions, feature ideas, text corrections or partnerships — we would love to hear from you.')}</p>
			<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
				{cfg.whatsapp && <a className="btn" href={waLink(cfg.whatsapp, "Assalamu'alaikum, saya ingin bertanya tentang Quran SRT Studio.")} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>}
				{cfg.contactEmail && <a className="btn" href={`mailto:${cfg.contactEmail}`}><Mail size={16} /> {cfg.contactEmail}</a>}
			</div>
			{!canSend && !cfg.contactEmail && !cfg.whatsapp ? (
				<div className="notice">{t('Formulir kontak belum diaktifkan oleh pemilik situs.', 'The contact form has not been enabled by the site owner yet.')}</div>
			) : (
				<form className="card auth-card" onSubmit={submit}>
					<div className="grid-2">
						<label className="field"><span>{t('Nama', 'Name')}</span><input className="input" required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
						<label className="field"><span>Email</span><input className="input" type="email" required maxLength={120} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
					</div>
					<label className="field"><span>{t('Topik', 'Topic')}</span>
						<select className="select" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
							{['Pertanyaan umum', 'Laporan kesalahan teks', 'Saran fitur', 'Paket Pro', 'Paket Lembaga', 'Kerja sama'].concat(params.get('topik') && !['Paket Pro', 'Paket Lembaga'].includes(params.get('topik')!) ? [params.get('topik')!] : []).map((x) => <option key={x}>{x}</option>)}
						</select>
					</label>
					<label className="field"><span>{t('Pesan', 'Message')}</span><textarea className="textarea" required minLength={10} maxLength={4000} rows={6} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>
					<input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true" />
					<button className="btn btn-primary btn-lg" disabled={state === 'busy'}>{state === 'busy' ? <Loader2 size={17} className="spin" /> : <Send size={17} />} {canSend ? t('Kirim pesan', 'Send message') : t('Kirim lewat email', 'Send via email')}</button>
					{state === 'ok' && <div className="notice ok">{t('Pesan terkirim. Kami akan membalas lewat email.', 'Message sent. We will reply by email.')}</div>}
					{state === 'err' && <div className="notice error">{err || t('Pesan gagal dikirim. Coba lagi atau hubungi lewat email.', 'Message failed. Try again or email us.')}</div>}
				</form>
			)}
		</div>
	);
}
