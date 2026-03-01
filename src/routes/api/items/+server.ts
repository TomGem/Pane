import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb } from '$lib/server/space';
import { getGlobalDb } from '$lib/server/db';
import type { Item, Tag } from '$lib/types';

function isPrivateUrl(urlStr: string): boolean {
	try {
		const parsed = new URL(urlStr);
		if (!['http:', 'https:'].includes(parsed.protocol)) return true;
		const hostname = parsed.hostname;
		if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return true;
		// Reject private IP ranges
		const parts = hostname.split('.').map(Number);
		if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
			if (parts[0] === 10) return true;
			if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
			if (parts[0] === 192 && parts[1] === 168) return true;
			if (parts[0] === 169 && parts[1] === 254) return true;
			if (parts[0] === 0) return true;
		}
		return false;
	} catch {
		return true;
	}
}

const MAX_FETCH_SIZE = 100 * 1024; // 100 KB — enough for meta tags

async function fetchPageMeta(url: string): Promise<{ title: string | null; description: string | null }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);
	try {
		let currentUrl = url;
		let redirects = 0;
		const MAX_REDIRECTS = 5;

		while (redirects < MAX_REDIRECTS) {
			if (isPrivateUrl(currentUrl)) return { title: null, description: null };

			const res = await fetch(currentUrl, {
				headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pane/1.0)' },
				signal: controller.signal,
				redirect: 'manual'
			});

			if (res.status >= 300 && res.status < 400) {
				const location = res.headers.get('location');
				if (!location) return { title: null, description: null };
				currentUrl = new URL(location, currentUrl).href;
				redirects++;
				continue;
			}

			if (!res.ok) return { title: null, description: null };

			const contentType = res.headers.get('content-type') ?? '';
			if (!contentType.includes('text/html')) return { title: null, description: null };
			const contentLength = Number(res.headers.get('content-length'));
			if (contentLength > MAX_FETCH_SIZE) return { title: null, description: null };
			const reader = res.body?.getReader();
			if (!reader) return { title: null, description: null };
			const chunks: Uint8Array[] = [];
			let totalSize = 0;
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				totalSize += value.byteLength;
				chunks.push(value);
				if (totalSize >= MAX_FETCH_SIZE) break;
			}
			reader.cancel().catch(() => {});
			const text = new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_FETCH_SIZE));
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
		}
		return { title: null, description: null };
	} catch {
		return { title: null, description: null };
	} finally {
		clearTimeout(timeout);
	}
}

function getTagsForItem(spaceDb: ReturnType<typeof getSpaceDb>, itemId: number): Tag[] {
	const tagIds = spaceDb.prepare('SELECT tag_id FROM item_tags WHERE item_id = ?').all(itemId) as { tag_id: number }[];
	if (tagIds.length === 0) return [];
	const globalDb = getGlobalDb();
	const placeholders = tagIds.map(() => '?').join(',');
	return globalDb.prepare(`SELECT id, name, color FROM tags WHERE id IN (${placeholders})`).all(...tagIds.map(r => r.tag_id)) as Tag[];
}

function attachTags(spaceDb: ReturnType<typeof getSpaceDb>, items: Item[]): Item[] {
	return items.map((item) => ({
		...item,
		tags: getTagsForItem(spaceDb, item.id)
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
			const escaped = search.replace(/[%_\\]/g, '\\$&');
			query += " AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')";
			const searchPattern = `%${escaped}%`;
			params.push(searchPattern, searchPattern, searchPattern);
		}

		query += ' ORDER BY sort_order';

		const items = db.prepare(query).all(...params) as Item[];
		const itemsWithTags = attachTags(db, items);

		return json(itemsWithTags);
	} catch (err) {
		if (isHttpError(err)) throw err;
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

		// Validate tags against global DB before transaction
		if (Array.isArray(tags) && tags.length > 0) {
			const globalDb = getGlobalDb();
			const checkTag = globalDb.prepare('SELECT id FROM tags WHERE id = ?');
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
		if (isHttpError(err)) throw err;
		console.error('Failed to create item:', err);
		return json({ error: 'Failed to create item' }, { status: 500 });
	}
};
