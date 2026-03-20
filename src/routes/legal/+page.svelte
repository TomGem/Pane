<script lang="ts">
	import { page } from '$app/stores';
	import DOMPurify from 'dompurify';
	import { marked } from 'marked';

	let { data } = $props();

	let activeTab = $state<'privacy' | 'legal'>(
		($page.url.searchParams.get('tab') === 'legal') ? 'legal' : 'privacy'
	);

	let privacyHtml = $derived(DOMPurify.sanitize(marked.parse(data.privacy_policy) as string));
	let legalHtml = $derived(DOMPurify.sanitize(marked.parse(data.legal_notice) as string));
</script>

<svelte:head>
	<title>{activeTab === 'privacy' ? 'Privacy Policy' : 'Legal Notice'} - Pane</title>
</svelte:head>

<div class="legal-page">
	<div class="legal-card glass-strong">
		<div class="legal-header">
			<a href="/login" class="back-link">&larr; Back</a>
			<div class="legal-tabs">
				<button
					class="tab-btn"
					class:active={activeTab === 'privacy'}
					onclick={() => activeTab = 'privacy'}
				>Privacy Policy</button>
				<button
					class="tab-btn"
					class:active={activeTab === 'legal'}
					onclick={() => activeTab = 'legal'}
				>Legal Notice</button>
			</div>
		</div>
		<div class="legal-content markdown-body">
			{#if activeTab === 'privacy'}
				{@html privacyHtml}
			{:else}
				{@html legalHtml}
			{/if}
		</div>
	</div>
</div>

<style>
	.legal-page {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		min-height: 100vh;
		padding: 40px 20px;
	}

	.legal-card {
		width: 100%;
		max-width: 720px;
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.legal-header {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border);
	}

	.back-link {
		font-size: 13px;
		color: var(--text-muted);
		text-decoration: none;
		flex-shrink: 0;
	}

	.back-link:hover {
		color: var(--accent);
	}

	.legal-tabs {
		display: flex;
		gap: 4px;
	}

	.tab-btn {
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		border-radius: var(--radius-sm);
		transition: color var(--transition), background-color var(--transition);
	}

	.tab-btn:hover {
		color: var(--text-primary);
		background: var(--accent-soft);
	}

	.tab-btn.active {
		color: var(--accent);
		background: var(--accent-soft);
	}

	.legal-content {
		padding: 24px;
		font-size: 14px;
		line-height: 1.7;
		color: var(--text-secondary);
		max-height: 80vh;
		overflow-y: auto;
	}

	.legal-content :global(h1) {
		font-size: 22px;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 16px;
	}

	.legal-content :global(h2) {
		font-size: 17px;
		font-weight: 700;
		color: var(--text-primary);
		margin-top: 24px;
		margin-bottom: 8px;
	}

	.legal-content :global(h3) {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-primary);
		margin-top: 16px;
		margin-bottom: 6px;
	}

	.legal-content :global(p) {
		margin-bottom: 12px;
	}

	.legal-content :global(ul) {
		padding-left: 20px;
		margin-bottom: 12px;
	}

	.legal-content :global(li) {
		margin-bottom: 4px;
	}

	.legal-content :global(strong) {
		color: var(--text-primary);
	}
</style>
