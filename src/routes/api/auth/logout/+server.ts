import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { invalidateSession } from '$lib/server/session';

export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('pane_session');
	if (sessionId) {
		invalidateSession(sessionId);
	}
	cookies.delete('pane_session', { path: '/' });
	return json({ success: true });
};
