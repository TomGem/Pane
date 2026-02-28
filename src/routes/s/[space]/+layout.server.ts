import type { LayoutServerLoad } from './$types';
import { slugExists, listSpaces, getDb } from '$lib/server/db';
import { getMeta } from '$lib/server/schema';
import { error, redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ params }) => {
	const space = params.space;

	if (!slugExists(space)) {
		// Redirect to root which will find the first available space
		throw redirect(307, '/');
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
