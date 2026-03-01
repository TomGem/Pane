import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGlobalDb } from '$lib/server/db';
import type { Tag } from '$lib/types';

export const GET: RequestHandler = async () => {
	try {
		const db = getGlobalDb();
		const tags = db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
		return json(tags);
	} catch (err) {
		console.error('Failed to fetch tags:', err);
		return json({ error: 'Failed to fetch tags' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { name, color } = await request.json();

		if (!name || !color) {
			return json({ error: 'Name and color are required' }, { status: 400 });
		}

		const db = getGlobalDb();

		const result = db.prepare(
			'INSERT INTO tags (name, color) VALUES (?, ?)'
		).run(name, color);

		const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag;

		return json(tag, { status: 201 });
	} catch (err) {
		if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
			return json({ error: 'A tag with that name already exists' }, { status: 409 });
		}
		console.error('Failed to create tag:', err);
		return json({ error: 'Failed to create tag' }, { status: 500 });
	}
};
