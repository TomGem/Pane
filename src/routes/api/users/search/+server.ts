import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 1) return json({ users: [] });

	const authDb = getAuthDb();
	const users = authDb.prepare(`
		SELECT id, display_name, email FROM users
		WHERE id != ? AND blocked = 0 AND display_name LIKE ? ESCAPE '\\'
		ORDER BY display_name COLLATE NOCASE
		LIMIT 8
	`).all(locals.userId, `%${q.replace(/[%_\\]/g, '\\$&')}%`) as { id: string; display_name: string; email: string }[];

	return json({ users });
};
