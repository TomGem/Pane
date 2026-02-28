import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb, getSpaceSlug } from '$lib/server/space';
import { saveFile, deleteFile } from '$lib/server/storage';
import type { Item, Category } from '$lib/types';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const formData = await request.formData();

		const file = formData.get('file') as File | null;
		const categoryId = formData.get('category_id') as string | null;
		const title = formData.get('title') as string | null;
		const description = formData.get('description') as string | null;

		if (!file) {
			return json({ error: 'File is required' }, { status: 400 });
		}

		if (file.size > MAX_FILE_SIZE) {
			return json({ error: 'File size exceeds the 100 MB limit' }, { status: 413 });
		}

		if (!categoryId || isNaN(Number(categoryId))) {
			return json({ error: 'A valid category_id is required' }, { status: 400 });
		}

		const numCategoryId = Number(categoryId);
		const spaceSlug = getSpaceSlug(url);
		const db = getSpaceDb(url);

		const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(numCategoryId) as Category | undefined;
		if (!category) {
			return json({ error: 'Category not found' }, { status: 404 });
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const { filePath, fileName } = saveFile(spaceSlug, category.slug, file.name, buffer);

		try {
			const maxOrder = db.prepare(
				'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM items WHERE category_id = ?'
			).get(numCategoryId) as { max_order: number };
			const sort_order = maxOrder.max_order + 1;

			const result = db.prepare(
				`INSERT INTO items (category_id, type, title, content, description, file_path, file_name, file_size, mime_type, sort_order)
				 VALUES (?, 'document', ?, NULL, ?, ?, ?, ?, ?, ?)`
			).run(
				numCategoryId,
				title || file.name,
				description || null,
				filePath,
				fileName,
				file.size,
				file.type || 'application/octet-stream',
				sort_order
			);

			const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid) as Item;
			item.tags = [];

			return json(item, { status: 201 });
		} catch (dbErr) {
			// Clean up the saved file if DB insert fails
			deleteFile(spaceSlug, filePath);
			throw dbErr;
		}
	} catch (err) {
		console.error('Failed to upload file:', err);
		return json({ error: 'Failed to upload file' }, { status: 500 });
	}
};
