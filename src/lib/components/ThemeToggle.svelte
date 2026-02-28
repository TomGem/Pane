<script lang="ts">
	import type { ThemeMode } from '$lib/stores/theme.svelte';

	interface Props {
		mode: ThemeMode;
		onchange?: (mode: ThemeMode) => void;
	}

	let { mode, onchange }: Props = $props();

	const options: { value: ThemeMode; label: string }[] = [
		{ value: 'light', label: 'Light' },
		{ value: 'system', label: 'System' },
		{ value: 'dark', label: 'Dark' }
	];

	function select(value: ThemeMode) {
		onchange?.(value);
	}
</script>

<div class="theme-toggle glass" role="radiogroup" aria-label="Theme selection">
	{#each options as opt (opt.value)}
		<button
			class="toggle-btn"
			class:active={mode === opt.value}
			role="radio"
			aria-checked={mode === opt.value}
			aria-label="{opt.label} theme"
			title="{opt.label} theme"
			onclick={() => select(opt.value)}
		>
			{#if opt.value === 'light'}
				<!-- Sun icon -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="5" />
					<line x1="12" y1="1" x2="12" y2="3" />
					<line x1="12" y1="21" x2="12" y2="23" />
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
					<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
					<line x1="1" y1="12" x2="3" y2="12" />
					<line x1="21" y1="12" x2="23" y2="12" />
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
					<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
				</svg>
			{:else if opt.value === 'system'}
				<!-- Monitor icon -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
					<line x1="8" y1="21" x2="16" y2="21" />
					<line x1="12" y1="17" x2="12" y2="21" />
				</svg>
			{:else}
				<!-- Moon icon -->
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			{/if}
		</button>
	{/each}
</div>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		border-radius: var(--radius);
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition:
			background-color var(--transition),
			color var(--transition);
	}

	.toggle-btn:hover {
		color: var(--text-secondary);
		background-color: var(--accent-soft);
	}

	.toggle-btn.active {
		color: var(--accent);
		background-color: var(--accent-soft);
	}
</style>
