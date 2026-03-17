import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSpaceAccess, requireWriteAccess } from '$lib/server/space';
import { slugify } from '$lib/utils/slugify';
import type { Category } from '$lib/types';

const MAX_NAME_LENGTH = 255;
const MAX_COLOR_LENGTH = 50;

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const { db, spaceSlug } = resolveSpaceAccess(locals, url);
		const parentParam = url.searchParams.get('parent_id');

		let categories;
		if (parentParam !== null) {
			if (parentParam === 'null' || parentParam === '') {
				categories = db.prepare(
					`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
					 FROM categories c WHERE c.space_slug = ? AND c.parent_id IS NULL ORDER BY c.sort_order`
				).all(spaceSlug);
			} else {
				const numParentId = Number(parentParam);
				if (isNaN(numParentId)) {
					return json({ error: 'Invalid parent_id' }, { status: 400 });
				}
				categories = db.prepare(
					`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
					 FROM categories c WHERE c.space_slug = ? AND c.parent_id = ? ORDER BY c.sort_order`
				).all(spaceSlug, numParentId);
			}
		} else {
			categories = db.prepare(
				`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
				 FROM categories c WHERE c.space_slug = ? ORDER BY c.sort_order`
			).all(spaceSlug);
		}

		return json(categories);
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to fetch categories:', err);
		return json({ error: 'Failed to fetch categories' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, url, locals }) => {
	try {
		const access = resolveSpaceAccess(locals, url);
		requireWriteAccess(access);
		const { db, spaceSlug } = access;

		const { name, color, parent_id } = await request.json();

		if (!name || !color) {
			return json({ error: 'Name and color are required' }, { status: 400 });
		}

		if (typeof name === 'string' && name.length > MAX_NAME_LENGTH) {
			return json({ error: `Name exceeds maximum length of ${MAX_NAME_LENGTH} characters` }, { status: 400 });
		}
		if (typeof color === 'string' && color.length > MAX_COLOR_LENGTH) {
			return json({ error: `Color exceeds maximum length of ${MAX_COLOR_LENGTH} characters` }, { status: 400 });
		}

		const slug = slugify(name);

		const parentIdValue = parent_id ?? null;
		if (parentIdValue !== null) {
			const parent = db.prepare('SELECT id FROM categories WHERE id = ? AND space_slug = ?').get(parentIdValue, spaceSlug);
			if (!parent) {
				return json({ error: 'Parent category not found' }, { status: 404 });
			}
		}
		const maxOrder = parentIdValue === null
			? db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM categories WHERE space_slug = ? AND parent_id IS NULL').get(spaceSlug) as { max_order: number }
			: db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM categories WHERE space_slug = ? AND parent_id = ?').get(spaceSlug, parentIdValue) as { max_order: number };
		const sort_order = maxOrder.max_order + 1;

		const result = db.prepare(
			'INSERT INTO categories (space_slug, name, slug, color, sort_order, parent_id) VALUES (?, ?, ?, ?, ?, ?)'
		).run(spaceSlug, name, slug, color, sort_order, parentIdValue);

		const category = db.prepare(
			`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
			 FROM categories c WHERE c.id = ?`
		).get(result.lastInsertRowid);

		return json(category, { status: 201 });
	} catch (err) {
		if (isHttpError(err)) throw err;
		if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
			return json({ error: 'A category with that name already exists' }, { status: 409 });
		}
		console.error('Failed to create category:', err);
		return json({ error: 'Failed to create category' }, { status: 500 });
	}
};
