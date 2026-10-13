import { Link } from 'react-router';
import type { Route } from './+types/not-found';
import { seo } from '~/lib/seo';
import { useT } from '~/lib/i18n';

export const meta: Route.MetaFunction = () => seo({ title: 'Halaman tidak ditemukan', description: 'Halaman yang Anda cari tidak ada.', path: '/404', noindex: true });

export default function NotFound() {
	const { t } = useT();
	return (
		<div className="prose-page">
			<h1>{t('Halaman tidak ditemukan', 'Page not found')}</h1>
			<p className="lead">{t('Alamat ini tidak ada atau sudah dipindahkan.', 'This address does not exist or has moved.')}</p>
			<div style={{ display: 'flex', gap: 10 }}>
				<Link className="btn btn-primary" to="/studio">{t('Buka Studio', 'Open Studio')}</Link>
				<Link className="btn" to="/">{t('Ke beranda', 'Go home')}</Link>
			</div>
		</div>
	);
}
