import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb, validateSpaceSlug } from '$lib/server/db';
import { emitToUser } from '$lib/server/events';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const slug = params.slug;
	if (!validateSpaceSlug(slug)) return json({ error: 'Invalid space slug' }, { status: 400 });

	try {
		const { permission } = await request.json();

		if (!permission || !['read', 'write'].includes(permission)) {
			return json({ error: 'Permission must be "read" or "write"' }, { status: 400 });
		}

		const authDb = getAuthDb();
		const result = authDb.prepare(
			'UPDATE space_shares SET permission = ? WHERE id = ? AND owner_id = ? AND space_slug = ?'
		).run(permission, params.id, locals.userId, slug);

		if (result.changes === 0) {
			return json({ error: 'Share not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (err) {
		console.error('Failed to update share:', err);
		return json({ error: 'Failed to update share' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const slug = params.slug;
	if (!validateSpaceSlug(slug)) return json({ error: 'Invalid space slug' }, { status: 400 });

	const authDb = getAuthDb();

	// Look up who the share belongs to before deleting
	const share = authDb.prepare(
		'SELECT shared_with, owner_id FROM space_shares WHERE id = ? AND space_slug = ? AND (owner_id = ? OR shared_with = ?)'
	).get(params.id, slug, locals.userId, locals.userId) as { shared_with: string; owner_id: string } | undefined;

	if (!share) {
		return json({ error: 'Share not found' }, { status: 404 });
	}

	authDb.prepare(
		'DELETE FROM space_shares WHERE id = ? AND space_slug = ?'
	).run(params.id, slug);

	// Notify the recipient that a share was removed
	emitToUser(share.shared_with, { type: 'share:removed', timestamp: Date.now() });

	return json({ success: true });
};
