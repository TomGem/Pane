import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb, getSpaceSlug } from '$lib/server/space';
import { getGlobalDb } from '$lib/server/db';
import { moveFile, deleteFile } from '$lib/server/storage';
import type { Item, Tag, Category } from '$lib/types';

function getTagsForItem(spaceDb: ReturnType<typeof getSpaceDb>, itemId: number): Tag[] {
	const tagIds = spaceDb.prepare('SELECT tag_id FROM item_tags WHERE item_id = ?').all(itemId) as { tag_id: number }[];
	if (tagIds.length === 0) return [];
	const globalDb = getGlobalDb();
	const placeholders = tagIds.map(() => '?').join(',');
	return globalDb.prepare(`SELECT id, name, color FROM tags WHERE id IN (${placeholders})`).all(...tagIds.map(r => r.tag_id)) as Tag[];
}

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const numId = Number(params.id);
		if (isNaN(numId)) return json({ error: 'Invalid item id' }, { status: 400 });

		const db = getSpaceDb(url);
		const item = db.prepare('SELECT * FROM items WHERE id = ?').get(numId) as Item | undefined;

		if (!item) {
			return json({ error: 'Item not found' }, { status: 404 });
		}

		item.tags = getTagsForItem(db, item.id);

		return json(item);
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to fetch item:', err);
		return json({ error: 'Failed to fetch item' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, url }) => {
	try {
		const numId = Number(params.id);
		if (isNaN(numId)) return json({ error: 'Invalid item id' }, { status: 400 });

		const body = await request.json();
		const { title, content, description, category_id, is_pinned, tags } = body;

		const spaceSlug = getSpaceSlug(url);
		const db = getSpaceDb(url);

		const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(numId) as Item | undefined;
		if (!existing) {
			return json({ error: 'Item not found' }, { status: 404 });
		}

		// Validate tags against global DB before transaction
		if (Array.isArray(tags)) {
			const globalDb = getGlobalDb();
			const checkTag = globalDb.prepare('SELECT id FROM tags WHERE id = ?');
			for (const tagId of tags) {
				if (!checkTag.get(tagId)) {
					return json({ error: `Tag with id ${tagId} not found` }, { status: 400 });
				}
			}
		}

		const updateItem = db.transaction(() => {
			let newFilePath = existing.file_path;

			// If category changed and item has a file, move it
			if (category_id !== undefined && category_id !== existing.category_id && existing.file_path) {
				const newCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(category_id) as Category;
				if (newCategory) {
					newFilePath = moveFile(spaceSlug, existing.file_path, newCategory.slug);
				}
			}

			// Build UPDATE dynamically so we can distinguish "not provided" from "explicitly null"
			const fields: string[] = [];
			const values: unknown[] = [];

			if ('title' in body) { fields.push('title = ?'); values.push(title ?? null); }
			if ('content' in body) { fields.push('content = ?'); values.push(content ?? null); }
			if ('description' in body) { fields.push('description = ?'); values.push(description ?? null); }
			if (category_id !== undefined) { fields.push('category_id = ?'); values.push(category_id); }
			if (is_pinned !== undefined) { fields.push('is_pinned = ?'); values.push(is_pinned); }
			if (newFilePath !== existing.file_path) { fields.push('file_path = ?'); values.push(newFilePath); }

			if (fields.length > 0) {
				fields.push('updated_at = CURRENT_TIMESTAMP');
				values.push(numId);
				db.prepare(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
			}

			// Update tags if provided
			if (Array.isArray(tags)) {
				db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(numId);
				const insertTag = db.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)');
				for (const tagId of tags) {
					insertTag.run(numId, tagId);
				}
			}
		});

		updateItem();

		const item = db.prepare('SELECT * FROM items WHERE id = ?').get(numId) as Item;
		item.tags = getTagsForItem(db, item.id);

		return json(item);
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to update item:', err);
		return json({ error: 'Failed to update item' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	try {
		const numId = Number(params.id);
		if (isNaN(numId)) return json({ error: 'Invalid item id' }, { status: 400 });

		const spaceSlug = getSpaceSlug(url);
		const db = getSpaceDb(url);

		const item = db.prepare('SELECT * FROM items WHERE id = ?').get(numId) as Item | undefined;
		if (!item) {
			return json({ error: 'Item not found' }, { status: 404 });
		}

		if (item.file_path) {
			deleteFile(spaceSlug, item.file_path);
		}

		db.prepare('DELETE FROM items WHERE id = ?').run(numId);

		return json({ success: true });
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to delete item:', err);
		return json({ error: 'Failed to delete item' }, { status: 500 });
	}
};
