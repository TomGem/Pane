import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthDb } from '$lib/server/db';
import { getAuthMeta } from '$lib/server/auth-schema';

export const load: PageServerLoad = async () => {
	const db = getAuthDb();
	const enabled = getAuthMeta(db, 'legal_enabled') === 'true';

	if (!enabled) {
		throw redirect(307, '/');
	}

	return {
		privacy_policy: getAuthMeta(db, 'privacy_policy') ?? '',
		legal_notice: getAuthMeta(db, 'legal_notice') ?? ''
	};
};
