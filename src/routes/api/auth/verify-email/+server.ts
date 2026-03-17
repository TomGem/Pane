import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.userId) {
			return json({ error: 'Not logged in' }, { status: 401 });
		}

		const { code } = await request.json();
		if (!code || typeof code !== 'string') {
			return json({ error: 'Verification code is required' }, { status: 400 });
		}

		const authDb = getAuthDb();

		// Find valid verification code
		const verification = authDb.prepare(
			'SELECT * FROM email_verifications WHERE user_id = ? AND code = ? AND expires_at > datetime(?)'
		).get(locals.userId, code.trim(), new Date().toISOString()) as { id: number } | undefined;

		if (!verification) {
			return json({ error: 'Invalid or expired verification code' }, { status: 400 });
		}

		// Mark email as verified
		authDb.prepare('UPDATE users SET email_verified = 1, updated_at = datetime(?) WHERE id = ?')
			.run(new Date().toISOString(), locals.userId);

		// Clean up verification codes for this user
		authDb.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(locals.userId);

		return json({ success: true, email_verified: true });
	} catch (err) {
		console.error('Email verification failed:', err);
		return json({ error: 'Verification failed' }, { status: 500 });
	}
};
