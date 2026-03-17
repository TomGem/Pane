import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserDb, validateSpaceSlug, listSpaces } from '$lib/server/db';
import { spaceExists } from '$lib/server/user-schema';
import { deleteSpaceDir } from '$lib/server/storage';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });
		const { name } = await request.json();

		if (!name || typeof name !== 'string' || !name.trim()) {
			return json({ error: 'Name is required' }, { status: 400 });
		}

		const slug = params.slug;
		if (!validateSpaceSlug(slug)) {
			return json({ error: 'Space not found' }, { status: 404 });
		}

		const db = getUserDb(locals.userId);
		if (!spaceExists(db, slug)) {
			return json({ error: 'Space not found' }, { status: 404 });
		}

		db.prepare('UPDATE spaces SET display_name = ?, updated_at = datetime(?) WHERE slug = ?')
			.run(name.trim(), new Date().toISOString(), slug);

		return json({ slug, name: name.trim() });
	} catch (err) {
		console.error('Failed to rename space:', err);
		return json({ error: 'Failed to rename space' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });
		const slug = params.slug;
		if (!validateSpaceSlug(slug)) {
			return json({ error: 'Space not found' }, { status: 404 });
		}

		const db = getUserDb(locals.userId);
		if (!spaceExists(db, slug)) {
			return json({ error: 'Space not found' }, { status: 404 });
		}

		// Guard: cannot delete the last space
		const spaces = listSpaces(locals.userId);
		if (spaces.length <= 1) {
			return json({ error: 'Cannot delete the last space' }, { status: 400 });
		}

		// Delete space (CASCADE handles categories, items, item_tags)
		db.prepare('DELETE FROM spaces WHERE slug = ?').run(slug);

		// Remove storage dir
		deleteSpaceDir(locals.userId, slug);

		return json({ success: true });
	} catch (err) {
		console.error('Failed to delete space:', err);
		return json({ error: 'Failed to delete space' }, { status: 500 });
	}
};
