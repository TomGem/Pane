import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';
import { verifyPassword, hashPassword } from '$lib/server/auth';
import { invalidateAllSessions, createSession, getSessionCookieOptions } from '$lib/server/session';
import type { User } from '$lib/types';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { current_password, new_password } = await request.json();

		if (!current_password || !new_password) {
			return json({ error: 'Current password and new password are required' }, { status: 400 });
		}

		if (new_password.length < 8 || new_password.length > 256) {
			return json({ error: 'New password must be between 8 and 256 characters' }, { status: 400 });
		}

		const authDb = getAuthDb();
		const user = authDb.prepare(
			'SELECT * FROM users WHERE id = ?'
		).get(locals.user.id) as User & { password_hash: string } | undefined;

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		const validPassword = await verifyPassword(current_password, user.password_hash);
		if (!validPassword) {
			return json({ error: 'Current password is incorrect' }, { status: 401 });
		}

		const newHash = await hashPassword(new_password);
		authDb.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(?) WHERE id = ?')
			.run(newHash, new Date().toISOString(), user.id);

		// Invalidate all sessions and create a new one
		invalidateAllSessions(user.id);
		const { sessionId, expiresAt } = createSession(user.id);
		cookies.set('pane_session', sessionId, getSessionCookieOptions(expiresAt));

		return json({ success: true });
	} catch (err) {
		console.error('Change password failed:', err);
		return json({ error: 'Failed to change password' }, { status: 500 });
	}
};
