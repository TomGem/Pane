<script lang="ts">
	import TagInput from './TagInput.svelte';
	import type { Item, Tag, Category } from '$lib/types';

	interface Props {
		item?: Item | null;
		categoryId?: number | null;
		categories: Category[];
		tags: Tag[];
		onsubmit?: (data: { type: string; title: string; content?: string; description?: string; category_id: number; tags?: number[]; file?: File }) => void;
		oncancel?: () => void;
		oncreatetag?: (name: string, color: string) => Promise<Tag>;
	}

	let { item = null, categoryId = null, categories, tags, onsubmit, oncancel, oncreatetag }: Props = $props();

	// svelte-ignore state_referenced_locally — intentional initial-value capture; component remounts each time modal opens
	let type = $state(item?.type ?? 'note');
	// svelte-ignore state_referenced_locally
	let title = $state(item?.title ?? '');
	// svelte-ignore state_referenced_locally
	let content = $state(item?.content ?? '');
	// svelte-ignore state_referenced_locally
	let description = $state(item?.description ?? '');
	// svelte-ignore state_referenced_locally
	let selectedCategoryId = $state(item?.category_id ?? categoryId ?? (categories[0]?.id ?? 0));
	// svelte-ignore state_referenced_locally
	let selectedTagIds = $state<number[]>(item?.tags?.map((t) => t.id) ?? []);
	let file = $state<File | null>(null);

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			file = input.files[0];
			if (!title) title = file.name;
		}
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!title.trim()) return;
		if (type === 'document' && !file && !item) return;
		onsubmit?.({
			type,
			title: title.trim(),
			content: content.trim() || undefined,
			description: description.trim() || undefined,
			category_id: selectedCategoryId,
			tags: selectedTagIds,
			file: file ?? undefined
		});
	}
</script>

<form class="item-form" onsubmit={handleSubmit}>
	<div class="form-group">
		<label class="form-label" for="item-type">Type</label>
		<div class="type-selector" role="radiogroup" aria-label="Item type">
			<button type="button" class="type-btn" class:active={type === 'link'} role="radio" aria-checked={type === 'link'} onclick={() => type = 'link'}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
					<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
				</svg>
				Link
			</button>
			<button type="button" class="type-btn" class:active={type === 'note'} role="radio" aria-checked={type === 'note'} onclick={() => type = 'note'}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<polyline points="14 2 14 8 20 8" />
				</svg>
				Note
			</button>
			<button type="button" class="type-btn" class:active={type === 'document'} role="radio" aria-checked={type === 'document'} onclick={() => type = 'document'}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
					<polyline points="13 2 13 9 20 9" />
				</svg>
				Document
			</button>
		</div>
	</div>

	<div class="form-group">
		<label class="form-label" for="item-category">Category</label>
		<select id="item-category" class="input" bind:value={selectedCategoryId}>
			{#each categories as cat}
				<option value={cat.id}>{cat.name}</option>
			{/each}
		</select>
	</div>

	<div class="form-group">
		<label class="form-label" for="item-title">Title</label>
		<input id="item-title" class="input" type="text" bind:value={title} placeholder="Enter title..." required />
	</div>

	{#if type === 'link'}
		<div class="form-group">
			<label class="form-label" for="item-url">URL</label>
			<input id="item-url" class="input" type="url" bind:value={content} placeholder="https://..." />
		</div>
	{:else if type === 'note'}
		<div class="form-group">
			<label class="form-label" for="item-content">Content</label>
			<textarea id="item-content" class="input textarea" bind:value={content} placeholder="Write your note..." rows="4"></textarea>
		</div>
	{:else if type === 'document'}
		<div class="form-group">
			<label class="form-label" for="item-file">File</label>
			<input id="item-file" class="input file-input" type="file" onchange={handleFileChange} />
			{#if item?.file_name}
				<span class="current-file">Current: {item.file_name}</span>
			{/if}
		</div>
	{/if}

	<div class="form-group">
		<label class="form-label" for="item-desc">Description</label>
		<input id="item-desc" class="input" type="text" bind:value={description} placeholder="Brief description (optional)" />
	</div>

	<div class="form-group">
		<label class="form-label" for="item-tags">Tags</label>
		<TagInput id="item-tags" {tags} bind:selectedIds={selectedTagIds} oncreate={oncreatetag} />
	</div>

	<div class="form-actions">
		<button type="button" class="btn" onclick={oncancel}>Cancel</button>
		<button type="submit" class="btn btn-primary" disabled={!title.trim()}>
			{item ? 'Update' : 'Create'}
		</button>
	</div>
</form>

<style>
	.item-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.form-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.textarea {
		resize: vertical;
		min-height: 80px;
	}

	.type-selector {
		display: flex;
		gap: 6px;
	}

	.type-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		transition: all var(--transition);
	}

	.type-btn:hover {
		border-color: var(--accent);
	}

	.type-btn.active {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}

	.type-btn svg {
		display: inline;
	}

	.file-input {
		padding: 6px;
	}

	.current-file {
		font-size: 12px;
		color: var(--text-muted);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding-top: 8px;
	}
</style>
