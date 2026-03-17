import { json } from '@sveltejs/kit';
import { randomInt } from 'crypto';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';
import { sendVerificationEmail } from '$lib/server/email';
import type { User } from '$lib/types';

export const POST: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.userId) {
			return json({ error: 'Not logged in' }, { status: 401 });
		}

		const authDb = getAuthDb();

		const user = authDb.prepare('SELECT * FROM users WHERE id = ?').get(locals.userId) as User | undefined;
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		if (user.email_verified) {
			return json({ error: 'Email already verified' }, { status: 400 });
		}

		// Rate limit: only one code per 60 seconds
		const recentCode = authDb.prepare(
			"SELECT id FROM email_verifications WHERE user_id = ? AND created_at > datetime(?, '-60 seconds')"
		).get(locals.userId, new Date().toISOString());

		if (recentCode) {
			return json({ error: 'Please wait before requesting a new code' }, { status: 429 });
		}

		// Delete old codes
		authDb.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(locals.userId);

		// Generate new code
		const code = String(randomInt(100000, 999999));
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
		authDb.prepare(
			'INSERT INTO email_verifications (user_id, code, expires_at) VALUES (?, ?, ?)'
		).run(locals.userId, code, expiresAt.toISOString());

		await sendVerificationEmail(user.email, code, user.display_name);

		return json({ success: true });
	} catch (err) {
		console.error('Failed to resend verification:', err);
		return json({ error: 'Failed to resend verification email' }, { status: 500 });
	}
};
