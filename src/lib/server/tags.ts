import type Database from 'better-sqlite3';
import type { Tag } from '$lib/types';

export function getTagsForItem(userDb: Database.Database, itemId: number): Tag[] {
	const tagIds = userDb.prepare('SELECT tag_id FROM item_tags WHERE item_id = ?').all(itemId) as { tag_id: number }[];
	if (tagIds.length === 0) return [];
	const placeholders = tagIds.map(() => '?').join(',');
	return userDb.prepare(`SELECT id, name, color FROM tags WHERE id IN (${placeholders})`).all(tagIds.map(r => r.tag_id)) as Tag[];
}

export function attachTagsBatched<T extends { id: number }>(userDb: Database.Database, items: T[]): (T & { tags: Tag[] })[] {
	if (items.length === 0) return [];

	const itemIds = items.map((i) => i.id);
	const placeholders = itemIds.map(() => '?').join(',');
	const allItemTags = userDb.prepare(
		`SELECT item_id, tag_id FROM item_tags WHERE item_id IN (${placeholders})`
	).all(itemIds) as { item_id: number; tag_id: number }[];

	if (allItemTags.length === 0) {
		return items.map((item) => ({ ...item, tags: [] }));
	}

	const uniqueTagIds = [...new Set(allItemTags.map((r) => r.tag_id))];
	const tagPlaceholders = uniqueTagIds.map(() => '?').join(',');
	const allTags = userDb.prepare(
		`SELECT id, name, color FROM tags WHERE id IN (${tagPlaceholders})`
	).all(uniqueTagIds) as Tag[];
	const tagMap = new Map(allTags.map((t) => [t.id, t]));

	const itemTagMap = new Map<number, Tag[]>();
	for (const { item_id, tag_id } of allItemTags) {
		const tag = tagMap.get(tag_id);
		if (tag) {
			const arr = itemTagMap.get(item_id) ?? [];
			arr.push(tag);
			itemTagMap.set(item_id, arr);
		}
	}

	return items.map((item) => ({
		...item,
		tags: itemTagMap.get(item.id) ?? []
	}));
}
