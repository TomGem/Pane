<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import SettingsOverlay from './SettingsOverlay.svelte';
	import type { ThemeMode } from '$lib/stores/theme.svelte';
	import type { PaletteId } from '$lib/stores/palette.svelte';
	import type { Tag, Space } from '$lib/types';
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';

	interface Props {
		searchQuery?: string;
		tags?: Tag[];
		selectedTagIds?: number[];
		themeMode: ThemeMode;
		paletteId?: PaletteId;
		spaceName?: string;
		spaces?: Space[];
		spaceSlug?: string;
		onsearch?: (query: string) => void;
		ontagtoggle?: (tagId: number) => void;
		oncleartags?: () => void;
		onadd?: () => void;
		onaddcategory?: () => void;
		onthemechange?: (mode: ThemeMode) => void;
		onpalettechange?: (id: PaletteId) => void;
	}

	let { searchQuery = $bindable(''), tags = [], selectedTagIds = [], themeMode, paletteId = 'indigo', spaceName = 'Pane', spaces = [], spaceSlug = 'pane', onsearch, ontagtoggle, oncleartags, onadd, onaddcategory, onthemechange, onpalettechange }: Props = $props();

	let searchInputEl = $state<HTMLInputElement | null>(null);
	let showTagMenu = $state(false);
	let showHelp = $state(false);
	let showSettings = $state(false);
	let showSpaceMenu = $state(false);
	let creatingSpace = $state(false);
	let newSpaceName = $state('');
	let newSpaceInputEl = $state<HTMLInputElement | null>(null);
	let confirmDeleteSlug = $state<string | null>(null);
	let now = $state(new Date());

	$effect(() => {
		if (!showHelp) return;
		const interval = setInterval(() => { now = new Date(); }, 1000);
		return () => clearInterval(interval);
	});

	let clockText = $derived.by(() => {
		const date = now.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
		const time = now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
		return `${date} ${time}`;
	});

	function handleSearchInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchQuery = target.value;
		onsearch?.(searchQuery);
	}

	const app = getContext<{ setFocusSearch: (fn: () => void) => void }>('app');

	function focusSearch() {
		searchInputEl?.focus();
	}

	app.setFocusSearch(focusSearch);

	async function handleDeleteSpace(slug: string) {
		try {
			const res = await fetch(`/api/spaces/${slug}`, { method: 'DELETE' });
			if (!res.ok) return;
			confirmDeleteSlug = null;
			showSpaceMenu = false;
			// Navigate to another space if we deleted the current one
			if (slug === spaceSlug) {
				const remaining = spaces.filter((s) => s.slug !== slug);
				goto(`/s/${remaining[0]?.slug ?? 'pane'}`);
			} else {
				// Reload to refresh the spaces list
				location.reload();
			}
		} catch { /* ignore */ }
	}

	async function handleCreateSpace() {
		const name = newSpaceName.trim();
		if (!name) return;
		try {
			const res = await fetch('/api/spaces', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
			const data = await res.json();
			if (!res.ok) return;
			creatingSpace = false;
			newSpaceName = '';
			showSpaceMenu = false;
			goto(`/s/${data.slug}`);
		} catch { /* ignore */ }
	}

	function handleGlobalKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showSettings) {
			showSettings = false;
		}
		if (e.key === 'Escape' && showHelp) {
			showHelp = false;
		}
		if (e.key === 'Escape' && showSpaceMenu) {
			showSpaceMenu = false;
			creatingSpace = false;
			newSpaceName = '';
			confirmDeleteSlug = null;
		}
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			searchQuery = '';
			onsearch?.('');
			searchInputEl?.blur();
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<header class="toolbar glass-strong">
	<div class="toolbar-left">
		<span class="toolbar-title">Pane</span>
		<div class="space-selector-wrapper">
			<button
				class="space-switcher-btn"
				onclick={() => showSpaceMenu = !showSpaceMenu}
				title="Switch space"
				aria-label="Switch space"
			>
				<span class="space-switcher-name">{spaceName}</span>
				<svg class="space-chevron" class:open={showSpaceMenu} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</button>
			{#if showSpaceMenu}
				<div class="space-menu glass-strong">
					<div class="space-menu-header">
						<span class="space-menu-title">Spaces</span>
					</div>
					<div class="space-menu-list">
						{#each spaces as s (s.slug)}
							{#if confirmDeleteSlug === s.slug}
								<div class="space-menu-confirm">
									<span class="space-menu-confirm-text">Delete <strong>{s.name}</strong>?</span>
									<div class="space-menu-confirm-actions">
										<button class="space-menu-confirm-btn cancel" onclick={() => confirmDeleteSlug = null}>Cancel</button>
										<button class="space-menu-confirm-btn delete" onclick={() => handleDeleteSpace(s.slug)}>Delete</button>
									</div>
								</div>
							{:else}
								<div class="space-menu-row" class:current={s.slug === spaceSlug}>
									<a
										class="space-menu-item"
										href="/s/{s.slug}"
										onclick={() => showSpaceMenu = false}
									>
										<span class="space-menu-name">{s.name}</span>
										{#if s.slug === spaceSlug}
											<svg class="space-menu-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
												<polyline points="20 6 9 17 4 12" />
											</svg>
										{/if}
									</a>
									{#if spaces.length > 1}
										<button
											class="space-menu-delete"
											onclick={() => confirmDeleteSlug = s.slug}
											title="Delete space"
											aria-label="Delete {s.name}"
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<polyline points="3 6 5 6 21 6" />
												<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
											</svg>
										</button>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
					<div class="space-menu-footer">
						{#if creatingSpace}
							<form class="space-create-form" onsubmit={(e) => { e.preventDefault(); handleCreateSpace(); }}>
								<input
									bind:this={newSpaceInputEl}
									class="input space-create-input"
									type="text"
									placeholder="Space name..."
									bind:value={newSpaceName}
									onkeydown={(e) => { if (e.key === 'Escape') { creatingSpace = false; newSpaceName = ''; } }}
								/>
								<button class="btn btn-primary space-create-submit" type="submit" disabled={!newSpaceName.trim()}>
									Create
								</button>
							</form>
						{:else}
							<button class="space-menu-new" onclick={() => { creatingSpace = true; setTimeout(() => newSpaceInputEl?.focus(), 0); }}>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<line x1="12" y1="5" x2="12" y2="19" />
									<line x1="5" y1="12" x2="19" y2="12" />
								</svg>
								New Space
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<div class="toolbar-center">
		<div class="search-wrapper">
			<!-- Search icon -->
			<svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			<input
				bind:this={searchInputEl}
				class="input search-input"
				type="text"
				placeholder="Search..."
				value={searchQuery}
				oninput={handleSearchInput}
				onkeydown={handleSearchKeydown}
			/>
			{#if searchQuery}
				<button class="search-clear" onclick={() => { searchQuery = ''; onsearch?.(''); }} aria-label="Clear search" title="Clear search">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			{/if}
		</div>
		{#if tags.length > 0}
			<div class="tag-dropdown-wrapper">
				<button
					class="btn-tag-filter"
					class:has-selection={selectedTagIds.length > 0}
					title="Filter by tags"
					aria-label="Filter by tags"
					onclick={() => showTagMenu = !showTagMenu}
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
						<line x1="7" y1="7" x2="7.01" y2="7" />
					</svg>
					{#if selectedTagIds.length > 0}
						<span class="tag-count">{selectedTagIds.length}</span>
					{/if}
				</button>
				{#if showTagMenu}
					<div class="tag-menu glass-strong">
						<div class="tag-menu-header">
							<span class="tag-menu-title">Filter by tags</span>
							{#if selectedTagIds.length > 0}
								<button class="tag-menu-clear" onclick={oncleartags}>Clear</button>
							{/if}
						</div>
						<div class="tag-menu-list">
							{#each tags as tag (tag.id)}
								<button
									class="tag-menu-item"
									class:selected={selectedTagIds.includes(tag.id)}
									onclick={() => ontagtoggle?.(tag.id)}
								>
									<span class="tag-menu-dot" style:background-color={tag.color}></span>
									<span class="tag-menu-name">{tag.name}</span>
									{#if selectedTagIds.includes(tag.id)}
										<svg class="tag-menu-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="20 6 9 17 4 12" />
										</svg>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="toolbar-right">
		<button class="btn-toolbar-icon" onclick={() => onadd?.()} aria-label="Add item" title="Add item">
			<!-- file-plus -->
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
				<polyline points="14 2 14 8 20 8" />
				<line x1="12" y1="18" x2="12" y2="12" />
				<line x1="9" y1="15" x2="15" y2="15" />
			</svg>
		</button>
		<button class="btn-toolbar-icon" onclick={() => onaddcategory?.()} aria-label="Add category" title="Add category">
			<!-- folder-plus -->
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
				<line x1="12" y1="11" x2="12" y2="17" />
				<line x1="9" y1="14" x2="15" y2="14" />
			</svg>
		</button>
		<ThemeToggle mode={themeMode} onchange={onthemechange} />
		<button class="btn-toolbar-icon" onclick={() => showSettings = true} aria-label="Settings" title="Settings">
			<!-- settings/gear icon -->
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="3" />
				<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
			</svg>
		</button>
		<button class="btn-toolbar-icon" onclick={() => showHelp = true} aria-label="Help" title="Help">
			<!-- help-circle -->
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10" />
				<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
				<line x1="12" y1="17" x2="12.01" y2="17" />
			</svg>
		</button>
	</div>
</header>

{#if showTagMenu}
	<div class="tag-menu-backdrop" onclick={() => showTagMenu = false} onkeydown={(e) => { if (e.key === 'Escape') showTagMenu = false; }} role="button" tabindex="-1"></div>
{/if}

{#if showSpaceMenu}
	<div class="space-menu-backdrop" onclick={() => { showSpaceMenu = false; creatingSpace = false; newSpaceName = ''; confirmDeleteSlug = null; }} onkeydown={(e) => { if (e.key === 'Escape') { showSpaceMenu = false; creatingSpace = false; newSpaceName = ''; confirmDeleteSlug = null; } }} role="button" tabindex="-1"></div>
{/if}

{#if showSettings}
	<SettingsOverlay
		{themeMode}
		{paletteId}
		onclose={() => showSettings = false}
		onthemechange={onthemechange}
		onpalettechange={onpalettechange}
	/>
{/if}

{#if showHelp}
	<div class="help-overlay" onclick={(e) => { if (e.target === e.currentTarget) showHelp = false; }} onkeydown={(e) => { if (e.key === 'Escape') showHelp = false; }} role="button" tabindex="-1">
		<div class="help-panel glass-strong">
			<div class="help-header">
				<h2 class="help-title">Pane Help</h2>
				<button class="help-close" onclick={() => showHelp = false} aria-label="Close" title="Close">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
			<div class="help-body">
				<div class="help-clock">{clockText}</div>
				<section class="help-section">
					<h3>Getting started</h3>
					<p>Pane is a local Kanban dashboard for organizing links, notes, and documents into columns. Use <strong>Spaces</strong> to keep separate boards for different projects or topics.</p>
					<ul>
						<li>Create <strong>categories</strong> (columns) to group your items</li>
						<li>Add <strong>links</strong>, <strong>notes</strong>, or <strong>documents</strong> to any category</li>
						<li>Create <strong>subcategories</strong> to nest organization deeper</li>
					</ul>
				</section>
				<section class="help-section">
					<h3>Spaces</h3>
					<ul>
						<li>Click the <strong>space name</strong> in the toolbar to switch between spaces</li>
						<li>Each space has its own categories, items, tags, and files</li>
						<li>Create a new space from the dropdown to start a fresh board</li>
					</ul>
				</section>
				<section class="help-section">
					<h3>Drag &amp; drop</h3>
					<ul>
						<li>Drag items between columns to move them</li>
						<li>Drag items into expanded subcategories</li>
						<li>Drag columns to reorder them</li>
						<li>Drop a <strong>URL</strong> or <strong>file</strong> onto a column to add it instantly</li>
					</ul>
				</section>
				<section class="help-section">
					<h3>Tags &amp; filtering</h3>
					<ul>
						<li>Assign tags to items when creating or editing them</li>
						<li>Click a <strong>tag badge</strong> on a card to filter by that tag</li>
						<li>Use the <strong>tag dropdown</strong> next to the search box to filter by multiple tags</li>
						<li>Search and tag filters combine — both must match</li>
					</ul>
				</section>
				<section class="help-section">
					<h3>Keyboard shortcuts</h3>
					<div class="shortcut-list">
						<div class="shortcut-row">
							<span class="shortcut-keys"><kbd>/</kbd> or <kbd>Cmd</kbd><kbd>K</kbd></span>
							<span>Focus search</span>
						</div>
						<div class="shortcut-row">
							<span class="shortcut-keys"><kbd>Cmd</kbd><kbd>N</kbd></span>
							<span>New item</span>
						</div>
						<div class="shortcut-row">
							<span class="shortcut-keys"><kbd>Cmd</kbd><kbd>Shift</kbd><kbd>N</kbd></span>
							<span>New category</span>
						</div>
						<div class="shortcut-row">
							<span class="shortcut-keys"><kbd>Esc</kbd></span>
							<span>Close modal / clear search</span>
						</div>
					</div>
				</section>
				<section class="help-section">
					<h3>Other features</h3>
					<ul>
						<li>Toggle between <strong>light</strong>, <strong>dark</strong>, and <strong>system</strong> themes</li>
						<li>Click a card to open its link, preview media, or read notes</li>
						<li>All data stays on your local machine — nothing is sent to the cloud</li>
					</ul>
				</section>
			</div>
		</div>
	</div>
{/if}

<style>
	.toolbar {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 20px;
		border-bottom: 1px solid var(--border);
	}

	.toolbar-left {
		flex-shrink: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 10px;
		overflow: visible;
	}

	.toolbar-title {
		font-size: 18px;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text-primary);
		flex-shrink: 0;
	}

	.space-selector-wrapper {
		position: relative;
		min-width: 0;
	}

	.space-switcher-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 8px;
		border-radius: var(--radius);
		color: var(--text-muted);
		background: var(--bg-glass);
		border: 1px solid var(--border-glass);
		cursor: pointer;
		transition: background-color var(--transition), color var(--transition), border-color var(--transition);
		max-width: 180px;
	}

	.space-switcher-btn:hover {
		color: var(--text-primary);
		background: var(--accent-soft);
		border-color: var(--border);
	}

	.space-switcher-name {
		font-size: 13px;
		font-weight: 600;
		color: inherit;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.space-chevron {
		flex-shrink: 0;
		color: var(--text-muted);
		transition: transform 0.2s ease;
	}

	.space-chevron.open {
		transform: rotate(180deg);
	}

	.space-menu {
		position: absolute;
		top: calc(100% + 10px);
		left: 0;
		z-index: 150;
		min-width: 220px;
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
		background: var(--bg-primary);
		border: 1px solid var(--border);
	}

	.space-menu-header {
		display: flex;
		align-items: center;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
	}

	.space-menu-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.space-menu-list {
		padding: 4px;
		max-height: 240px;
		overflow-y: auto;
	}

	.space-menu-row {
		display: flex;
		align-items: center;
		border-radius: var(--radius-sm);
		transition: background-color var(--transition);
	}

	.space-menu-row:hover {
		background: var(--accent-soft);
	}

	.space-menu-row.current {
		background: var(--accent-soft);
	}

	.space-menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		padding: 7px 10px;
		cursor: pointer;
		text-decoration: none;
		color: var(--text-primary);
		font-size: 13px;
	}

	.space-menu-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.space-menu-check {
		flex-shrink: 0;
		color: var(--accent);
	}

	.space-menu-delete {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		opacity: 0;
		transition: opacity var(--transition), background-color var(--transition), color var(--transition);
	}

	.space-menu-row:hover .space-menu-delete {
		opacity: 1;
	}

	.space-menu-delete:hover {
		background: rgba(239, 68, 68, 0.1);
		color: var(--danger);
	}

	.space-menu-confirm {
		padding: 8px 10px;
		font-size: 13px;
		color: var(--text-primary);
	}

	.space-menu-confirm-text {
		display: block;
		margin-bottom: 8px;
	}

	.space-menu-confirm-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}

	.space-menu-confirm-btn {
		font-size: 12px;
		padding: 4px 12px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background-color var(--transition);
	}

	.space-menu-confirm-btn.cancel {
		color: var(--text-secondary);
		background: var(--bg-secondary);
	}

	.space-menu-confirm-btn.cancel:hover {
		background: var(--border);
	}

	.space-menu-confirm-btn.delete {
		color: white;
		background: var(--danger);
	}

	.space-menu-confirm-btn.delete:hover {
		opacity: 0.9;
	}

	.space-menu-footer {
		padding: 4px;
		border-top: 1px solid var(--border);
	}

	.space-menu-new {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 7px 10px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background-color var(--transition);
		font-size: 13px;
		color: var(--accent);
	}

	.space-menu-new:hover {
		background: var(--accent-soft);
	}

	.space-create-form {
		display: flex;
		gap: 6px;
		padding: 4px;
	}

	.space-create-input {
		flex: 1;
		font-size: 13px;
		padding: 6px 8px;
	}

	.space-create-submit {
		flex-shrink: 0;
		font-size: 12px;
		padding: 6px 12px;
	}

	.space-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99;
	}

	.toolbar-center {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.search-wrapper {
		position: relative;
		flex: 1;
	}

	.search-icon {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		pointer-events: none;
	}

	.search-input {
		padding-left: 34px;
		padding-right: 32px;
		background-color: var(--bg-glass);
		border-color: var(--border-glass);
	}

	.search-input:focus {
		background-color: var(--bg-secondary);
		border-color: var(--accent);
	}

	.search-clear {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: color var(--transition);
	}

	.search-clear:hover {
		color: var(--text-primary);
	}

	.tag-dropdown-wrapper {
		position: relative;
		flex-shrink: 0;
	}

	.btn-tag-filter {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 8px;
		border-radius: var(--radius);
		color: var(--text-muted);
		background: var(--bg-glass);
		border: 1px solid var(--border-glass);
		cursor: pointer;
		transition: background-color var(--transition), color var(--transition), border-color var(--transition);
	}

	.btn-tag-filter:hover {
		color: var(--text-primary);
		background: var(--accent-soft);
		border-color: var(--border);
	}

	.btn-tag-filter.has-selection {
		color: var(--accent);
		border-color: var(--accent);
	}

	.tag-count {
		font-size: 11px;
		font-weight: 700;
		background: var(--accent);
		color: white;
		min-width: 16px;
		height: 16px;
		line-height: 16px;
		text-align: center;
		border-radius: 9999px;
		padding: 0 4px;
	}

	.tag-menu {
		position: absolute;
		top: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 150;
		min-width: 200px;
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
	}

	.tag-menu-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
	}

	.tag-menu-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.tag-menu-clear {
		font-size: 12px;
		color: var(--accent);
		cursor: pointer;
	}

	.tag-menu-clear:hover {
		text-decoration: underline;
	}

	.tag-menu-list {
		padding: 4px;
		max-height: 240px;
		overflow-y: auto;
	}

	.tag-menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 7px 10px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background-color var(--transition);
		text-align: left;
	}

	.tag-menu-item:hover {
		background: var(--accent-soft);
	}

	.tag-menu-item.selected {
		background: var(--accent-soft);
	}

	.tag-menu-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.tag-menu-name {
		flex: 1;
		font-size: 13px;
		color: var(--text-primary);
	}

	.tag-menu-check {
		flex-shrink: 0;
		color: var(--accent);
	}

	.tag-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99;
	}

	.toolbar-right {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.btn-toolbar-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.btn-toolbar-icon:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.help-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
	}

	.help-panel {
		width: 90vw;
		max-width: 560px;
		max-height: 85vh;
		overflow-y: auto;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
	}

	.help-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.help-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.help-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.help-close:hover {
		background: var(--accent-soft);
		color: var(--text-primary);
	}

	.help-clock {
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-secondary);
		text-align: center;
		padding-bottom: 14px;
		margin-bottom: 14px;
		border-bottom: 1px solid var(--border);
	}

	.help-body {
		padding: 16px 20px 20px;
	}

	.help-section {
		margin-bottom: 16px;
	}

	.help-section:last-child {
		margin-bottom: 0;
	}

	.help-section h3 {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 6px;
	}

	.help-section p,
	.help-section li {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.help-section ul {
		padding-left: 18px;
		margin: 0;
	}

	.shortcut-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.shortcut-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.shortcut-keys {
		display: flex;
		gap: 4px;
	}

	.shortcut-keys :global(kbd) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		height: 22px;
		padding: 0 6px;
		font-size: 11px;
		font-family: inherit;
		font-weight: 600;
		color: var(--text-primary);
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: 4px;
	}
</style>
