<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import { api } from '$lib/utils/api';
	import Card from './Card.svelte';
	import type { Category, Item, ReorderMove } from '$lib/types';

	interface Props {
		category: Category;
		spaceSlug?: string;
		ondrilldown: (id: number) => void;
		onitemedit?: (item: Item) => void;
		onitemdelete?: (item: Item) => void;
	}

	let { category, spaceSlug = 'pane', ondrilldown, onitemedit, onitemdelete }: Props = $props();

	let expanded = $state(false);
	let items = $state<Item[]>([]);
	let loaded = $state(false);

	async function toggle() {
		expanded = !expanded;
		if (expanded && !loaded) {
			items = await api<Item[]>(`/api/items?category_id=${category.id}&space=${spaceSlug}`);
			loaded = true;
		}
	}

	function handleDndConsider(e: CustomEvent<{ items: Item[] }>) {
		items = e.detail.items;
	}

	async function handleDndFinalize(e: CustomEvent<{ items: Item[] }>) {
		items = e.detail.items;
		const moves: ReorderMove[] = items.map((item, i) => ({
			id: item.id,
			category_id: category.id,
			sort_order: i
		}));
		if (moves.length > 0) {
			await api(`/api/items/reorder?space=${spaceSlug}`, {
				method: 'PUT',
				body: JSON.stringify({ moves })
			});
			items = await api<Item[]>(`/api/items?category_id=${category.id}&space=${spaceSlug}`);
		}
	}
</script>

<div class="subcategory-wrapper">
	<div class="subcategory-card">
		<button class="expand-btn" onclick={toggle} aria-label={expanded ? 'Collapse' : 'Expand'} title={expanded ? 'Collapse' : 'Expand'}>
			<svg class="collapse-chevron" class:expanded width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</button>
		<button class="name-area" onclick={() => ondrilldown(category.id)} title="View subcategory">
			<span class="accent-bar" style:background-color={category.color}></span>
			<svg class="folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
			</svg>
			<span class="subcategory-name">{category.name}</span>
			<svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="9 18 15 12 9 6" />
			</svg>
		</button>
	</div>

	{#if expanded}
		<div
			class="expanded-items"
			use:dndzone={{ items, flipDurationMs: 200, dropTargetStyle: {} }}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
		>
			{#each items as item (item.id)}
				<Card {item} {spaceSlug} onedit={onitemedit} ondelete={onitemdelete} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.subcategory-wrapper {
		display: flex;
		flex-direction: column;
	}

	.subcategory-card {
		display: flex;
		align-items: center;
		width: 100%;
		border-radius: var(--radius);
		background: var(--bg-glass);
		border: 1px solid var(--border);
		overflow: hidden;
		transition: background-color var(--transition), box-shadow var(--transition);
	}

	.subcategory-card:hover {
		background: var(--accent-soft);
		box-shadow: var(--shadow);
	}

	.expand-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 28px;
		align-self: stretch;
		cursor: pointer;
		transition: background-color var(--transition);
	}

	.expand-btn:hover {
		background: var(--accent-soft);
	}

	.collapse-chevron {
		color: var(--text-muted);
		transition: transform 0.2s ease;
		transform: rotate(-90deg);
	}

	.collapse-chevron.expanded {
		transform: rotate(0deg);
	}

	.expand-btn:hover .collapse-chevron {
		color: var(--accent);
	}

	.name-area {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		padding: 8px 10px;
		cursor: pointer;
		text-align: left;
		overflow: hidden;
		border-left: 1px solid var(--border);
		transition: background-color var(--transition);
	}

	.name-area:hover {
		background: var(--accent-soft);
	}

	.accent-bar {
		flex-shrink: 0;
		width: 3px;
		height: 20px;
		border-radius: 2px;
	}

	.folder-icon {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.name-area:hover .folder-icon {
		color: var(--accent);
	}

	.subcategory-name {
		flex: 1;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nav-chevron {
		flex-shrink: 0;
		color: var(--text-muted);
		opacity: 0.5;
	}

	.name-area:hover .nav-chevron {
		opacity: 1;
		color: var(--accent);
	}

	.expanded-items {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 6px 0 0 16px;
		min-height: 40px;
	}
</style>
