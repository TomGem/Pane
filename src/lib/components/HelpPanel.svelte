<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		onclose: () => void;
		legalEnabled?: boolean;
	}

	let { onclose, legalEnabled = false }: Props = $props();

	let now = $state(new Date());

	$effect(() => {
		const interval = setInterval(() => { now = new Date(); }, 10000);
		return () => clearInterval(interval);
	});

	function toDiscordianDate(date: Date): string {
		const year = date.getFullYear() + 1166;
		const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
		const leap = isLeap(date.getFullYear());
		const start = new Date(date.getFullYear(), 0, 0);
		const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);

		if (leap && dayOfYear === 60) {
			return `St. Tib's Day, ${year} YOLD`;
		}

		const adj = leap && dayOfYear > 60 ? dayOfYear - 1 : dayOfYear;
		const seasons = ['Chaos', 'Discord', 'Confusion', 'Bureaucracy', 'The Aftermath'];
		const weekdays = ['Sweetmorn', 'Boomtime', 'Pungenday', 'Prickle-Prickle', 'Setting Orange'];
		const seasonIndex = Math.floor((adj - 1) / 73);
		const dayOfSeason = ((adj - 1) % 73) + 1;
		const weekdayIndex = (adj - 1) % 5;

		return `${weekdays[weekdayIndex]}, ${seasons[seasonIndex]} ${dayOfSeason}, ${year} YOLD`;
	}

	let clockText = $derived.by(() => {
		const ddate = toDiscordianDate(now);
		const time = now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', hour12: false });
		return `${ddate} — ${time}`;
	});

	import { trapFocus } from '$lib/actions/trapFocus';

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
			<section class="help-section">
				<h3>Getting started</h3>
				<p>Pane is a multi-user Kanban dashboard for organizing links, notes, and documents into columns. Use <strong>Spaces</strong> to keep separate boards for different projects or topics.</p>
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
					<li>Use the <strong>space switcher</strong> dropdown to jump between spaces directly</li>
					<li>Each space has its own categories, items, and files</li>
					<li>Create or delete spaces from the Spaces dashboard</li>
					<li><strong>Move categories</strong> between spaces from the column menu</li>
					<li><strong>Promote</strong> a subcategory to top-level, or <strong>demote</strong> a top-level category into another</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Sharing &amp; chat</h3>
				<ul>
					<li><strong>Share spaces</strong> with other users by <strong>username</strong> or <strong>email</strong> from the toolbar or dashboard</li>
					<li>Username search offers <strong>autocomplete</strong> suggestions as you type</li>
					<li>Choose <strong>Can edit</strong> (read-write) or <strong>View only</strong> (read-only) permissions</li>
					<li>Shared spaces appear in the <strong>"Shared with me"</strong> section on the dashboard</li>
					<li>Space cards show a <strong>"Shared with N"</strong> indicator when shared</li>
					<li>Leave a shared space anytime from the dashboard</li>
					<li><strong>Real-time chat</strong> is available in shared spaces — open the chat panel to message collaborators</li>
					<li><strong>Presence indicators</strong> show which users are currently online in a shared space</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Drag &amp; drop</h3>
				<ul>
					<li>Drag items between columns to move them</li>
					<li>Drag items into expanded subcategories</li>
					<li>Drag columns to reorder them</li>
					<li>Drop a <strong>URL</strong> or <strong>file</strong> onto a column to add it instantly</li>
					<li>Drop an <strong>entire folder</strong> onto a column — subfolders are automatically created as subcategories with all files imported</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Tags &amp; filtering</h3>
				<ul>
					<li>Tags are <strong>shared across all your spaces</strong></li>
					<li>Assign tags to items when creating or editing them</li>
					<li>Edit tag names and colours from the <strong>tag dropdown</strong> in the toolbar</li>
					<li>Click a <strong>tag badge</strong> on a card to filter by that tag</li>
					<li>Use the tag dropdown to filter by multiple tags at once</li>
					<li>Search and tag filters combine — both must match</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Links &amp; metadata</h3>
				<ul>
					<li>When you add a link, the page title, description, and <strong>favicon</strong> are fetched automatically</li>
					<li>Favicons appear on link cards for quick visual identification</li>
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
				<h3>Documents &amp; media</h3>
				<ul>
					<li>Upload files up to <strong>100 MB</strong> per document</li>
					<li><strong>PDFs</strong> are displayed inline in a full-screen overlay</li>
					<li>Images, videos, and audio files play natively in the viewer</li>
					<li><strong>Text and markdown files</strong> open in a reader with rendered formatting and copy-to-clipboard</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Keyboard shortcuts</h3>
				<div class="shortcut-list">
					<div class="shortcut-row">
						<span class="shortcut-keys"><kbd>/</kbd> or <kbd>Ctrl</kbd><kbd>K</kbd></span>
						<span>Focus search</span>
					</div>
					<div class="shortcut-row">
						<span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>N</kbd></span>
						<span>New item</span>
					</div>
					<div class="shortcut-row">
						<span class="shortcut-keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>N</kbd></span>
						<span>New category</span>
					</div>
					<div class="shortcut-row">
						<span class="shortcut-keys"><kbd>Esc</kbd></span>
						<span>Close modal / clear search</span>
					</div>
				</div>
			</section>
			<section class="help-section">
				<h3>Export &amp; import</h3>
				<ul>
					<li>Open the <strong>user menu</strong> (person icon) and click <strong>Export &amp; Import</strong></li>
					<li>Export one or more spaces as a ZIP archive, optionally including files</li>
					<li>Import a ZIP to restore or transfer spaces between machines</li>
					<li>Choose how to handle conflicts: <strong>skip</strong>, <strong>rename</strong>, or <strong>replace</strong></li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Appearance</h3>
				<ul>
					<li>Toggle between <strong>light</strong>, <strong>dark</strong>, and <strong>system</strong> themes</li>
					<li>Choose from <strong>8 accent colour palettes</strong> in the user menu</li>
					<li>Pick a <strong>sans-serif font</strong> (System, Fira Sans, Inter, Ubuntu) and <strong>monospace font</strong> (System, Fira Code, JetBrains Mono, Source Code Pro)</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Changelog</h3>
				<ul>
					<li>Open the <strong>changelog</strong> from the toolbar to see a history of changes in the current space</li>
					<li>Tracks item, category, and tag creation, updates, and deletions</li>
					<li>Click on an entry to <strong>navigate to the item</strong> in the board</li>
					<li>Shows who made each change in shared spaces</li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Account &amp; storage</h3>
				<ul>
					<li>Click the <strong>user icon</strong> to see your account info and storage usage</li>
					<li>Upload a <strong>profile avatar</strong> from the user menu</li>
					<li><strong>Change your password</strong> from the <strong>user menu</strong> (person icon)</li>
					<li><strong>Forgot your password?</strong> Use the link on the login page to reset it via email</li>
					<li>Each user has a <strong>storage quota</strong> — check your usage in the user menu</li>
					<li><strong>Delete your account</strong> from the user menu's Danger zone — requires password confirmation</li>
					<li>Admins can manage users, invite codes, quotas, and legal pages from the <strong>Admin Panel</strong></li>
				</ul>
			</section>
			<section class="help-section">
				<h3>Privacy</h3>
				<ul>
					<li>All data stays on your server — databases and files are stored locally</li>
					<li>Control whether other users can see your <strong>email address</strong> in the privacy settings of the user menu</li>
				</ul>
			</section>
			{#if legalEnabled}
				<section class="help-section">
					<h3>Legal</h3>
					<ul>
						<li><a href="/legal" class="help-demo-link">Privacy Policy</a></li>
						<li><a href="/legal?tab=legal" class="help-demo-link">Legal Notice</a></li>
					</ul>
				</section>
			{/if}
			<section class="help-section">
				<h3>Feature demo</h3>
				<p>Want a visual overview? <a href="/demo.html" target="_blank" class="help-demo-link">Open the interactive feature presentation</a></p>
			</section>
			<div class="help-clock">{clockText}</div>
			<div class="help-version">Pane v2.4.0</div>
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
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
		text-align: center;
		margin-top: 16px;
		padding-top: 14px;
		border-top: 1px solid var(--border);
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

	.help-version {
		margin-top: 4px;
		font-size: 12px;
		color: var(--text-muted);
		text-align: center;
	}

	.help-demo-link {
		color: var(--accent);
		font-weight: 600;
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
