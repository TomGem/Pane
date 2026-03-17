import type Database from 'better-sqlite3';
import { getUserDb, getAuthDb, validateSpaceSlug } from './db';
import { spaceExists } from './user-schema';
import { error } from '@sveltejs/kit';

export function getSpaceSlug(url: URL): string {
	const slug = url.searchParams.get('space');
	if (!slug) {
		throw error(400, 'Missing space parameter');
	}
	if (!validateSpaceSlug(slug)) {
		throw error(400, 'Invalid space slug');
	}
	return slug;
}

export type SpacePermission = 'owner' | 'read' | 'write';

export interface SpaceAccess {
	db: Database.Database;
	spaceSlug: string;
	permission: SpacePermission;
	ownerId: string;
}

export function resolveSpaceAccess(locals: App.Locals, url: URL): SpaceAccess {
	if (!locals.userId) {
		throw error(401, 'Unauthorized');
	}

	const spaceSlug = getSpaceSlug(url);
	const ownerId = url.searchParams.get('owner');

	if (!ownerId || ownerId === locals.userId) {
		// Own space
		const db = getUserDb(locals.userId);
		if (!spaceExists(db, spaceSlug)) {
			throw error(404, 'Space not found');
		}
		return { db, spaceSlug, permission: 'owner', ownerId: locals.userId };
	}

	// Shared space — check auth DB
	const authDb = getAuthDb();
	const share = authDb.prepare(
		'SELECT permission FROM space_shares WHERE owner_id = ? AND space_slug = ? AND shared_with = ?'
	).get(ownerId, spaceSlug, locals.userId) as { permission: 'read' | 'write' } | undefined;

	if (!share) {
		throw error(403, 'Access denied');
	}

	const db = getUserDb(ownerId);
	if (!spaceExists(db, spaceSlug)) {
		throw error(404, 'Space not found');
	}

	return { db, spaceSlug, permission: share.permission, ownerId };
}

export function requireWriteAccess(access: SpaceAccess) {
	if (access.permission === 'read') {
		throw error(403, 'Read-only access');
	}
}
