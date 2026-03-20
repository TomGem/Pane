import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';
import { getAuthMeta } from '$lib/server/auth-schema';

export const GET: RequestHandler = async () => {
	const db = getAuthDb();
	const enabled = getAuthMeta(db, 'legal_enabled') === 'true';

	if (!enabled) {
		return json({ enabled: false });
	}

	return json({
		enabled: true,
		privacy_policy: getAuthMeta(db, 'privacy_policy') ?? '',
		legal_notice: getAuthMeta(db, 'legal_notice') ?? ''
	});
};
