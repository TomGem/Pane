<script lang="ts">
	import Toolbar from '$lib/components/Toolbar.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import { setContext, getContext, onDestroy } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { Tag, Space, StorageQuotaInfo } from '$lib/types';
	import type { ThemeStore } from '$lib/stores/theme.svelte';
	import type { PaletteStore } from '$lib/stores/palette.svelte';
	import type { FontStore } from '$lib/stores/font.svelte';
	import type { MonoFontStore } from '$lib/stores/mono-font.svelte';
	import { createChatStore } from '$lib/stores/chat.svelte';

	let { data, children }: { data: { spaceSlug: string; spaceName: string; spaces: Space[]; ownerId?: string; permission: 'owner' | 'read' | 'write'; user?: { id: string; email: string; display_name: string; role: string } | null; storage?: StorageQuotaInfo | null; singleUser?: boolean; hasShares?: boolean; legalEnabled?: boolean }; children: Snippet } = $props();

	const theme = getContext<ThemeStore>('theme');
	const palette = getContext<PaletteStore>('palette');
	const fontStore = getContext<FontStore>('font');
	const monoFontStore = getContext<MonoFontStore>('monoFont');
	let searchQuery = $state('');
	let tags = $state<Tag[]>([]);
	let selectedTagIds = $state<number[]>([]);
	let focusSearchFn = $state<(() => void) | null>(null);
	let addCallback = $state<(() => void) | null>(null);
	let addCategoryCallback = $state<(() => void) | null>(null);
	let updateTagFn = $state<((id: number, name: string, color: string) => Promise<Tag>) | null>(null);

	// Track hasShares as client state so it updates reactively when shares change
	let hasSharesLocal = $state<boolean | null>(null);

	// Reset local override when navigating to a different space
	$effect(() => {
		data.spaceSlug;
		hasSharesLocal = null;
	});

	const hasShares = $derived(hasSharesLocal ?? (data.hasShares ?? false));

	const showChat = $derived(!data.singleUser && (hasShares || !!data.ownerId));

	let chat = $state<ReturnType<typeof createChatStore> | null>(null);

	// Create/destroy chat store (with its own SSE) when showChat changes
	$effect(() => {
		if (showChat && data.user) {
			const store = createChatStore(data.spaceSlug, data.ownerId, data.user.id);
			store.connectSSE();
			chat = store;
			return () => {
				store.disconnectSSE();
			};
		} else {
			chat = null;
		}
	});

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

	async function handleTagUpdate(id: number, name: string, color: string) {
		await updateTagFn?.(id, name, color);
	}

	function handleChatToggle() {
		if (!chat) return;
		if (chat.isOpen) {
			chat.close();
		} else {
			chat.open();
		}
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
		setTags(t: Tag[]) { tags = t; },
		setUpdateTag(fn: (id: number, name: string, color: string) => Promise<Tag>) { updateTagFn = fn; }
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
	user={data.user}
	isOwner={!data.ownerId}
	singleUser={data.singleUser ?? false}
	legalEnabled={data.legalEnabled ?? false}
	ownerId={data.ownerId}
	{hasShares}
	chatUnread={chat?.unreadCount ?? 0}
	onsearch={handleSearch}
	ontagtoggle={handleTagToggle}
	oncleartags={handleClearTags}
	onadd={handleAdd}
	onaddcategory={handleAddCategory}
	ontagupdate={handleTagUpdate}
	onthemechange={(mode: string) => theme.setMode(mode as 'light' | 'dark' | 'system')}
	paletteId={palette.palette}
	onpalettechange={(id) => palette.setPalette(id)}
	fontId={fontStore.font}
	onfontchange={(id) => fontStore.setFont(id)}
	monoFontId={monoFontStore.font}
	onmonofontchange={(id) => monoFontStore.setFont(id)}
	onchat={handleChatToggle}
	onshareschange={(count) => { hasSharesLocal = count > 0; }}
/>
<div class="app-layout">
	<main class="app-content">
		{#key data.spaceSlug}
			{@render children()}
		{/key}
	</main>
	{#if chat?.isOpen}
		<ChatPanel
			{chat}
			isOwner={!data.ownerId}
			onclose={() => chat?.close()}
		/>
	{/if}
</div>

<style>
	.app-layout {
		flex: 1;
		display: flex;
		overflow: hidden;
	}

	.app-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 20px;
		overflow-x: auto;
	}

	@media (max-width: 767px) {
		.app-content {
			padding: 12px;
		}
	}
</style>
