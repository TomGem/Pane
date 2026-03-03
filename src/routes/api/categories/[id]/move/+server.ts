import fs from 'fs';
import path from 'path';
import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceSlug } from '$lib/server/space';
import { getDb, slugExists } from '$lib/server/db';
import { copyCategoryDirAcrossSpaces, deleteCategoryDir, ensureSpaceDir, getStorageRoot } from '$lib/server/storage';
import type { Category, Item, ItemTag } from '$lib/types';

interface CategoryRow extends Category {
	children_count?: number;
}

export const POST: RequestHandler = async ({ params, request, url }) => {
	try {
		const categoryId = Number(params.id);
		if (isNaN(categoryId)) return json({ error: 'Invalid category id' }, { status: 400 });

		const { targetSpace } = await request.json();
		if (!targetSpace || typeof targetSpace !== 'string') {
			return json({ error: 'targetSpace is required' }, { status: 400 });
		}

		const sourceSpace = getSpaceSlug(url);

		if (sourceSpace === targetSpace) {
			return json({ error: 'Source and target space cannot be the same' }, { status: 400 });
		}

		if (!slugExists(targetSpace)) {
			return json({ error: 'Target space does not exist' }, { status: 404 });
		}

		const sourceDb = getDb(sourceSpace);
		const targetDb = getDb(targetSpace);

		// Verify category exists in source
		const rootCategory = sourceDb.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId) as CategoryRow | undefined;
		if (!rootCategory) {
			return json({ error: 'Category not found' }, { status: 404 });
		}

		// Fetch entire subtree via recursive CTE
		const allCategories = sourceDb.prepare(`
			WITH RECURSIVE tree AS (
				SELECT * FROM categories WHERE id = ?
				UNION ALL
				SELECT c.* FROM categories c JOIN tree t ON c.parent_id = t.id
			)
			SELECT * FROM tree
		`).all(categoryId) as Category[];

		const categoryIds = allCategories.map((c) => c.id);

		// Fetch all items for these categories
		const placeholders = categoryIds.map(() => '?').join(',');
		const allItems = sourceDb.prepare(
			`SELECT * FROM items WHERE category_id IN (${placeholders})`
		).all(...categoryIds) as Item[];

		// Fetch all item_tags for these items
		const itemIds = allItems.map((i) => i.id);
		let allItemTags: ItemTag[] = [];
		if (itemIds.length > 0) {
			const itemPlaceholders = itemIds.map(() => '?').join(',');
			allItemTags = sourceDb.prepare(
				`SELECT * FROM item_tags WHERE item_id IN (${itemPlaceholders})`
			).all(...itemIds) as ItemTag[];
		}

		// Resolve slug conflicts in target DB
		const slugMap = new Map<string, string>(); // old slug -> new slug
		for (const cat of allCategories) {
			let newSlug = cat.slug;
			let suffix = 2;
			while (targetDb.prepare('SELECT id FROM categories WHERE slug = ?').get(newSlug)) {
				newSlug = `${cat.slug}-${suffix}`;
				suffix++;
			}
			slugMap.set(cat.slug, newSlug);
		}

		// Calculate max sort_order in target space at root level (for the root category)
		const maxSort = targetDb.prepare(
			'SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM categories WHERE parent_id IS NULL'
		).get() as { max_sort: number };

		const oldToNewCatId = new Map<number, number>();
		const oldToNewItemId = new Map<number, number>();
		const copiedCategorySlugs: string[] = [];

		// Phase 1: Copy files to target (non-destructive)
		ensureSpaceDir(targetSpace);
		try {
			for (const cat of allCategories) {
				copyCategoryDirAcrossSpaces(sourceSpace, targetSpace, cat.slug);
				copiedCategorySlugs.push(cat.slug);
			}
		} catch (copyErr) {
			// Rollback: remove any copied dirs
			for (const slug of copiedCategorySlugs) {
				try { deleteCategoryDir(targetSpace, slug); } catch { /* best-effort */ }
			}
			throw copyErr;
		}

		// Phase 2: Insert into target DB (transaction, clean up copies on failure)
		try {
			targetDb.transaction(() => {
				const insertCat = targetDb.prepare(
					`INSERT INTO categories (name, slug, color, sort_order, parent_id, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`
				);
				const insertItem = targetDb.prepare(
					`INSERT INTO items (category_id, type, title, content, file_path, file_name, file_size, mime_type, description, favicon_url, sort_order, is_pinned, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				);
				const insertItemTag = targetDb.prepare(
					'INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)'
				);

				for (const cat of allCategories) {
					const newSlug = slugMap.get(cat.slug) ?? cat.slug;
					const isRoot = cat.id === categoryId;
					const newParentId = isRoot ? null : (oldToNewCatId.get(cat.parent_id!) ?? null);
					const sortOrder = isRoot ? maxSort.max_sort + 1 : cat.sort_order;

					const result = insertCat.run(
						cat.name, newSlug, cat.color, sortOrder,
						newParentId, cat.created_at, cat.updated_at
					);
					oldToNewCatId.set(cat.id, Number(result.lastInsertRowid));
				}

				for (const item of allItems) {
					const newCategoryId = oldToNewCatId.get(item.category_id)!;
					let newFilePath = item.file_path;
					if (newFilePath) {
						const oldCat = allCategories.find((c) => c.id === item.category_id);
						if (oldCat) {
							const newSlug = slugMap.get(oldCat.slug) ?? oldCat.slug;
							if (newSlug !== oldCat.slug && newFilePath.startsWith(oldCat.slug + '/')) {
								newFilePath = newSlug + newFilePath.slice(oldCat.slug.length);
							}
						}
					}

					const result = insertItem.run(
						newCategoryId, item.type, item.title, item.content,
						newFilePath, item.file_name, item.file_size, item.mime_type,
						item.description, item.favicon_url, item.sort_order, item.is_pinned,
						item.created_at, item.updated_at
					);
					oldToNewItemId.set(item.id, Number(result.lastInsertRowid));
				}

				for (const it of allItemTags) {
					const newItemId = oldToNewItemId.get(it.item_id);
					if (newItemId !== undefined) {
						insertItemTag.run(newItemId, it.tag_id);
					}
				}
			})();
		} catch (insertErr) {
			// Rollback: remove copied files since target DB insert failed
			for (const slug of copiedCategorySlugs) {
				try { deleteCategoryDir(targetSpace, slug); } catch { /* best-effort */ }
			}
			throw insertErr;
		}

		// Phase 3: Delete from source DB (CASCADE handles items + item_tags)
		// After this point, data lives in target. If this fails, data exists in both (safe duplicate).
		sourceDb.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);

		// Phase 4: Clean up source files (best-effort, individual try-catch)
		for (const cat of allCategories) {
			try {
				deleteCategoryDir(sourceSpace, cat.slug);
			} catch (cleanupErr) {
				console.warn(`Failed to clean up source directory for ${cat.slug}:`, cleanupErr);
			}
		}

		// Phase 5: Rename dirs in target for slug collisions (best-effort)
		for (const cat of allCategories) {
			const newSlug = slugMap.get(cat.slug) ?? cat.slug;
			if (newSlug !== cat.slug) {
				try {
					const storageRoot = getStorageRoot();
					const oldDir = path.resolve(storageRoot, targetSpace, cat.slug);
					const newDir = path.resolve(storageRoot, targetSpace, newSlug);
					if (fs.existsSync(oldDir)) {
						fs.renameSync(oldDir, newDir);
					}
				} catch (renameErr) {
					console.warn(`Failed to rename directory ${cat.slug} -> ${newSlug}:`, renameErr);
				}
			}
		}

		return json({ success: true, targetSpace });
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to move category:', err);
		return json({ error: 'Failed to move category' }, { status: 500 });
	}
};
