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

	let { board, spaceSlug = 'desk', searchQuery = '', selectedTagIds = [], onitemedit, onitemdelete, onadditem, oneditcategory, ondeletecategory, onaddsubcategory, ondrilldown }: Props = $props();

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

	async function extractWeblocUrl(file: File): Promise<string | null> {
		// Try XML plist first
		const text = await file.text();
		try {
			const doc = new DOMParser().parseFromString(text, 'text/xml');
			const keys = doc.getElementsByTagName('key');
			for (let i = 0; i < keys.length; i++) {
				if (keys[i].textContent === 'URL') {
					const sibling = keys[i].nextElementSibling;
					if (sibling?.tagName === 'string' && sibling.textContent) {
						return sibling.textContent;
					}
				}
			}
		} catch { /* not XML */ }
		const xmlMatch = text.match(/<string>(https?:\/\/[^<]+)<\/string>/);
		if (xmlMatch) return xmlMatch[1];

		// Binary plist: scan raw bytes for an ASCII URL
		const bytes = new Uint8Array(await file.arrayBuffer());
		let ascii = '';
		for (let i = 0; i < bytes.length; i++) {
			const b = bytes[i];
			ascii += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ' ';
		}
		const binMatch = ascii.match(/https?:\/\/[^\s]+/);
		return binMatch?.[0] ?? null;
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
