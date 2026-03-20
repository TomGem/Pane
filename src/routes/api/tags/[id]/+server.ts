import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSpaceAccess, requireWriteAccess } from '$lib/server/space';
import type { Tag } from '$lib/types';
import { emit } from '$lib/server/events';
import { logChange } from '$lib/server/changelog';

const MAX_NAME_LENGTH = 255;
const COLOR_REGEX = /^#[0-9a-fA-F]{3,8}$/;

export const PUT: RequestHandler = async ({ params, request, locals, url }) => {
	try {
		const access = resolveSpaceAccess(locals, url);
		requireWriteAccess(access);

		const numId = Number(params.id);
		if (isNaN(numId)) return json({ error: 'Invalid tag id' }, { status: 400 });

		const { name, color } = await request.json();

		if (!name || !color) {
			return json({ error: 'Name and color are required' }, { status: 400 });
		}

		if (typeof name === 'string' && name.length > MAX_NAME_LENGTH) {
			return json({ error: `Name exceeds maximum length of ${MAX_NAME_LENGTH} characters` }, { status: 400 });
		}
		if (typeof color !== 'string' || !COLOR_REGEX.test(color)) {
			return json({ error: 'Color must be a valid hex color (e.g. #ff0000)' }, { status: 400 });
		}

		const existing = access.db.prepare('SELECT * FROM tags WHERE id = ?').get(numId) as Tag | undefined;
		if (!existing) {
			return json({ error: 'Tag not found' }, { status: 404 });
		}

		access.db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(name, color, numId);

		const tag = access.db.prepare('SELECT * FROM tags WHERE id = ?').get(numId) as Tag;

		emit(access.ownerId, access.spaceSlug, { type: 'tag:updated', timestamp: Date.now() }, locals.userId);
		logChange({ db: access.db, spaceSlug: access.spaceSlug, action: 'tag:updated', entityType: 'tag', entityId: tag.id, entityTitle: tag.name, userId: locals.userId, userName: locals.user?.display_name });
		return json(tag);
	} catch (err) {
		if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
			return json({ error: 'A tag with that name already exists' }, { status: 409 });
		}
		console.error('Failed to update tag:', err);
		return json({ error: 'Failed to update tag' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals, url }) => {
	try {
		const access = resolveSpaceAccess(locals, url);
		requireWriteAccess(access);

		const numId = Number(params.id);
		if (isNaN(numId)) return json({ error: 'Invalid tag id' }, { status: 400 });

		const existing = access.db.prepare('SELECT * FROM tags WHERE id = ?').get(numId) as Tag | undefined;
		if (!existing) {
			return json({ error: 'Tag not found' }, { status: 404 });
		}

		access.db.prepare('DELETE FROM tags WHERE id = ?').run(numId);

		emit(access.ownerId, access.spaceSlug, { type: 'tag:deleted', timestamp: Date.now() }, locals.userId);
		logChange({ db: access.db, spaceSlug: access.spaceSlug, action: 'tag:deleted', entityType: 'tag', entityId: numId, entityTitle: existing.name, userId: locals.userId, userName: locals.user?.display_name });
		return json({ success: true });
	} catch (err) {
		console.error('Failed to delete tag:', err);
		return json({ error: 'Failed to delete tag' }, { status: 500 });
	}
};
