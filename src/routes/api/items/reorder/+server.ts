import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb, getSpaceSlug } from '$lib/server/space';
import { moveFile } from '$lib/server/storage';
import type { Item, Category, ReorderMove } from '$lib/types';

export const PUT: RequestHandler = async ({ request, url }) => {
	try {
		const { moves } = await request.json() as { moves: ReorderMove[] };

		if (!Array.isArray(moves) || moves.length === 0) {
			return json({ error: 'moves must be a non-empty array' }, { status: 400 });
		}

		const spaceSlug = getSpaceSlug(url);
		const db = getSpaceDb(url);

		// Collect file moves to perform outside the transaction
		const fileMoves: { item: Item; newCategorySlug: string; moveId: number }[] = [];

		const reorder = db.transaction((movesToApply: ReorderMove[]) => {
			const getItem = db.prepare('SELECT * FROM items WHERE id = ?');
			const getCategory = db.prepare('SELECT * FROM categories WHERE id = ?');
			const updateItem = db.prepare(
				'UPDATE items SET category_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
			);

			for (const move of movesToApply) {
				const item = getItem.get(move.id) as Item | undefined;
				if (!item) continue;

				// Track file moves to perform after transaction commits
				if (move.category_id !== item.category_id && item.file_path) {
					const newCategory = getCategory.get(move.category_id) as Category | undefined;
					if (newCategory) {
						fileMoves.push({ item: { ...item }, newCategorySlug: newCategory.slug, moveId: move.id });
					}
				}

				updateItem.run(move.category_id, move.sort_order, move.id);
			}
		});

		reorder(moves);

		// Move files after transaction committed successfully
		if (fileMoves.length > 0) {
			const updateFilePath = db.prepare('UPDATE items SET file_path = ? WHERE id = ?');
			for (const { item, newCategorySlug, moveId } of fileMoves) {
				const newFilePath = moveFile(spaceSlug, item.file_path!, newCategorySlug);
				updateFilePath.run(newFilePath, moveId);
			}
		}

		return json({ success: true });
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to reorder items:', err);
		return json({ error: 'Failed to reorder items' }, { status: 500 });
	}
};
