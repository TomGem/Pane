import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';
import { sendPasswordResetEmail } from '$lib/server/email';
import type { User } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { email } = await request.json();

		if (!email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		const authDb = getAuthDb();
		const normalizedEmail = email.toLowerCase().trim();

		const user = authDb.prepare(
			'SELECT * FROM users WHERE email = ?'
		).get(normalizedEmail) as User | undefined;

		// Always return success to prevent email enumeration
		if (!user) {
			return json({ success: true });
		}

		// Rate limit: max 1 code per 60 seconds
		const recent = authDb.prepare(
			'SELECT created_at FROM password_resets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
		).get(user.id) as { created_at: string } | undefined;

		if (recent) {
			const elapsed = Date.now() - new Date(recent.created_at + 'Z').getTime();
			if (elapsed < 60_000) {
				return json({ success: true });
			}
		}

		// Delete old codes and create new one
		authDb.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);

		const code = String(Math.floor(100000 + Math.random() * 900000));
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

		authDb.prepare(
			'INSERT INTO password_resets (user_id, code, expires_at) VALUES (?, ?, ?)'
		).run(user.id, code, expiresAt);

		await sendPasswordResetEmail(user.email, code, user.display_name);

		return json({ success: true });
	} catch (err) {
		console.error('Forgot password failed:', err);
		return json({ error: 'Failed to send reset code' }, { status: 500 });
	}
};
