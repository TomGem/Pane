<script lang="ts">
	import '../app.css';
	import { createThemeStore } from '$lib/stores/theme.svelte';
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const theme = createThemeStore();

	setContext('theme', theme);
</script>

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
