<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import Card from './Card.svelte';
	import SubcategoryCard from './SubcategoryCard.svelte';
	import type { CategoryWithItems, Item } from '$lib/types';

	interface Props {
		category: CategoryWithItems;
		spaceSlug?: string;
		searchQuery?: string;
		selectedTagIds?: number[];
		onitemsupdate?: (categoryId: number, items: Item[]) => void;
		onitemedit?: (item: Item) => void;
		onitemdelete?: (item: Item) => void;
		onadditem?: (categoryId: number) => void;
		oneditcategory?: (category: CategoryWithItems) => void;
		ondeletecategory?: (category: CategoryWithItems) => void;
		onaddsubcategory?: (category: CategoryWithItems) => void;
		ondropurl?: (url: string, categoryId: number) => void;
		ondropfile?: (file: File, categoryId: number) => void;
		ondrilldown?: (categoryId: number) => void;
	}

	let {
		category,
		spaceSlug = 'desk',
		searchQuery = '',
		selectedTagIds = [],
		onitemsupdate,
		onitemedit,
		onitemdelete,
		onadditem,
		oneditcategory,
		ondeletecategory,
		onaddsubcategory,
		ondropurl,
		ondropfile,
		ondrilldown
	}: Props = $props();

	let items = $derived(category.items);
	let filteredItems = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		const hasQuery = q.length > 0;
		const hasTags = selectedTagIds.length > 0;
		if (!hasQuery && !hasTags) return items;
		return items.filter((item) => {
			const matchesSearch = !hasQuery || (
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
	let collapsed = $state(false);
	let showMenu = $state(false);
	let dragOver = $state(false);

	function menuKeyboard(node: HTMLElement) {
		const first = node.querySelector('[role="menuitem"]') as HTMLElement;
		first?.focus();

		function handleKeydown(e: KeyboardEvent) {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				const items = node.querySelectorAll<HTMLElement>('[role="menuitem"]');
				const current = [...items].indexOf(document.activeElement as HTMLElement);
				const next = e.key === 'ArrowDown'
					? (current + 1) % items.length
					: (current - 1 + items.length) % items.length;
				items[next]?.focus();
			}
		}

		node.addEventListener('keydown', handleKeydown);
		return { destroy() { node.removeEventListener('keydown', handleKeydown); } };
	}

	function handleDndConsider(e: CustomEvent<{ items: Item[] }>) {
		category.items = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<{ items: Item[] }>) {
		category.items = e.detail.items;
		onitemsupdate?.(category.id, e.detail.items);
	}

	function handleDragEnter(e: DragEvent) {
		if (e.dataTransfer?.types.includes('text/uri-list') || e.dataTransfer?.types.includes('Files')) {
			e.preventDefault();
			dragOver = true;
		}
	}

	function handleDragOver(e: DragEvent) {
		if (e.dataTransfer?.types.includes('text/uri-list') || e.dataTransfer?.types.includes('Files')) {
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDragLeave(e: DragEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
			dragOver = false;
		}
	}

	function handleDrop(e: DragEvent) {
		dragOver = false;
		if (!e.dataTransfer) return;

		// Check for URL drops
		const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
		if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
			e.preventDefault();
			ondropurl?.(url, category.id);
			return;
		}

		// Check for file drops
		if (e.dataTransfer.files.length > 0) {
			e.preventDefault();
			for (const file of e.dataTransfer.files) {
				ondropfile?.(file, category.id);
			}
		}
	}
</script>

<div
	class="column"
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	class:drag-over={dragOver}
	role="region"
	aria-label="{category.name} column"
>
	<div class="column-header" style:border-top-color={category.color}>
		{#if ondrilldown}
			<button class="column-title column-title-clickable" onclick={() => ondrilldown(category.id)}>
				{category.name}
				{#if category.children_count > 0}
					<svg class="chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="9 18 15 12 9 6" />
					</svg>
				{/if}
			</button>
		{:else}
			<h2 class="column-title">{category.name}</h2>
		{/if}
		<div class="column-count">{filteredItems.length}</div>
		<div class="column-actions">
			<button class="btn-icon btn-collapse" onclick={() => collapsed = !collapsed} aria-label={collapsed ? 'Expand column' : 'Collapse column'} title={collapsed ? 'Expand column' : 'Collapse column'}>
				<svg class="collapse-chevron" class:collapsed width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</button>
			<button class="btn-icon" onclick={() => onadditem?.(category.id)} aria-label="Add item" title="Add item">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</button>
			<div class="menu-wrapper">
				<button class="btn-icon" onclick={() => showMenu = !showMenu} aria-label="Column menu" title="Column menu">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="1" />
						<circle cx="12" cy="5" r="1" />
						<circle cx="12" cy="19" r="1" />
					</svg>
				</button>
				{#if showMenu}
					<div class="menu glass" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') showMenu = false; }} role="menu" tabindex="-1" use:menuKeyboard>
						<button class="menu-item" role="menuitem" onclick={() => { showMenu = false; oneditcategory?.(category); }}>Edit category</button>
						<button class="menu-item" role="menuitem" onclick={() => { showMenu = false; onaddsubcategory?.(category); }}>Add subcategory</button>
						<button class="menu-item menu-item-danger" role="menuitem" onclick={() => { showMenu = false; ondeletecategory?.(category); }}>Delete category</button>
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#if !collapsed}
		{#if category.children && category.children.length > 0}
			<div class="subcategory-list">
				{#each category.children as child (child.id)}
					<SubcategoryCard category={child} {spaceSlug} ondrilldown={ondrilldown ?? (() => {})} {onitemedit} {onitemdelete} />
				{/each}
			</div>
		{/if}

		<div
			class="column-items"
			use:dndzone={{ items: category.items, flipDurationMs: 200, dropTargetStyle: {} }}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
		>
			{#each category.items as item (item.id)}
				{@const visible = filteredItems.some((fi) => fi.id === item.id)}
				<div class:search-hidden={!visible}>
					<Card
						{item}
						{spaceSlug}
						onedit={onitemedit}
						ondelete={onitemdelete}
					/>
				</div>
			{/each}
		</div>

		{#if filteredItems.length === 0}
			<div class="empty-state">
				<p>No items yet</p>
				<p class="empty-hint">Drop files or URLs here, or click + to add</p>
			</div>
		{/if}

		{#if dragOver}
			<div class="drop-overlay">
				<div class="drop-label">Drop here</div>
			</div>
		{/if}
	{/if}
</div>

{#if showMenu}
	<div class="menu-backdrop" onclick={() => showMenu = false} aria-hidden="true"></div>
{/if}

<style>
	.column {
		position: relative;
		flex: 0 0 320px;
		max-width: 320px;
		display: flex;
		flex-direction: column;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		max-height: calc(100vh - 100px);
	}

	@media (max-width: 767px) {
		.column {
			flex: 1 1 100%;
			max-width: 100%;
			max-height: none;
		}
	}

	.column.drag-over {
		outline: 2px dashed var(--accent);
		outline-offset: -2px;
	}

	.column-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 14px 10px;
		border-top: 3px solid transparent;
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
	}

	.column-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--text-primary);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.column-title-clickable {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 4px;
		margin: -2px -4px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background-color var(--transition), color var(--transition);
		text-align: left;
	}

	.column-title-clickable:hover {
		background-color: var(--accent-soft);
		color: var(--accent);
	}

	.chevron-icon {
		flex-shrink: 0;
		opacity: 0.5;
	}

	.column-title-clickable:hover .chevron-icon {
		opacity: 1;
	}

	.column-count {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		background: var(--bg-primary);
		padding: 0 6px;
		border-radius: 9999px;
		min-width: 20px;
		text-align: center;
	}

	.column-actions {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}

	.btn-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.btn-icon:hover {
		background-color: var(--accent-soft);
		color: var(--accent);
	}

	.collapse-chevron {
		transition: transform 0.2s ease;
	}

	.collapse-chevron.collapsed {
		transform: rotate(-90deg);
	}

	.subcategory-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 0 10px 8px;
	}

	.column-items {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0 10px 10px;
		overflow-y: auto;
		min-height: 60px;
	}

	.empty-state {
		text-align: center;
		padding: 20px 14px;
		color: var(--text-muted);
		font-size: 13px;
	}

	.empty-hint {
		font-size: 11px;
		margin-top: 4px;
		opacity: 0.7;
	}

	.drop-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(99, 102, 241, 0.08);
		border-radius: var(--radius-lg);
		pointer-events: none;
		z-index: 5;
	}

	.drop-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--accent);
		background: var(--bg-glass-strong);
		padding: 8px 16px;
		border-radius: var(--radius);
	}

	.menu-wrapper {
		position: relative;
	}

	.menu {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 50;
		min-width: 160px;
		padding: 4px;
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
	}

	.menu-item {
		display: block;
		width: 100%;
		padding: 8px 12px;
		text-align: left;
		font-size: 13px;
		color: var(--text-primary);
		border-radius: var(--radius-sm);
		transition: background-color var(--transition);
	}

	.menu-item:hover {
		background-color: var(--accent-soft);
	}

	.menu-item-danger {
		color: var(--danger);
	}

	.menu-item-danger:hover {
		background-color: rgba(239, 68, 68, 0.1);
	}

	.menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
	}

	.search-hidden {
		display: none;
	}
</style>
