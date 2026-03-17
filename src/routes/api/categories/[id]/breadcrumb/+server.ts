import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSpaceAccess } from '$lib/server/space';
import type { BreadcrumbSegment } from '$lib/types';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		const { db } = resolveSpaceAccess(locals, url);

		const numId = Number(params.id);
		if (isNaN(numId)) {
			return json({ error: 'Invalid category id' }, { status: 400 });
		}

		const ancestors = db.prepare(`
			WITH RECURSIVE chain AS (
				SELECT id, name, parent_id FROM categories WHERE id = ?
				UNION ALL
				SELECT c.id, c.name, c.parent_id FROM categories c JOIN chain ch ON c.id = ch.parent_id
			)
			SELECT id, name FROM chain
		`).all(numId) as { id: number; name: string }[];

		const segments: BreadcrumbSegment[] = ancestors.reverse().map((a) => ({
			id: a.id,
			name: a.name
		}));

		return json(segments);
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to fetch breadcrumb:', err);
		return json({ error: 'Failed to fetch breadcrumb' }, { status: 500 });
	}
};
