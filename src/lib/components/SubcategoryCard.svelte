<script lang="ts">
	import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
	import Card from './Card.svelte';
	import SubcategoryCard from './SubcategoryCard.svelte';
	import type { Category, Item } from '$lib/types';

	let isTouchDevice = $state(false);
	$effect(() => {
		isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
	});

	interface Props {
		category: Category;
		allItems?: Item[];
		allCategories?: Category[];
		matchingSubcategoryIds?: Set<number>;
		spaceSlug?: string;
		searchQuery?: string;
		selectedTagIds?: number[];
		searchMatch?: boolean;
		ondrilldown: (id: number) => void;
		onitemsupdate?: (categoryId: number, items: Item[]) => void;
		onitemedit?: (item: Item) => void;
		onitemrefresh?: (item: Item) => void;
		onitemdelete?: (item: Item) => void;
		onnotesave?: (item: Item, content: string) => void;
	}

	let { category, allItems = [], allCategories = [], matchingSubcategoryIds = new Set(), spaceSlug = 'desk', searchQuery = '', selectedTagIds = [], searchMatch = false, ondrilldown, onitemsupdate, onitemedit, onitemrefresh, onitemdelete, onnotesave }: Props = $props();

	let childCategories = $derived(allCategories.filter((c) => c.parent_id === category.id).sort((a, b) => a.sort_order - b.sort_order));

	let userExpanded = $state(false);
	let expanded = $derived(userExpanded || searchMatch);
	let items = $derived(allItems.filter((i) => i.category_id === category.id).sort((a, b) => a.sort_order - b.sort_order));
	let dndItems = $state<Item[]>([]);
	let dragging = $state(false);

	// Sync dndItems from derived items when not actively dragging
	$effect(() => {
		if (!dragging) {
			dndItems = items;
		}
	});

	let displayItems = $derived(dragging ? dndItems : items);

	let nameMatchesSearch = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		return q.length > 0 && category.name.toLowerCase().includes(q);
	});

	let filteredItems = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		const hasQuery = q.length > 0;
		const hasTags = selectedTagIds.length > 0;
		if (!hasQuery && !hasTags) return displayItems;
		// If the subcategory name itself matches, show all items (only filter by tags)
		if (nameMatchesSearch && !hasTags) return displayItems;
		return displayItems.filter((item) => {
			const matchesSearch = !hasQuery || nameMatchesSearch || (
				item.title.toLowerCase().includes(q) ||
				item.description?.toLowerCase().includes(q) ||
				item.content?.toLowerCase().includes(q) ||
				item.file_name?.toLowerCase().includes(q) ||
				item.tags?.some((tag) => tag.name.toLowerCase().includes(q))
			);
			const matchesTags = !hasTags || item.tags?.some((tag) => selectedTagIds.includes(tag.id));
			return matchesSearch && matchesTags;
		});
	});

	let isDraggedOver = $derived(
		!expanded && dndItems.some((i) => (i as any)[SHADOW_ITEM_MARKER_PROPERTY_NAME])
	);

	function toggle() {
		userExpanded = !userExpanded;
	}

	function handleDndConsider(e: CustomEvent<{ items: Item[] }>) {
		dragging = true;
		dndItems = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<{ items: Item[] }>) {
		dndItems = e.detail.items;
		dragging = false;
		onitemsupdate?.(category.id, e.detail.items);
	}
</script>

<div class="subcategory-wrapper">
	<div class="subcategory-card" class:drop-highlight={isDraggedOver}>
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

	{#if expanded && childCategories.length > 0}
		<div class="child-subcategories">
			{#each childCategories as child (child.id)}
				<SubcategoryCard category={child} {allItems} {allCategories} {matchingSubcategoryIds} {spaceSlug} {searchQuery} {selectedTagIds} searchMatch={matchingSubcategoryIds.has(child.id)} {ondrilldown} {onitemsupdate} {onitemedit} {onitemrefresh} {onitemdelete} {onnotesave} />
			{/each}
		</div>
	{/if}

	<div
		class="drop-zone"
		class:expanded
		use:dndzone={{ items: displayItems, flipDurationMs: 200, dropTargetStyle: {}, dragDisabled: isTouchDevice }}
		onconsider={handleDndConsider}
		onfinalize={handleDndFinalize}
	>
		{#each displayItems as item (item.id)}
			{@const visible = expanded && filteredItems.some((fi) => fi.id === item.id)}
			<div class:hidden-item={!expanded} class:search-hidden={expanded && !visible}>
				<Card {item} {spaceSlug} onedit={onitemedit} onrefresh={onitemrefresh} ondelete={onitemdelete} {onnotesave} />
			</div>
		{/each}
	</div>
</div>

<style>
	.subcategory-wrapper {
		display: flex;
		flex-direction: column;
		position: relative;
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

	.child-subcategories {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 6px 0 0 16px;
	}

	.drop-zone {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
	}

	.drop-zone.expanded {
		position: static;
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 6px 0 0 16px;
		min-height: 40px;
	}

	.hidden-item {
		position: absolute;
		visibility: hidden;
		pointer-events: none;
		height: 0;
		overflow: hidden;
	}

	.subcategory-card.drop-highlight {
		background: var(--accent-soft);
		box-shadow: 0 0 0 2px var(--accent);
	}

	.search-hidden {
		display: none;
	}
</style>
