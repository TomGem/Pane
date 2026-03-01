<script lang="ts">
	import '../app.css';
	import { createThemeStore } from '$lib/stores/theme.svelte';
	import { createPaletteStore } from '$lib/stores/palette.svelte';
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const theme = createThemeStore();
	const palette = createPaletteStore();

	setContext('theme', theme);
	setContext('palette', palette);
</script>

<svelte:head>
	<title>Pane</title>
	<meta name="description" content="A local-only Kanban dashboard for organizing links, notes, and documents into draggable columns." />
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
