import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb, getSpaceSlug } from '$lib/server/space';
import { slugify } from '$lib/utils/slugify';
import { deleteCategoryDir } from '$lib/server/storage';
import type { Category } from '$lib/types';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const db = getSpaceDb(url);
		const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(params.id) as Category | undefined;

		if (!category) {
			return json({ error: 'Category not found' }, { status: 404 });
		}

		return json(category);
	} catch (err) {
		console.error('Failed to fetch category:', err);
		return json({ error: 'Failed to fetch category' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, url }) => {
	try {
		const { name, color, parent_id } = await request.json();

		if (!name || !color) {
			return json({ error: 'Name and color are required' }, { status: 400 });
		}

		const db = getSpaceDb(url);
		const slug = slugify(name);
		const categoryId = Number(params.id);

		const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId) as Category | undefined;
		if (!existing) {
			return json({ error: 'Category not found' }, { status: 404 });
		}

		// parent_id: undefined means "not provided" (keep existing), null means "move to root"
		const parentIdProvided = parent_id !== undefined;
		const newParentId = parent_id ?? null;

		if (parentIdProvided && newParentId !== null) {
			if (newParentId === categoryId) {
				return json({ error: 'A category cannot be its own parent' }, { status: 400 });
			}
			const parent = db.prepare('SELECT id FROM categories WHERE id = ?').get(newParentId);
			if (!parent) {
				return json({ error: 'Parent category not found' }, { status: 404 });
			}
			// Walk up the ancestor chain from the proposed parent to detect cycles
			let current: number | null = newParentId;
			while (current !== null) {
				const ancestor = db.prepare('SELECT parent_id FROM categories WHERE id = ?').get(current) as { parent_id: number | null } | undefined;
				if (!ancestor) break;
				current = ancestor.parent_id;
				if (current === categoryId) {
					return json({ error: 'Cannot set parent: would create a circular reference' }, { status: 400 });
				}
			}
		}

		if (parentIdProvided) {
			db.prepare(
				'UPDATE categories SET name = ?, slug = ?, color = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
			).run(name, slug, color, newParentId, categoryId);
		} else {
			db.prepare(
				'UPDATE categories SET name = ?, slug = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
			).run(name, slug, color, categoryId);
		}

		const category = db.prepare(
			`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
			 FROM categories c WHERE c.id = ?`
		).get(categoryId) as Category;

		return json(category);
	} catch (err) {
		console.error('Failed to update category:', err);
		return json({ error: 'Failed to update category' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	try {
		const spaceSlug = getSpaceSlug(url);
		const db = getSpaceDb(url);

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
			deleteCategoryDir(spaceSlug, slug);
		}

		return json({ success: true });
	} catch (err) {
		console.error('Failed to delete category:', err);
		return json({ error: 'Failed to delete category' }, { status: 500 });
	}
};
