import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSpaceAccess, requireWriteAccess } from '$lib/server/space';
import { getTagsForItem } from '$lib/server/tags';
import { fetchPageMeta } from '$lib/server/meta';
import type { Item } from '$lib/types';

export const POST: RequestHandler = async ({ params, url, locals }) => {
	try {
		const numId = Number(params.id);
		if (isNaN(numId)) return json({ error: 'Invalid item id' }, { status: 400 });
		if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });

		const access = resolveSpaceAccess(locals, url);
		requireWriteAccess(access);
		const { db } = access;

		const item = db.prepare('SELECT * FROM items WHERE id = ?').get(numId) as Item | undefined;
		if (!item) {
			return json({ error: 'Item not found' }, { status: 404 });
		}

		if (item.type !== 'link' || !item.content) {
			return json({ error: 'Only link items can be refreshed' }, { status: 400 });
		}

		const meta = await fetchPageMeta(item.content);

		const fields: string[] = [];
		const values: unknown[] = [];

		if (meta.title) { fields.push('title = ?'); values.push(meta.title); }
		if (meta.description) { fields.push('description = ?'); values.push(meta.description); }
		if (meta.favicon !== undefined) { fields.push('favicon_url = ?'); values.push(meta.favicon); }

		if (fields.length > 0) {
			fields.push('updated_at = CURRENT_TIMESTAMP');
			values.push(numId);
			db.prepare(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
		}

		// Handle 404 tag for unavailable links
		if (meta.unavailable) {
			db.prepare("INSERT OR IGNORE INTO tags (name, color) VALUES ('404', '#ef4444')").run();
			const tag404 = db.prepare("SELECT id FROM tags WHERE name = '404'").get() as { id: number };
			const existing = db.prepare('SELECT 1 FROM item_tags WHERE item_id = ? AND tag_id = ?').get(numId, tag404.id);
			if (!existing) {
				db.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)').run(numId, tag404.id);
			}
		} else {
			const tag404 = db.prepare("SELECT id FROM tags WHERE name = '404'").get() as { id: number } | undefined;
			if (tag404) {
				db.prepare('DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?').run(numId, tag404.id);
			}
		}

		const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(numId) as Item;
		updated.tags = getTagsForItem(db, updated.id);

		return json(updated);
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to refresh link:', err);
		return json({ error: 'Failed to refresh link' }, { status: 500 });
	}
};
