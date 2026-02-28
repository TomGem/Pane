<script lang="ts">
	import type { Item } from '$lib/types';
	import MediaOverlay from './MediaOverlay.svelte';
	import NoteOverlay from './NoteOverlay.svelte';
	import { getContext } from 'svelte';

	interface Props {
		item: Item;
		spaceSlug?: string;
		onedit?: (item: Item) => void;
		ondelete?: (item: Item) => void;
	}

	let { item, spaceSlug = 'pane', onedit, ondelete }: Props = $props();

	const app = getContext<{ toggleTag: (tagId: number) => void }>('app');

	let showMediaOverlay = $state(false);
	let showNoteOverlay = $state(false);

	const typeIcons: Record<string, string> = {
		link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
		note: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
		document: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'
	};

	function formatFileSize(bytes: number | null): string {
		if (!bytes) return '';
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function getItemUrl(): string | null {
		if (item.type === 'link' && item.content) return item.content;
		if (item.type === 'document' && item.file_path) return `/api/files/${item.file_path}?space=${spaceSlug}`;
		return null;
	}

	function isDisplayableMedia(): boolean {
		if (item.type !== 'document' || !item.mime_type) return false;
		return /^(image|video|audio)\//.test(item.mime_type);
	}

	function isClickable(): boolean {
		return !!getItemUrl() || (item.type === 'note' && !!item.content);
	}

	function handleCardClick(e: MouseEvent) {
		// Don't open if clicking on action buttons or tags
		if ((e.target as HTMLElement).closest('.card-actions')) return;
		if ((e.target as HTMLElement).closest('.card-tags')) return;
		openCard();
	}

	function handleCardKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openCard();
		}
	}

	function openCard() {
		if (item.type === 'note' && item.content) {
			showNoteOverlay = true;
			return;
		}
		const url = getItemUrl();
		if (!url) return;
		if (isDisplayableMedia()) {
			showMediaOverlay = true;
		} else {
			window.open(url, '_blank', 'noopener,noreferrer');
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="card glass" class:pinned={item.is_pinned} class:clickable={isClickable()} onclick={handleCardClick} onkeydown={handleCardKeydown} role={isClickable() ? 'button' : undefined} tabindex={isClickable() ? 0 : undefined}>
	<div class="card-header">
		<div class="card-type">
			{#if item.type === 'link'}
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
					<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
				</svg>
			{:else if item.type === 'note'}
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<polyline points="14 2 14 8 20 8" />
					<line x1="16" y1="13" x2="8" y2="13" />
					<line x1="16" y1="17" x2="8" y2="17" />
				</svg>
			{:else}
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
					<polyline points="13 2 13 9 20 9" />
				</svg>
			{/if}
			<span class="type-label">{item.type}</span>
		</div>
		<div class="card-actions">
			<button class="btn-icon" onclick={() => onedit?.(item)} aria-label="Edit" title="Edit item">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
				</svg>
			</button>
			<button class="btn-icon btn-icon-danger" onclick={() => ondelete?.(item)} aria-label="Delete" title="Delete item">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="3 6 5 6 21 6" />
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
				</svg>
			</button>
		</div>
	</div>

	<h3 class="card-title">{item.title}</h3>

	{#if item.type === 'link' && item.content}
		<p class="card-url">{item.content}</p>
	{/if}

	{#if item.description}
		<p class="card-desc">{item.description}</p>
	{/if}

	{#if item.type === 'note' && item.content}
		<p class="card-note">{item.content}</p>
	{/if}

	{#if item.type === 'document' && item.file_name}
		<div class="card-file">
			<span class="file-name">{item.file_name}</span>
			{#if item.file_size}
				<span class="file-size">{formatFileSize(item.file_size)}</span>
			{/if}
		</div>
	{/if}

	{#if item.tags && item.tags.length > 0}
		<div class="card-tags">
			{#each item.tags as tag}
				<button class="badge" style:background-color="{tag.color}20" style:color={tag.color} title="Filter by {tag.name}" onclick={() => app.toggleTag(tag.id)}>{tag.name}</button>
			{/each}
		</div>
	{/if}

	{#if item.is_pinned}
		<div class="pin-indicator">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
				<path d="M12 2l2.09 6.26L20.18 9l-5.09 3.74L17.18 19 12 15.27 6.82 19l2.09-6.26L3.82 9l6.09-.74z" />
			</svg>
		</div>
	{/if}
</div>

{#if showMediaOverlay}
	<MediaOverlay
		url={`/api/files/${item.file_path}?space=${spaceSlug}`}
		fileName={item.file_name ?? ''}
		mimeType={item.mime_type ?? ''}
		onclose={() => showMediaOverlay = false}
	/>
{/if}

{#if showNoteOverlay}
	<NoteOverlay
		title={item.title}
		content={item.content ?? ''}
		onclose={() => showNoteOverlay = false}
	/>
{/if}

<style>
	.card {
		position: relative;
		padding: 12px;
		border-radius: var(--radius);
		cursor: grab;
		transition: box-shadow var(--transition), transform var(--transition);
	}

	.card:hover {
		box-shadow: var(--shadow-lg);
		transform: translateY(-1px);
	}

	.card:active {
		cursor: grabbing;
	}

	.card.clickable {
		cursor: pointer;
	}

	.card.pinned {
		border-left: 3px solid var(--accent);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}

	.card-type {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--text-muted);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.card-type svg {
		display: inline;
	}

	.type-label {
		font-weight: 600;
	}

	.card-actions {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.card:hover .card-actions {
		opacity: 1;
	}

	.btn-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.btn-icon:hover {
		background-color: var(--accent-soft);
		color: var(--accent);
	}

	.btn-icon-danger:hover {
		background-color: rgba(239, 68, 68, 0.1);
		color: var(--danger);
	}

	.card-title {
		font-size: 14px;
		font-weight: 600;
		line-height: 1.4;
		color: var(--text-primary);
		margin-bottom: 4px;
	}

	.card-url {
		font-size: 11px;
		color: var(--accent);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-bottom: 4px;
		opacity: 0.8;
	}

	.card-desc {
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
		margin-bottom: 6px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-note {
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
		background: var(--bg-secondary);
		border-radius: var(--radius-sm);
		padding: 6px 0;
		margin-bottom: 6px;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		white-space: pre-wrap;
	}

	.card-file {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 6px;
	}

	.file-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-size {
		flex-shrink: 0;
		font-size: 11px;
	}

	.card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 6px;
	}

	.pin-indicator {
		position: absolute;
		top: 6px;
		right: 6px;
		color: var(--accent);
	}
</style>
