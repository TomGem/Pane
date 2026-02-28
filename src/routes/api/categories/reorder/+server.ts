import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb } from '$lib/server/space';

export const PUT: RequestHandler = async ({ request, url }) => {
	try {
		const { orderedIds } = await request.json();

		if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
			return json({ error: 'orderedIds must be a non-empty array' }, { status: 400 });
		}

		const db = getSpaceDb(url);

		const reorder = db.transaction((ids: number[]) => {
			const stmt = db.prepare('UPDATE categories SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
			for (let i = 0; i < ids.length; i++) {
				stmt.run(i + 1, ids[i]);
			}
		});

		reorder(orderedIds);

		return json({ success: true });
	} catch (err) {
		console.error('Failed to reorder categories:', err);
		return json({ error: 'Failed to reorder categories' }, { status: 500 });
	}
};
