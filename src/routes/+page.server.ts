import { listSpaces, getUserDb, getAuthDb } from '$lib/server/db';
import { createSpace } from '$lib/server/user-schema';
import type { PageServerLoad } from './$types';
import type { SpaceWithStats, SharedSpaceInfo } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.userId) return { spaces: [] as SpaceWithStats[], sharedSpaces: [] as SharedSpaceInfo[] };

	let spaces = listSpaces(locals.userId);

	if (spaces.length === 0) {
		const db = getUserDb(locals.userId);
		createSpace(db, 'desk', 'Desk');
		spaces = listSpaces(locals.userId);
	}

	const db = getUserDb(locals.userId);
	const spacesWithStats: SpaceWithStats[] = spaces.map((s) => {
		const catRow = db.prepare('SELECT COUNT(*) as count FROM categories WHERE space_slug = ?').get(s.slug) as { count: number };
		const itemRow = db.prepare(`
			SELECT COUNT(*) as count FROM items i
			JOIN categories c ON i.category_id = c.id
			WHERE c.space_slug = ?
		`).get(s.slug) as { count: number };
		return {
			...s,
			categoryCount: catRow.count,
			itemCount: itemRow.count
		};
	});

	// Load shared spaces
	const authDb = getAuthDb();
	const shares = authDb.prepare(`
		SELECT ss.owner_id, ss.space_slug, ss.permission, u.display_name AS owner_name
		FROM space_shares ss
		JOIN users u ON u.id = ss.owner_id
		WHERE ss.shared_with = ?
	`).all(locals.userId) as { owner_id: string; space_slug: string; permission: 'read' | 'write'; owner_name: string }[];

	const sharedSpaces: SharedSpaceInfo[] = [];
	for (const share of shares) {
		try {
			const ownerDb = getUserDb(share.owner_id);
			const row = ownerDb.prepare('SELECT display_name FROM spaces WHERE slug = ?')
				.get(share.space_slug) as { display_name: string } | undefined;
			if (row) {
				sharedSpaces.push({
					slug: share.space_slug,
					name: row.display_name,
					owner_id: share.owner_id,
					owner_name: share.owner_name,
					permission: share.permission
				});
			}
		} catch {
			// Owner DB may not exist anymore, skip
		}
	}

	return { spaces: spacesWithStats, sharedSpaces };
};
