<script lang="ts">
	import '../app.css';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import { createThemeStore } from '$lib/stores/theme.svelte';
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { Tag } from '$lib/types';

	let { children }: { children: Snippet } = $props();

	const theme = createThemeStore();
	let searchQuery = $state('');
	let tags = $state<Tag[]>([]);
	let selectedTagIds = $state<number[]>([]);
	let focusSearchFn = $state<(() => void) | null>(null);
	let addCallback = $state<(() => void) | null>(null);
	let addCategoryCallback = $state<(() => void) | null>(null);

	function handleSearch(query: string) {
		searchQuery = query;
	}

	function handleTagToggle(tagId: number) {
		if (selectedTagIds.includes(tagId)) {
			selectedTagIds = selectedTagIds.filter((id) => id !== tagId);
		} else {
			selectedTagIds = [...selectedTagIds, tagId];
		}
	}

	function handleClearTags() {
		selectedTagIds = [];
	}

	function handleAdd() {
		addCallback?.();
	}

	function handleAddCategory() {
		addCategoryCallback?.();
	}

	setContext('app', {
		get searchQuery() { return searchQuery; },
		setSearchQuery(query: string) { searchQuery = query; },
		get selectedTagIds() { return selectedTagIds; },
		toggleTag(tagId: number) { handleTagToggle(tagId); },
		focusSearch() { focusSearchFn?.(); },
		setFocusSearch(fn: () => void) { focusSearchFn = fn; },
		setAddCallback(fn: () => void) { addCallback = fn; },
		setAddCategoryCallback(fn: () => void) { addCategoryCallback = fn; },
		setTags(t: Tag[]) { tags = t; }
	});
</script>

<div class="app-shell">
	<Toolbar
		bind:searchQuery
		{tags}
		{selectedTagIds}
		themeMode={theme.mode}
		onsearch={handleSearch}
		ontagtoggle={handleTagToggle}
		oncleartags={handleClearTags}
		onadd={handleAdd}
		onaddcategory={handleAddCategory}
		onthemechange={(mode: string) => theme.setMode(mode as 'light' | 'dark' | 'system')}
	/>
	<main class="app-content">
		{@render children()}
	</main>
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.app-content {
		flex: 1;
		padding: 20px;
		overflow-x: auto;
	}

	@media (max-width: 767px) {
		.app-content {
			padding: 12px;
		}
	}
</style>
