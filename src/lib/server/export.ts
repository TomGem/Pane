import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { PassThrough } from 'stream';
import { getUserDb, listSpaces } from './db';
import { getStorageRoot } from './storage';
import type { Category, Item, ItemTag, Tag } from '$lib/types';
import type { ExportManifest, ExportSpaceData, ExportTags } from '$lib/types/export';

interface ExportResult {
	stream: PassThrough;
	filename: string;
}

function readSpaceData(userId: string, slug: string): ExportSpaceData {
	const db = getUserDb(userId);
	const row = db.prepare('SELECT display_name FROM spaces WHERE slug = ?').get(slug) as { display_name: string } | undefined;
	const displayName = row?.display_name ?? slug;

	const meta: Record<string, string> = { display_name: displayName };

	const categories = db.prepare('SELECT * FROM categories WHERE space_slug = ? ORDER BY sort_order').all(slug) as Category[];
	const categoryIds = categories.map((c) => c.id);

	let items: Item[] = [];
	let itemTags: ItemTag[] = [];

	if (categoryIds.length > 0) {
		const placeholders = categoryIds.map(() => '?').join(',');
		items = db.prepare(`SELECT * FROM items WHERE category_id IN (${placeholders}) ORDER BY sort_order`).all(...categoryIds) as Item[];

		const itemIds = items.map((i) => i.id);
		if (itemIds.length > 0) {
			const itemPlaceholders = itemIds.map(() => '?').join(',');
			itemTags = db.prepare(`SELECT * FROM item_tags WHERE item_id IN (${itemPlaceholders})`).all(...itemIds) as ItemTag[];
		}
	}

	return { slug, display_name: displayName, meta, categories, items, item_tags: itemTags };
}

function collectReferencedTags(userId: string, spacesData: ExportSpaceData[]): Tag[] {
	const db = getUserDb(userId);
	const tagIds = new Set<number>();
	for (const space of spacesData) {
		for (const it of space.item_tags) {
			tagIds.add(it.tag_id);
		}
	}
	if (tagIds.size === 0) return [];

	const placeholders = [...tagIds].map(() => '?').join(',');
	return db.prepare(`SELECT * FROM tags WHERE id IN (${placeholders})`).all(...tagIds) as Tag[];
}

export function createExportZip(userId: string, spaceSlugs: string[], includeFiles: boolean): ExportResult {
	if (spaceSlugs.length === 1 && spaceSlugs[0] === 'all') {
		spaceSlugs = listSpaces(userId).map((s) => s.slug);
	}

	const spacesData = spaceSlugs.map((slug) => readSpaceData(userId, slug));
	const tags = collectReferencedTags(userId, spacesData);

	let totalCategories = 0;
	let totalItems = 0;
	for (const sd of spacesData) {
		totalCategories += sd.categories.length;
		totalItems += sd.items.length;
	}

	const manifest: ExportManifest = {
		version: 1,
		app: 'pane',
		exported_at: new Date().toISOString(),
		spaces: spaceSlugs,
		include_files: includeFiles,
		stats: {
			spaces: spacesData.length,
			categories: totalCategories,
			items: totalItems,
			tags: tags.length
		}
	};

	const archive = archiver('zip', { zlib: { level: 6 } });
	const passthrough = new PassThrough();
	archive.pipe(passthrough);

	archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

	const tagsData: ExportTags = { tags };
	archive.append(JSON.stringify(tagsData, null, 2), { name: 'global/tags.json' });

	const storageRoot = getStorageRoot();
	for (const sd of spacesData) {
		archive.append(JSON.stringify(sd, null, 2), { name: `spaces/${sd.slug}/data.json` });

		if (includeFiles) {
			const spaceStorageDir = path.join(storageRoot, userId, sd.slug);
			if (fs.existsSync(spaceStorageDir)) {
				archive.directory(spaceStorageDir, `spaces/${sd.slug}/files`);
			}
		}
	}

	archive.finalize();

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const filename = `pane-export-${timestamp}.zip`;

	return { stream: passthrough, filename };
}
