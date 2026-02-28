import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import type { Category, Item, Tag, CategoryWithItems } from '$lib/types';

export const load: PageServerLoad = async () => {
	const db = getDb();

	const categories = db.prepare(
		`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
		 FROM categories c WHERE c.parent_id IS NULL ORDER BY c.sort_order`
	).all() as (Category & { children_count: number })[];

	const categoryIds = categories.map((c) => c.id);

	const allItems = db.prepare('SELECT * FROM items ORDER BY sort_order').all() as Item[];

	let childCategories: Category[] = [];
	if (categoryIds.length > 0) {
		const placeholders = categoryIds.map(() => '?').join(',');
		childCategories = db.prepare(
			`SELECT * FROM categories WHERE parent_id IN (${placeholders}) ORDER BY sort_order`
		).all(...categoryIds) as Category[];
	}

	const tags = db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];

	// Attach tags to items
	if (allItems.length > 0) {
		const itemTags = db.prepare('SELECT item_id, tag_id FROM item_tags').all() as { item_id: number; tag_id: number }[];
		const tagMap = new Map(tags.map((t) => [t.id, t]));

		for (const item of allItems) {
			item.tags = itemTags
				.filter((it) => it.item_id === item.id)
				.map((it) => tagMap.get(it.tag_id))
				.filter(Boolean) as Tag[];
		}
	}

	const columns: CategoryWithItems[] = categories.map((cat) => ({
		...cat,
		items: allItems.filter((i) => i.category_id === cat.id),
		children: childCategories.filter((ch) => ch.parent_id === cat.id)
	}));

	return { columns, tags, allItems };
};
