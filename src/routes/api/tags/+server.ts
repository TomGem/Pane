import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb } from '$lib/server/space';
import type { Tag } from '$lib/types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const db = getSpaceDb(url);
		const tags = db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
		return json(tags);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch tags';
		return json({ error: message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const { name, color } = await request.json();

		if (!name || !color) {
			return json({ error: 'Name and color are required' }, { status: 400 });
		}

		const db = getSpaceDb(url);

		const result = db.prepare(
			'INSERT INTO tags (name, color) VALUES (?, ?)'
		).run(name, color);

		const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag;

		return json(tag, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to create tag';
		return json({ error: message }, { status: 500 });
	}
};
