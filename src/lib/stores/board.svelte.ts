import type { CategoryWithItems, Category, Item, Tag, ReorderMove, BreadcrumbSegment } from '$lib/types';
import { api } from '$lib/utils/api';

function spaceParam(spaceSlug: string): string {
	return `space=${encodeURIComponent(spaceSlug)}`;
}

function withSpace(url: string, spaceSlug: string): string {
	return url.includes('?') ? `${url}&${spaceParam(spaceSlug)}` : `${url}?${spaceParam(spaceSlug)}`;
}

export function createBoardStore(initial: CategoryWithItems[], initialAllItems?: Item[], spaceSlug: string = 'desk') {
	let columns = $state<CategoryWithItems[]>(initial);
	let allItems = $state<Item[]>(initialAllItems ?? initial.flatMap((c) => c.items));
	let allTags = $state<Tag[]>([]);
	let currentParentId = $state<number | null>(null);
	let breadcrumb = $state<BreadcrumbSegment[]>([]);

	async function loadTags() {
		allTags = await api<Tag[]>(withSpace('/api/tags', spaceSlug));
	}

	async function refresh() {
		const parentParam = currentParentId === null ? 'null' : String(currentParentId);
		const [cats, fetchedItems] = await Promise.all([
			api<(Category & { children_count: number })[]>(withSpace(`/api/categories?parent_id=${parentParam}`, spaceSlug)),
			api<Item[]>(withSpace('/api/items', spaceSlug))
		]);
		allItems = fetchedItems;
		const allCats = await api<Category[]>(withSpace('/api/categories', spaceSlug));

		// When drilled into a category, include it as the first column so its direct items are visible
		let displayCats = cats;
		if (currentParentId !== null) {
			const parentCat = allCats.find((c) => c.id === currentParentId);
			if (parentCat) {
				displayCats = [parentCat as Category & { children_count: number }, ...cats];
			}
		}

		const catIds = new Set(displayCats.map((c) => c.id));
		const childCats = allCats.filter((c) => c.parent_id !== null && catIds.has(c.parent_id));
		columns = displayCats.map((cat) => ({
			...cat,
			items: fetchedItems.filter((i) => i.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order),
			// Don't show subcategory cards on the parent column — they're already separate columns
			children: cat.id === currentParentId ? [] : childCats.filter((ch) => ch.parent_id === cat.id)
		}));
	}

	// Categories
	async function addCategory(name: string, color: string) {
		await api<Category>(withSpace('/api/categories', spaceSlug), {
			method: 'POST',
			body: JSON.stringify({ name, color, parent_id: currentParentId })
		});
		await refresh();
	}

	async function addSubcategory(name: string, color: string, parentId: number) {
		await api<Category>(withSpace('/api/categories', spaceSlug), {
			method: 'POST',
			body: JSON.stringify({ name, color, parent_id: parentId })
		});
		await refresh();
	}

	async function updateCategory(id: number, name: string, color: string) {
		await api<Category>(withSpace(`/api/categories/${id}`, spaceSlug), {
			method: 'PUT',
			body: JSON.stringify({ name, color })
		});
		await refresh();
	}

	async function deleteCategory(id: number) {
		await api(withSpace(`/api/categories/${id}`, spaceSlug), { method: 'DELETE' });
		await refresh();
	}

	async function reorderCategories(orderedIds: number[]) {
		await api(withSpace('/api/categories/reorder', spaceSlug), {
			method: 'PUT',
			body: JSON.stringify({ orderedIds })
		});
	}

	// Navigation
	async function drillDown(categoryId: number) {
		currentParentId = categoryId;
		await Promise.all([
			refresh(),
			fetchBreadcrumb(categoryId)
		]);
	}

	async function navigateTo(parentId: number | null) {
		currentParentId = parentId;
		if (parentId === null) {
			breadcrumb = [];
		} else {
			await fetchBreadcrumb(parentId);
		}
		await refresh();
	}

	async function fetchBreadcrumb(categoryId: number) {
		breadcrumb = await api<BreadcrumbSegment[]>(withSpace(`/api/categories/${categoryId}/breadcrumb`, spaceSlug));
	}

	// Items
	async function addItem(data: { category_id: number; type: string; title: string; content?: string; description?: string; tags?: number[]; fetch_title?: boolean }) {
		await api<Item>(withSpace('/api/items', spaceSlug), {
			method: 'POST',
			body: JSON.stringify(data)
		});
		await refresh();
	}

	async function updateItem(id: number, data: Partial<Omit<Item, 'tags'>> & { tags?: number[] }) {
		await api<Item>(withSpace(`/api/items/${id}`, spaceSlug), {
			method: 'PUT',
			body: JSON.stringify(data)
		});
		await refresh();
	}

	async function deleteItem(id: number) {
		await api(withSpace(`/api/items/${id}`, spaceSlug), { method: 'DELETE' });
		await refresh();
	}

	async function reorderItems(moves: ReorderMove[]) {
		await api(withSpace('/api/items/reorder', spaceSlug), {
			method: 'PUT',
			body: JSON.stringify({ moves })
		});
		await refresh();
	}

	async function uploadFile(file: File, categoryId: number, title?: string, description?: string) {
		const form = new FormData();
		form.append('file', file);
		form.append('category_id', String(categoryId));
		if (title) form.append('title', title);
		if (description) form.append('description', description);

		await fetch(withSpace('/api/items/upload', spaceSlug), { method: 'POST', body: form });
		await refresh();
	}

	// Quick link from URL drop
	async function addLink(url: string, categoryId: number) {
		let title = url;
		try {
			const u = new URL(url);
			title = u.hostname + u.pathname;
		} catch { /* keep raw url as title */ }
		await addItem({ category_id: categoryId, type: 'link', title, content: url, fetch_title: true });
	}

	// Tags
	async function addTag(name: string, color: string) {
		const tag = await api<Tag>(withSpace('/api/tags', spaceSlug), {
			method: 'POST',
			body: JSON.stringify({ name, color })
		});
		allTags = [...allTags, tag];
		return tag;
	}

	return {
		get columns() { return columns; },
		set columns(v: CategoryWithItems[]) { columns = v; },
		get allItems() { return allItems; },
		get allTags() { return allTags; },
		get currentParentId() { return currentParentId; },
		get breadcrumb() { return breadcrumb; },
		get spaceSlug() { return spaceSlug; },
		refresh,
		loadTags,
		addCategory,
		addSubcategory,
		updateCategory,
		deleteCategory,
		reorderCategories,
		drillDown,
		navigateTo,
		addItem,
		updateItem,
		deleteItem,
		reorderItems,
		uploadFile,
		addLink,
		addTag
	};
}

export type BoardStore = ReturnType<typeof createBoardStore>;
