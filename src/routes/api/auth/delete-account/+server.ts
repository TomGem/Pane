import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb, getDataDir, validateUserId } from '$lib/server/db';
import { verifyPassword } from '$lib/server/auth';
import { invalidateAllSessions } from '$lib/server/session';
import type { User } from '$lib/types';
import fs from 'fs';
import path from 'path';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { password } = await request.json();

		if (!password) {
			return json({ error: 'Password is required' }, { status: 400 });
		}

		const authDb = getAuthDb();
		const user = authDb.prepare(
			'SELECT * FROM users WHERE id = ?'
		).get(locals.user.id) as (User & { password_hash: string }) | undefined;

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		const validPassword = await verifyPassword(password, user.password_hash);
		if (!validPassword) {
			return json({ error: 'Incorrect password' }, { status: 401 });
		}

		const userId = user.id;

		// Invalidate all sessions
		invalidateAllSessions(userId);

		// Delete all auth DB records (CASCADE handles sessions, email_verifications,
		// password_resets, oauth_accounts, chat_messages, space_shares where user is shared_with)
		// But we also need to delete space_shares where user is the owner
		authDb.transaction(() => {
			authDb.prepare('DELETE FROM space_shares WHERE owner_id = ?').run(userId);
			authDb.prepare('DELETE FROM users WHERE id = ?').run(userId);
		})();

		// Delete user database file
		if (validateUserId(userId)) {
			const dbPath = path.join(getDataDir(), `${userId}.db`);
			for (const suffix of ['', '-wal', '-shm']) {
				const filePath = dbPath + suffix;
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			}
		}

		// Delete user storage directory
		const storageDir = path.resolve('storage', userId);
		if (fs.existsSync(storageDir)) {
			fs.rmSync(storageDir, { recursive: true, force: true });
		}

		// Delete avatar (stored at storage/{userId}/avatar.*)
		// Already covered by removing the storage directory above

		// Clear session cookie
		cookies.delete('pane_session', { path: '/' });

		return json({ success: true });
	} catch (err) {
		console.error('Account deletion failed:', err);
		return json({ error: 'Failed to delete account' }, { status: 500 });
	}
};
