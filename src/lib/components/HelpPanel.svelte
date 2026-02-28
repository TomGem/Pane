<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	let now = $state(new Date());

	$effect(() => {
		const interval = setInterval(() => { now = new Date(); }, 1000);
		return () => clearInterval(interval);
	});

	let clockText = $derived.by(() => {
		const date = now.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
		const time = now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
		return `${date} ${time}`;
	});

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

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="help-overlay" onclick={(e) => { if (e.target === e.currentTarget) onclose(); }} onkeydown={(e) => { if (e.key === 'Escape') onclose(); }} role="dialog" aria-modal="true" aria-label="Pane Help" tabindex="-1" use:trapFocus>
	<div class="help-panel glass-strong">
		<div class="help-header">
			<h2 class="help-title">Pane Help</h2>
			<button class="help-close" onclick={onclose} aria-label="Close" title="Close">
				<Icon name="close" size={18} />
			</button>
		</div>
		<div class="help-body">
			<div class="help-clock">{clockText}</div>
			<section class="help-section">
				<h3>Getting started</h3>
				<p>Pane is a local Kanban dashboard for organizing links, notes, and documents into columns. Use <strong>Spaces</strong> to keep separate boards for different projects or topics.</p>
				<ul>
					<li>Create <strong>categories</strong> (columns) to group your items</li>
					<li>Add <strong>links</strong>, <strong>notes</strong>, or <strong>documents</strong> to any category</li>
					<li>Create <strong>subcategories</strong> to nest organization deeper</li>
					<li>Start with <strong>sample data</strong> on an empty board to see how it works</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Spaces</h3>
				<ul>
					<li>Click <strong>Pane</strong> in the toolbar to go to the Spaces dashboard</li>
					<li>Each space has its own categories, items, tags, and files</li>
					<li>Create, rename, or delete spaces from the Spaces dashboard</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Drag &amp; drop</h3>
				<ul>
					<li>Drag items between columns to move them</li>
					<li>Drag items into expanded subcategories</li>
					<li>Drag columns to reorder them</li>
					<li>Drop a <strong>URL</strong> or <strong>file</strong> onto a column to add it instantly</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Tags &amp; filtering</h3>
				<ul>
					<li>Assign tags to items when creating or editing them</li>
					<li>Click a <strong>tag badge</strong> on a card to filter by that tag</li>
					<li>Use the <strong>tag dropdown</strong> next to the search box to filter by multiple tags</li>
					<li>Search and tag filters combine — both must match</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Notes &amp; markdown</h3>
				<ul>
					<li>Notes support <strong>markdown</strong> formatting — headings, bold, lists, code blocks, and more</li>
					<li>Click a note card to open it in a full-screen reader</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Keyboard shortcuts</h3>
				<div class="shortcut-list">
					<div class="shortcut-row">
						<span class="shortcut-keys"><kbd>/</kbd> or <kbd>Cmd</kbd><kbd>K</kbd></span>
						<span>Focus search</span>
					</div>
					<div class="shortcut-row">
						<span class="shortcut-keys"><kbd>Cmd</kbd><kbd>N</kbd></span>
						<span>New item</span>
					</div>
					<div class="shortcut-row">
						<span class="shortcut-keys"><kbd>Cmd</kbd><kbd>Shift</kbd><kbd>N</kbd></span>
						<span>New category</span>
					</div>
					<div class="shortcut-row">
						<span class="shortcut-keys"><kbd>Esc</kbd></span>
						<span>Close modal / clear search</span>
					</div>
				</div>
			</section>
			<section class="help-section">
				<h3>Appearance</h3>
				<ul>
					<li>Toggle between <strong>light</strong>, <strong>dark</strong>, and <strong>system</strong> themes</li>
					<li>Choose from <strong>8 accent colour palettes</strong> in Settings</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Privacy</h3>
				<ul>
					<li>All data stays on your local machine — nothing is sent to the cloud</li>
				</ul>
			</section>
		</div>
	</div>
</div>

<style>
	.help-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
	}

	.help-panel {
		width: 90vw;
		max-width: 560px;
		max-height: 85vh;
		overflow-y: auto;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
	}

	.help-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.help-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.help-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.help-close:hover {
		background: var(--accent-soft);
		color: var(--text-primary);
	}

	.help-clock {
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-secondary);
		text-align: center;
		padding-bottom: 14px;
		margin-bottom: 14px;
		border-bottom: 1px solid var(--border);
	}

	.help-body {
		padding: 16px 20px 20px;
	}

	.help-section {
		margin-bottom: 16px;
	}

	.help-section:last-child {
		margin-bottom: 0;
	}

	.help-section h3 {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 6px;
	}

	.help-section p,
	.help-section li {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.help-section ul {
		padding-left: 18px;
		margin: 0;
	}

	.shortcut-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.shortcut-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.shortcut-keys {
		display: flex;
		gap: 4px;
	}

	.shortcut-keys :global(kbd) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		height: 22px;
		padding: 0 6px;
		font-size: 11px;
		font-family: inherit;
		font-weight: 600;
		color: var(--text-primary);
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: 4px;
	}
</style>
