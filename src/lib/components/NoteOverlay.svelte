<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	interface Props {
		title: string;
		content: string;
		onclose: () => void;
	}

	let { title, content, onclose }: Props = $props();

	let copied = $state(false);

	let html = $derived(DOMPurify.sanitize(marked.parse(content, { async: false }) as string));

	async function copyToClipboard() {
		await navigator.clipboard.writeText(content);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" onclick={handleBackdropClick} onkeydown={handleKeydown} role="button" tabindex="-1">
	<div class="controls">
		<button class="ctrl-btn" onclick={copyToClipboard} aria-label="Copy to clipboard" title={copied ? 'Copied!' : 'Copy to clipboard'}>
			{#if copied}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="20 6 9 17 4 12" />
				</svg>
			{:else}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
					<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
				</svg>
			{/if}
		</button>
		<button class="ctrl-btn" onclick={onclose} aria-label="Close" title="Close">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</div>

	<div class="note-panel">
		<h2 class="note-title">{title}</h2>
		<div class="note-content markdown">
			{@html html}
		</div>
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
	}

	.ctrl-btn:hover {
		background: rgba(255, 255, 255, 0.25);
	}

	.note-panel {
		width: 90vw;
		max-width: 720px;
		max-height: 85vh;
		overflow-y: auto;
		background: var(--bg-primary, #1a1a2e);
		border-radius: 12px;
		padding: 32px;
	}

	.note-title {
		font-size: 22px;
		font-weight: 700;
		color: var(--text-primary, #e0e0e0);
		margin-bottom: 20px;
		line-height: 1.3;
	}

	.note-content {
		color: var(--text-secondary, #b0b0b0);
		font-size: 15px;
		line-height: 1.7;
	}

	/* Markdown styles */
	.markdown :global(h1) {
		font-size: 1.6em;
		font-weight: 700;
		margin: 1em 0 0.5em;
		color: var(--text-primary, #e0e0e0);
	}
	.markdown :global(h2) {
		font-size: 1.35em;
		font-weight: 600;
		margin: 1em 0 0.4em;
		color: var(--text-primary, #e0e0e0);
	}
	.markdown :global(h3) {
		font-size: 1.15em;
		font-weight: 600;
		margin: 0.8em 0 0.3em;
		color: var(--text-primary, #e0e0e0);
	}
	.markdown :global(p) {
		margin: 0.6em 0;
	}
	.markdown :global(ul),
	.markdown :global(ol) {
		margin: 0.6em 0;
		padding-left: 1.5em;
	}
	.markdown :global(li) {
		margin: 0.25em 0;
	}
	.markdown :global(blockquote) {
		border-left: 3px solid var(--accent, #6c63ff);
		padding-left: 12px;
		margin: 0.8em 0;
		color: var(--text-muted, #888);
		font-style: italic;
	}
	.markdown :global(code) {
		background: rgba(255, 255, 255, 0.08);
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.9em;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
	.markdown :global(pre) {
		background: rgba(0, 0, 0, 0.3);
		padding: 12px 16px;
		border-radius: 8px;
		overflow-x: auto;
		margin: 0.8em 0;
	}
	.markdown :global(pre code) {
		background: none;
		padding: 0;
	}
	.markdown :global(a) {
		color: var(--accent, #6c63ff);
		text-decoration: underline;
	}
	.markdown :global(hr) {
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		margin: 1.2em 0;
	}
	.markdown :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 0.8em 0;
	}
	.markdown :global(th),
	.markdown :global(td) {
		border: 1px solid rgba(255, 255, 255, 0.12);
		padding: 6px 10px;
		text-align: left;
	}
	.markdown :global(th) {
		background: rgba(255, 255, 255, 0.05);
		font-weight: 600;
	}
	.markdown :global(img) {
		max-width: 100%;
		border-radius: 4px;
	}
</style>
