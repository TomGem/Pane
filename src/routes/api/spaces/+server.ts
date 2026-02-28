import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listSpaces, createDb, validateSpaceSlug, slugExists } from '$lib/server/db';
import { ensureSpaceDir } from '$lib/server/storage';

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64) || 'space';
}

export const GET: RequestHandler = async () => {
	try {
		const spaces = listSpaces();
		return json(spaces);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to list spaces';
		return json({ error: message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { name } = await request.json();

		if (!name || typeof name !== 'string' || !name.trim()) {
			return json({ error: 'Name is required' }, { status: 400 });
		}

		let slug = generateSlug(name.trim());
		if (!validateSpaceSlug(slug)) {
			return json({ error: 'Invalid name — use letters, numbers, and dashes' }, { status: 400 });
		}

		// Ensure unique slug
		let finalSlug = slug;
		let suffix = 2;
		while (slugExists(finalSlug)) {
			finalSlug = `${slug}-${suffix}`;
			suffix++;
		}

		createDb(finalSlug, name.trim());
		ensureSpaceDir(finalSlug);

		return json({ slug: finalSlug, name: name.trim() }, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to create space';
		return json({ error: message }, { status: 500 });
	}
};
