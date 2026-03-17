import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const authDb = getAuthDb();
	const result = authDb.prepare('DELETE FROM invite_codes WHERE code = ?').run(params.code);

	if (result.changes === 0) {
		return json({ error: 'Invite code not found' }, { status: 404 });
	}

	return json({ success: true });
};
