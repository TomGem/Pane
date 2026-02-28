import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb, getSpaceSlug } from '$lib/server/space';
import { saveFile } from '$lib/server/storage';
import type { Item, Category } from '$lib/types';

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB

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
			return json({ error: 'File size exceeds the 1 GB limit' }, { status: 413 });
		}

		if (!categoryId) {
			return json({ error: 'category_id is required' }, { status: 400 });
		}

		const spaceSlug = getSpaceSlug(url);
		const db = getSpaceDb(url);

		const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(categoryId)) as Category | undefined;
		if (!category) {
			return json({ error: 'Category not found' }, { status: 404 });
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const { filePath, fileName } = saveFile(spaceSlug, category.slug, file.name, buffer);

		const maxOrder = db.prepare(
			'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM items WHERE category_id = ?'
		).get(Number(categoryId)) as { max_order: number };
		const sort_order = maxOrder.max_order + 1;

		const result = db.prepare(
			`INSERT INTO items (category_id, type, title, content, description, file_path, file_name, file_size, mime_type, sort_order)
			 VALUES (?, 'document', ?, NULL, ?, ?, ?, ?, ?, ?)`
		).run(
			Number(categoryId),
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
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to upload file';
		return json({ error: message }, { status: 500 });
	}
};
