import { json } from '@sveltejs/kit';
import { randomUUID, randomInt } from 'crypto';
import type { RequestHandler } from './$types';
import { getAuthDb, createUserDb } from '$lib/server/db';
import { createSpace } from '$lib/server/user-schema';
import { hashPassword } from '$lib/server/auth';
import { createSession, getSessionCookieOptions } from '$lib/server/session';
import { sendVerificationEmail } from '$lib/server/email';

const MAX_EMAIL_LENGTH = 320;
const MAX_NAME_LENGTH = 255;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { email, password, display_name, invite_code } = await request.json();

		if (!email || !password || !display_name) {
			return json({ error: 'Email, password, and display name are required' }, { status: 400 });
		}

		if (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH || !email.includes('@')) {
			return json({ error: 'Invalid email address' }, { status: 400 });
		}

		if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
			return json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 });
		}
		if (password.length > MAX_PASSWORD_LENGTH) {
			return json({ error: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters` }, { status: 400 });
		}

		if (typeof display_name !== 'string' || !display_name.trim() || display_name.length > MAX_NAME_LENGTH) {
			return json({ error: 'Invalid display name' }, { status: 400 });
		}

		const authDb = getAuthDb();
		const normalizedEmail = email.toLowerCase().trim();

		// Check if email already exists
		const existing = authDb.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
		if (existing) {
			return json({ error: 'An account with this email already exists' }, { status: 409 });
		}

		// Check if this is the first user (becomes admin, no invite code needed)
		const userCount = authDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
		const isFirstUser = userCount.count === 0;

		// Validate invite code (unless first user)
		if (!isFirstUser) {
			if (!invite_code || typeof invite_code !== 'string') {
				return json({ error: 'Invitation code is required' }, { status: 400 });
			}

			const code = authDb.prepare(
				'SELECT * FROM invite_codes WHERE code = ?'
			).get(invite_code) as { code: string; max_uses: number; use_count: number; expires_at: string | null } | undefined;

			if (!code) {
				return json({ error: 'Invalid invitation code' }, { status: 400 });
			}

			if (code.use_count >= code.max_uses) {
				return json({ error: 'This invitation code has been used up' }, { status: 400 });
			}

			if (code.expires_at && new Date(code.expires_at) < new Date()) {
				return json({ error: 'This invitation code has expired' }, { status: 400 });
			}

			// Increment use count
			authDb.prepare('UPDATE invite_codes SET use_count = use_count + 1 WHERE code = ?').run(invite_code);
		}

		// Create user
		const userId = randomUUID();
		const passwordHash = await hashPassword(password);
		const role = isFirstUser ? 'admin' : 'user';

		authDb.prepare(
			`INSERT INTO users (id, email, email_verified, password_hash, display_name, role)
			 VALUES (?, ?, 0, ?, ?, ?)`
		).run(userId, normalizedEmail, passwordHash, display_name.trim(), role);

		// Create user DB with default space
		const userDb = createUserDb(userId);
		createSpace(userDb, 'desk', 'Desk');

		// Generate verification code
		const verificationCode = String(randomInt(100000, 999999));
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
		authDb.prepare(
			'INSERT INTO email_verifications (user_id, code, expires_at) VALUES (?, ?, ?)'
		).run(userId, verificationCode, expiresAt.toISOString());

		// Send verification email
		await sendVerificationEmail(normalizedEmail, verificationCode, display_name.trim());

		// Create session (user can verify email while logged in)
		const { sessionId, expiresAt: sessionExpires } = createSession(userId);
		cookies.set('pane_session', sessionId, getSessionCookieOptions(sessionExpires));

		return json({
			user: { id: userId, email: normalizedEmail, display_name: display_name.trim(), role },
			email_verified: false
		}, { status: 201 });
	} catch (err) {
		console.error('Registration failed:', err);
		return json({ error: 'Registration failed' }, { status: 500 });
	}
};
