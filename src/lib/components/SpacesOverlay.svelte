<script lang="ts">
	import type { Space } from '$lib/types';

	interface Props {
		spaces: Space[];
		spaceSlug: string;
		onclose: () => void;
		onnavigate: (slug: string) => void;
		oncreate: (name: string) => void;
		ondelete: (slug: string) => void;
	}

	let { spaces, spaceSlug, onclose, onnavigate, oncreate, ondelete }: Props = $props();

	let creatingSpace = $state(false);
	let newSpaceName = $state('');
	let newSpaceInputEl = $state<HTMLInputElement | null>(null);
	let confirmDeleteSlug = $state<string | null>(null);

	function handleCreate() {
		const name = newSpaceName.trim();
		if (!name) return;
		oncreate(name);
		creatingSpace = false;
		newSpaceName = '';
	}
</script>

<div class="spaces-overlay" onclick={(e) => { if (e.target === e.currentTarget) onclose(); }} onkeydown={(e) => { if (e.key === 'Escape') onclose(); }} role="button" tabindex="-1">
	<div class="spaces-panel glass-strong">
		<div class="spaces-header">
			<h2 class="spaces-title">Spaces</h2>
			<button class="spaces-close" onclick={onclose} aria-label="Close" title="Close">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
		<div class="spaces-body">
			<div class="spaces-grid">
				{#each spaces as s (s.slug)}
					{#if confirmDeleteSlug === s.slug}
						<div class="space-card confirm">
							<span class="space-card-confirm-text">Delete <strong>{s.name}</strong>?</span>
							<div class="space-card-confirm-actions">
								<button class="space-card-confirm-btn cancel" onclick={() => confirmDeleteSlug = null}>Cancel</button>
								<button class="space-card-confirm-btn delete" onclick={() => { ondelete(s.slug); confirmDeleteSlug = null; }}>Delete</button>
							</div>
						</div>
					{:else}
						<div
							class="space-card"
							class:current={s.slug === spaceSlug}
							onclick={() => onnavigate(s.slug)}
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onnavigate(s.slug); } }}
							role="button"
							tabindex="0"
						>
							<span class="space-card-name">{s.name}</span>
							{#if s.slug === spaceSlug}
								<svg class="space-card-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12" />
								</svg>
							{/if}
							{#if spaces.length > 1}
								<button
									class="space-card-delete"
									onclick={(e) => { e.stopPropagation(); confirmDeleteSlug = s.slug; }}
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
		</div>
		<div class="spaces-footer">
			{#if creatingSpace}
				<form class="space-create-form" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
					<input
						bind:this={newSpaceInputEl}
						class="input space-create-input"
						type="text"
						placeholder="Space name..."
						bind:value={newSpaceName}
						onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); creatingSpace = false; newSpaceName = ''; } }}
					/>
					<button class="btn btn-primary space-create-submit" type="submit" disabled={!newSpaceName.trim()}>
						Create
					</button>
				</form>
			{:else}
				<button class="space-new-btn" onclick={() => { creatingSpace = true; setTimeout(() => newSpaceInputEl?.focus(), 0); }}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
					New Space
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.spaces-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
	}

	.spaces-panel {
		width: 90vw;
		max-width: 480px;
		max-height: 85vh;
		overflow-y: auto;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
	}

	.spaces-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.spaces-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.spaces-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.spaces-close:hover {
		background: var(--accent-soft);
		color: var(--text-primary);
	}

	.spaces-body {
		padding: 16px 20px;
	}

	.spaces-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 10px;
	}

	.space-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 16px;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: var(--bg-secondary);
		cursor: pointer;
		transition: background-color var(--transition), border-color var(--transition), box-shadow var(--transition);
		text-align: left;
	}

	.space-card:hover {
		background: var(--accent-soft);
		border-color: var(--border);
	}

	.space-card.current {
		border-color: var(--accent);
		background: var(--accent-soft);
		box-shadow: 0 0 0 1px var(--accent);
	}

	.space-card.confirm {
		display: flex;
		flex-direction: column;
		gap: 10px;
		cursor: default;
	}

	.space-card-name {
		flex: 1;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.space-card-check {
		flex-shrink: 0;
		color: var(--accent);
	}

	.space-card-delete {
		position: absolute;
		top: 6px;
		right: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		opacity: 0;
		transition: opacity var(--transition), background-color var(--transition), color var(--transition);
	}

	.space-card:hover .space-card-delete {
		opacity: 1;
	}

	.space-card-delete:hover {
		background: rgba(239, 68, 68, 0.1);
		color: var(--danger);
	}

	.space-card-confirm-text {
		font-size: 13px;
		color: var(--text-primary);
	}

	.space-card-confirm-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}

	.space-card-confirm-btn {
		font-size: 12px;
		padding: 4px 12px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background-color var(--transition);
	}

	.space-card-confirm-btn.cancel {
		color: var(--text-secondary);
		background: var(--bg-secondary);
	}

	.space-card-confirm-btn.cancel:hover {
		background: var(--border);
	}

	.space-card-confirm-btn.delete {
		color: white;
		background: var(--danger);
	}

	.space-card-confirm-btn.delete:hover {
		opacity: 0.9;
	}

	.spaces-footer {
		padding: 12px 20px 16px;
		border-top: 1px solid var(--border);
	}

	.space-new-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 12px;
		border-radius: var(--radius);
		cursor: pointer;
		transition: background-color var(--transition);
		font-size: 13px;
		font-weight: 600;
		color: var(--accent);
	}

	.space-new-btn:hover {
		background: var(--accent-soft);
	}

	.space-create-form {
		display: flex;
		gap: 8px;
	}

	.space-create-input {
		flex: 1;
		font-size: 13px;
		padding: 8px 10px;
	}

	.space-create-submit {
		flex-shrink: 0;
		font-size: 12px;
		padding: 8px 14px;
	}
</style>
