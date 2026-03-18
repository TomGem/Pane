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
	const authDb = getAuthDb();

	// Query share counts for all owned spaces in one go
	const shareCounts = authDb.prepare(
		'SELECT space_slug, COUNT(*) as count FROM space_shares WHERE owner_id = ? GROUP BY space_slug'
	).all(locals.userId) as { space_slug: string; count: number }[];
	const shareCountMap = new Map(shareCounts.map((r) => [r.space_slug, r.count]));

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
			itemCount: itemRow.count,
			shareCount: shareCountMap.get(s.slug) ?? 0
		};
	});
	const shares = authDb.prepare(`
		SELECT ss.id AS share_id, ss.owner_id, ss.space_slug, ss.permission, u.display_name AS owner_name
		FROM space_shares ss
		JOIN users u ON u.id = ss.owner_id
		WHERE ss.shared_with = ?
	`).all(locals.userId) as { share_id: number; owner_id: string; space_slug: string; permission: 'read' | 'write'; owner_name: string }[];

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
					share_id: share.share_id,
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
