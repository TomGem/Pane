export type PaletteId = 'indigo' | 'blue' | 'teal' | 'green' | 'orange' | 'red' | 'pink' | 'grey';

export interface PaletteInfo {
	id: PaletteId;
	name: string;
	light: string;
	dark: string;
}

export const PALETTES: PaletteInfo[] = [
	{ id: 'indigo', name: 'Indigo', light: '#6366f1', dark: '#818cf8' },
	{ id: 'blue', name: 'Blue', light: '#3b82f6', dark: '#60a5fa' },
	{ id: 'teal', name: 'Teal', light: '#14b8a6', dark: '#2dd4bf' },
	{ id: 'green', name: 'Green', light: '#22c55e', dark: '#4ade80' },
	{ id: 'orange', name: 'Orange', light: '#f97316', dark: '#fb923c' },
	{ id: 'red', name: 'Red', light: '#ef4444', dark: '#f87171' },
	{ id: 'pink', name: 'Pink', light: '#ec4899', dark: '#f472b6' },
	{ id: 'grey', name: 'Grey', light: '#6b7280', dark: '#9ca3af' }
];

const STORAGE_KEY = 'palette';

function loadPalette(): PaletteId {
	if (typeof window === 'undefined') return 'indigo';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored && PALETTES.some((p) => p.id === stored)) {
		return stored as PaletteId;
	}
	return 'indigo';
}

export type PaletteStore = ReturnType<typeof createPaletteStore>;

export function createPaletteStore() {
	let palette = $state<PaletteId>(loadPalette());

	$effect(() => {
		if (typeof document === 'undefined') return;
		const html = document.documentElement;
		if (palette === 'indigo') {
			html.removeAttribute('data-palette');
			localStorage.removeItem(STORAGE_KEY);
		} else {
			html.setAttribute('data-palette', palette);
			localStorage.setItem(STORAGE_KEY, palette);
		}
	});

	function setPalette(id: PaletteId) {
		palette = id;
	}

	return {
		get palette() {
			return palette;
		},
		setPalette
	};
}
