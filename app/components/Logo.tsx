/** Tanda: bingkai bintang delapan (rub' al-hizb) dengan garis waktu di tengah. */
export function LogoMark({ size = 34 }: { size?: number }) {
	return (
		<svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
			<rect x="10" y="10" width="28" height="28" rx="3" fill="#0e3b33" />
			<rect x="10" y="10" width="28" height="28" rx="3" fill="#0e3b33" transform="rotate(45 24 24)" />
			<rect x="12.5" y="12.5" width="23" height="23" rx="2" fill="none" stroke="#d7b462" strokeWidth="1.3" />
			<rect x="12.5" y="12.5" width="23" height="23" rx="2" fill="none" stroke="#d7b462" strokeWidth="1.3" transform="rotate(45 24 24)" />
			<rect x="16" y="21" width="9" height="2.6" rx="1.3" fill="#f3efe0" />
			<rect x="26.5" y="21" width="5.5" height="2.6" rx="1.3" fill="#d7b462" />
			<rect x="16" y="25.6" width="16" height="2.2" rx="1.1" fill="#f3efe0" opacity=".55" />
		</svg>
	);
}

export function Logo() {
	return (
		<>
			<LogoMark />
			<span className="word">
				Quran <b>SRT</b> Studio
			</span>
		</>
	);
}
