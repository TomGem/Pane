<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		title: string;
		onclose?: () => void;
		children: Snippet;
	}

	let { title, onclose, children }: Props = $props();

	import { trapFocus } from '$lib/actions/trapFocus';

	// Track where mousedown started to prevent accidental backdrop closes
	// (e.g. text selection dragging outside, or clicking slightly off the modal)
	let mouseDownOnBackdrop = $state(false);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			// If focus is in a form field, blur it first instead of closing
			const active = document.activeElement;
			if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) {
				active.blur();
				return;
			}
			onclose?.();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" role="presentation"
	onmousedown={(e) => { mouseDownOnBackdrop = e.target === e.currentTarget; }}
	onclick={(e) => { if (e.target === e.currentTarget && mouseDownOnBackdrop) onclose?.(); }}
>
	<div class="modal glass-strong" role="dialog" aria-labelledby="modal-title" aria-modal="true" use:trapFocus>
		<div class="modal-header">
			<h2 id="modal-title" class="modal-title">{title}</h2>
			<button class="modal-close" onclick={onclose} aria-label="Close" title="Close">
				<Icon name="close" size={18} />
			</button>
		</div>
		<div class="modal-body">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		animation: fadeIn 0.15s ease;
	}

	.modal {
		width: 90%;
		max-width: 480px;
		max-height: 85vh;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: slideUp 0.2s ease;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.modal-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.modal-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.modal-close:hover {
		background-color: var(--accent-soft);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 20px;
		overflow-y: auto;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(10px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
</style>
