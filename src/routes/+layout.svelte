<script lang="ts">
	import '../app.css';
	import { createThemeStore } from '$lib/stores/theme.svelte';
	import { createPaletteStore } from '$lib/stores/palette.svelte';
	import { createFontStore } from '$lib/stores/font.svelte';
	import { createMonoFontStore } from '$lib/stores/mono-font.svelte';
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const theme = createThemeStore();
	const palette = createPaletteStore();
	const fontStore = createFontStore();
	const monoFontStore = createMonoFontStore();

	setContext('theme', theme);
	setContext('palette', palette);
	setContext('font', fontStore);
	setContext('monoFont', monoFontStore);
</script>

<svelte:head>
	<title>Pane</title>
	<meta name="description" content="A multi-user Kanban dashboard for organizing links, notes, and documents into draggable columns." />
</svelte:head>

<div class="app-shell">
	{@render children()}
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}
</style>
