<script lang="ts">
	import type { Tag } from '$lib/types';

	interface Props {
		id?: string;
		tags: Tag[];
		selectedIds: number[];
		onchange?: (ids: number[]) => void;
		oncreate?: (name: string, color: string) => Promise<Tag>;
	}

	let { id, tags, selectedIds = $bindable([]), onchange, oncreate }: Props = $props();

	let inputValue = $state('');
	let showDropdown = $state(false);
	let filtered = $derived(
		tags.filter((t) =>
			!selectedIds.includes(t.id) &&
			t.name.toLowerCase().includes(inputValue.toLowerCase())
		)
	);

	let selectedTags = $derived(tags.filter((t) => selectedIds.includes(t.id)));

	function selectTag(tag: Tag) {
		selectedIds = [...selectedIds, tag.id];
		inputValue = '';
		showDropdown = false;
		onchange?.(selectedIds);
	}

	function removeTag(tagId: number) {
		selectedIds = selectedIds.filter((id) => id !== tagId);
		onchange?.(selectedIds);
	}

	async function createTag() {
		if (!inputValue.trim() || !oncreate) return;
		const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
		const color = colors[Math.floor(Math.random() * colors.length)];
		const tag = await oncreate(inputValue.trim(), color);
		selectedIds = [...selectedIds, tag.id];
		inputValue = '';
		showDropdown = false;
		onchange?.(selectedIds);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (filtered.length > 0) {
				selectTag(filtered[0]);
			} else if (inputValue.trim() && oncreate) {
				createTag();
			}
		}
		if (e.key === 'Backspace' && !inputValue && selectedIds.length > 0) {
			removeTag(selectedIds[selectedIds.length - 1]);
		}
	}
</script>

<div class="tag-input-wrapper">
	<div class="tag-input-selected">
		{#each selectedTags as tag (tag.id)}
			<span class="tag-chip" style:background-color="{tag.color}20" style:color={tag.color}>
				{tag.name}
				<button class="tag-remove" onclick={() => removeTag(tag.id)} aria-label="Remove {tag.name}" title="Remove {tag.name}">×</button>
			</span>
		{/each}
		<input
			{id}
			class="tag-text-input"
			type="text"
			placeholder={selectedIds.length === 0 ? 'Add tags...' : ''}
			bind:value={inputValue}
			onfocus={() => showDropdown = true}
			onblur={() => setTimeout(() => showDropdown = false, 200)}
			onkeydown={handleKeydown}
		/>
	</div>
	{#if showDropdown && (filtered.length > 0 || (inputValue.trim() && oncreate))}
		<div class="tag-dropdown glass-strong">
			{#each filtered as tag (tag.id)}
				<button class="tag-option" onmousedown={(e) => { e.preventDefault(); selectTag(tag); }}>
					<span class="tag-dot" style:background-color={tag.color}></span>
					{tag.name}
				</button>
			{/each}
			{#if inputValue.trim() && !tags.some(t => t.name.toLowerCase() === inputValue.trim().toLowerCase()) && oncreate}
				<button class="tag-option tag-create" onmousedown={(e) => { e.preventDefault(); createTag(); }}>
					+ Create "{inputValue.trim()}"
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.tag-input-wrapper {
		position: relative;
	}

	.tag-input-selected {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 6px 8px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		min-height: 38px;
		align-items: center;
		cursor: text;
		transition: border-color var(--transition), box-shadow var(--transition);
	}

	.tag-input-selected:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px 8px;
		font-size: 12px;
		font-weight: 500;
		border-radius: 9999px;
	}

	.tag-remove {
		font-size: 14px;
		line-height: 1;
		margin-left: 2px;
		opacity: 0.7;
	}

	.tag-remove:hover {
		opacity: 1;
	}

	.tag-text-input {
		flex: 1;
		min-width: 60px;
		border: none;
		outline: none;
		background: transparent;
		font-size: 13px;
		color: var(--text-primary);
		padding: 2px 4px;
	}

	.tag-text-input::placeholder {
		color: var(--text-muted);
	}

	.tag-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 50;
		margin-top: 4px;
		max-height: 200px;
		overflow-y: auto;
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		padding: 4px;
	}

	.tag-option {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		font-size: 13px;
		color: var(--text-primary);
		border-radius: var(--radius-sm);
		text-align: left;
		transition: background-color var(--transition);
	}

	.tag-option:hover {
		background-color: var(--accent-soft);
	}

	.tag-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.tag-create {
		color: var(--accent);
		font-weight: 500;
	}
</style>
