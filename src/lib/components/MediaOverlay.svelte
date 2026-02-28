<script lang="ts">
	interface Props {
		url: string;
		fileName: string;
		mimeType: string;
		onclose: () => void;
	}

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
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" onclick={handleBackdropClick} aria-hidden="true">
	<div class="controls">
		<a class="ctrl-btn" href={url} download={fileName} aria-label="Download" title="Download">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
		</a>
		<button class="ctrl-btn" onclick={onclose} aria-label="Close" title="Close">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
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
