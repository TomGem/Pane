import { json } from '@sveltejs/kit';
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

		const reorder = db.transaction((movesToApply: ReorderMove[]) => {
			const getItem = db.prepare('SELECT * FROM items WHERE id = ?');
			const getCategory = db.prepare('SELECT * FROM categories WHERE id = ?');
			const updateItem = db.prepare(
				'UPDATE items SET category_id = ?, sort_order = ?, file_path = COALESCE(?, file_path), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
			);

			for (const move of movesToApply) {
				const item = getItem.get(move.id) as Item | undefined;
				if (!item) continue;

				let newFilePath: string | null = null;

				// If category changed and item has a file, move it
				if (move.category_id !== item.category_id && item.file_path) {
					const newCategory = getCategory.get(move.category_id) as Category | undefined;
					if (newCategory) {
						newFilePath = moveFile(spaceSlug, item.file_path, newCategory.slug);
					}
				}

				updateItem.run(move.category_id, move.sort_order, newFilePath, move.id);
			}
		});

		reorder(moves);

		return json({ success: true });
	} catch (err) {
		console.error('Failed to reorder items:', err);
		return json({ error: 'Failed to reorder items' }, { status: 500 });
	}
};
