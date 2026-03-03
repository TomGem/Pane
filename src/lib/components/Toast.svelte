<script lang="ts">
	interface Props {
		message: string;
		type?: 'success' | 'error';
		progress?: { current: number; total: number };
		onclose?: () => void;
	}

	let { message, type = 'success', progress, onclose }: Props = $props();

	let percentage = $derived(progress ? Math.round((progress.current / progress.total) * 100) : 0);
</script>

<div class="toast glass-strong" class:error={type === 'error'}>
	<div class="toast-body">
		<span class="toast-message">{message}</span>
		<button class="toast-close" onclick={onclose} aria-label="Close" title="Close">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</div>
	{#if progress}
		<div class="toast-progress-track">
			<div class="toast-progress-bar" style="width: {percentage}%"></div>
		</div>
	{/if}
</div>

<style>
	.toast {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0;
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		animation: slideIn 0.2s ease;
		border-left: 3px solid var(--accent);
		overflow: hidden;
	}

	.toast.error {
		border-left-color: var(--danger);
	}

	.toast-body {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
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

	.toast-progress-track {
		height: 3px;
		background: var(--border);
	}

	.toast-progress-bar {
		height: 100%;
		background: var(--accent);
		transition: width 0.15s ease;
	}

	@keyframes slideIn {
		from { opacity: 0; transform: translateX(20px); }
		to { opacity: 1; transform: translateX(0); }
	}
</style>
