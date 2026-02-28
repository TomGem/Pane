<script lang="ts">
	import type { Category } from '$lib/types';

	interface Props {
		category?: Category | null;
		parentColor?: string | null;
		onsubmit?: (data: { name: string; color: string }) => void;
		oncancel?: () => void;
	}

	let { category = null, parentColor = null, onsubmit, oncancel }: Props = $props();

	const presetColors = [
		'#ef4444', '#f97316', '#f59e0b', '#eab308',
		'#84cc16', '#22c55e', '#10b981', '#14b8a6',
		'#0d9488', '#06b6d4', '#0ea5e9', '#0369a1',
		'#3b82f6', '#6366f1', '#4338ca', '#8b5cf6',
		'#a855f7', '#d946ef', '#ec4899', '#f43f5e',
		'#be123c', '#78716c', '#64748b'
	];

	function hexToHsl(hex: string): [number, number, number] {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;
		const max = Math.max(r, g, b), min = Math.min(r, g, b);
		const l = (max + min) / 2;
		if (max === min) return [0, 0, l * 100];
		const d = max - min;
		const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		let h = 0;
		if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
		else if (max === g) h = ((b - r) / d + 2) / 6;
		else h = ((r - g) / d + 4) / 6;
		return [h * 360, s * 100, l * 100];
	}

	function hslToHex(h: number, s: number, l: number): string {
		h = ((h % 360) + 360) % 360;
		s = Math.max(0, Math.min(100, s)) / 100;
		l = Math.max(0, Math.min(100, l)) / 100;
		const a = s * Math.min(l, 1 - l);
		const f = (n: number) => {
			const k = (n + h / 30) % 12;
			const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
			return Math.round(255 * color).toString(16).padStart(2, '0');
		};
		return `#${f(0)}${f(8)}${f(4)}`;
	}

	function generateMatchingPalette(parentHex: string): string[] {
		const [h, s, l] = hexToHsl(parentHex);
		const variations: [number, number, number][] = [
			[h, s, l],                              // parent exact
			[h, s, Math.min(l + 15, 90)],           // lighter
			[h, s, Math.min(l + 28, 92)],           // much lighter
			[h, s, Math.max(l - 15, 15)],           // darker
			[h, s, Math.max(l - 28, 10)],           // much darker
			[h, Math.max(s - 20, 10), l],            // desaturated
			[(h + 10) % 360, s, l],                  // slight hue shift +
		];
		return variations.map(([vh, vs, vl]) => hslToHex(vh, vs, vl));
	}

	let activePalette = $derived(parentColor ? generateMatchingPalette(parentColor) : presetColors);

	let defaultColor = $derived(parentColor ?? '#6366f1');
	// svelte-ignore state_referenced_locally — intentional initial-value capture; component remounts each time modal opens
	let name = $state(category?.name ?? '');
	// svelte-ignore state_referenced_locally
	let color = $state(category?.color ?? defaultColor);

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name.trim()) return;
		onsubmit?.({ name: name.trim(), color });
	}
</script>

<form class="category-form" onsubmit={handleSubmit}>
	<div class="form-group">
		<label class="form-label" for="cat-name">Name</label>
		<input id="cat-name" class="input" type="text" bind:value={name} placeholder="Category name..." required />
	</div>

	<div class="form-group">
		<label class="form-label" for="cat-color">Color</label>
		<div class="color-picker">
			{#each activePalette as c}
				<button
					type="button"
					class="color-swatch"
					class:selected={color === c}
					style:background-color={c}
					onclick={() => color = c}
					aria-label="Select color {c}"
				></button>
			{/each}
			<input id="cat-color" type="color" class="color-custom" bind:value={color} aria-label="Custom color" />
		</div>
	</div>

	<div class="form-actions">
		<button type="button" class="btn" onclick={oncancel}>Cancel</button>
		<button type="submit" class="btn btn-primary" disabled={!name.trim()}>
			{category ? 'Update' : 'Create'}
		</button>
	</div>
</form>

<style>
	.category-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.form-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.color-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}

	.color-swatch {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid transparent;
		transition: transform var(--transition), border-color var(--transition);
	}

	.color-swatch:hover {
		transform: scale(1.15);
	}

	.color-swatch.selected {
		border-color: var(--text-primary);
		transform: scale(1.15);
	}

	.color-custom {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px dashed var(--border);
		padding: 0;
		cursor: pointer;
		overflow: hidden;
	}

	.color-custom::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	.color-custom::-webkit-color-swatch {
		border: none;
		border-radius: 50%;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding-top: 8px;
	}
</style>
