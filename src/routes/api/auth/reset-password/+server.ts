import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';
import { hashPassword } from '$lib/server/auth';
import { invalidateAllSessions } from '$lib/server/session';
import type { User } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { email, code, new_password } = await request.json();

		if (!email || !code || !new_password) {
			return json({ error: 'Email, code, and new password are required' }, { status: 400 });
		}

		if (new_password.length < 8 || new_password.length > 256) {
			return json({ error: 'Password must be between 8 and 256 characters' }, { status: 400 });
		}

		const authDb = getAuthDb();
		const normalizedEmail = email.toLowerCase().trim();

		const user = authDb.prepare(
			'SELECT * FROM users WHERE email = ?'
		).get(normalizedEmail) as User | undefined;

		if (!user) {
			return json({ error: 'Invalid or expired reset code' }, { status: 400 });
		}

		const reset = authDb.prepare(
			'SELECT * FROM password_resets WHERE user_id = ? AND code = ? AND expires_at > datetime(?)'
		).get(user.id, code.trim(), new Date().toISOString()) as { id: number } | undefined;

		if (!reset) {
			return json({ error: 'Invalid or expired reset code' }, { status: 400 });
		}

		const newHash = await hashPassword(new_password);

		const updatePassword = authDb.transaction(() => {
			authDb.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(?) WHERE id = ?')
				.run(newHash, new Date().toISOString(), user.id);
			authDb.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
		});
		updatePassword();

		// Invalidate all existing sessions
		invalidateAllSessions(user.id);

		return json({ success: true });
	} catch (err) {
		console.error('Reset password failed:', err);
		return json({ error: 'Failed to reset password' }, { status: 500 });
	}
};
