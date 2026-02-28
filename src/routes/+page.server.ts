import { listSpaces, createDb, getDb } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	let spaces = listSpaces();

	if (spaces.length === 0) {
		createDb('pane', 'Pane');
		spaces = listSpaces();
	}

	const spacesWithStats = spaces.map((s) => {
		const db = getDb(s.slug);
		const catRow = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
		const itemRow = db.prepare('SELECT COUNT(*) as count FROM items').get() as { count: number };
		return {
			...s,
			categoryCount: catRow.count,
			itemCount: itemRow.count
		};
	});

	return { spaces: spacesWithStats };
};
