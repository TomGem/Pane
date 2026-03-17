import type { PageServerLoad } from './$types';
import { getUserDb } from '$lib/server/db';
import type { Category, Item, Tag, CategoryWithItems } from '$lib/types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
	if (!locals.userId) return { columns: [], tags: [], allItems: [] };

	const parentData = await parent();
	const targetUserId = parentData.ownerId ?? locals.userId;
	const db = getUserDb(targetUserId);
	const spaceSlug = params.space;

	const categories = db.prepare(
		`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
		 FROM categories c WHERE c.space_slug = ? AND c.parent_id IS NULL ORDER BY c.sort_order`
	).all(spaceSlug) as (Category & { children_count: number })[];

	const categoryIds = categories.map((c) => c.id);

	// Load all items for this space (including subcategory items) so search can match across the full tree
	const allItems = db.prepare(
		`SELECT i.* FROM items i
		 JOIN categories c ON i.category_id = c.id
		 WHERE c.space_slug = ?
		 ORDER BY i.sort_order`
	).all(spaceSlug) as Item[];

	let childCategories: Category[] = [];
	if (categoryIds.length > 0) {
		const placeholders = categoryIds.map(() => '?').join(',');
		childCategories = db.prepare(
			`SELECT * FROM categories WHERE parent_id IN (${placeholders}) ORDER BY sort_order`
		).all(...categoryIds) as Category[];
	}

	// Tags are per-user — use the owner's DB for shared spaces
	const tags = db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];

	// Attach tags to items using Map for O(n+m) instead of O(n*m)
	if (allItems.length > 0) {
		const itemIds = allItems.map((i) => i.id);
		const placeholders = itemIds.map(() => '?').join(',');
		const itemTags = db.prepare(
			`SELECT item_id, tag_id FROM item_tags WHERE item_id IN (${placeholders})`
		).all(...itemIds) as { item_id: number; tag_id: number }[];
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
