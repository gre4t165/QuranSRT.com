import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiCheckout } from '~/lib/account';
import { useT } from '~/lib/i18n';

/** Pilih metode lalu arahkan ke halaman pembayaran Xendit / PayPal. Harga dihitung ulang di server. */
export function PayChoice({ xendit, paypal, product, amount, email, label, disabled }: { xendit: boolean; paypal: boolean; product: string; amount?: (cur: 'IDR' | 'USD') => number; email?: string; label?: (cur: 'IDR' | 'USD') => string; disabled?: boolean }) {
	const { t } = useT();
	const [busy, setBusy] = useState<'xendit' | 'paypal' | null>(null);
	const [err, setErr] = useState('');
	const go = async (provider: 'xendit' | 'paypal') => {
		setBusy(provider);
		setErr('');
		try {
			const r = await apiCheckout({ product, provider, amount: amount?.(provider === 'xendit' ? 'IDR' : 'USD'), email });
			window.location.href = r.url;
		} catch (e) {
			setErr((e as Error).message);
			setBusy(null);
		}
	};
	if (!xendit && !paypal) return <div className="notice warn">{t('Pembayaran online belum diaktifkan di situs ini.', 'Online payment is not enabled on this site.')}</div>;
	return (
		<div style={{ display: 'grid', gap: 10 }}>
			<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
				{xendit && (
					<button type="button" className="btn btn-primary" disabled={disabled || !!busy} onClick={() => void go('xendit')}>
						{busy === 'xendit' && <Loader2 size={16} className="spin" />} {label?.('IDR') ?? t('Bayar (QRIS, VA, e-wallet)', 'Pay (QRIS, bank, e-wallet)')}
					</button>
				)}
				{paypal && (
					<button type="button" className="btn" disabled={disabled || !!busy} onClick={() => void go('paypal')}>
						{busy === 'paypal' && <Loader2 size={16} className="spin" />} {label?.('USD') ?? t('Bayar dengan PayPal', 'Pay with PayPal')}
					</button>
				)}
			</div>
			{err && <div className="notice error">{err}</div>}
		</div>
	);
}
