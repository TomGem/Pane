<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import Icon from './Icon.svelte';

	interface Props {
		url: string;
		fileName: string;
		mimeType: string;
		onclose: () => void;
	}

	let { url, fileName, mimeType, onclose }: Props = $props();

	let content = $state('');
	let loading = $state(true);
	let error = $state('');
	let copied = $state(false);

	let isMarkdown = $derived(mimeType === 'text/markdown' || fileName.endsWith('.md'));
	let html = $derived(isMarkdown ? DOMPurify.sanitize(marked.parse(content, { async: false }) as string) : '');

	$effect(() => {
		fetch(url)
			.then((res) => {
				if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
				return res.text();
			})
			.then((text) => {
				content = text;
				loading = false;
			})
			.catch((err) => {
				error = err.message;
				loading = false;
			});
	});

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
<div class="overlay" onclick={handleBackdropClick} onkeydown={handleKeydown} role="dialog" aria-modal="true" aria-label="File: {fileName}" tabindex="-1" use:trapFocus>
	<div class="controls">
		<button class="ctrl-btn" onclick={copyToClipboard} aria-label="Copy to clipboard" title={copied ? 'Copied!' : 'Copy to clipboard'}>
			{#if copied}
				<Icon name="check" size={20} />
			{:else}
				<Icon name="copy" size={20} />
			{/if}
		</button>
		<a class="ctrl-btn" href={url} download={fileName} aria-label="Download" title="Download">
			<Icon name="download" size={20} />
		</a>
		<button class="ctrl-btn" onclick={onclose} aria-label="Close" title="Close">
			<Icon name="close" size={20} />
		</button>
	</div>

	<div class="text-panel">
		<h2 class="text-title">{fileName}</h2>
		{#if loading}
			<p class="loading">Loading...</p>
		{:else if error}
			<p class="error">{error}</p>
		{:else if isMarkdown}
			<div class="text-content markdown">
				{@html html}
			</div>
		{:else}
			<pre class="text-content">{content}</pre>
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

	.text-panel {
		width: 90vw;
		max-width: 720px;
		max-height: 85vh;
		overflow-y: auto;
		background: var(--bg-primary, #1a1a2e);
		border-radius: 12px;
		padding: 32px;
	}

	.text-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary, #e0e0e0);
		margin-bottom: 20px;
		line-height: 1.3;
		word-break: break-word;
		font-family: var(--font-mono);
	}

	.loading, .error {
		color: var(--text-muted, #888);
		font-size: 14px;
	}

	.error {
		color: var(--danger, #ef4444);
	}

	pre.text-content {
		color: var(--text-secondary, #b0b0b0);
		font-size: 13px;
		line-height: 1.6;
		font-family: var(--font-mono);
		white-space: pre-wrap;
		word-break: break-word;
		margin: 0;
	}

	.markdown {
		color: var(--text-secondary, #b0b0b0);
		font-size: 14px;
		line-height: 1.7;
		font-family: var(--font-mono);
	}

	/* Markdown styles (same as NoteOverlay) */
	.markdown :global(h1) { font-size: 1.6em; font-weight: 700; margin: 1em 0 0.5em; color: var(--text-primary, #e0e0e0); }
	.markdown :global(h2) { font-size: 1.35em; font-weight: 600; margin: 1em 0 0.4em; color: var(--text-primary, #e0e0e0); }
	.markdown :global(h3) { font-size: 1.15em; font-weight: 600; margin: 0.8em 0 0.3em; color: var(--text-primary, #e0e0e0); }
	.markdown :global(p) { margin: 0.6em 0; }
	.markdown :global(ul), .markdown :global(ol) { margin: 0.6em 0; padding-left: 1.5em; }
	.markdown :global(li) { margin: 0.25em 0; }
	.markdown :global(blockquote) { border-left: 3px solid var(--accent, #6c63ff); padding-left: 12px; margin: 0.8em 0; color: var(--text-muted, #888); font-style: italic; }
	.markdown :global(code) { background: rgba(255, 255, 255, 0.08); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: var(--font-mono); }
	.markdown :global(pre) { background: rgba(0, 0, 0, 0.3); padding: 12px 16px; border-radius: 8px; overflow-x: auto; margin: 0.8em 0; }
	.markdown :global(pre code) { background: none; padding: 0; }
	.markdown :global(a) { color: var(--accent, #6c63ff); text-decoration: underline; }
	.markdown :global(hr) { border: none; border-top: 1px solid rgba(255, 255, 255, 0.1); margin: 1.2em 0; }
	.markdown :global(table) { width: 100%; border-collapse: collapse; margin: 0.8em 0; }
	.markdown :global(th), .markdown :global(td) { border: 1px solid rgba(255, 255, 255, 0.12); padding: 6px 10px; text-align: left; }
	.markdown :global(th) { background: rgba(255, 255, 255, 0.05); font-weight: 600; }
	.markdown :global(img) { max-width: 100%; border-radius: 4px; }
</style>
