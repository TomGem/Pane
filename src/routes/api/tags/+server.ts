import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSpaceAccess, requireWriteAccess } from '$lib/server/space';
import type { Tag } from '$lib/types';
import { emit } from '$lib/server/events';
import { logChange } from '$lib/server/changelog';

const MAX_NAME_LENGTH = 255;
const MAX_COLOR_LENGTH = 50;

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const { db } = resolveSpaceAccess(locals, url);
		const tags = db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
		return json(tags);
	} catch (err) {
		console.error('Failed to fetch tags:', err);
		return json({ error: 'Failed to fetch tags' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals, url }) => {
	try {
		const access = resolveSpaceAccess(locals, url);
		requireWriteAccess(access);

		const { name, color } = await request.json();

		if (!name || !color) {
			return json({ error: 'Name and color are required' }, { status: 400 });
		}

		if (typeof name === 'string' && name.length > MAX_NAME_LENGTH) {
			return json({ error: `Name exceeds maximum length of ${MAX_NAME_LENGTH} characters` }, { status: 400 });
		}
		if (typeof color === 'string' && color.length > MAX_COLOR_LENGTH) {
			return json({ error: `Color exceeds maximum length of ${MAX_COLOR_LENGTH} characters` }, { status: 400 });
		}

		const result = access.db.prepare(
			'INSERT INTO tags (name, color) VALUES (?, ?)'
		).run(name, color);

		const tag = access.db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag;

		emit(access.ownerId, access.spaceSlug, { type: 'tag:created', timestamp: Date.now() }, locals.userId);
		logChange({ db: access.db, spaceSlug: access.spaceSlug, action: 'tag:created', entityType: 'tag', entityId: tag.id, entityTitle: tag.name, userId: locals.userId, userName: locals.user?.display_name });
		return json(tag, { status: 201 });
	} catch (err) {
		if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
			return json({ error: 'A tag with that name already exists' }, { status: 409 });
		}
		console.error('Failed to create tag:', err);
		return json({ error: 'Failed to create tag' }, { status: 500 });
	}
};
