export type FontId = 'system' | 'fira' | 'inter' | 'ubuntu';

export interface FontInfo {
	id: FontId;
	name: string;
	family: string;
}

export const FONTS: FontInfo[] = [
	{ id: 'system', name: 'System', family: 'system-ui, sans-serif' },
	{ id: 'fira', name: 'Fira Sans', family: "'Fira Sans', system-ui, sans-serif" },
	{ id: 'inter', name: 'Inter', family: "'Inter', system-ui, sans-serif" },
	{ id: 'ubuntu', name: 'Ubuntu', family: "'Ubuntu', system-ui, sans-serif" }
];

const STORAGE_KEY = 'font';
const DEFAULT_FONT: FontId = 'system';

function loadFont(): FontId {
	if (typeof window === 'undefined') return DEFAULT_FONT;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored && FONTS.some((f) => f.id === stored)) {
		return stored as FontId;
	}
	return DEFAULT_FONT;
}

export type FontStore = ReturnType<typeof createFontStore>;

export function createFontStore() {
	let font = $state<FontId>(loadFont());

	$effect(() => {
		if (typeof document === 'undefined') return;
		const html = document.documentElement;
		const info = FONTS.find((f) => f.id === font);
		if (font === DEFAULT_FONT) {
			html.removeAttribute('data-font');
			localStorage.removeItem(STORAGE_KEY);
		} else {
			html.setAttribute('data-font', font);
			localStorage.setItem(STORAGE_KEY, font);
		}
		if (info) {
			html.style.setProperty('--font-sans', info.family);
		}
	});

	function setFont(id: FontId) {
		font = id;
	}

	return {
		get font() {
			return font;
		},
		setFont
	};
}
