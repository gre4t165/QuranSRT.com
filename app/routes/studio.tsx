import type { Route } from './+types/studio';
import { seo } from '~/lib/seo';
import { Studio } from '~/components/studio/Studio';

export const meta: Route.MetaFunction = () =>
	seo({
		title: 'Studio — buat subtitle Al-Qur’an SRT online',
		description: 'Pilih surah dan qari, sinkronkan waktu otomatis, atur tampilan, lalu unduh subtitle SRT, VTT, ASS atau video MP4 — langsung di browser, gratis.',
		path: '/studio',
	});

export default function StudioRoute() {
	return <Studio />;
}
