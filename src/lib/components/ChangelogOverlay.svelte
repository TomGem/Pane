<script lang="ts">
	import Icon from './Icon.svelte';
	import type { ChangelogEntry } from '$lib/types';
	import { api } from '$lib/utils/api';
	import { getContext } from 'svelte';

	interface Props {
		spaceSlug: string;
		ownerId?: string;
		singleUser?: boolean;
		onclose: () => void;
	}

	let { spaceSlug, ownerId, singleUser = false, onclose }: Props = $props();

	const app = getContext<{ setSearchQuery: (query: string) => void }>('app');

	let entries = $state<ChangelogEntry[]>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let hasMore = $state(true);
	const PAGE_SIZE = 50;

	function buildUrl(offset: number): string {
		let url = `/api/changelog?space=${encodeURIComponent(spaceSlug)}&limit=${PAGE_SIZE}&offset=${offset}`;
		if (ownerId) url += `&owner=${encodeURIComponent(ownerId)}`;
		return url;
	}

	async function loadEntries() {
		loading = true;
		try {
			entries = await api<ChangelogEntry[]>(buildUrl(0));
			hasMore = entries.length === PAGE_SIZE;
		} catch (err) {
			console.error('Failed to load changelog:', err);
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		try {
			const more = await api<ChangelogEntry[]>(buildUrl(entries.length));
			entries = [...entries, ...more];
			hasMore = more.length === PAGE_SIZE;
		} catch (err) {
			console.error('Failed to load more:', err);
		} finally {
			loadingMore = false;
		}
	}

	loadEntries();

	function actionLabel(action: string): string {
		switch (action) {
			case 'item:created': return 'added item';
			case 'item:updated': return 'updated item';
			case 'item:deleted': return 'deleted item';
			case 'category:created': return 'added category';
			case 'category:updated': return 'updated category';
			case 'category:deleted': return 'deleted category';
			case 'category:moved': return 'moved category';
			case 'tag:created': return 'added tag';
			case 'tag:updated': return 'updated tag';
			case 'tag:deleted': return 'deleted tag';
			case 'space:seeded': return 'seeded space';
			case 'space:imported': return 'imported space';
			default: return action;
		}
	}

	function actionIcon(action: string): string {
		if (action.startsWith('item:')) return 'file-text';
		if (action.startsWith('category:')) return 'folder';
		if (action.startsWith('tag:')) return 'tag';
		return 'grid';
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr + 'Z');
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		const diffHr = Math.floor(diffMs / 3600000);
		const diffDay = Math.floor(diffMs / 86400000);

		if (diffMin < 1) return 'just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		if (diffHr < 24) return `${diffHr}h ago`;
		if (diffDay < 7) return `${diffDay}d ago`;
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function isNavigable(entry: ChangelogEntry): boolean {
		return !!entry.entity_title && !entry.action.endsWith(':deleted');
	}

	function handleEntryClick(entry: ChangelogEntry) {
		if (!isNavigable(entry)) return;
		app.setSearchQuery(entry.entity_title!);
		onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus a11y_no_noninteractive_tabindex -->
<div class="changelog-backdrop" onclick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Changelog" tabindex="-1">
	<div class="changelog-panel glass-strong">
		<div class="changelog-header">
			<h2 class="changelog-title">Changelog</h2>
			<button class="changelog-close" onclick={onclose} aria-label="Close">
				<Icon name="close" size={18} />
			</button>
		</div>

		<div class="changelog-body">
			{#if loading}
				<div class="changelog-empty">Loading...</div>
			{:else if entries.length === 0}
				<div class="changelog-empty">No changes recorded yet.</div>
			{:else}
				<div class="changelog-list">
					{#each entries as entry (entry.id)}
						<div class="changelog-entry">
							<div class="changelog-entry-icon">
								<Icon name={actionIcon(entry.action)} size={14} />
							</div>
							<div class="changelog-entry-content">
								<div class="changelog-entry-line">
									{#if !singleUser && entry.user_name}
										<span class="changelog-user">{entry.user_name}</span>
									{/if}
									<span class="changelog-action">{actionLabel(entry.action)}</span>
									{#if entry.entity_title}
										{#if isNavigable(entry)}
											<button class="changelog-entity-link" title="Find on board: {entry.entity_title}" onclick={() => handleEntryClick(entry)}>{entry.entity_title}</button>
										{:else}
											<span class="changelog-entity">{entry.entity_title}</span>
										{/if}
									{/if}
								</div>
								<div class="changelog-time">{formatTime(entry.created_at)}</div>
							</div>
						</div>
					{/each}
				</div>
				{#if hasMore}
					<button class="changelog-load-more" onclick={loadMore} disabled={loadingMore}>
						{loadingMore ? 'Loading...' : 'Load more'}
					</button>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.changelog-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 60px;
		background: rgba(0, 0, 0, 0.3);
	}

	.changelog-panel {
		width: 100%;
		max-width: 480px;
		max-height: calc(100vh - 120px);
		display: flex;
		flex-direction: column;
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
	}

	.changelog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.changelog-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.changelog-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.changelog-close:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.changelog-body {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
	}

	.changelog-empty {
		padding: 40px 20px;
		text-align: center;
		color: var(--text-muted);
		font-size: 13px;
	}

	.changelog-list {
		display: flex;
		flex-direction: column;
	}

	.changelog-entry {
		display: flex;
		gap: 10px;
		padding: 8px 20px;
		transition: background-color var(--transition);
	}

	.changelog-entry:hover {
		background: var(--accent-soft);
	}

	.changelog-entry-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		background: var(--bg-secondary);
		color: var(--text-muted);
		margin-top: 1px;
	}

	.changelog-entry-content {
		flex: 1;
		min-width: 0;
	}

	.changelog-entry-line {
		font-size: 13px;
		color: var(--text-primary);
		line-height: 1.5;
	}

	.changelog-user {
		font-weight: 600;
		margin-right: 3px;
	}

	.changelog-action {
		color: var(--text-muted);
	}

	.changelog-entity,
	.changelog-entity-link {
		font-weight: 500;
		margin-left: 3px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 200px;
		display: inline-block;
		vertical-align: bottom;
	}

	.changelog-entity-link {
		color: var(--accent);
		cursor: pointer;
		text-decoration: none;
		border-radius: 2px;
		transition: color var(--transition);
	}

	.changelog-entity-link:hover {
		text-decoration: underline;
	}

	.changelog-time {
		font-size: 11px;
		color: var(--text-muted);
		margin-top: 1px;
	}

	.changelog-load-more {
		display: block;
		width: calc(100% - 40px);
		margin: 8px 20px;
		padding: 8px;
		border-radius: var(--radius-sm);
		font-size: 12px;
		color: var(--accent);
		background: var(--accent-soft);
		text-align: center;
		cursor: pointer;
		transition: background-color var(--transition);
	}

	.changelog-load-more:hover {
		background: var(--accent);
		color: white;
	}

	.changelog-load-more:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
