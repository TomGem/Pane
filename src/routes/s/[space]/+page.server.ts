import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import type { Category, Item, Tag, CategoryWithItems } from '$lib/types';

export const load: PageServerLoad = async ({ params }) => {
	const db = getDb(params.space);

	const categories = db.prepare(
		`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
		 FROM categories c WHERE c.parent_id IS NULL ORDER BY c.sort_order`
	).all() as (Category & { children_count: number })[];

	const categoryIds = categories.map((c) => c.id);

	// Only load items belonging to root-level categories (not all items in DB)
	let allItems: Item[] = [];
	if (categoryIds.length > 0) {
		const placeholders = categoryIds.map(() => '?').join(',');
		allItems = db.prepare(
			`SELECT * FROM items WHERE category_id IN (${placeholders}) ORDER BY sort_order`
		).all(...categoryIds) as Item[];
	}

	let childCategories: Category[] = [];
	if (categoryIds.length > 0) {
		const placeholders = categoryIds.map(() => '?').join(',');
		childCategories = db.prepare(
			`SELECT * FROM categories WHERE parent_id IN (${placeholders}) ORDER BY sort_order`
		).all(...categoryIds) as Category[];
	}

	const tags = db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];

	// Attach tags to items using Map for O(n+m) instead of O(n*m)
	if (allItems.length > 0) {
		const itemTags = db.prepare('SELECT item_id, tag_id FROM item_tags').all() as { item_id: number; tag_id: number }[];
		const tagMap = new Map(tags.map((t) => [t.id, t]));
		const itemTagMap = new Map<number, Tag[]>();

		for (const it of itemTags) {
			const tag = tagMap.get(it.tag_id);
			if (!tag) continue;
			const arr = itemTagMap.get(it.item_id);
			if (arr) arr.push(tag);
			else itemTagMap.set(it.item_id, [tag]);
		}

		for (const item of allItems) {
			item.tags = itemTagMap.get(item.id) ?? [];
		}
	}

	const columns: CategoryWithItems[] = categories.map((cat) => ({
		...cat,
		items: allItems.filter((i) => i.category_id === cat.id),
		children: childCategories.filter((ch) => ch.parent_id === cat.id)
	}));

	return { columns, tags, allItems };
};
