import { redirect } from '@sveltejs/kit';
import { listSpaces, createDb } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	let spaces = listSpaces();

	if (spaces.length === 0) {
		createDb('pane', 'Pane');
		spaces = listSpaces();
	}

	throw redirect(307, `/s/${spaces[0].slug}`);
};
