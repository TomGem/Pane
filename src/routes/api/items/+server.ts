import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb } from '$lib/server/space';
import { getGlobalDb } from '$lib/server/db';
import { getTagsForItem, attachTagsBatched } from '$lib/server/tags';
import type { Item } from '$lib/types';

const VALID_ITEM_TYPES = ['link', 'note', 'document'];
const MAX_TITLE_LENGTH = 1000;
const MAX_CONTENT_LENGTH = 500_000;
const MAX_DESCRIPTION_LENGTH = 5000;

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

const MAX_FETCH_SIZE = 1024 * 1024; // 1 MB — YouTube inlines ~600KB of JS before meta tags

async function fetchPageMeta(url: string): Promise<{ title: string | null; description: string | null; favicon: string | null; unavailable: boolean }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);
	const unavailableResult = { title: null, description: null, favicon: null, unavailable: true };
	try {
		let currentUrl = url;
		let redirects = 0;
		const MAX_REDIRECTS = 5;

		while (redirects < MAX_REDIRECTS) {
			if (isPrivateUrl(currentUrl)) return unavailableResult;

			const res = await fetch(currentUrl, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'en-US,en;q=0.9'
				},
				signal: controller.signal,
				redirect: 'manual'
			});

			if (res.status >= 300 && res.status < 400) {
				const location = res.headers.get('location');
				if (!location) return unavailableResult;
				currentUrl = new URL(location, currentUrl).href;
				redirects++;
				continue;
			}

			if (!res.ok) return unavailableResult;

			const contentType = res.headers.get('content-type') ?? '';
			if (!contentType.includes('text/html')) return { title: null, description: null, favicon: null, unavailable: false };
			const contentLength = Number(res.headers.get('content-length'));
			if (contentLength > MAX_FETCH_SIZE) return { title: null, description: null, favicon: null, unavailable: false };
			const reader = res.body?.getReader();
			if (!reader) return { title: null, description: null, favicon: null, unavailable: false };
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
			const ogTitleMatch = text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
				?? text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
			const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
			if (ogTitleMatch?.[1]) {
				title = ogTitleMatch[1].trim().replace(/\s+/g, ' ') || null;
			} else if (titleMatch?.[1]) {
				title = titleMatch[1].trim().replace(/\s+/g, ' ') || null;
			}
			let description: string | null = null;
			const ogDescMatch = text.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
				?? text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
			const descMatch = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
				?? text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
			if (ogDescMatch?.[1]) {
				description = ogDescMatch[1].trim() || null;
			} else if (descMatch?.[1]) {
				description = descMatch[1].trim() || null;
			}

			// Extract favicon
			let favicon: string | null = null;
			const origin = new URL(currentUrl).origin;
			const iconMatch = text.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
				?? text.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
			const appleTouchMatch = text.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i)
				?? text.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);
			if (iconMatch?.[1]) {
				favicon = new URL(iconMatch[1], currentUrl).href;
			} else if (appleTouchMatch?.[1]) {
				favicon = new URL(appleTouchMatch[1], currentUrl).href;
			} else {
				favicon = `${origin}/favicon.ico`;
			}

			return { title, description, favicon, unavailable: false };
		}
		return unavailableResult;
	} catch {
		return unavailableResult;
	} finally {
		clearTimeout(timeout);
	}
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
		const itemsWithTags = attachTagsBatched(db, items);

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

		if (!VALID_ITEM_TYPES.includes(type)) {
			return json({ error: `Invalid type: must be one of ${VALID_ITEM_TYPES.join(', ')}` }, { status: 400 });
		}

		if (typeof rawTitle === 'string' && rawTitle.length > MAX_TITLE_LENGTH) {
			return json({ error: `Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters` }, { status: 400 });
		}
		if (typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
			return json({ error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` }, { status: 400 });
		}
		if (typeof description === 'string' && description.length > MAX_DESCRIPTION_LENGTH) {
			return json({ error: `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters` }, { status: 400 });
		}

		let title = rawTitle;
		let desc = description;
		let faviconUrl: string | null = null;
		let tagIds: number[] = Array.isArray(tags) ? [...tags] : [];
		if (fetch_title && type === 'link' && content) {
			const meta = await fetchPageMeta(content);
			if (meta.title) title = meta.title;
			if (meta.description && !desc) desc = meta.description;
			faviconUrl = meta.favicon;

			if (meta.unavailable) {
				const globalDb = getGlobalDb();
				globalDb.prepare("INSERT OR IGNORE INTO tags (name, color) VALUES ('404', '#ef4444')").run();
				const tag404 = globalDb.prepare("SELECT id FROM tags WHERE name = '404'").get() as { id: number };
				if (!tagIds.includes(tag404.id)) {
					tagIds.push(tag404.id);
				}
			}
		}

		const db = getSpaceDb(url);

		// Validate tags against global DB before transaction
		if (tagIds.length > 0) {
			const globalDb = getGlobalDb();
			const checkTag = globalDb.prepare('SELECT id FROM tags WHERE id = ?');
			for (const tagId of tagIds) {
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
				`INSERT INTO items (category_id, type, title, content, description, favicon_url, sort_order)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			).run(category_id, type, title, content || null, desc || null, faviconUrl, sort_order);

			const itemId = result.lastInsertRowid as number;

			if (tagIds.length > 0) {
				const insertTag = db.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)');
				for (const tagId of tagIds) {
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
