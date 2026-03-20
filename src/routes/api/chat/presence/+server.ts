import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { resolveSpaceAccess } from '$lib/server/space';
import { getAuthDb } from '$lib/server/db';
import { getSpaceSubscribers } from '$lib/server/events';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.userId) throw error(401, 'Unauthorized');

	const access = resolveSpaceAccess(locals, url);
	const userIds = getSpaceSubscribers(access.ownerId, access.spaceSlug);

	if (userIds.length === 0) {
		return json([]);
	}

	const authDb = getAuthDb();
	const placeholders = userIds.map(() => '?').join(',');
	const users = authDb.prepare(
		`SELECT id, display_name, avatar_path FROM users WHERE id IN (${placeholders})`
	).all(...userIds);

	return json(users);
};
