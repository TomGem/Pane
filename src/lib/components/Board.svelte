<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import Column from './Column.svelte';
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
		ondrilldown?: (categoryId: number) => void;
	}

	let { board, spaceSlug = 'pane', searchQuery = '', selectedTagIds = [], onitemedit, onitemdelete, onadditem, oneditcategory, ondeletecategory, onaddsubcategory, ondrilldown }: Props = $props();

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
		await board.uploadFile(file, categoryId);
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

<div
	class="board"
	use:dndzone={{
		items: board.columns,
		flipDurationMs: 200,
		type: 'columns',
		dropTargetStyle: {},
		dragDisabled: false
	}}
	onconsider={handleColumnConsider}
	onfinalize={handleColumnFinalize}
>
	{#each board.columns as column (column.id)}
		{@const visible = columnHasMatch(column, searchQuery, selectedTagIds)}
		<div class:search-hidden={!visible}>
			<Column
				category={column}
				{spaceSlug}
				{searchQuery}
				{selectedTagIds}
				onitemsupdate={handleItemsUpdate}
				onitemedit={onitemedit}
				onitemdelete={onitemdelete}
				onadditem={onadditem}
				oneditcategory={oneditcategory}
				ondeletecategory={ondeletecategory}
				onaddsubcategory={onaddsubcategory}
				ondropurl={handleDropUrl}
				ondropfile={handleDropFile}
				{ondrilldown}
			/>
		</div>
	{/each}
</div>

<style>
	.board {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		padding: 4px;
		min-height: 200px;
		align-items: flex-start;
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
