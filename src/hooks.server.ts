import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getAuthDb, createUserDb, getUserDb, authDbExists, userDbExists } from '$lib/server/db';
import { createSpace } from '$lib/server/user-schema';
import { setAuthMeta, getAuthMeta } from '$lib/server/auth-schema';
import { isRateLimited } from '$lib/server/rate-limit';
import { needsMigration, runMigration } from '$lib/server/migration';
import { validateSession, invalidateSession, cleanExpiredSessions } from '$lib/server/session';
import fs from 'fs';

const SINGLE_USER = env.SINGLE_USER === 'true';
const SINGLE_USER_ID = 'single-user';

fs.mkdirSync('data', { recursive: true });
fs.mkdirSync('storage', { recursive: true });

// --- Startup: migration and initialization ---

if (SINGLE_USER) {
	// Single-user mode: ensure user DB exists with a default space
	const authDb = getAuthDb();
	const version = getAuthMeta(authDb, 'migration_version');

	if (needsMigration() && version !== '1') {
		runMigration();
	}

	// Ensure single-user DB exists
	if (!userDbExists(SINGLE_USER_ID)) {
		const db = createUserDb(SINGLE_USER_ID);
		createSpace(db, 'desk', 'Desk');
	}

	// Mark migration done if fresh install
	if (!getAuthMeta(authDb, 'migration_version')) {
		setAuthMeta(authDb, 'migration_version', '1');
	}
} else {
	// Multi-user mode
	if (!authDbExists() || needsMigration()) {
		runMigration();
	} else {
		// Ensure auth DB is initialized
		getAuthDb();
	}
}

// --- Session cleanup (every hour) ---
if (!SINGLE_USER) {
	setInterval(() => {
		try {
			cleanExpiredSessions();
		} catch { /* ignore */ }
	}, 60 * 60 * 1000);
}

// --- Request handler ---

const PUBLIC_PATHS = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/api/auth/'];

function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export const handle: Handle = async ({ event, resolve }) => {
	// Rate limiting for API routes
	if (event.url.pathname.startsWith('/api/')) {
		const ip = event.getClientAddress();
		if (isRateLimited(ip)) {
			return new Response(JSON.stringify({ error: 'Too many requests' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
			});
		}
	}

	// Single-user mode: inject synthetic user, skip auth
	event.locals.singleUser = SINGLE_USER;

	if (SINGLE_USER) {
		event.locals.user = {
			id: SINGLE_USER_ID,
			email: 'local@localhost',
			display_name: 'Local User',
			role: 'admin',
			avatar_path: null
		};
		event.locals.userId = SINGLE_USER_ID;
		return resolve(event);
	}

	// Multi-user auth
	const sessionId = event.cookies.get('pane_session');
	if (sessionId) {
		const result = validateSession(sessionId);
		if (result) {
			if (result.blocked) {
				// Blocked user: destroy session and treat as unauthenticated
				invalidateSession(sessionId);
				event.cookies.delete('pane_session', { path: '/' });
			} else {
				event.locals.user = {
					id: result.id,
					email: result.email,
					display_name: result.display_name,
					role: result.role,
					avatar_path: result.avatar_path
				};
				event.locals.userId = result.id;
			}
		}
	}

	// Check if route requires auth
	if (!event.locals.user && !isPublicPath(event.url.pathname)) {
		if (event.url.pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw redirect(307, '/login');
	}

	return resolve(event);
};
