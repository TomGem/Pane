export type MonoFontId = 'system' | 'fira-code' | 'jetbrains' | 'source-code';

export interface MonoFontInfo {
	id: MonoFontId;
	name: string;
	family: string;
}

export const MONO_FONTS: MonoFontInfo[] = [
	{ id: 'system', name: 'System', family: 'ui-monospace, monospace' },
	{ id: 'fira-code', name: 'Fira Code', family: "'Fira Code', ui-monospace, monospace" },
	{ id: 'jetbrains', name: 'JetBrains Mono', family: "'JetBrains Mono', ui-monospace, monospace" },
	{ id: 'source-code', name: 'Source Code Pro', family: "'Source Code Pro', ui-monospace, monospace" }
];

const STORAGE_KEY = 'mono-font';
const DEFAULT_FONT: MonoFontId = 'system';

function loadMonoFont(): MonoFontId {
	if (typeof window === 'undefined') return DEFAULT_FONT;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored && MONO_FONTS.some((f) => f.id === stored)) {
		return stored as MonoFontId;
	}
	return DEFAULT_FONT;
}

export type MonoFontStore = ReturnType<typeof createMonoFontStore>;

export function createMonoFontStore() {
	let font = $state<MonoFontId>(loadMonoFont());

	$effect(() => {
		if (typeof document === 'undefined') return;
		const html = document.documentElement;
		const info = MONO_FONTS.find((f) => f.id === font);
		if (font === DEFAULT_FONT) {
			html.removeAttribute('data-mono-font');
			localStorage.removeItem(STORAGE_KEY);
		} else {
			html.setAttribute('data-mono-font', font);
			localStorage.setItem(STORAGE_KEY, font);
		}
		if (info) {
			html.style.setProperty('--font-mono', info.family);
		}
	});

	function setFont(id: MonoFontId) {
		font = id;
	}

	return {
		get font() {
			return font;
		},
		setFont
	};
}
