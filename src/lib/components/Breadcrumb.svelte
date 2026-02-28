<script lang="ts">
	import type { BreadcrumbSegment } from '$lib/types';

	interface Props {
		segments: BreadcrumbSegment[];
		onnavigate: (parentId: number | null) => void;
	}

	let { segments, onnavigate }: Props = $props();
</script>

{#if segments.length > 0}
	<nav class="breadcrumb">
		<button class="breadcrumb-link" onclick={() => onnavigate(null)}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
				<polyline points="9 22 9 12 15 12 15 22" />
			</svg>
			Home
		</button>
		{#each segments as segment, i}
			<span class="breadcrumb-sep">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="9 18 15 12 9 6" />
				</svg>
			</span>
			{#if i < segments.length - 1}
				<button class="breadcrumb-link" onclick={() => onnavigate(segment.id)}>
					{segment.name}
				</button>
			{:else}
				<span class="breadcrumb-current">{segment.name}</span>
			{/if}
		{/each}
	</nav>
{/if}

<style>
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 4px;
		font-size: 13px;
		flex-wrap: wrap;
	}

	.breadcrumb-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--accent);
		font-weight: 500;
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		transition: background-color var(--transition);
	}

	.breadcrumb-link:hover {
		background-color: var(--accent-soft);
	}

	.breadcrumb-sep {
		color: var(--text-muted);
		display: inline-flex;
		align-items: center;
	}

	.breadcrumb-current {
		color: var(--text-primary);
		font-weight: 600;
		padding: 2px 6px;
	}
</style>
