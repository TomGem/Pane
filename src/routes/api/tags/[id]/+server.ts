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
		const message = err instanceof Error ? err.message : 'Failed to update tag';
		return json({ error: message }, { status: 500 });
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
		const message = err instanceof Error ? err.message : 'Failed to delete tag';
		return json({ error: message }, { status: 500 });
	}
};
