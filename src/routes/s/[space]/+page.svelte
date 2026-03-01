<script lang="ts">
	import Board from '$lib/components/Board.svelte';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ItemForm from '$lib/components/ItemForm.svelte';
	import CategoryForm from '$lib/components/CategoryForm.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { createBoardStore } from '$lib/stores/board.svelte';
	import { getContext } from 'svelte';
	import type { CategoryWithItems, Item, Tag } from '$lib/types';
	import { page } from '$app/stores';

	let { data } = $props();

	const spaceSlug = $derived($page.data.spaceSlug as string);

	// svelte-ignore state_referenced_locally — intentionally capturing initial SSR data; store manages its own state after hydration
	const board = createBoardStore(data.columns, data.allItems, spaceSlug);
	const app = getContext<{ searchQuery: string; setSearchQuery: (query: string) => void; selectedTagIds: number[]; toggleTag: (tagId: number) => void; focusSearch: () => void; setAddCallback: (fn: () => void) => void; setAddCategoryCallback: (fn: () => void) => void; setTags: (tags: Tag[]) => void; setUpdateTag: (fn: (id: number, name: string, color: string) => Promise<Tag>) => void }>('app');

	let isNested = $derived(board.currentParentId !== null);

	// Sync tags to layout context whenever they change
	$effect(() => {
		app.setTags(board.allTags);
	});

	// Load tags on mount and register add callback
	$effect(() => {
		board.loadTags().catch((e: unknown) => console.error('Failed to load tags:', e));
		app.setAddCallback(() => {
			if (board.columns.length > 0) {
				handleAddItem(board.columns[0].id);
			} else {
				handleAddCategory();
			}
		});
		app.setAddCategoryCallback(() => {
			handleAddCategory();
		});
		app.setUpdateTag(board.updateTag);
	});

	// Modal state
	let showItemModal = $state(false);
	let showCategoryModal = $state(false);
	let showDeleteConfirm = $state(false);
	let editingItem = $state<Item | null>(null);
	let editingCategory = $state<CategoryWithItems | null>(null);
	let deletingItem = $state<Item | null>(null);
	let deletingCategory = $state<CategoryWithItems | null>(null);
	let defaultCategoryId = $state<number | null>(null);
	let subcategoryParentId = $state<number | null>(null);
	let subcategoryParentColor = $state<string | null>(null);

	// Sample data loading
	let loadingSampleData = $state(false);

	async function handleLoadSampleData() {
		loadingSampleData = true;
		try {
			const res = await fetch(`/api/seed?space=${spaceSlug}`, { method: 'POST' });
			const data = await res.json();
			if (!res.ok) {
				toast(data.error ?? 'Failed to load sample data', 'error');
				return;
			}
			await Promise.all([board.refresh(), board.loadTags()]);
			toast('Sample data loaded');
		} catch {
			toast('Failed to load sample data', 'error');
		} finally {
			loadingSampleData = false;
		}
	}

	// Toast
	let toasts = $state<{ id: number; message: string; type: 'success' | 'error' }[]>([]);
	let nextToastId = 0;

	function toast(message: string, type: 'success' | 'error' = 'success') {
		const id = nextToastId++;
		toasts = [...toasts, { id, message, type }];
		setTimeout(() => {
			toasts = toasts.filter((t) => t.id !== id);
		}, 3000);
	}

	// Navigation
	async function handleDrillDown(categoryId: number) {
		await board.drillDown(categoryId);
	}

	async function handleBreadcrumbNavigate(parentId: number | null) {
		await board.navigateTo(parentId);
	}

	// Item CRUD
	function handleAddItem(categoryId: number) {
		editingItem = null;
		defaultCategoryId = categoryId;
		showItemModal = true;
	}

	function handleEditItem(item: Item) {
		editingItem = item;
		defaultCategoryId = item.category_id;
		showItemModal = true;
	}

	function handleDeleteItem(item: Item) {
		deletingItem = item;
		showDeleteConfirm = true;
	}

	async function confirmDeleteItem() {
		if (!deletingItem) return;
		try {
			await board.deleteItem(deletingItem.id);
			toast('Item deleted');
		} catch (e) {
			console.error('Failed to delete item:', e);
			toast('Failed to delete item', 'error');
		}
		deletingItem = null;
		showDeleteConfirm = false;
	}

	async function handleItemSubmit(data: { type: string; title: string; content?: string; description?: string; category_id: number; tags?: number[]; file?: File }) {
		try {
			if (editingItem) {
				await board.updateItem(editingItem.id, { ...data, type: data.type as Item['type'] });
				toast('Item updated');
			} else if (data.type === 'document' && data.file) {
				await board.uploadFile(data.file, data.category_id, data.title, data.description);
				toast('Document uploaded');
			} else {
				await board.addItem(data.type === 'link' ? { ...data, fetch_title: true } : data);
				toast('Item created');
			}
			showItemModal = false;
			editingItem = null;
		} catch (e) {
			console.error('Failed to save item:', e);
			toast('Failed to save item', 'error');
		}
	}

	// Category CRUD
	function handleAddCategory() {
		editingCategory = null;
		// When inside a nested view, treat toolbar "add category" as adding a subcategory
		if (board.currentParentId !== null) {
			const parentCol = board.columns.find((c) => c.id === board.currentParentId);
			if (parentCol) {
				subcategoryParentId = parentCol.id;
				subcategoryParentColor = parentCol.color;
			}
		}
		showCategoryModal = true;
	}

	function handleAddSubcategory(category: CategoryWithItems) {
		editingCategory = null;
		subcategoryParentId = category.id;
		subcategoryParentColor = category.color;
		showCategoryModal = true;
	}

	function handleEditCategory(category: CategoryWithItems) {
		editingCategory = category;
		showCategoryModal = true;
	}

	function handleDeleteCategory(category: CategoryWithItems) {
		deletingCategory = category;
		showDeleteConfirm = true;
	}

	async function confirmDeleteCategory() {
		if (!deletingCategory) return;
		try {
			await board.deleteCategory(deletingCategory.id);
			toast('Category deleted');
		} catch (e) {
			console.error('Failed to delete category:', e);
			toast('Failed to delete category', 'error');
		}
		deletingCategory = null;
		showDeleteConfirm = false;
	}

	async function handleCategorySubmit(data: { name: string; color: string }) {
		try {
			if (editingCategory) {
				await board.updateCategory(editingCategory.id, data.name, data.color);
				toast('Category updated');
			} else if (subcategoryParentId !== null) {
				await board.addSubcategory(data.name, data.color, subcategoryParentId);
				toast('Subcategory created');
			} else {
				await board.addCategory(data.name, data.color);
				toast('Category created');
			}
			showCategoryModal = false;
			editingCategory = null;
			subcategoryParentId = null;
		subcategoryParentColor = null;
		} catch (e) {
			console.error('Failed to save category:', e);
			toast('Failed to save category', 'error');
		}
	}

	// Keyboard shortcuts
	function handleKeydown(e: KeyboardEvent) {
		const modalOpen = showItemModal || showCategoryModal || showDeleteConfirm;
		const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

		// When a modal is open, let the Modal component handle Escape; skip all other shortcuts
		if (modalOpen) return;

		if (e.key === 'Escape') {
			subcategoryParentId = null;
			subcategoryParentColor = null;
		}
		// Cmd/Ctrl+K — focus search
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			app.focusSearch();
		}
		// / — focus search (only when not typing in an input)
		if (e.key === '/' && !inInput) {
			e.preventDefault();
			app.focusSearch();
		}
		// Cmd/Ctrl+N — new item
		if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') {
			e.preventDefault();
			if (board.columns.length > 0) {
				handleAddItem(board.columns[0].id);
			} else {
				handleAddCategory();
			}
		}
		// Cmd/Ctrl+Shift+N — new category
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
			e.preventDefault();
			handleAddCategory();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="page">
	<Breadcrumb segments={board.breadcrumb} onnavigate={handleBreadcrumbNavigate} />

	{#if board.columns.length === 0}
		<div class="empty-board">
			<div class="empty-board-content glass">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="7" height="7" />
					<rect x="14" y="3" width="7" height="7" />
					<rect x="3" y="14" width="7" height="7" />
					<rect x="14" y="14" width="7" height="7" />
				</svg>
				<h2>{isNested ? 'No subcategories yet' : 'No categories yet'}</h2>
				<p>{isNested ? 'Create a subcategory to organize this level' : 'Create your first category to get started'}</p>
				<button class="btn btn-primary" onclick={handleAddCategory}>
					{isNested ? 'Create Subcategory' : 'Create Category'}
				</button>
				{#if !isNested}
					<div class="empty-board-divider">
						<span>or</span>
					</div>
					<button class="btn btn-outline" onclick={handleLoadSampleData} disabled={loadingSampleData}>
						{loadingSampleData ? 'Loading...' : 'Load Sample Data'}
					</button>
				{/if}
			</div>
		</div>
	{:else}
		<Board
			{board}
			{spaceSlug}
			searchQuery={app.searchQuery}
			selectedTagIds={app.selectedTagIds}
			onitemedit={handleEditItem}
			onitemdelete={handleDeleteItem}
			onadditem={handleAddItem}
			oneditcategory={handleEditCategory}
			ondeletecategory={handleDeleteCategory}
			onaddsubcategory={handleAddSubcategory}
			ondrilldown={handleDrillDown}
		/>
	{/if}
</div>

<!-- Item Modal -->
{#if showItemModal}
	<Modal title={editingItem ? 'Edit Item' : 'New Item'} onclose={() => { showItemModal = false; editingItem = null; }}>
		<ItemForm
			item={editingItem}
			categoryId={defaultCategoryId}
			categories={board.columns}
			tags={board.allTags}
			onsubmit={handleItemSubmit}
			oncancel={() => { showItemModal = false; editingItem = null; }}
			oncreatetag={async (name, color) => board.addTag(name, color)}
		/>
	</Modal>
{/if}

<!-- Category Modal -->
{#if showCategoryModal}
	<Modal title={editingCategory ? 'Edit Category' : (subcategoryParentId !== null || isNested ? 'New Subcategory' : 'New Category')} onclose={() => { showCategoryModal = false; editingCategory = null; subcategoryParentId = null; subcategoryParentColor = null; }}>
		<CategoryForm
			category={editingCategory}
			parentColor={subcategoryParentColor}
			onsubmit={handleCategorySubmit}
			oncancel={() => { showCategoryModal = false; editingCategory = null; subcategoryParentId = null; subcategoryParentColor = null; }}
		/>
	</Modal>
{/if}

<!-- Delete Confirmation -->
{#if showDeleteConfirm}
	<Modal title="Confirm Delete" onclose={() => { showDeleteConfirm = false; deletingItem = null; deletingCategory = null; }}>
		<div class="confirm-dialog">
			{#if deletingItem}
				<p>Delete <strong>{deletingItem.title}</strong>?</p>
				<p class="confirm-hint">This action cannot be undone.</p>
			{:else if deletingCategory}
				<p>Delete category <strong>{deletingCategory.name}</strong>?</p>
				{#if deletingCategory.children_count > 0}
					<p class="confirm-hint confirm-hint-warn">This category contains {deletingCategory.children_count} {deletingCategory.children_count === 1 ? 'subcategory' : 'subcategories'} that will also be deleted.</p>
				{/if}
				<p class="confirm-hint">All items in this category will be permanently deleted.</p>
			{/if}
			<div class="confirm-actions">
				<button class="btn" onclick={() => { showDeleteConfirm = false; deletingItem = null; deletingCategory = null; }}>Cancel</button>
				<button class="btn btn-danger" onclick={() => deletingItem ? confirmDeleteItem() : confirmDeleteCategory()}>Delete</button>
			</div>
		</div>
	</Modal>
{/if}

<!-- Toasts -->
<div class="toast-container" role="status" aria-live="polite">
	{#each toasts as t (t.id)}
		<Toast message={t.message} type={t.type} onclose={() => toasts = toasts.filter(x => x.id !== t.id)} />
	{/each}
</div>

<style>
	.page {
		flex: 1;
	}

	.empty-board {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
	}

	.empty-board-content {
		text-align: center;
		padding: 40px 60px;
		border-radius: var(--radius-lg);
		color: var(--text-muted);
	}

	.empty-board-content svg {
		margin: 0 auto 16px;
	}

	.empty-board-content h2 {
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.empty-board-content p {
		margin-bottom: 20px;
	}

	.empty-board-divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 16px 0;
		color: var(--text-muted);
		font-size: 13px;
	}

	.empty-board-divider::before,
	.empty-board-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.btn-outline {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text-secondary);
		padding: 8px 20px;
		border-radius: var(--radius);
		cursor: pointer;
		font-size: 14px;
		transition: all 0.15s ease;
	}

	.btn-outline:hover:not(:disabled) {
		border-color: var(--text-muted);
		color: var(--text-primary);
	}

	.btn-outline:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.confirm-dialog {
		padding: 4px 0;
	}

	.confirm-dialog p {
		margin-bottom: 8px;
		color: var(--text-primary);
	}

	.confirm-hint {
		font-size: 13px;
		color: var(--text-muted);
	}

	.confirm-hint-warn {
		color: var(--danger);
		font-weight: 500;
	}

	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 20px;
	}

	.toast-container {
		position: fixed;
		bottom: 20px;
		right: 20px;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
</style>
