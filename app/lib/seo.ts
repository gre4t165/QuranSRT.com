import type { MetaDescriptor } from 'react-router';

// Bila VITE_SITE_URL diisi saat build (mis. https://studio.domainanda.com), tag canonical & og:url ditulis ke HTML.
// Bila kosong, root.tsx menambahkan canonical saat halaman dibuka.
export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export function seo(o: { title: string; description: string; path: string; noindex?: boolean; jsonLd?: object | object[] }): MetaDescriptor[] {
	const title = o.title.includes('Quran SRT Studio') ? o.title : `${o.title} — Quran SRT Studio`;
	const tags: MetaDescriptor[] = [
		{ title },
		{ name: 'description', content: o.description },
		{ property: 'og:title', content: title },
		{ property: 'og:description', content: o.description },
		{ property: 'og:type', content: 'website' },
		{ property: 'og:site_name', content: 'Quran SRT Studio' },
		{ property: 'og:locale', content: 'id_ID' },
		{ property: 'og:image', content: `${SITE_URL}/og.png` },
		{ property: 'og:image:width', content: '1200' },
		{ property: 'og:image:height', content: '630' },
		{ name: 'twitter:card', content: 'summary_large_image' },
		{ name: 'twitter:title', content: title },
		{ name: 'twitter:description', content: o.description },
		{ name: 'twitter:image', content: `${SITE_URL}/og.png` },
	];
	if (SITE_URL) tags.push({ tagName: 'link', rel: 'canonical', href: SITE_URL + o.path }, { property: 'og:url', content: SITE_URL + o.path });
	if (o.noindex) tags.push({ name: 'robots', content: 'noindex' });
	for (const j of [o.jsonLd ?? []].flat()) tags.push({ 'script:ld+json': j });
	return tags;
}
