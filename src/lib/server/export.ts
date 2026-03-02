import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { PassThrough } from 'stream';
import { getDb, getGlobalDb, listSpaces } from './db';
import { getMeta } from './schema';
import { getStorageRoot } from './storage';
import type { Category, Item, ItemTag, Tag } from '$lib/types';
import type { ExportManifest, ExportSpaceData, ExportTags } from '$lib/types/export';

interface ExportResult {
	stream: PassThrough;
	filename: string;
}

function readSpaceData(slug: string): ExportSpaceData {
	const db = getDb(slug);
	const displayName = getMeta(db, 'display_name') ?? slug;

	const metaRows = db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[];
	const meta: Record<string, string> = {};
	for (const row of metaRows) {
		meta[row.key] = row.value;
	}

	const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all() as Category[];
	const items = db.prepare('SELECT * FROM items ORDER BY sort_order').all() as Item[];
	const itemTags = db.prepare('SELECT * FROM item_tags').all() as ItemTag[];

	return { slug, display_name: displayName, meta, categories, items, item_tags: itemTags };
}

function collectReferencedTags(spacesData: ExportSpaceData[]): Tag[] {
	const globalDb = getGlobalDb();
	const tagIds = new Set<number>();
	for (const space of spacesData) {
		for (const it of space.item_tags) {
			tagIds.add(it.tag_id);
		}
	}
	if (tagIds.size === 0) return [];

	const placeholders = [...tagIds].map(() => '?').join(',');
	return globalDb.prepare(`SELECT * FROM tags WHERE id IN (${placeholders})`).all(...tagIds) as Tag[];
}

export function createExportZip(spaceSlugs: string[], includeFiles: boolean): ExportResult {
	// Resolve 'all' to actual space slugs
	if (spaceSlugs.length === 1 && spaceSlugs[0] === 'all') {
		spaceSlugs = listSpaces().map((s) => s.slug);
	}

	const spacesData = spaceSlugs.map((slug) => readSpaceData(slug));
	const tags = collectReferencedTags(spacesData);

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

	// Add manifest
	archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

	// Add global tags
	const tagsData: ExportTags = { tags };
	archive.append(JSON.stringify(tagsData, null, 2), { name: 'global/tags.json' });

	// Add space data + files
	const storageRoot = getStorageRoot();
	for (const sd of spacesData) {
		archive.append(JSON.stringify(sd, null, 2), { name: `spaces/${sd.slug}/data.json` });

		if (includeFiles) {
			const spaceStorageDir = path.join(storageRoot, sd.slug);
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
