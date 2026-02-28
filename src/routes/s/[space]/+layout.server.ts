import type { LayoutServerLoad } from './$types';
import { slugExists, listSpaces, getDb } from '$lib/server/db';
import { getMeta } from '$lib/server/schema';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ params }) => {
	const space = params.space;

	if (!slugExists(space)) {
		throw error(404, 'Space not found');
	}

	const db = getDb(space);
	const spaceName = getMeta(db, 'display_name') ?? space;
	const spaces = listSpaces();

	return {
		spaceSlug: space,
		spaceName,
		spaces
	};
};
