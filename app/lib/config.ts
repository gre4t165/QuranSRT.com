// Konfigurasi yang bisa diubah SETELAH deploy tanpa build ulang: edit file /app-config.json di hosting.
import { useEffect, useState } from 'react';

export interface PlanConfig {
	id: string;
	name: string;
	price: string;
	period: string;
	highlight?: boolean;
	features: string[];
	cta: string;
	href?: string;
}

export interface AppConfig {
	brand: string;
	siteUrl: string;
	contactEmail: string;
	whatsapp: string;
	announcement: string;
	freeVideoWatermark: boolean;
	plans: PlanConfig[];
}

export const DEFAULT_CONFIG: AppConfig = {
	brand: 'Quran SRT Studio',
	siteUrl: '',
	contactEmail: '',
	whatsapp: '',
	announcement: '',
	freeVideoWatermark: true,
	plans: [],
};

let cached: Promise<AppConfig> | null = null;

export function loadConfig(): Promise<AppConfig> {
	if (!cached) {
		cached = fetch('/app-config.json', { cache: 'no-cache' })
			.then((r) => (r.ok ? r.json() : {}))
			.then((j) => ({ ...DEFAULT_CONFIG, ...(j as Partial<AppConfig>) }))
			.catch(() => DEFAULT_CONFIG);
	}
	return cached;
}

export function useAppConfig(): AppConfig {
	const [cfg, setCfg] = useState<AppConfig>(DEFAULT_CONFIG);
	useEffect(() => {
		let alive = true;
		void loadConfig().then((c) => alive && setCfg(c));
		return () => {
			alive = false;
		};
	}, []);
	return cfg;
}

export const waLink = (num: string, text: string) => `https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
