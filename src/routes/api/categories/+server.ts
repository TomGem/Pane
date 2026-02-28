import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb } from '$lib/server/space';
import { slugify } from '$lib/utils/slugify';
import type { Category } from '$lib/types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const db = getSpaceDb(url);
		const parentParam = url.searchParams.get('parent_id');

		let categories;
		if (parentParam !== null) {
			if (parentParam === 'null' || parentParam === '') {
				categories = db.prepare(
					`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
					 FROM categories c WHERE c.parent_id IS NULL ORDER BY c.sort_order`
				).all();
			} else {
				categories = db.prepare(
					`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
					 FROM categories c WHERE c.parent_id = ? ORDER BY c.sort_order`
				).all(Number(parentParam));
			}
		} else {
			// No filter — return all (backward compat for refresh)
			categories = db.prepare(
				`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
				 FROM categories c ORDER BY c.sort_order`
			).all();
		}

		return json(categories);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch categories';
		return json({ error: message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const { name, color, parent_id } = await request.json();

		if (!name || !color) {
			return json({ error: 'Name and color are required' }, { status: 400 });
		}

		const db = getSpaceDb(url);
		const slug = slugify(name);

		const parentIdValue = parent_id ?? null;
		const maxOrder = parentIdValue === null
			? db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM categories WHERE parent_id IS NULL').get() as { max_order: number }
			: db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM categories WHERE parent_id = ?').get(parentIdValue) as { max_order: number };
		const sort_order = maxOrder.max_order + 1;

		const result = db.prepare(
			'INSERT INTO categories (name, slug, color, sort_order, parent_id) VALUES (?, ?, ?, ?, ?)'
		).run(name, slug, color, sort_order, parentIdValue);

		const category = db.prepare(
			`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
			 FROM categories c WHERE c.id = ?`
		).get(result.lastInsertRowid);

		return json(category, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to create category';
		return json({ error: message }, { status: 500 });
	}
};
