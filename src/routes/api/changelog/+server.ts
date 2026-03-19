import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSpaceAccess } from '$lib/server/space';
import { getChangelog } from '$lib/server/changelog';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const access = resolveSpaceAccess(locals, url);
		const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
		const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
		const entries = getChangelog(access.db, access.spaceSlug, limit, offset);
		return json(entries);
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to fetch changelog:', err);
		return json({ error: 'Failed to fetch changelog' }, { status: 500 });
	}
};
