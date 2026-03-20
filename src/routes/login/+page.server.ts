import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthDb } from '$lib/server/db';
import { getAuthMeta } from '$lib/server/auth-schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(307, '/');
	}

	const db = getAuthDb();
	return {
		legalEnabled: getAuthMeta(db, 'legal_enabled') === 'true'
	};
};
