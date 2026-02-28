import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb } from '$lib/server/space';
import type { Item, Tag } from '$lib/types';

async function fetchPageMeta(url: string): Promise<{ title: string | null; description: string | null }> {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pane/1.0)' },
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) return { title: null, description: null };
		const contentType = res.headers.get('content-type') ?? '';
		if (!contentType.includes('text/html')) return { title: null, description: null };
		const text = await res.text();
		let title: string | null = null;
		const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
		if (titleMatch?.[1]) {
			title = titleMatch[1].trim().replace(/\s+/g, ' ') || null;
		}
		let description: string | null = null;
		const descMatch = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
			?? text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
		if (descMatch?.[1]) {
			description = descMatch[1].trim() || null;
		}
		return { title, description };
	} catch {
		return { title: null, description: null };
	}
}

function getTagsForItem(db: ReturnType<typeof getSpaceDb>, itemId: number): Tag[] {
	return db.prepare(
		`SELECT t.id, t.name, t.color
		 FROM tags t
		 INNER JOIN item_tags it ON it.tag_id = t.id
		 WHERE it.item_id = ?`
	).all(itemId) as Tag[];
}

function attachTags(db: ReturnType<typeof getSpaceDb>, items: Item[]): Item[] {
	return items.map((item) => ({
		...item,
		tags: getTagsForItem(db, item.id)
	}));
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const db = getSpaceDb(url);

		const categoryId = url.searchParams.get('category_id');
		const type = url.searchParams.get('type');
		const search = url.searchParams.get('search');

		let query = 'SELECT * FROM items WHERE 1=1';
		const params: (string | number)[] = [];

		if (categoryId) {
			const numCategoryId = Number(categoryId);
			if (isNaN(numCategoryId)) {
				return json({ error: 'Invalid category_id' }, { status: 400 });
			}
			query += ' AND category_id = ?';
			params.push(numCategoryId);
		}

		if (type) {
			query += ' AND type = ?';
			params.push(type);
		}

		if (search) {
			query += ' AND (title LIKE ? OR description LIKE ? OR content LIKE ?)';
			const searchPattern = `%${search}%`;
			params.push(searchPattern, searchPattern, searchPattern);
		}

		query += ' ORDER BY sort_order';

		const items = db.prepare(query).all(...params) as Item[];
		const itemsWithTags = attachTags(db, items);

		return json(itemsWithTags);
	} catch (err) {
		console.error('Failed to fetch items:', err);
		return json({ error: 'Failed to fetch items' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const { category_id, type, title: rawTitle, content, description, tags, fetch_title } = await request.json();

		if (!category_id || !type || !rawTitle) {
			return json({ error: 'category_id, type, and title are required' }, { status: 400 });
		}

		let title = rawTitle;
		let desc = description;
		if (fetch_title && type === 'link' && content) {
			const meta = await fetchPageMeta(content);
			if (meta.title) title = meta.title;
			if (meta.description && !desc) desc = meta.description;
		}

		const db = getSpaceDb(url);

		// Validate tags before transaction
		if (Array.isArray(tags) && tags.length > 0) {
			const checkTag = db.prepare('SELECT id FROM tags WHERE id = ?');
			for (const tagId of tags) {
				if (!checkTag.get(tagId)) {
					return json({ error: `Tag with id ${tagId} not found` }, { status: 400 });
				}
			}
		}

		const maxOrder = db.prepare(
			'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM items WHERE category_id = ?'
		).get(category_id) as { max_order: number };
		const sort_order = maxOrder.max_order + 1;

		const createItem = db.transaction(() => {
			const result = db.prepare(
				`INSERT INTO items (category_id, type, title, content, description, sort_order)
				 VALUES (?, ?, ?, ?, ?, ?)`
			).run(category_id, type, title, content || null, desc || null, sort_order);

			const itemId = result.lastInsertRowid as number;

			if (Array.isArray(tags) && tags.length > 0) {
				const insertTag = db.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)');
				for (const tagId of tags) {
					insertTag.run(itemId, tagId);
				}
			}

			return itemId;
		});

		const itemId = createItem();

		const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as Item;
		item.tags = getTagsForItem(db, item.id);

		return json(item, { status: 201 });
	} catch (err) {
		console.error('Failed to create item:', err);
		return json({ error: 'Failed to create item' }, { status: 500 });
	}
};
