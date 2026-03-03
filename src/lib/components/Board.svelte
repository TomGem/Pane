<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import Column from './Column.svelte';
	import { getDirectoryEntries, traverseDirectory } from '$lib/utils/folder-drop';
	import { extractWeblocUrl } from '$lib/utils/webloc';
	import type { CategoryWithItems, Item } from '$lib/types';
	import type { BoardStore } from '$lib/stores/board.svelte';

	interface Props {
		board: BoardStore;
		spaceSlug?: string;
		searchQuery?: string;
		selectedTagIds?: number[];
		onitemedit?: (item: Item) => void;
		onitemdelete?: (item: Item) => void;
		onadditem?: (categoryId: number) => void;
		oneditcategory?: (category: CategoryWithItems) => void;
		ondeletecategory?: (category: CategoryWithItems) => void;
		onaddsubcategory?: (category: CategoryWithItems) => void;
		onmovecategory?: (category: CategoryWithItems) => void;
		ondrilldown?: (categoryId: number) => void;
		onfolderimported?: (stats: { categories: number; items: number }) => void;
		onfoldererror?: (error: string) => void;
		onprogress?: (current: number, total: number, fileName: string) => void;
	}

	let { board, spaceSlug = 'desk', searchQuery = '', selectedTagIds = [], onitemedit, onitemdelete, onadditem, oneditcategory, ondeletecategory, onaddsubcategory, onmovecategory, ondrilldown, onfolderimported, onfoldererror, onprogress }: Props = $props();

	function handleColumnConsider(e: CustomEvent<{ items: CategoryWithItems[] }>) {
		board.columns = e.detail.items;
	}

	function handleColumnFinalize(e: CustomEvent<{ items: CategoryWithItems[] }>) {
		board.columns = e.detail.items;
		board.reorderCategories(e.detail.items.map((c) => c.id));
	}

	function handleItemsUpdate(categoryId: number, items: Item[]) {
		// Build moves array from current board state
		const moves = board.columns.flatMap((col) =>
			col.items.map((item, index) => ({
				id: item.id,
				category_id: col.id,
				sort_order: index + 1
			}))
		);
		board.reorderItems(moves);
	}

	async function handleDropUrl(url: string, categoryId: number) {
		await board.addLink(url, categoryId);
	}

	async function handleDropFile(file: File, categoryId: number) {
		const name = file.name.toLowerCase();

		if (name.endsWith('.webloc')) {
			const url = await extractWeblocUrl(file);
			if (url) {
				await board.addLink(url, categoryId);
				return;
			}
		}

		if (name.endsWith('.md')) {
			const content = await file.text();
			const title = file.name.replace(/\.md$/i, '');
			await board.addItem({ category_id: categoryId, type: 'note', title, content });
			return;
		}

		await board.uploadFile(file, categoryId);
	}

	async function handleDropFolder(entries: FileSystemDirectoryEntry[]) {
		for (const entry of entries) {
			try {
				const folder = await traverseDirectory(entry);
				const stats = await board.importFolder(folder, onprogress);
				onfolderimported?.(stats);
			} catch (e) {
				console.error(`Failed to import folder "${entry.name}":`, e);
				onfoldererror?.(e instanceof Error ? e.message : `Failed to import "${entry.name}"`);
			}
		}
	}

	// Board-level folder drop (for drops on the background, between columns)
	let boardDragOver = $state(false);

	function handleBoardDragEnter(e: DragEvent) {
		if (e.dataTransfer?.types.includes('Files')) {
			e.preventDefault();
			boardDragOver = true;
		}
	}

	function handleBoardDragOver(e: DragEvent) {
		if (e.dataTransfer?.types.includes('Files')) {
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleBoardDragLeave(e: DragEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
			boardDragOver = false;
		}
	}

	function handleBoardDrop(e: DragEvent) {
		boardDragOver = false;
		if (!e.dataTransfer) return;
		const dirs = getDirectoryEntries(e.dataTransfer);
		if (dirs.length > 0) {
			e.preventDefault();
			handleDropFolder(dirs);
		}
	}

	function itemMatchesSearch(item: Item, q: string): boolean {
		if (!q) return true;
		return item.title.toLowerCase().includes(q) ||
			(item.description?.toLowerCase().includes(q) ?? false) ||
			(item.content?.toLowerCase().includes(q) ?? false) ||
			(item.file_name?.toLowerCase().includes(q) ?? false) ||
			(item.tags?.some((tag) => tag.name.toLowerCase().includes(q)) ?? false);
	}

	function itemMatchesTags(item: Item, tagIds: number[]): boolean {
		if (tagIds.length === 0) return true;
		return item.tags?.some((tag) => tagIds.includes(tag.id)) ?? false;
	}

	function itemMatchesFilters(item: Item, q: string, tagIds: number[]): boolean {
		return itemMatchesSearch(item, q) && itemMatchesTags(item, tagIds);
	}

	let matchingSubcategoryIds = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		const hasTags = selectedTagIds.length > 0;
		if (!q && !hasTags) return new Set<number>();
		const ids = new Set<number>();
		for (const col of board.columns) {
			for (const child of col.children ?? []) {
				if (q && child.name.toLowerCase().includes(q)) {
					ids.add(child.id);
					continue;
				}
				if (board.allItems.some((item) => item.category_id === child.id && itemMatchesFilters(item, q, selectedTagIds))) {
					ids.add(child.id);
				}
			}
		}
		return ids;
	});

	function columnHasMatch(column: CategoryWithItems, query: string, tagIds: number[]): boolean {
		const q = query.toLowerCase().trim();
		if (!q && tagIds.length === 0) return true;
		if (column.items.some((item) => itemMatchesFilters(item, q, tagIds))) return true;
		if (q && column.children?.some((child) => child.name.toLowerCase().includes(q))) return true;

		// Check items belonging to subcategories
		const childIds = new Set(column.children?.map((c) => c.id) ?? []);
		if (childIds.size > 0) {
			return board.allItems.some((item) => childIds.has(item.category_id) && itemMatchesFilters(item, q, tagIds));
		}
		return false;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="board"
	class:board-drag-over={boardDragOver}
	use:dndzone={{
		items: board.columns,
		flipDurationMs: 200,
		type: 'columns',
		dropTargetStyle: {},
		dragDisabled: false
	}}
	onconsider={handleColumnConsider}
	onfinalize={handleColumnFinalize}
	ondragenter={handleBoardDragEnter}
	ondragover={handleBoardDragOver}
	ondragleave={handleBoardDragLeave}
	ondrop={handleBoardDrop}
>
	{#each board.columns as column (column.id)}
		{@const visible = columnHasMatch(column, searchQuery, selectedTagIds)}
		<div class:search-hidden={!visible}>
			<Column
				category={column}
				allItems={board.allItems}
				{spaceSlug}
				{searchQuery}
				{selectedTagIds}
				{matchingSubcategoryIds}
				onitemsupdate={handleItemsUpdate}
				onitemedit={onitemedit}
				onitemdelete={onitemdelete}
				onadditem={onadditem}
				oneditcategory={oneditcategory}
				ondeletecategory={ondeletecategory}
				onaddsubcategory={onaddsubcategory}
				onmovecategory={onmovecategory}
				ondropurl={handleDropUrl}
				ondropfile={handleDropFile}
				ondropfolder={handleDropFolder}
				{ondrilldown}
			/>
		</div>
	{/each}

	{#if boardDragOver}
		<div class="board-drop-overlay">
			<div class="board-drop-label">Drop folder to create category</div>
		</div>
	{/if}
</div>

<style>
	.board {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		padding: 4px;
		min-height: 200px;
		align-items: flex-start;
	}

	.board.board-drag-over {
		outline: 2px dashed var(--accent);
		outline-offset: -2px;
		border-radius: var(--radius-lg);
	}

	.board-drop-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(99, 102, 241, 0.06);
		border-radius: var(--radius-lg);
		pointer-events: none;
		z-index: 10;
	}

	.board-drop-label {
		font-size: 15px;
		font-weight: 600;
		color: var(--accent);
		background: var(--bg-glass-strong);
		padding: 10px 20px;
		border-radius: var(--radius);
	}

	.search-hidden {
		display: none;
	}

	@media (max-width: 767px) {
		.board {
			gap: 12px;
		}
	}
</style>
