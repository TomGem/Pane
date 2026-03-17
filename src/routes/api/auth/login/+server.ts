import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';
import { verifyPassword } from '$lib/server/auth';
import { createSession, getSessionCookieOptions } from '$lib/server/session';
import type { User } from '$lib/types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			return json({ error: 'Email and password are required' }, { status: 400 });
		}

		const authDb = getAuthDb();
		const normalizedEmail = email.toLowerCase().trim();

		const user = authDb.prepare(
			'SELECT * FROM users WHERE email = ?'
		).get(normalizedEmail) as User & { password_hash: string } | undefined;

		if (!user) {
			return json({ error: 'Invalid email or password' }, { status: 401 });
		}

		const validPassword = await verifyPassword(password, user.password_hash);
		if (!validPassword) {
			return json({ error: 'Invalid email or password' }, { status: 401 });
		}

		if (user.blocked) {
			return json({ error: 'Your account has been blocked' }, { status: 403 });
		}

		// Create session
		const { sessionId, expiresAt } = createSession(user.id);
		cookies.set('pane_session', sessionId, getSessionCookieOptions(expiresAt));

		return json({
			user: {
				id: user.id,
				email: user.email,
				display_name: user.display_name,
				role: user.role
			},
			email_verified: !!user.email_verified
		});
	} catch (err) {
		console.error('Login failed:', err);
		return json({ error: 'Login failed' }, { status: 500 });
	}
};
