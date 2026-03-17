import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthDb } from '$lib/server/db';
import type { InviteCode, User } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw redirect(307, '/');
	}

	const authDb = getAuthDb();

	const codes = authDb.prepare(
		'SELECT code, created_by, max_uses, use_count, expires_at, created_at FROM invite_codes ORDER BY created_at DESC'
	).all() as InviteCode[];

	const users = authDb.prepare(
		'SELECT id, email, email_verified, display_name, role, blocked, created_at, updated_at FROM users ORDER BY created_at DESC'
	).all() as User[];

	return { codes, users };
};
