import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const authDb = getAuthDb();
	const row = authDb.prepare('SELECT show_email FROM users WHERE id = ?').get(locals.userId) as { show_email: number } | undefined;

	return json({ show_email: row?.show_email ?? 0 });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json();
	const showEmail = body.show_email ? 1 : 0;

	const authDb = getAuthDb();
	authDb.prepare('UPDATE users SET show_email = ? WHERE id = ?').run(showEmail, locals.userId);

	return json({ show_email: showEmail });
};
