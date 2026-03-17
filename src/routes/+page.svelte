<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { getContext } from 'svelte';
	import type { ThemeStore } from '$lib/stores/theme.svelte';
	import type { PaletteStore } from '$lib/stores/palette.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import SettingsOverlay from '$lib/components/SettingsOverlay.svelte';
	import HelpPanel from '$lib/components/HelpPanel.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data } = $props();

	const theme = getContext<ThemeStore>('theme');
	const palette = getContext<PaletteStore>('palette');

	let showSettings = $state(false);
	let showHelp = $state(false);
	let showUserMenu = $state(false);
	let creatingSpace = $state(false);
	let newSpaceName = $state('');
	let newSpaceInputEl = $state<HTMLInputElement | null>(null);
	let confirmDeleteSlug = $state<string | null>(null);

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
		} catch { /* ignore */ }
		window.location.href = '/login';
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
			const result = await res.json();
			if (!res.ok) return;
			newSpaceName = '';
			creatingSpace = false;
			goto(`/s/${result.slug}`);
		} catch { /* ignore */ }
	}

	async function handleDeleteSpace(slug: string) {
		try {
			const res = await fetch(`/api/spaces/${slug}`, { method: 'DELETE' });
			if (!res.ok) return;
			confirmDeleteSlug = null;
			await invalidateAll();
		} catch { /* ignore */ }
	}

	function handleGlobalKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showUserMenu) {
			showUserMenu = false;
		} else if (e.key === 'Escape' && showHelp) {
			showHelp = false;
		} else if (e.key === 'Escape' && showSettings) {
			showSettings = false;
		}
		if (e.key === 'Escape' && creatingSpace) {
			creatingSpace = false;
			newSpaceName = '';
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<header class="toolbar glass-strong">
	<div class="toolbar-left">
		<span class="toolbar-title">Pane</span>
		<span class="toolbar-subtitle">Spaces</span>
	</div>
	<div class="toolbar-right">
		<ThemeToggle mode={theme.mode} onchange={(mode) => theme.setMode(mode)} />
		<button class="btn-toolbar-icon" onclick={() => showSettings = true} aria-label="Settings" title="Settings">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="3" />
				<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
			</svg>
		</button>
		<button class="btn-toolbar-icon" onclick={() => showHelp = true} aria-label="Help" title="Help">
			<Icon name="help-circle" size={18} />
		</button>
		{#if data.user}
			<div class="user-menu-wrapper">
				<button
					class="btn-toolbar-icon"
					onclick={() => showUserMenu = !showUserMenu}
					aria-label="User menu"
					title={data.user.display_name}
				>
					<Icon name="user" size={18} />
				</button>
				{#if showUserMenu}
					<div class="user-menu glass-strong">
						<div class="user-menu-header">
							<span class="user-menu-name">{data.user.display_name}</span>
							<span class="user-menu-email">{data.user.email}</span>
						</div>
						<div class="user-menu-list">
							{#if data.user.role === 'admin'}
								<a class="user-menu-item" href="/admin" onclick={() => showUserMenu = false}>
									<Icon name="shield" size={14} />
									<span>Admin Panel</span>
								</a>
							{/if}
							<button class="user-menu-item" onclick={handleLogout}>
								<Icon name="log-out" size={14} />
								<span>Sign out</span>
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</header>

<main class="spaces-board">
	<div class="spaces-columns">
		{#each data.spaces as space (space.slug)}
			{#if confirmDeleteSlug === space.slug}
				<div class="space-column confirm">
					<div class="space-column-header">
						<span class="space-column-name">{space.name}</span>
					</div>
					<div class="space-confirm-body">
						<p class="space-confirm-text">Delete this space and all its data?</p>
						<div class="space-confirm-actions">
							<button class="btn btn-sm" onclick={() => confirmDeleteSlug = null}>Cancel</button>
							<button class="btn btn-sm btn-danger" onclick={() => handleDeleteSpace(space.slug)}>Delete</button>
						</div>
					</div>
				</div>
			{:else}
				<a
					class="space-column"
					href="/s/{space.slug}"
				>
					<div class="space-column-header">
						<span class="space-column-name">{space.name}</span>
						{#if data.spaces.length > 1}
							<button
								class="space-column-delete"
								onclick={(e) => { e.preventDefault(); e.stopPropagation(); confirmDeleteSlug = space.slug; }}
								title="Delete space"
								aria-label="Delete {space.name}"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="3 6 5 6 21 6" />
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
								</svg>
							</button>
						{/if}
					</div>
					<div class="space-column-body">
						<div class="space-stat">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
							</svg>
							<span>{space.categoryCount} {space.categoryCount === 1 ? 'category' : 'categories'}</span>
						</div>
						<div class="space-stat">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
								<polyline points="14 2 14 8 20 8" />
							</svg>
							<span>{space.itemCount} {space.itemCount === 1 ? 'item' : 'items'}</span>
						</div>
					</div>
					<div class="space-column-footer">
						<span class="space-open-hint">Open board</span>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</div>
				</a>
			{/if}
		{/each}

		<!-- New space card -->
		<div class="space-column new-space">
			{#if creatingSpace}
				<div class="space-column-header">
					<span class="space-column-name">New Space</span>
				</div>
				<div class="new-space-form-body">
					<form onsubmit={(e) => { e.preventDefault(); handleCreateSpace(); }}>
						<input
							bind:this={newSpaceInputEl}
							class="input"
							type="text"
							placeholder="Space name..."
							bind:value={newSpaceName}
							onkeydown={(e) => { if (e.key === 'Escape') { creatingSpace = false; newSpaceName = ''; } }}
						/>
						<div class="new-space-actions">
							<button class="btn btn-sm" type="button" onclick={() => { creatingSpace = false; newSpaceName = ''; }}>Cancel</button>
							<button class="btn btn-sm btn-primary" type="submit" disabled={!newSpaceName.trim()}>Create</button>
						</div>
					</form>
				</div>
			{:else}
				<button
					class="new-space-trigger"
					onclick={() => { creatingSpace = true; setTimeout(() => newSpaceInputEl?.focus(), 0); }}
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
					<span>New Space</span>
				</button>
			{/if}
		</div>
	</div>

	{#if data.sharedSpaces && data.sharedSpaces.length > 0}
		<h2 class="shared-heading">Shared with me</h2>
		<div class="spaces-columns">
			{#each data.sharedSpaces as shared (shared.owner_id + '/' + shared.slug)}
				<a
					class="space-column shared"
					href="/s/{shared.slug}?owner={shared.owner_id}"
				>
					<div class="space-column-header">
						<span class="space-column-name">{shared.name}</span>
					</div>
					<div class="space-column-body">
						<div class="space-stat">
							<Icon name="user" size={14} />
							<span>{shared.owner_name}</span>
						</div>
						<div class="space-stat">
							<span class="badge">{shared.permission === 'write' ? 'Can edit' : 'View only'}</span>
						</div>
					</div>
					<div class="space-column-footer">
						<span class="space-open-hint">Open board</span>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</main>

{#if showUserMenu}
	<div class="user-menu-backdrop" onclick={() => showUserMenu = false} aria-hidden="true"></div>
{/if}

{#if showHelp}
	<HelpPanel onclose={() => showHelp = false} />
{/if}

{#if showSettings}
	<SettingsOverlay
		themeMode={theme.mode}
		paletteId={palette.palette}
		onclose={() => showSettings = false}
		onthemechange={(mode) => theme.setMode(mode)}
		onpalettechange={(id) => palette.setPalette(id)}
	/>
{/if}

<style>
	.toolbar {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 10px 20px;
		border-bottom: 1px solid var(--border);
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.toolbar-title {
		font-size: 18px;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text-primary);
	}

	.toolbar-subtitle {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-muted);
	}

	.toolbar-right {
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

	.spaces-board {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 24px 20px;
	}

	.spaces-columns {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 16px;
		min-height: 0;
	}

	.space-column {
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
		background: var(--bg-secondary);
		text-decoration: none;
		color: inherit;
		transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
	}

	a.space-column:hover {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
		transform: translateY(-2px);
		text-decoration: none;
	}

	.space-column.confirm {
		border-color: var(--danger);
	}

	.space-column-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px 10px;
	}

	.space-column-name {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.space-column-delete {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		opacity: 0;
		transition: opacity var(--transition), background-color var(--transition), color var(--transition);
	}

	.space-column:hover .space-column-delete {
		opacity: 1;
	}

	.space-column-delete:hover {
		background: rgba(239, 68, 68, 0.1);
		color: var(--danger);
	}

	.space-column-body {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 0 16px 14px;
	}

	.space-stat {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.space-stat svg {
		flex-shrink: 0;
	}

	.space-column-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		border-top: 1px solid var(--border);
		font-size: 12px;
		font-weight: 600;
		color: var(--accent);
	}

	.space-open-hint {
		opacity: 0;
		transition: opacity var(--transition);
	}

	.space-column:hover .space-open-hint {
		opacity: 1;
	}

	.space-column-footer svg {
		opacity: 0;
		transition: opacity var(--transition), transform var(--transition);
	}

	.space-column:hover .space-column-footer svg {
		opacity: 1;
		transform: translateX(2px);
	}

	.space-confirm-body {
		padding: 0 16px 16px;
	}

	.space-confirm-text {
		font-size: 13px;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}

	.space-confirm-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	/* New space card */
	.space-column.new-space {
		border-style: dashed;
		border-color: var(--border);
		background: transparent;
	}

	.new-space-trigger {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 40px 16px;
		color: var(--text-muted);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: color var(--transition), background-color var(--transition);
		border-radius: var(--radius-lg);
	}

	.new-space-trigger:hover {
		color: var(--accent);
		background: var(--accent-soft);
	}

	.new-space-form-body {
		padding: 0 16px 16px;
	}

	.new-space-form-body form {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.new-space-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.shared-heading {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-secondary);
		margin-top: 24px;
		margin-bottom: 12px;
	}

	.space-column.shared {
		border-style: dashed;
	}

	.user-menu-wrapper {
		position: relative;
	}

	.user-menu {
		position: absolute;
		top: calc(100% + 10px);
		right: 0;
		z-index: 150;
		min-width: 200px;
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
		background: var(--bg-primary);
		border: 1px solid var(--border);
	}

	.user-menu-header {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
	}

	.user-menu-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.user-menu-email {
		font-size: 12px;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-menu-list {
		padding: 4px;
	}

	.user-menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 7px 10px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 13px;
		color: var(--text-primary);
		text-decoration: none;
		text-align: left;
		transition: background-color var(--transition);
	}

	.user-menu-item:hover {
		background: var(--accent-soft);
		text-decoration: none;
	}

	.user-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99;
	}

	@media (max-width: 767px) {
		.spaces-board {
			padding: 16px 12px;
		}

		.spaces-columns {
			grid-template-columns: 1fr;
		}
	}
</style>
