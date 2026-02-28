<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		title: string;
		onclose?: () => void;
		children: Snippet;
	}

	let { title, onclose, children }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose?.();
		}
	}

	function trapFocus(node: HTMLElement) {
		const previouslyFocused = document.activeElement as HTMLElement;

		function getFocusable() {
			return node.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
		}

		// Focus first focusable element inside the dialog
		requestAnimationFrame(() => {
			const focusable = getFocusable();
			(focusable[0] as HTMLElement)?.focus();
		});

		function handleTab(e: KeyboardEvent) {
			if (e.key !== 'Tab') return;
			const focusable = getFocusable();
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last.focus();
				}
			} else {
				if (document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		}

		node.addEventListener('keydown', handleTab);

		return {
			destroy() {
				node.removeEventListener('keydown', handleTab);
				previouslyFocused?.focus();
			}
		};
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) onclose?.(); }} aria-hidden="true">
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
