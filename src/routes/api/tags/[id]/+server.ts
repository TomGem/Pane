import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb } from '$lib/server/space';
import type { Tag } from '$lib/types';

export const PUT: RequestHandler = async ({ params, request, url }) => {
	try {
		const { name, color } = await request.json();

		if (!name || !color) {
			return json({ error: 'Name and color are required' }, { status: 400 });
		}

		const db = getSpaceDb(url);

		const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(params.id) as Tag | undefined;
		if (!existing) {
			return json({ error: 'Tag not found' }, { status: 404 });
		}

		db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(name, color, params.id);

		const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(params.id) as Tag;

		return json(tag);
	} catch (err) {
		console.error('Failed to update tag:', err);
		return json({ error: 'Failed to update tag' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	try {
		const db = getSpaceDb(url);

		const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(params.id) as Tag | undefined;
		if (!existing) {
			return json({ error: 'Tag not found' }, { status: 404 });
		}

		db.prepare('DELETE FROM tags WHERE id = ?').run(params.id);

		return json({ success: true });
	} catch (err) {
		console.error('Failed to delete tag:', err);
		return json({ error: 'Failed to delete tag' }, { status: 500 });
	}
};
