export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme-mode';

function getSystemTheme(): ResolvedTheme {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadMode(): ThemeMode {
	if (typeof window === 'undefined') return 'system';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark' || stored === 'system') {
		return stored;
	}
	return 'system';
}

export function createThemeStore() {
	let mode = $state<ThemeMode>(loadMode());

	// Keep a reactive system-theme tracker so $derived re-evaluates when system preference changes
	let systemTheme = $state<ResolvedTheme>(getSystemTheme());

	if (typeof window !== 'undefined') {
		const mql = window.matchMedia('(prefers-color-scheme: dark)');
		mql.addEventListener('change', (e) => {
			systemTheme = e.matches ? 'dark' : 'light';
		});
	}

	// Re-derive resolved taking systemTheme into account
	const resolvedTheme = $derived<ResolvedTheme>(
		mode === 'system' ? systemTheme : mode
	);

	// Apply data-theme attribute and persist to localStorage
	$effect(() => {
		const theme = resolvedTheme;
		if (typeof document === 'undefined') return;

		const html = document.documentElement;
		html.classList.add('theme-transitioning');
		html.setAttribute('data-theme', theme);

		// Persist mode
		localStorage.setItem(STORAGE_KEY, mode);

		// Remove transition class after animation completes
		const timeout = setTimeout(() => {
			html.classList.remove('theme-transitioning');
		}, 350);

		return () => clearTimeout(timeout);
	});

	function setMode(newMode: ThemeMode) {
		mode = newMode;
	}

	function toggle() {
		const order: ThemeMode[] = ['light', 'system', 'dark'];
		const currentIndex = order.indexOf(mode);
		mode = order[(currentIndex + 1) % order.length];
	}

	return {
		get mode() {
			return mode;
		},
		get resolved() {
			return resolvedTheme;
		},
		setMode,
		toggle
	};
}
