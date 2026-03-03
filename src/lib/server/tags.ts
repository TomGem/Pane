import type Database from 'better-sqlite3';
import { getGlobalDb } from './db';
import type { Tag } from '$lib/types';

export function getTagsForItem(spaceDb: Database.Database, itemId: number): Tag[] {
	const tagIds = spaceDb.prepare('SELECT tag_id FROM item_tags WHERE item_id = ?').all(itemId) as { tag_id: number }[];
	if (tagIds.length === 0) return [];
	const globalDb = getGlobalDb();
	const placeholders = tagIds.map(() => '?').join(',');
	return globalDb.prepare(`SELECT id, name, color FROM tags WHERE id IN (${placeholders})`).all(tagIds.map(r => r.tag_id)) as Tag[];
}

export function attachTagsBatched<T extends { id: number }>(spaceDb: Database.Database, items: T[]): (T & { tags: Tag[] })[] {
	if (items.length === 0) return [];

	const itemIds = items.map((i) => i.id);
	const placeholders = itemIds.map(() => '?').join(',');
	const allItemTags = spaceDb.prepare(
		`SELECT item_id, tag_id FROM item_tags WHERE item_id IN (${placeholders})`
	).all(itemIds) as { item_id: number; tag_id: number }[];

	if (allItemTags.length === 0) {
		return items.map((item) => ({ ...item, tags: [] }));
	}

	const uniqueTagIds = [...new Set(allItemTags.map((r) => r.tag_id))];
	const tagPlaceholders = uniqueTagIds.map(() => '?').join(',');
	const globalDb = getGlobalDb();
	const allTags = globalDb.prepare(
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
