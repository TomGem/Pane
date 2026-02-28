import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, closeDb, listSpaces, validateSpaceSlug, slugExists } from '$lib/server/db';
import { setMeta } from '$lib/server/schema';
import { deleteSpaceDir } from '$lib/server/storage';
import fs from 'fs';
import path from 'path';

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { name } = await request.json();

		if (!name || typeof name !== 'string' || !name.trim()) {
			return json({ error: 'Name is required' }, { status: 400 });
		}

		const slug = params.slug;
		if (!validateSpaceSlug(slug) || !slugExists(slug)) {
			return json({ error: 'Space not found' }, { status: 404 });
		}

		const db = getDb(slug);
		setMeta(db, 'display_name', name.trim());

		return json({ slug, name: name.trim() });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to rename space';
		return json({ error: message }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const slug = params.slug;
		if (!validateSpaceSlug(slug) || !slugExists(slug)) {
			return json({ error: 'Space not found' }, { status: 404 });
		}

		// Guard: cannot delete the last space
		const spaces = listSpaces();
		if (spaces.length <= 1) {
			return json({ error: 'Cannot delete the last space' }, { status: 400 });
		}

		closeDb(slug);

		// Remove DB files
		const dataDir = path.resolve('data');
		for (const ext of ['.db', '.db-wal', '.db-shm', '.db-journal']) {
			const filePath = path.join(dataDir, `${slug}${ext}`);
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		}

		// Remove storage dir
		deleteSpaceDir(slug);

		return json({ success: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to delete space';
		return json({ error: message }, { status: 500 });
	}
};
