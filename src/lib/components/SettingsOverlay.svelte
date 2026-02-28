<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import type { ThemeMode } from '$lib/stores/theme.svelte';
	import { PALETTES, type PaletteId } from '$lib/stores/palette.svelte';

	interface Props {
		themeMode: ThemeMode;
		paletteId: PaletteId;
		onclose: () => void;
		onthemechange?: (mode: ThemeMode) => void;
		onpalettechange?: (id: PaletteId) => void;
	}

	let { themeMode, paletteId, onclose, onthemechange, onpalettechange }: Props = $props();

	let isDark = $derived(themeMode === 'dark' || (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches));
</script>

<div class="settings-overlay" onclick={(e) => { if (e.target === e.currentTarget) onclose(); }} onkeydown={(e) => { if (e.key === 'Escape') onclose(); }} role="button" tabindex="-1">
	<div class="settings-panel glass-strong">
		<div class="settings-header">
			<h2 class="settings-title">Settings</h2>
			<button class="settings-close" onclick={onclose} aria-label="Close" title="Close">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
		<div class="settings-body">
			<section class="settings-section">
				<h3 class="settings-section-title">Theme</h3>
				<ThemeToggle mode={themeMode} onchange={onthemechange} />
			</section>
			<section class="settings-section">
				<h3 class="settings-section-title">Accent colour</h3>
				<div class="palette-grid">
					{#each PALETTES as p (p.id)}
						<button
							class="palette-swatch"
							class:active={paletteId === p.id}
							onclick={() => onpalettechange?.(p.id)}
							title={p.name}
							aria-label="{p.name} palette"
						>
							<span
								class="swatch-circle"
								style:background-color={isDark ? p.dark : p.light}
							>
								{#if paletteId === p.id}
									<svg class="swatch-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="20 6 9 17 4 12" />
									</svg>
								{/if}
							</span>
							<span class="swatch-name">{p.name}</span>
						</button>
					{/each}
				</div>
			</section>
		</div>
	</div>
</div>

<style>
	.settings-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
	}

	.settings-panel {
		width: 90vw;
		max-width: 420px;
		max-height: 85vh;
		overflow-y: auto;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
	}

	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.settings-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.settings-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.settings-close:hover {
		background: var(--accent-soft);
		color: var(--text-primary);
	}

	.settings-body {
		padding: 16px 20px 20px;
	}

	.settings-section {
		margin-bottom: 20px;
	}

	.settings-section:last-child {
		margin-bottom: 0;
	}

	.settings-section-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		margin-bottom: 10px;
	}

	.palette-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}

	.palette-swatch {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 8px 4px;
		border-radius: var(--radius);
		cursor: pointer;
		transition: background-color var(--transition);
	}

	.palette-swatch:hover {
		background: var(--accent-soft);
	}

	.palette-swatch.active {
		background: var(--accent-soft);
	}

	.swatch-circle {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: box-shadow var(--transition);
	}

	.palette-swatch.active .swatch-circle {
		box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px currentColor;
	}

	.swatch-check {
		color: white;
	}

	.swatch-name {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-secondary);
	}
</style>
