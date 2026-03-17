import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserStorageUsage, getUserQuota } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.userId || locals.userId === 'single-user') {
		return json({ used_bytes: 0, quota_bytes: 0 }, { status: 200 });
	}

	return json({
		used_bytes: getUserStorageUsage(locals.userId),
		quota_bytes: getUserQuota(locals.userId)
	});
};
