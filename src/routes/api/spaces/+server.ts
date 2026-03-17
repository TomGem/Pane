import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserDb, validateSpaceSlug, listSpaces } from '$lib/server/db';
import { createSpace, spaceExists } from '$lib/server/user-schema';
import { ensureSpaceDir } from '$lib/server/storage';
import { slugify } from '$lib/utils/slugify';

const MAX_NAME_LENGTH = 255;

function generateSlug(name: string): string {
	return slugify(name).slice(0, 64) || 'space';
}

export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });
		const spaces = listSpaces(locals.userId);
		return json(spaces);
	} catch (err) {
		console.error('Failed to list spaces:', err);
		return json({ error: 'Failed to list spaces' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });
		const { name } = await request.json();

		if (!name || typeof name !== 'string' || !name.trim()) {
			return json({ error: 'Name is required' }, { status: 400 });
		}

		if (name.trim().length > MAX_NAME_LENGTH) {
			return json({ error: `Name exceeds maximum length of ${MAX_NAME_LENGTH} characters` }, { status: 400 });
		}

		let slug = generateSlug(name.trim());
		if (!validateSpaceSlug(slug)) {
			return json({ error: 'Invalid name — use letters, numbers, and dashes' }, { status: 400 });
		}

		const db = getUserDb(locals.userId);

		// Ensure unique slug within user's spaces
		let finalSlug = slug;
		let suffix = 2;
		while (spaceExists(db, finalSlug)) {
			const suffixStr = `-${suffix}`;
			const maxBaseLen = 64 - suffixStr.length;
			finalSlug = `${slug.slice(0, maxBaseLen)}${suffixStr}`;
			suffix++;
		}

		createSpace(db, finalSlug, name.trim());
		ensureSpaceDir(locals.userId, finalSlug);

		return json({ slug: finalSlug, name: name.trim() }, { status: 201 });
	} catch (err) {
		console.error('Failed to create space:', err);
		return json({ error: 'Failed to create space' }, { status: 500 });
	}
};
