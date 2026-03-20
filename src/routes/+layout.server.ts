import type { LayoutServerLoad } from './$types';
import type { StorageQuotaInfo } from '$lib/types';
import { getUserStorageUsage, getUserQuota, getAuthDb } from '$lib/server/db';
import { getAuthMeta } from '$lib/server/auth-schema';

export const load: LayoutServerLoad = async ({ locals }) => {
	let storage: StorageQuotaInfo | null = null;
	if (locals.userId) {
		storage = {
			used_bytes: getUserStorageUsage(locals.userId),
			quota_bytes: getUserQuota(locals.userId)
		};
	}

	const authDb = getAuthDb();
	return {
		user: locals.user,
		storage,
		singleUser: locals.singleUser,
		legalEnabled: getAuthMeta(authDb, 'legal_enabled') === 'true'
	};
};
