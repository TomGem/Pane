import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';
import { invalidateAllSessions } from '$lib/server/session';

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const userId = params.id;

	// Prevent admin from blocking themselves
	if (userId === locals.user.id) {
		return json({ error: 'Cannot block yourself' }, { status: 400 });
	}

	const { blocked } = await request.json();
	if (typeof blocked !== 'boolean') {
		return json({ error: 'Invalid request: blocked must be a boolean' }, { status: 400 });
	}

	const authDb = getAuthDb();

	const user = authDb.prepare('SELECT id, role FROM users WHERE id = ?').get(userId) as { id: string; role: string } | undefined;
	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	// Prevent blocking other admins
	if (user.role === 'admin') {
		return json({ error: 'Cannot block an admin user' }, { status: 400 });
	}

	authDb.prepare('UPDATE users SET blocked = ?, updated_at = datetime(\'now\') WHERE id = ?').run(blocked ? 1 : 0, userId);

	// If blocking, invalidate all their sessions
	if (blocked) {
		invalidateAllSessions(userId);
	}

	return json({ success: true, blocked });
};
