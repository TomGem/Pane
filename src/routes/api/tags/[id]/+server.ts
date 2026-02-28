import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb } from '$lib/server/space';
import type { Tag } from '$lib/types';

export const PUT: RequestHandler = async ({ params, request, url }) => {
	try {
		const numId = Number(params.id);
		if (isNaN(numId)) return json({ error: 'Invalid tag id' }, { status: 400 });

		const { name, color } = await request.json();

		if (!name || !color) {
			return json({ error: 'Name and color are required' }, { status: 400 });
		}

		const db = getSpaceDb(url);

		const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(numId) as Tag | undefined;
		if (!existing) {
			return json({ error: 'Tag not found' }, { status: 404 });
		}

		db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(name, color, numId);

		const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(numId) as Tag;

		return json(tag);
	} catch (err) {
		if (isHttpError(err)) throw err;
		if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
			return json({ error: 'A tag with that name already exists' }, { status: 409 });
		}
		console.error('Failed to update tag:', err);
		return json({ error: 'Failed to update tag' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	try {
		const numId = Number(params.id);
		if (isNaN(numId)) return json({ error: 'Invalid tag id' }, { status: 400 });

		const db = getSpaceDb(url);

		const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(numId) as Tag | undefined;
		if (!existing) {
			return json({ error: 'Tag not found' }, { status: 404 });
		}

		db.prepare('DELETE FROM tags WHERE id = ?').run(numId);

		return json({ success: true });
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to delete tag:', err);
		return json({ error: 'Failed to delete tag' }, { status: 500 });
	}
};
