import type { LayoutServerLoad } from './$types';
import type { StorageQuotaInfo } from '$lib/types';
import { getUserStorageUsage, getUserQuota } from '$lib/server/db';

export const load: LayoutServerLoad = async ({ locals }) => {
	let storage: StorageQuotaInfo | null = null;
	if (locals.userId && locals.userId !== 'single-user') {
		storage = {
			used_bytes: getUserStorageUsage(locals.userId),
			quota_bytes: getUserQuota(locals.userId)
		};
	}

	return {
		user: locals.user,
		storage
	};
};
