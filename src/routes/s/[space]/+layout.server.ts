import type { LayoutServerLoad } from './$types';
import { getUserDb, getAuthDb, listSpaces } from '$lib/server/db';
import { spaceExists } from '$lib/server/user-schema';
import { redirect } from '@sveltejs/kit';
import type { SpacePermission } from '$lib/server/space';

export const load: LayoutServerLoad = async ({ params, locals, url }) => {
	if (!locals.userId) {
		throw redirect(307, '/login');
	}

	const space = params.space;
	const ownerParam = url.searchParams.get('owner');

	let ownerId: string;
	let permission: SpacePermission;

	if (!ownerParam || ownerParam === locals.userId) {
		// Own space
		ownerId = locals.userId;
		permission = 'owner';
		const db = getUserDb(locals.userId);
		if (!spaceExists(db, space)) {
			throw redirect(307, '/');
		}
	} else {
		// Shared space — verify access
		ownerId = ownerParam;
		const authDb = getAuthDb();
		const share = authDb.prepare(
			'SELECT permission FROM space_shares WHERE owner_id = ? AND space_slug = ? AND shared_with = ?'
		).get(ownerId, space, locals.userId) as { permission: 'read' | 'write' } | undefined;

		if (!share) {
			throw redirect(307, '/');
		}

		permission = share.permission;
		const db = getUserDb(ownerId);
		if (!spaceExists(db, space)) {
			throw redirect(307, '/');
		}
	}

	const db = getUserDb(ownerId);
	const row = db.prepare('SELECT display_name FROM spaces WHERE slug = ?').get(space) as { display_name: string } | undefined;
	const spaceName = row?.display_name ?? space;
	const spaces = listSpaces(locals.userId);

	// Check if space has any shares
	let hasShares = false;
	if (ownerId === locals.userId) {
		const authDb = getAuthDb();
		const shareCount = authDb.prepare(
			'SELECT COUNT(*) as cnt FROM space_shares WHERE owner_id = ? AND space_slug = ?'
		).get(locals.userId, space) as { cnt: number };
		hasShares = shareCount.cnt > 0;
	}

	return {
		spaceSlug: space,
		spaceName,
		spaces,
		ownerId: ownerId !== locals.userId ? ownerId : undefined,
		permission,
		hasShares
	};
};
