import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, Loader2, LogOut, MailWarning } from 'lucide-react';
import type { Route } from './+types/akun';
import { seo } from '~/lib/seo';
import { useT } from '~/lib/i18n';
import { refreshAuth, setAuthUser, signOut, useAuth } from '~/lib/useAuth';
import { apiHistory, apiPaypalCapture, apiProfile, apiResend, money, type PaymentRow } from '~/lib/account';

export const meta: Route.MetaFunction = () => seo({ title: 'Akun saya', description: 'Kelola akun, paket, dan riwayat pembayaran Quran SRT Studio.', path: '/akun', noindex: true });

type Banner = { kind: 'ok' | 'wait' | 'err'; text: string } | null;

export default function Akun() {
	const { t, lang } = useT();
	const auth = useAuth();
	const nav = useNavigate();
	const [sp, setSp] = useSearchParams();
	const [history, setHistory] = useState<PaymentRow[] | null>(null);
	const [banner, setBanner] = useState<Banner>(null);
	const [name, setName] = useState('');
	const [msg, setMsg] = useState('');
	const handled = useRef(false);
	const bayar = sp.get('bayar');

	// Kembali dari halaman pembayaran. Tidak perlu login untuk donasi tamu.
	useEffect(() => {
		if (!bayar || handled.current) return;
		handled.current = true;
		const pid = Number(sp.get('p')) || 0;
		const clear = () => setSp({}, { replace: true });
		if (bayar === 'gagal') {
			setBanner({ kind: 'err', text: t('Pembayaran dibatalkan atau gagal. Tidak ada biaya yang dipotong.', 'Payment was cancelled or failed. You have not been charged.') });
			clear();
			return;
		}
		(async () => {
			try {
				if (bayar === 'paypal') {
					const order = sp.get('token') ?? '';
					setBanner({ kind: 'wait', text: t('Menyelesaikan pembayaran PayPal…', 'Completing your PayPal payment…') });
					await apiPaypalCapture(order);
				} else {
					setBanner({ kind: 'wait', text: t('Menunggu konfirmasi pembayaran…', 'Waiting for payment confirmation…') });
					// Webhook Xendit bisa tertunda beberapa detik; tunggu sampai server menandai lunas.
					let confirmed = false;
					let guest = false;
					for (let i = 0; i < 12 && !confirmed; i++) {
						const items = await apiHistory().catch(() => null);
						if (!items) {
							guest = true; // belum login (donasi tamu): tidak bisa dicek, cukup ucapkan terima kasih
							break;
						}
						confirmed = items.find((x) => x.id === pid)?.status === 'paid';
						if (!confirmed) await new Promise((r) => setTimeout(r, 2500));
					}
					if (!confirmed) {
						await refreshAuth();
						setBanner({ kind: guest ? 'ok' : 'wait', text: guest ? t('Terima kasih! Bila pembayaran berhasil, kuitansi dikirim ke email Anda.', 'Thank you! If the payment succeeded, a receipt is emailed to you.') : t('Pembayaran belum terkonfirmasi oleh bank/e-wallet. Bila sudah membayar, paket aktif otomatis dalam beberapa menit dan kuitansi dikirim ke email.', 'Payment is not confirmed yet. If you already paid, your plan activates automatically within minutes and a receipt is emailed.') });
						clear();
						return;
					}
				}
				await refreshAuth();
				setBanner({ kind: 'ok', text: t('Pembayaran diterima. Terima kasih! Kuitansi dikirim ke email Anda.', 'Payment received. Thank you! A receipt was sent to your email.') });
			} catch (e) {
				setBanner({ kind: 'err', text: (e as Error).message || t('Pembayaran belum terkonfirmasi. Bila sudah membayar, paket aktif otomatis dalam beberapa menit.', 'Payment is not confirmed yet. If you already paid, your plan activates automatically within minutes.') });
			}
			clear();
		})();
	}, [bayar, sp, setSp, t]);

	useEffect(() => {
		if (auth.user) {
			setName(auth.user.name);
			void apiHistory().then(setHistory).catch(() => setHistory([]));
		}
	}, [auth.user?.id, banner?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (auth.ready && auth.enabled && !auth.user && !bayar && !banner) nav('/masuk?next=/akun', { replace: true });
	}, [auth.ready, auth.enabled, auth.user, bayar, banner, nav]);

	const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { dateStyle: 'long' });
	const u = auth.user;
	const planName = u ? (u.plan === 'free' ? t('Gratis', 'Free') : u.plan === 'pro' ? 'Pro' : t('Lembaga', 'Organisation')) : '';
	const statusLabel: Record<PaymentRow['status'], string> = { paid: t('Lunas', 'Paid'), pending: t('Menunggu', 'Pending'), failed: t('Gagal', 'Failed'), expired: t('Kedaluwarsa', 'Expired') };

	const bannerEl = banner && (
		<div className={`notice${banner.kind === 'err' ? ' error' : ''}`} role="status" style={{ marginBottom: 20 }}>
			{banner.kind === 'wait' ? <Loader2 size={18} className="spin" /> : banner.kind === 'ok' ? <CheckCircle2 size={18} /> : null} {banner.text}
		</div>
	);

	if (!u) {
		return (
			<div className="page" style={{ paddingTop: 56, maxWidth: 640 }}>
				{bannerEl}
				{auth.ready && !auth.enabled ? <p>{t('Akun belum diaktifkan di situs ini.', 'Accounts are not enabled on this site.')}</p> : !banner && <p className="status-line"><Loader2 size={16} className="spin" /> {t('Memuat…', 'Loading…')}</p>}
				{banner ? <Link className="btn" to="/">{t('Kembali ke beranda', 'Back to home')}</Link> : null}
			</div>
		);
	}

	return (
		<div className="page" style={{ paddingTop: 48, maxWidth: 760 }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
				<h1 style={{ fontSize: '2rem', marginRight: 'auto' }}>{t('Akun saya', 'My account')}</h1>
				<button className="btn" onClick={() => void signOut().then(() => nav('/'))}><LogOut size={16} /> {t('Keluar', 'Sign out')}</button>
			</div>
			{bannerEl}

			{!u.verified && (
				<div className="notice warn" style={{ marginBottom: 20 }}>
					<MailWarning size={18} />
					<span>
						{t('Email Anda belum diverifikasi. Cek kotak masuk', 'Your email is not verified yet. Check the inbox of')} <b>{u.email}</b>.{' '}
						<button className="btn btn-sm" onClick={() => apiResend().then(() => setMsg(t('Email verifikasi dikirim ulang.', 'Verification email resent.'))).catch((e: Error) => setMsg(e.message))}>{t('Kirim ulang', 'Resend')}</button>
					</span>
				</div>
			)}
			{msg && <div className="notice" style={{ marginBottom: 16 }}>{msg}</div>}

			<section className="card" style={{ padding: 24, display: 'grid', gap: 12, marginBottom: 20 }}>
				<h2 style={{ fontSize: '1.15rem' }}>{t('Paket', 'Plan')}</h2>
				<p style={{ margin: 0 }}>
					<b style={{ fontSize: '1.3rem' }}>{planName}</b>
					{u.plan !== 'free' && u.planUntil > 0 && <span className="sub"> · {t('aktif sampai', 'active until')} {fmtDate(u.planUntil)}</span>}
				</p>
				<div><Link className="btn btn-primary" to="/harga#beli">{u.plan === 'free' ? t('Upgrade ke Pro', 'Upgrade to Pro') : t('Perpanjang', 'Renew')}</Link></div>
			</section>

			<section className="card" style={{ padding: 24, display: 'grid', gap: 14, marginBottom: 20 }}>
				<h2 style={{ fontSize: '1.15rem' }}>{t('Profil', 'Profile')}</h2>
				<label className="field"><span>Email</span><input className="input" value={u.email} disabled /></label>
				<label className="field"><span>{t('Nama', 'Name')}</span><input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></label>
				<label className="check"><input type="checkbox" checked={u.marketing} onChange={(e) => void apiProfile({ marketing: e.target.checked }).then(setAuthUser)} /> {t('Kirimi saya tips dan kabar fitur baru lewat email', 'Send me tips and product news by email')}</label>
				<div><button className="btn" disabled={name === u.name} onClick={() => void apiProfile({ name }).then((x) => { setAuthUser(x); setMsg(t('Profil disimpan.', 'Profile saved.')); })}>{t('Simpan nama', 'Save name')}</button></div>
				<p className="sub" style={{ margin: 0 }}>{t('Email penting (verifikasi, reset sandi, kuitansi, pengingat paket) tetap dikirim.', 'Important emails (verification, password reset, receipts, plan reminders) are always sent.')}</p>
			</section>

			<section className="card" style={{ padding: 24, display: 'grid', gap: 12 }}>
				<h2 style={{ fontSize: '1.15rem' }}>{t('Riwayat pembayaran', 'Payment history')}</h2>
				{history === null ? <p className="status-line">{t('Memuat…', 'Loading…')}</p> : !history.length ? <p className="status-line">{t('Belum ada pembayaran.', 'No payments yet.')}</p> : (
					<div style={{ overflowX: 'auto' }}>
						<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
							<thead><tr style={{ textAlign: 'left', color: 'var(--muted)' }}><th>No.</th><th>{t('Tanggal', 'Date')}</th><th>{t('Item', 'Item')}</th><th>{t('Jumlah', 'Amount')}</th><th>Status</th></tr></thead>
							<tbody>
								{history.map((h) => (
									<tr key={h.id} style={{ borderTop: '1px solid var(--line)' }}>
										<td>QSS-{h.id}</td>
										<td>{fmtDate(h.created_at)}</td>
										<td>{h.product === 'donasi' ? t('Donasi', 'Donation') : h.product.replace('_', ' ').toUpperCase()}</td>
										<td>{money(h.currency, h.amount)}</td>
										<td>{statusLabel[h.status]}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	);
}
