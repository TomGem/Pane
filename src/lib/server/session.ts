import { randomUUID } from 'crypto';
import { getAuthDb } from './db';
import type { User } from '$lib/types';

const SESSION_MAX_AGE_DAYS = 30;

export function createSession(userId: string): { sessionId: string; expiresAt: Date } {
	const authDb = getAuthDb();
	const sessionId = randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

	authDb.prepare(
		'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
	).run(sessionId, userId, expiresAt.toISOString());

	return { sessionId, expiresAt };
}

export function validateSession(sessionId: string): User | null {
	const authDb = getAuthDb();
	const row = authDb.prepare(`
		SELECT u.id, u.email, u.email_verified, u.display_name, u.role, u.blocked, u.storage_quota_bytes, u.show_email, u.avatar_path, u.created_at, u.updated_at, s.expires_at
		FROM sessions s
		JOIN users u ON s.user_id = u.id
		WHERE s.id = ?
	`).get(sessionId) as (User & { expires_at: string }) | undefined;

	if (!row) return null;

	if (new Date(row.expires_at) < new Date()) {
		authDb.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
		return null;
	}

	return {
		id: row.id,
		email: row.email,
		email_verified: row.email_verified,
		display_name: row.display_name,
		role: row.role,
		blocked: row.blocked,
		storage_quota_bytes: row.storage_quota_bytes,
		show_email: row.show_email,
		avatar_path: row.avatar_path ?? null,
		created_at: row.created_at,
		updated_at: row.updated_at
	};
}

export function invalidateSession(sessionId: string) {
	const authDb = getAuthDb();
	authDb.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function invalidateAllSessions(userId: string) {
	const authDb = getAuthDb();
	authDb.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function cleanExpiredSessions() {
	const authDb = getAuthDb();
	authDb.prepare('DELETE FROM sessions WHERE expires_at < datetime(?)').run(new Date().toISOString());
}

export function getSessionCookieOptions(expiresAt: Date): {
	path: string;
	httpOnly: boolean;
	sameSite: 'lax';
	secure: boolean;
	expires: Date;
} {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: typeof process !== 'undefined' && process.env.NODE_ENV === 'production',
		expires: expiresAt
	};
}
