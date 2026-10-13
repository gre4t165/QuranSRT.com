import { Link } from 'react-router';
import { Check } from 'lucide-react';
import type { Route } from './+types/harga';
import { seo } from '~/lib/seo';
import { useT } from '~/lib/i18n';
import { useEffect, useState } from 'react';
import { useAppConfig, waLink, type PlanConfig } from '~/lib/config';
import { loadPayConfig, money, type PayConfig, type PayProduct } from '~/lib/account';
import { useAuth } from '~/lib/useAuth';
import { PayChoice } from '~/components/PayChoice';

export const meta: Route.MetaFunction = () =>
	seo({ title: 'Harga', description: 'Quran SRT Studio gratis untuk semua fitur inti. Paket Pro dan Lembaga untuk sinkron cloud, batch, video tanpa tanda air, dan dukungan.', path: '/harga' });

const DEFAULT_PLANS: PlanConfig[] = [
	{ id: 'free', name: 'Gratis', price: 'Rp0', period: 'selamanya', features: ['114 surah, 20+ qari', 'Sinkron otomatis, tap-sync, linimasa', 'Ekspor SRT, VTT, ASS, deskripsi', 'Ekspor video MP4/WebM', 'Proyek tersimpan di browser'], cta: 'Mulai sekarang', href: '/studio' },
	{ id: 'pro', name: 'Pro', price: 'Rp49.000', period: '/bulan', highlight: true, features: ['Semua fitur Gratis', 'Sinkron proyek di semua perangkat', 'Video tanpa tanda air', 'Batch ZIP satu juz', 'Dukungan prioritas'], cta: 'Berlangganan Pro' },
	{ id: 'lembaga', name: 'Lembaga', price: 'Hubungi kami', period: '', features: ['Semua fitur Pro', 'Akun untuk tim / pengurus masjid', 'Template layar sesuai identitas lembaga', 'Pendampingan & pelatihan'], cta: 'Diskusikan kebutuhan' },
];

export default function Harga() {
	const { t } = useT();
	const cfg = useAppConfig();
	const plans = cfg.plans.length ? cfg.plans : DEFAULT_PLANS;
	const auth = useAuth();
	const [pay, setPay] = useState<PayConfig | null>(null);
	const [prod, setProd] = useState('pro_12m');
	useEffect(() => {
		void loadPayConfig().then(setPay);
	}, []);
	const online = !!pay && (pay.xendit || pay.paypal) && pay.products.length > 0 && auth.enabled;
	const sel: PayProduct | undefined = pay?.products.find((p) => p.id === prod) ?? pay?.products[0];
	const hrefFor = (p: PlanConfig) => {
		if (p.href) return p.href;
		if (online && p.id === 'pro') return '#beli';
		if (cfg.whatsapp) return waLink(cfg.whatsapp, `Assalamu'alaikum, saya ingin paket ${p.name} Quran SRT Studio.`);
		if (cfg.contactEmail) return `mailto:${cfg.contactEmail}?subject=${encodeURIComponent('Paket ' + p.name + ' Quran SRT Studio')}`;
		return `/kontak?topik=${encodeURIComponent('Paket ' + p.name)}`;
	};
	return (
		<div className="page" style={{ paddingTop: 56 }}>
			<div className="section-head">
				<h1 style={{ fontSize: 'clamp(2rem,4vw,2.8rem)' }}>{t('Gratis untuk berkarya. Pro untuk tim yang rutin produksi.', 'Free to create. Pro for teams who publish every day.')}</h1>
				<p>{t('Semua fitur inti bisa dipakai tanpa daftar. Paket berbayar menambah sinkron cloud, batch, dan video tanpa tanda air.', 'Every core feature works without an account. Paid plans add cloud sync, batch export and watermark-free video.')}</p>
			</div>
			<div className="plans">
				{plans.map((p) => {
					const href = hrefFor(p);
					const internal = href.startsWith('/');
					const anchor = href.startsWith('#');
					return (
						<div key={p.id} className={`plan${p.highlight ? ' hl' : ''}`}>
							{p.highlight && <span className="tag">{t('Paling diminati', 'Most popular')}</span>}
							<h3>{p.name}</h3>
							<div className="price">{p.price} <small>{p.period}</small></div>
							<ul>
								{p.features.map((f) => (
									<li key={f}><Check size={16} />{f}</li>
								))}
							</ul>
							{internal ? (
								<Link className={`btn ${p.highlight ? 'btn-primary' : ''} btn-block`} to={href}>{p.cta}</Link>
							) : anchor ? (
								<a className={`btn ${p.highlight ? 'btn-primary' : ''} btn-block`} href={href}>{p.cta}</a>
							) : (
								<a className={`btn ${p.highlight ? 'btn-primary' : ''} btn-block`} href={href} target="_blank" rel="noreferrer">{p.cta}</a>
							)}
						</div>
					);
				})}
			</div>
			{online && sel ? (
				<section id="beli" className="card" style={{ marginTop: 56, padding: 28, display: 'grid', gap: 16, maxWidth: 640, marginInline: 'auto' }}>
					<h2 style={{ fontSize: '1.4rem' }}>{t('Berlangganan', 'Subscribe')}</h2>
					<div role="radiogroup" aria-label={t('Pilih paket', 'Choose a plan')} style={{ display: 'grid', gap: 10 }}>
						{pay!.products.map((p) => (
							<label key={p.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderColor: p.id === sel.id ? 'var(--action)' : undefined }}>
								<input type="radio" name="produk" checked={p.id === sel.id} onChange={() => setProd(p.id)} />
								<span style={{ flex: 1 }}><b>{p.label}</b></span>
								<span>{pay!.xendit ? money('IDR', p.idr) : money('USD', p.usd)}{pay!.xendit && pay!.paypal && <small className="sub"> · {money('USD', p.usd)}</small>}</span>
							</label>
						))}
					</div>
					{!auth.user ? (
						<div className="notice">{t('Masuk atau daftar dulu agar paket tercatat di akun Anda.', 'Sign in or sign up first so the plan is linked to your account.')} <Link to="/daftar?next=/harga%23beli">{t('Daftar', 'Sign up')}</Link> · <Link to="/masuk?next=/harga%23beli">{t('Masuk', 'Sign in')}</Link></div>
					) : !auth.user.verified ? (
						<div className="notice warn">{t('Verifikasi email Anda dulu (cek kotak masuk), lalu kembali ke sini.', 'Verify your email first (check your inbox), then come back.')} <Link to="/akun">{t('Buka akun', 'Open account')}</Link></div>
					) : (
						<PayChoice xendit={pay!.xendit} paypal={pay!.paypal} product={sel.id} label={(c) => (c === 'IDR' ? t(`Bayar ${money('IDR', sel.idr)} (QRIS, VA, e-wallet)`, `Pay ${money('IDR', sel.idr)} (QRIS, bank, e-wallet)`) : t(`Bayar ${money('USD', sel.usd)} dengan PayPal`, `Pay ${money('USD', sel.usd)} with PayPal`))} />
					)}
					<p className="status-line" style={{ margin: 0 }}>{t('Paket aktif otomatis setelah pembayaran terkonfirmasi dan kuitansi dikirim ke email. Perpanjangan menambah dari sisa masa aktif. Tidak ada tagihan otomatis berulang. Pembayaran diproses oleh Xendit/PayPal.', 'Your plan activates automatically once payment is confirmed and a receipt is emailed. Renewals add to the remaining time. There are no automatic recurring charges. Payments are processed by Xendit/PayPal.')}</p>
				</section>
			) : (
				<div className="section-head" style={{ marginTop: 56 }}>
					<h2 style={{ fontSize: '1.4rem' }}>{t('Cara berlangganan', 'How to subscribe')}</h2>
					<p style={{ fontSize: 16 }}>{t('Pembayaran saat ini lewat transfer bank atau QRIS. Setelah konfirmasi, paket akun Anda kami aktifkan dalam 1×24 jam. Proyek di browser tetap aman dan bisa dipindahkan ke cloud.', 'Payments are currently by bank transfer or QRIS. After confirmation we activate your plan within 24 hours. Browser projects stay safe and can move to the cloud.')}</p>
				</div>
			)}
		</div>
	);
}
