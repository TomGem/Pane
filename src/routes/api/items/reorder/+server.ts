import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSpaceAccess, requireWriteAccess } from '$lib/server/space';
import { moveFile } from '$lib/server/storage';
import type { Item, Category, ReorderMove } from '$lib/types';
import { emit } from '$lib/server/events';

export const PUT: RequestHandler = async ({ request, url, locals }) => {
	try {
		const { moves } = await request.json() as { moves: ReorderMove[] };

		if (!Array.isArray(moves) || moves.length === 0) {
			return json({ error: 'moves must be a non-empty array' }, { status: 400 });
		}

		const access = resolveSpaceAccess(locals, url);
		requireWriteAccess(access);
		const { db, spaceSlug, ownerId } = access;

		const fileMoves: { item: Item; newCategorySlug: string; moveId: number }[] = [];

		const reorder = db.transaction((movesToApply: ReorderMove[]) => {
			const getItem = db.prepare('SELECT i.* FROM items i JOIN categories c ON i.category_id = c.id WHERE i.id = ? AND c.space_slug = ?');
			const getCategory = db.prepare('SELECT * FROM categories WHERE id = ? AND space_slug = ?');
			const updateItem = db.prepare(
				'UPDATE items SET category_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
			);

			for (const move of movesToApply) {
				const item = getItem.get(move.id, spaceSlug) as Item | undefined;
				if (!item) continue;

				if (move.category_id !== item.category_id && item.file_path) {
					const newCategory = getCategory.get(move.category_id, spaceSlug) as Category | undefined;
					if (newCategory) {
						fileMoves.push({ item: { ...item }, newCategorySlug: newCategory.slug, moveId: move.id });
					}
				}

				updateItem.run(move.category_id, move.sort_order, move.id);
			}
		});

		reorder(moves);

		if (fileMoves.length > 0) {
			const updateFilePaths = db.transaction(() => {
				const updateFilePath = db.prepare('UPDATE items SET file_path = ? WHERE id = ?');
				for (const { item, newCategorySlug, moveId } of fileMoves) {
					const newFilePath = moveFile(ownerId, spaceSlug, item.file_path!, newCategorySlug);
					updateFilePath.run(newFilePath, moveId);
				}
			});
			updateFilePaths();
		}

		emit(access.ownerId, access.spaceSlug, { type: 'item:reordered', timestamp: Date.now() }, locals.userId);
		return json({ success: true });
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to reorder items:', err);
		return json({ error: 'Failed to reorder items' }, { status: 500 });
	}
};
