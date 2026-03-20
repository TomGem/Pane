import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb, getDataDir, validateUserId } from '$lib/server/db';
import { invalidateAllSessions } from '$lib/server/session';
import fs from 'fs';
import path from 'path';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const userId = params.id;

	if (userId === locals.user.id) {
		return json({ error: 'Cannot delete your own account from admin panel' }, { status: 400 });
	}

	const authDb = getAuthDb();

	const user = authDb.prepare('SELECT id, role FROM users WHERE id = ?').get(userId) as { id: string; role: string } | undefined;
	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	if (user.role === 'admin') {
		return json({ error: 'Cannot delete an admin user' }, { status: 400 });
	}

	// Invalidate all sessions
	invalidateAllSessions(userId);

	// Delete all auth DB records
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

	return json({ success: true });
};
