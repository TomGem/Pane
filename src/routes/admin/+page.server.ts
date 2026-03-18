import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthDb, getUserStorageUsage } from '$lib/server/db';
import type { InviteCode, User } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin' || locals.singleUser) {
		throw redirect(307, '/');
	}

	const authDb = getAuthDb();

	const codes = authDb.prepare(
		'SELECT code, created_by, max_uses, use_count, expires_at, created_at FROM invite_codes ORDER BY created_at DESC'
	).all() as InviteCode[];

	const users = authDb.prepare(
		'SELECT id, email, email_verified, display_name, role, blocked, storage_quota_bytes, created_at, updated_at FROM users ORDER BY created_at DESC'
	).all() as User[];

	const storageUsage: Record<string, number> = {};
	for (const user of users) {
		try {
			storageUsage[user.id] = getUserStorageUsage(user.id);
		} catch {
			storageUsage[user.id] = 0;
		}
	}

	return { codes, users, storageUsage };
};
