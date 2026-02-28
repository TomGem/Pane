import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { slugify } from '$lib/utils/slugify';
import { deleteCategoryDir } from '$lib/server/storage';
import type { Category } from '$lib/types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = getDb();
		const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(params.id) as Category | undefined;

		if (!category) {
			return json({ error: 'Category not found' }, { status: 404 });
		}

		return json(category);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch category';
		return json({ error: message }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { name, color } = await request.json();

		if (!name || !color) {
			return json({ error: 'Name and color are required' }, { status: 400 });
		}

		const db = getDb();
		const slug = slugify(name);

		const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(params.id) as Category | undefined;
		if (!existing) {
			return json({ error: 'Category not found' }, { status: 404 });
		}

		db.prepare(
			'UPDATE categories SET name = ?, slug = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		).run(name, slug, color, params.id);

		const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(params.id) as Category;

		return json(category);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to update category';
		return json({ error: message }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const db = getDb();

		const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(params.id) as Category | undefined;
		if (!category) {
			return json({ error: 'Category not found' }, { status: 404 });
		}

		// Find all descendant slugs via recursive CTE before deletion
		const descendants = db.prepare(`
			WITH RECURSIVE tree AS (
				SELECT id, slug FROM categories WHERE id = ?
				UNION ALL
				SELECT c.id, c.slug FROM categories c JOIN tree t ON c.parent_id = t.id
			)
			SELECT slug FROM tree
		`).all(params.id) as { slug: string }[];

		db.prepare('DELETE FROM categories WHERE id = ?').run(params.id);

		// Clean up storage dirs for this category and all descendants
		for (const { slug } of descendants) {
			deleteCategoryDir(slug);
		}

		return json({ success: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to delete category';
		return json({ error: message }, { status: 500 });
	}
};
