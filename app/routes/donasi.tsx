import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import type { Route } from './+types/donasi';
import { seo } from '~/lib/seo';
import { useT } from '~/lib/i18n';
import { loadPayConfig, money, type PayConfig } from '~/lib/account';
import { useAuth } from '~/lib/useAuth';
import { PayChoice } from '~/components/PayChoice';

export const meta: Route.MetaFunction = () =>
	seo({ title: 'Donasi', description: 'Dukung pengembangan Quran SRT Studio agar tetap gratis untuk dakwah, masjid, dan pengajar Al-Qur’an.', path: '/donasi' });

const IDR = [10000, 25000, 50000, 100000];
const USD = [2, 5, 10, 25];

export default function Donasi() {
	const { t } = useT();
	const auth = useAuth();
	const [cfg, setCfg] = useState<PayConfig | null | undefined>(undefined);
	const [cur, setCur] = useState<'IDR' | 'USD'>('IDR');
	const [amt, setAmt] = useState(25000);
	const [email, setEmail] = useState('');
	useEffect(() => {
		void loadPayConfig().then((c) => {
			setCfg(c);
			if (c && !c.xendit && c.paypal) {
				setCur('USD');
				setAmt(5);
			}
		});
	}, []);
	const pick = (c: 'IDR' | 'USD') => {
		setCur(c);
		setAmt(c === 'IDR' ? 25000 : 5);
	};
	const min = cur === 'IDR' ? cfg?.donation.minIdr ?? 10000 : cfg?.donation.minUsd ?? 1;
	const valid = Number.isFinite(amt) && amt >= min;
	const online = !!cfg && (cfg.xendit || cfg.paypal);

	return (
		<div className="page" style={{ paddingTop: 56, maxWidth: 680 }}>
			<div className="section-head" style={{ textAlign: 'left' }}>
				<h1 style={{ fontSize: 'clamp(2rem,4vw,2.6rem)' }}><Heart size={30} style={{ verticalAlign: '-4px' }} /> {t('Dukung Quran SRT Studio', 'Support Quran SRT Studio')}</h1>
				<p>{t('Fitur inti gratis untuk semua. Donasi Anda membantu biaya server dan layanan AI agar alat ini tetap bisa dipakai kreator dakwah, takmir masjid, dan pengajar Al-Qur’an.', 'Core features are free for everyone. Your donation helps cover server and AI costs so creators, mosques and Quran teachers can keep using it.')}</p>
			</div>

			{online && (
				<div className="card" style={{ padding: 24, display: 'grid', gap: 16 }}>
					{cfg!.xendit && cfg!.paypal && (
						<div className="seg" role="group" aria-label={t('Mata uang', 'Currency')} style={{ display: 'flex', gap: 8 }}>
							<button type="button" className={`btn btn-sm${cur === 'IDR' ? ' btn-primary' : ''}`} onClick={() => pick('IDR')}>Rupiah (QRIS / VA / e-wallet)</button>
							<button type="button" className={`btn btn-sm${cur === 'USD' ? ' btn-primary' : ''}`} onClick={() => pick('USD')}>USD (PayPal)</button>
						</div>
					)}
					<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
						{(cur === 'IDR' ? IDR : USD).map((v) => (
							<button key={v} type="button" className={`btn${amt === v ? ' btn-primary' : ''}`} onClick={() => setAmt(v)}>{money(cur, v)}</button>
						))}
					</div>
					<label className="field"><span>{t('Jumlah lain', 'Other amount')} ({cur})</span>
						<input className="input" type="number" min={min} step={cur === 'IDR' ? 1000 : 1} value={Number.isFinite(amt) ? amt : ''} onChange={(e) => setAmt(Number(e.target.value))} />
						<small className="sub">{t('Minimal', 'Minimum')} {money(cur, min)}</small>
					</label>
					{!auth.user && <label className="field"><span>{t('Email untuk kuitansi (opsional)', 'Email for the receipt (optional)')}</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>}
					<PayChoice
						xendit={cur === 'IDR' && cfg!.xendit}
						paypal={cur === 'USD' && cfg!.paypal}
						product="donasi"
						amount={() => amt}
						email={email || undefined}
						disabled={!valid}
						label={(c) => (c === 'IDR' ? t(`Donasi ${money('IDR', amt || 0)}`, `Donate ${money('IDR', amt || 0)}`) : t(`Donasi ${money('USD', amt || 0)} via PayPal`, `Donate ${money('USD', amt || 0)} via PayPal`))}
					/>
				</div>
			)}
			{cfg && cfg.donation.url && (
				<p style={{ marginTop: 20 }}><a className="btn" href={cfg.donation.url} target="_blank" rel="noreferrer noopener">{t('Donasi lewat platform lain', 'Donate via another platform')}</a></p>
			)}
			{cfg !== undefined && !online && !cfg?.donation.url && <div className="notice warn">{t('Donasi online belum diaktifkan. Hubungi kami lewat halaman Kontak.', 'Online donations are not enabled yet. Reach us via the Contact page.')}</div>}
			<p className="status-line" style={{ marginTop: 20 }}>{t('Donasi bersifat sukarela, tidak mengubah paket akun, dan tidak dapat dikembalikan. Pembayaran diproses oleh Xendit/PayPal; kami tidak menyimpan data kartu.', 'Donations are voluntary, do not change your plan and are non-refundable. Payments are processed by Xendit/PayPal; we never store card data.')}</p>
		</div>
	);
}
