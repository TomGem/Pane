import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb, getUserStorageUsage } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const userId = params.id;
	const authDb = getAuthDb();

	const user = authDb.prepare('SELECT storage_quota_bytes FROM users WHERE id = ?').get(userId) as { storage_quota_bytes: number } | undefined;
	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	let used_bytes = 0;
	try {
		used_bytes = getUserStorageUsage(userId);
	} catch {
		// User DB may not exist
	}

	return json({ quota_bytes: user.storage_quota_bytes, used_bytes });
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const userId = params.id;
	const { quota_bytes } = await request.json();

	if (typeof quota_bytes !== 'number' || quota_bytes < 0 || !Number.isInteger(quota_bytes)) {
		return json({ error: 'Invalid request: quota_bytes must be a non-negative integer' }, { status: 400 });
	}

	const authDb = getAuthDb();

	const user = authDb.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: string } | undefined;
	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	authDb.prepare("UPDATE users SET storage_quota_bytes = ?, updated_at = datetime('now') WHERE id = ?").run(quota_bytes, userId);

	return json({ success: true, quota_bytes });
};
