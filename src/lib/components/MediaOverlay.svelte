<script lang="ts">
	interface Props {
		url: string;
		fileName: string;
		mimeType: string;
		onclose: () => void;
	}

	import Icon from './Icon.svelte';

	let { url, fileName, mimeType, onclose }: Props = $props();

	let mediaType = $derived(mimeType.split('/')[0]);
	let videoEl = $state<HTMLVideoElement | null>(null);
	let audioEl = $state<HTMLAudioElement | null>(null);

	$effect(() => {
		videoEl?.play().catch(() => {});
	});

	$effect(() => {
		audioEl?.play().catch(() => {});
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function trapFocus(node: HTMLElement) {
		const previouslyFocused = document.activeElement as HTMLElement;
		function getFocusable() {
			return node.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
		}
		requestAnimationFrame(() => { getFocusable()[0]?.focus(); });
		function handleTab(e: KeyboardEvent) {
			if (e.key !== 'Tab') return;
			const focusable = getFocusable();
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
			else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
		}
		node.addEventListener('keydown', handleTab);
		return { destroy() { node.removeEventListener('keydown', handleTab); previouslyFocused?.focus(); } };
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="overlay" onclick={handleBackdropClick} onkeydown={handleKeydown} role="dialog" aria-modal="true" aria-label="Media: {fileName}" tabindex="-1" use:trapFocus>
	<div class="controls">
		<a class="ctrl-btn" href={url} download={fileName} aria-label="Download" title="Download">
			<Icon name="download" size={20} />
		</a>
		<button class="ctrl-btn" onclick={onclose} aria-label="Close" title="Close">
			<Icon name="close" size={20} />
		</button>
	</div>

	<div class="media-container">
		{#if mediaType === 'image'}
			<img src={url} alt={fileName} />
		{:else if mediaType === 'video'}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={videoEl} controls src={url}></video>
		{:else if mediaType === 'audio'}
			<div class="audio-wrapper">
				<span class="audio-filename">{fileName}</span>
				<audio bind:this={audioEl} controls src={url}></audio>
			</div>
		{/if}
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(8px);
	}

	.controls {
		position: absolute;
		top: 16px;
		right: 16px;
		display: flex;
		gap: 8px;
		z-index: 1;
	}

	.ctrl-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.1);
		color: white;
		cursor: pointer;
		transition: background 0.2s;
		border: none;
		text-decoration: none;
	}

	.ctrl-btn:hover {
		background: rgba(255, 255, 255, 0.25);
	}

	.media-container {
		display: flex;
		align-items: center;
		justify-content: center;
		max-width: 90vw;
		max-height: 90vh;
	}

	img {
		max-width: 90vw;
		max-height: 90vh;
		object-fit: contain;
		border-radius: 4px;
	}

	video {
		max-width: 90vw;
		max-height: 90vh;
		border-radius: 4px;
	}

	.audio-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 32px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 12px;
	}

	.audio-filename {
		color: white;
		font-size: 16px;
		font-weight: 500;
	}

	audio {
		min-width: 320px;
	}
</style>
