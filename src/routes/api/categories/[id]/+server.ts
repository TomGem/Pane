import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSpaceAccess, requireWriteAccess } from '$lib/server/space';
import { slugify } from '$lib/utils/slugify';
import { deleteCategoryDir, renameCategoryDir } from '$lib/server/storage';
import type { Category, Item } from '$lib/types';

const MAX_NAME_LENGTH = 255;
const MAX_COLOR_LENGTH = 50;

export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		const numId = Number(params.id);
		if (isNaN(numId)) return json({ error: 'Invalid category id' }, { status: 400 });

		const { db, spaceSlug } = resolveSpaceAccess(locals, url);
		const category = db.prepare('SELECT * FROM categories WHERE id = ? AND space_slug = ?').get(numId, spaceSlug) as Category | undefined;

		if (!category) {
			return json({ error: 'Category not found' }, { status: 404 });
		}

		return json(category);
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to fetch category:', err);
		return json({ error: 'Failed to fetch category' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, url, locals }) => {
	try {
		const categoryId = Number(params.id);
		if (isNaN(categoryId)) return json({ error: 'Invalid category id' }, { status: 400 });

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

		const access = resolveSpaceAccess(locals, url);
		requireWriteAccess(access);
		const { db, spaceSlug, ownerId } = access;

		const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND space_slug = ?').get(categoryId, spaceSlug) as Category | undefined;
		if (!existing) {
			return json({ error: 'Category not found' }, { status: 404 });
		}

		const slug = name === existing.name ? existing.slug : slugify(name);

		const parentIdProvided = parent_id !== undefined;
		const newParentId = parent_id ?? null;

		if (parentIdProvided && newParentId !== null) {
			if (newParentId === categoryId) {
				return json({ error: 'A category cannot be its own parent' }, { status: 400 });
			}
			const parent = db.prepare('SELECT id FROM categories WHERE id = ? AND space_slug = ?').get(newParentId, spaceSlug);
			if (!parent) {
				return json({ error: 'Parent category not found' }, { status: 404 });
			}
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

		const updateCategory = db.transaction(() => {
			if (parentIdProvided) {
				db.prepare(
					'UPDATE categories SET name = ?, slug = ?, color = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
				).run(name, slug, color, newParentId, categoryId);
			} else {
				db.prepare(
					'UPDATE categories SET name = ?, slug = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
				).run(name, slug, color, categoryId);
			}

			if (slug !== existing.slug) {
				renameCategoryDir(ownerId, spaceSlug, existing.slug, slug);
				const items = db.prepare('SELECT id, file_path FROM items WHERE category_id = ? AND file_path IS NOT NULL').all(categoryId) as Pick<Item, 'id' | 'file_path'>[];
				const updatePath = db.prepare('UPDATE items SET file_path = ? WHERE id = ?');
				for (const item of items) {
					if (item.file_path && item.file_path.startsWith(existing.slug + '/')) {
						const newPath = slug + item.file_path.slice(existing.slug.length);
						updatePath.run(newPath, item.id);
					}
				}
			}
		});

		updateCategory();

		const category = db.prepare(
			`SELECT c.*, (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children_count
			 FROM categories c WHERE c.id = ?`
		).get(categoryId) as Category;

		return json(category);
	} catch (err) {
		if (isHttpError(err)) throw err;
		if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
			return json({ error: 'A category with that name already exists' }, { status: 409 });
		}
		console.error('Failed to update category:', err);
		return json({ error: 'Failed to update category' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, url, locals }) => {
	try {
		const numId = Number(params.id);
		if (isNaN(numId)) return json({ error: 'Invalid category id' }, { status: 400 });

		const access = resolveSpaceAccess(locals, url);
		requireWriteAccess(access);
		const { db, spaceSlug, ownerId } = access;

		const category = db.prepare('SELECT * FROM categories WHERE id = ? AND space_slug = ?').get(numId, spaceSlug) as Category | undefined;
		if (!category) {
			return json({ error: 'Category not found' }, { status: 404 });
		}

		const descendants = db.prepare(`
			WITH RECURSIVE tree AS (
				SELECT id, slug FROM categories WHERE id = ?
				UNION ALL
				SELECT c.id, c.slug FROM categories c JOIN tree t ON c.parent_id = t.id
			)
			SELECT slug FROM tree
		`).all(numId) as { slug: string }[];

		db.prepare('DELETE FROM categories WHERE id = ?').run(numId);

		for (const { slug } of descendants) {
			deleteCategoryDir(ownerId, spaceSlug, slug);
		}

		return json({ success: true });
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to delete category:', err);
		return json({ error: 'Failed to delete category' }, { status: 500 });
	}
};
