<script lang="ts">
	interface Props {
		message: string;
		type?: 'success' | 'error';
		onclose?: () => void;
	}

	let { message, type = 'success', onclose }: Props = $props();
</script>

<div class="toast glass-strong" class:error={type === 'error'}>
	<span class="toast-message">{message}</span>
	<button class="toast-close" onclick={onclose} aria-label="Close" title="Close">
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	</button>
</div>

<style>
	.toast {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		animation: slideIn 0.2s ease;
		border-left: 3px solid var(--accent);
	}

	.toast.error {
		border-left-color: var(--danger);
	}

	.toast-message {
		font-size: 13px;
		color: var(--text-primary);
	}

	.toast-close {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
	}

	.toast-close:hover {
		color: var(--text-primary);
	}

	@keyframes slideIn {
		from { opacity: 0; transform: translateX(20px); }
		to { opacity: 1; transform: translateX(0); }
	}
</style>
