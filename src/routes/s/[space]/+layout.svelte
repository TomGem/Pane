<script lang="ts">
	import Toolbar from '$lib/components/Toolbar.svelte';
	import { setContext, getContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { Tag, Space } from '$lib/types';
	import type { ThemeStore } from '$lib/stores/theme.svelte';

	let { data, children }: { data: { spaceSlug: string; spaceName: string; spaces: Space[] }; children: Snippet } = $props();

	const theme = getContext<ThemeStore>('theme');
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

	// Reset layout state when switching spaces
	$effect(() => {
		data.spaceSlug;
		searchQuery = '';
		tags = [];
		selectedTagIds = [];
	});

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

<Toolbar
	bind:searchQuery
	{tags}
	{selectedTagIds}
	themeMode={theme.mode}
	spaceName={data.spaceName}
	spaces={data.spaces}
	spaceSlug={data.spaceSlug}
	onsearch={handleSearch}
	ontagtoggle={handleTagToggle}
	oncleartags={handleClearTags}
	onadd={handleAdd}
	onaddcategory={handleAddCategory}
	onthemechange={(mode: string) => theme.setMode(mode as 'light' | 'dark' | 'system')}
/>
<main class="app-content">
	{#key data.spaceSlug}
		{@render children()}
	{/key}
</main>

<style>
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
