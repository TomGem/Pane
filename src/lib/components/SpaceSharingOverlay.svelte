<script lang="ts">
	import Icon from './Icon.svelte';

	interface Share {
		id: number;
		shared_with: string;
		email: string;
		display_name: string;
		permission: 'read' | 'write';
	}

	interface Props {
		spaceSlug: string;
		spaceName: string;
		onclose: () => void;
	}

	let { spaceSlug, spaceName, onclose }: Props = $props();

	let shares = $state<Share[]>([]);
	let email = $state('');
	let permission = $state<'read' | 'write'>('read');
	let loading = $state(true);
	let error = $state('');
	let adding = $state(false);

	$effect(() => {
		loadShares();
	});

	async function loadShares() {
		loading = true;
		try {
			const res = await fetch(`/api/spaces/${spaceSlug}/shares`);
			const data = await res.json();
			if (res.ok) {
				shares = data.shares;
			}
		} catch { /* ignore */ }
		loading = false;
	}

	async function addShare() {
		error = '';
		adding = true;
		try {
			const res = await fetch(`/api/spaces/${spaceSlug}/shares`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, permission })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Failed to share';
			} else {
				shares = [data.share, ...shares];
				email = '';
			}
		} catch {
			error = 'Failed to share';
		}
		adding = false;
	}

	async function updatePermission(share: Share, newPermission: 'read' | 'write') {
		try {
			const res = await fetch(`/api/spaces/${spaceSlug}/shares/${share.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ permission: newPermission })
			});
			if (res.ok) {
				shares = shares.map(s => s.id === share.id ? { ...s, permission: newPermission } : s);
			}
		} catch { /* ignore */ }
	}

	async function removeShare(share: Share) {
		try {
			const res = await fetch(`/api/spaces/${spaceSlug}/shares/${share.id}`, { method: 'DELETE' });
			if (res.ok) {
				shares = shares.filter(s => s.id !== share.id);
			}
		} catch { /* ignore */ }
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay-backdrop" onclick={onclose} aria-hidden="true"></div>
<div class="overlay glass-strong">
	<div class="overlay-header">
		<h2 class="overlay-title">Share "{spaceName}"</h2>
		<button class="btn-close" onclick={onclose} aria-label="Close">
			<Icon name="close" size={18} />
		</button>
	</div>

	<div class="overlay-body">
		<form class="share-form" onsubmit={(e) => { e.preventDefault(); addShare(); }}>
			<input
				class="input share-email"
				type="email"
				bind:value={email}
				placeholder="Email address"
				required
			/>
			<select class="input share-permission" bind:value={permission}>
				<option value="read">View only</option>
				<option value="write">Can edit</option>
			</select>
			<button class="btn btn-primary" type="submit" disabled={adding || !email.trim()}>
				{adding ? 'Sharing...' : 'Share'}
			</button>
		</form>

		{#if error}
			<div class="share-error">{error}</div>
		{/if}

		{#if loading}
			<p class="share-loading">Loading...</p>
		{:else if shares.length === 0}
			<p class="share-empty">Not shared with anyone yet</p>
		{:else}
			<div class="share-list">
				{#each shares as share (share.id)}
					<div class="share-row">
						<div class="share-info">
							<span class="share-name">{share.display_name}</span>
							<span class="share-email">{share.email}</span>
						</div>
						<div class="share-actions">
							<select
								class="input share-permission-select"
								value={share.permission}
								onchange={(e) => updatePermission(share, (e.target as HTMLSelectElement).value as 'read' | 'write')}
							>
								<option value="read">View only</option>
								<option value="write">Can edit</option>
							</select>
							<button
								class="btn btn-sm btn-ghost"
								onclick={() => removeShare(share)}
								title="Remove access"
							>
								<Icon name="trash" size={14} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.overlay-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgba(0, 0, 0, 0.4);
	}

	.overlay {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 201;
		width: 90%;
		max-width: 480px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
	}

	.overlay-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.overlay-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.btn-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.btn-close:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.overlay-body {
		padding: 16px 20px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.share-form {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.share-email {
		flex: 1;
		min-width: 0;
	}

	.share-permission {
		width: auto;
		min-width: 110px;
	}

	.share-error {
		padding: 8px 12px;
		border-radius: var(--radius);
		background: rgba(239, 68, 68, 0.1);
		color: var(--danger);
		font-size: 13px;
	}

	.share-loading,
	.share-empty {
		text-align: center;
		font-size: 13px;
		color: var(--text-muted);
		padding: 16px;
	}

	.share-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.share-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 12px;
		border-radius: var(--radius);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
	}

	.share-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.share-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.share-email {
		font-size: 11px;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.share-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.share-permission-select {
		width: auto;
		min-width: 100px;
		font-size: 12px;
		padding: 4px 8px;
	}
</style>
