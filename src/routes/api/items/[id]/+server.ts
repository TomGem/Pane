import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb, getSpaceSlug } from '$lib/server/space';
import { moveFile, deleteFile } from '$lib/server/storage';
import type { Item, Tag, Category } from '$lib/types';

function getTagsForItem(db: ReturnType<typeof getSpaceDb>, itemId: number): Tag[] {
	return db.prepare(
		`SELECT t.id, t.name, t.color
		 FROM tags t
		 INNER JOIN item_tags it ON it.tag_id = t.id
		 WHERE it.item_id = ?`
	).all(itemId) as Tag[];
}

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const db = getSpaceDb(url);
		const item = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id) as Item | undefined;

		if (!item) {
			return json({ error: 'Item not found' }, { status: 404 });
		}

		item.tags = getTagsForItem(db, item.id);

		return json(item);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch item';
		return json({ error: message }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, url }) => {
	try {
		const body = await request.json();
		const { title, content, description, category_id, is_pinned, tags } = body;

		const spaceSlug = getSpaceSlug(url);
		const db = getSpaceDb(url);

		const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id) as Item | undefined;
		if (!existing) {
			return json({ error: 'Item not found' }, { status: 404 });
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

			db.prepare(
				`UPDATE items SET
					title = COALESCE(?, title),
					content = COALESCE(?, content),
					description = COALESCE(?, description),
					category_id = COALESCE(?, category_id),
					is_pinned = COALESCE(?, is_pinned),
					file_path = COALESCE(?, file_path),
					updated_at = CURRENT_TIMESTAMP
				 WHERE id = ?`
			).run(
				title ?? null,
				content ?? null,
				description ?? null,
				category_id ?? null,
				is_pinned ?? null,
				newFilePath,
				params.id
			);

			// Update tags if provided
			if (Array.isArray(tags)) {
				db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(params.id);
				const insertTag = db.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)');
				for (const tagId of tags) {
					insertTag.run(params.id, tagId);
				}
			}
		});

		updateItem();

		const item = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id) as Item;
		item.tags = getTagsForItem(db, item.id);

		return json(item);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to update item';
		return json({ error: message }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	try {
		const spaceSlug = getSpaceSlug(url);
		const db = getSpaceDb(url);

		const item = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id) as Item | undefined;
		if (!item) {
			return json({ error: 'Item not found' }, { status: 404 });
		}

		if (item.file_path) {
			deleteFile(spaceSlug, item.file_path);
		}

		db.prepare('DELETE FROM items WHERE id = ?').run(params.id);

		return json({ success: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to delete item';
		return json({ error: message }, { status: 500 });
	}
};
