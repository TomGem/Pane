import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSpaceAccess, requireWriteAccess } from '$lib/server/space';
import { getTagsForItem, attachTagsBatched } from '$lib/server/tags';
import { fetchPageMeta } from '$lib/server/meta';
import type { Item } from '$lib/types';
import { emit } from '$lib/server/events';

const VALID_ITEM_TYPES = ['link', 'note', 'document'];
const MAX_TITLE_LENGTH = 1000;
const MAX_CONTENT_LENGTH = 500_000;
const MAX_DESCRIPTION_LENGTH = 5000;

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const { db } = resolveSpaceAccess(locals, url);

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

export const POST: RequestHandler = async ({ request, url, locals }) => {
	try {
		if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });
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

		const access = resolveSpaceAccess(locals, url);
		requireWriteAccess(access);
		const { db } = access;

		if (fetch_title && type === 'link' && content) {
			const meta = await fetchPageMeta(content);
			if (meta.title) title = meta.title;
			if (meta.description && !desc) desc = meta.description;
			faviconUrl = meta.favicon;

			if (meta.unavailable) {
				db.prepare("INSERT OR IGNORE INTO tags (name, color) VALUES ('404', '#ef4444')").run();
				const tag404 = db.prepare("SELECT id FROM tags WHERE name = '404'").get() as { id: number };
				if (!tagIds.includes(tag404.id)) {
					tagIds.push(tag404.id);
				}
			}
		}

		// Validate tags against the space owner's tags
		if (tagIds.length > 0) {
			const checkTag = db.prepare('SELECT id FROM tags WHERE id = ?');
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

		emit(access.ownerId, access.spaceSlug, { type: 'item:created', timestamp: Date.now() }, locals.userId);
		return json(item, { status: 201 });
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to create item:', err);
		return json({ error: 'Failed to create item' }, { status: 500 });
	}
};
