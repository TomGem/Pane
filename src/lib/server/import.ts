import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { getDb, getGlobalDb, slugExists, createDb, closeDb } from './db';
import { getMeta } from './schema';
import { getStorageRoot, ensureCategoryDir } from './storage';
import type { Category, Item, ItemTag, Tag } from '$lib/types';
import type {
	ExportManifest,
	ExportSpaceData,
	ExportTags,
	ImportPreview,
	ImportPreviewSpace,
	ImportPreviewTag,
	ImportOptions,
	ImportResult,
	ConflictMode
} from '$lib/types/export';

function parseJsonEntry<T>(zip: AdmZip, entryName: string): T | null {
	const entry = zip.getEntry(entryName);
	if (!entry) return null;
	const text = entry.getData().toString('utf8');
	return JSON.parse(text) as T;
}

function validateManifest(manifest: ExportManifest): string[] {
	const errors: string[] = [];
	if (manifest.app !== 'pane') errors.push('Not a Pane export file');
	if (manifest.version !== 1) errors.push(`Unsupported export version: ${manifest.version}`);
	if (!Array.isArray(manifest.spaces) || manifest.spaces.length === 0) {
		errors.push('No spaces found in export');
	}
	return errors;
}

export function previewImport(zipBuffer: Buffer): ImportPreview {
	const zip = new AdmZip(zipBuffer);
	const errors: string[] = [];

	const manifest = parseJsonEntry<ExportManifest>(zip, 'manifest.json');
	if (!manifest) {
		return {
			manifest: { version: 1, app: 'pane', exported_at: '', spaces: [], include_files: false, stats: { spaces: 0, categories: 0, items: 0, tags: 0 } },
			spaces: [],
			tags: [],
			valid: false,
			errors: ['Missing manifest.json in ZIP']
		};
	}

	errors.push(...validateManifest(manifest));

	// Check spaces
	const spaces: ImportPreviewSpace[] = [];
	for (const slug of manifest.spaces) {
		const spaceData = parseJsonEntry<ExportSpaceData>(zip, `spaces/${slug}/data.json`);
		if (!spaceData) {
			errors.push(`Missing data.json for space: ${slug}`);
			continue;
		}
		spaces.push({
			slug,
			display_name: spaceData.display_name,
			categories: spaceData.categories.length,
			items: spaceData.items.length,
			exists: slugExists(slug)
		});
	}

	// Check tags
	const tags: ImportPreviewTag[] = [];
	const tagsData = parseJsonEntry<ExportTags>(zip, 'global/tags.json');
	if (tagsData?.tags) {
		const globalDb = getGlobalDb();
		const existingTag = globalDb.prepare('SELECT id FROM tags WHERE name = ?');
		for (const tag of tagsData.tags) {
			tags.push({
				name: tag.name,
				color: tag.color,
				exists: !!existingTag.get(tag.name)
			});
		}
	}

	return {
		manifest,
		spaces,
		tags,
		valid: errors.length === 0,
		errors
	};
}

function findAvailableSlug(baseSlug: string): string {
	if (!slugExists(baseSlug)) return baseSlug;
	for (let i = 2; i <= 100; i++) {
		const candidate = `${baseSlug}-${i}`;
		if (candidate.length <= 64 && !slugExists(candidate)) return candidate;
	}
	throw new Error(`Could not find available slug for: ${baseSlug}`);
}

function topologicalSortCategories(categories: Category[]): Category[] {
	const sorted: Category[] = [];
	const visited = new Set<number>();
	const byId = new Map<number, Category>();
	for (const cat of categories) byId.set(cat.id, cat);

	function visit(cat: Category) {
		if (visited.has(cat.id)) return;
		if (cat.parent_id !== null) {
			const parent = byId.get(cat.parent_id);
			if (parent) visit(parent);
		}
		visited.add(cat.id);
		sorted.push(cat);
	}

	for (const cat of categories) visit(cat);
	return sorted;
}

function importTags(tagsData: ExportTags | null): Map<number, number> {
	const idMap = new Map<number, number>();
	if (!tagsData?.tags.length) return idMap;

	const globalDb = getGlobalDb();
	const insertTag = globalDb.prepare('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)');
	const getTag = globalDb.prepare('SELECT id FROM tags WHERE name = ?');

	for (const tag of tagsData.tags) {
		insertTag.run(tag.name, tag.color);
		const row = getTag.get(tag.name) as { id: number };
		idMap.set(tag.id, row.id);
	}

	return idMap;
}

function deleteExistingSpace(slug: string) {
	// Close cached connection
	closeDb(slug);
	// Delete DB file
	const dbPath = path.resolve('data', `${slug}.db`);
	for (const suffix of ['', '-wal', '-shm', '-journal']) {
		const f = dbPath + suffix;
		if (fs.existsSync(f)) fs.unlinkSync(f);
	}
	// Delete storage
	const storageDir = path.join(getStorageRoot(), slug);
	if (fs.existsSync(storageDir)) {
		fs.rmSync(storageDir, { recursive: true, force: true });
	}
}

function importSpace(
	zip: AdmZip,
	spaceData: ExportSpaceData,
	finalSlug: string,
	tagIdMap: Map<number, number>,
	includeFiles: boolean
): void {
	// Create the space DB
	const db = createDb(finalSlug, spaceData.display_name);

	// Write any additional meta entries
	const setMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
	for (const [key, value] of Object.entries(spaceData.meta)) {
		if (key !== 'display_name') {
			setMeta.run(key, value);
		}
	}

	// Sort categories so parents come before children
	const sortedCategories = topologicalSortCategories(spaceData.categories);

	const categoryIdMap = new Map<number, number>();
	const itemIdMap = new Map<number, number>();

	db.transaction(() => {
		// Insert categories
		const insertCat = db.prepare(
			'INSERT INTO categories (name, slug, color, sort_order, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
		);
		for (const cat of sortedCategories) {
			const newParentId = cat.parent_id !== null ? (categoryIdMap.get(cat.parent_id) ?? null) : null;
			const result = insertCat.run(cat.name, cat.slug, cat.color, cat.sort_order, newParentId, cat.created_at, cat.updated_at);
			categoryIdMap.set(cat.id, Number(result.lastInsertRowid));
		}

		// Insert items
		const insertItem = db.prepare(
			'INSERT INTO items (category_id, type, title, content, file_path, file_name, file_size, mime_type, description, favicon_url, sort_order, is_pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
		);
		for (const item of spaceData.items) {
			const newCategoryId = categoryIdMap.get(item.category_id);
			if (newCategoryId === undefined) continue; // orphaned item
			const result = insertItem.run(
				newCategoryId, item.type, item.title, item.content,
				item.file_path, item.file_name, item.file_size, item.mime_type,
				item.description, item.favicon_url, item.sort_order, item.is_pinned,
				item.created_at, item.updated_at
			);
			itemIdMap.set(item.id, Number(result.lastInsertRowid));
		}

		// Insert item_tags with remapped IDs
		const insertItemTag = db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)');
		for (const it of spaceData.item_tags) {
			const newItemId = itemIdMap.get(it.item_id);
			const newTagId = tagIdMap.get(it.tag_id);
			if (newItemId !== undefined && newTagId !== undefined) {
				insertItemTag.run(newItemId, newTagId);
			}
		}
	})();

	// Extract files
	if (includeFiles) {
		const prefix = `spaces/${spaceData.slug}/files/`;
		const storageRoot = getStorageRoot();
		for (const entry of zip.getEntries()) {
			if (entry.isDirectory) continue;
			if (!entry.entryName.startsWith(prefix)) continue;
			const relativePath = entry.entryName.slice(prefix.length);
			if (!relativePath) continue;

			const targetPath = path.resolve(storageRoot, finalSlug, relativePath);
			// Safety: ensure target is within storage
			const spaceStorageRoot = path.join(storageRoot, finalSlug);
			if (!targetPath.startsWith(spaceStorageRoot + path.sep) && targetPath !== spaceStorageRoot) continue;

			fs.mkdirSync(path.dirname(targetPath), { recursive: true });
			fs.writeFileSync(targetPath, entry.getData());
		}
	}
}

export function executeImport(zipBuffer: Buffer, options: ImportOptions): ImportResult {
	const zip = new AdmZip(zipBuffer);
	const result: ImportResult = {
		success: true,
		imported_spaces: [],
		imported_tags: 0,
		skipped_spaces: [],
		errors: []
	};

	const manifest = parseJsonEntry<ExportManifest>(zip, 'manifest.json');
	if (!manifest) {
		return { ...result, success: false, errors: ['Missing manifest.json'] };
	}

	const validationErrors = validateManifest(manifest);
	if (validationErrors.length > 0) {
		return { ...result, success: false, errors: validationErrors };
	}

	// Import tags first (global operation)
	const tagsData = parseJsonEntry<ExportTags>(zip, 'global/tags.json');
	const tagIdMap = importTags(tagsData);
	result.imported_tags = tagIdMap.size;

	// Import each space
	for (const slug of manifest.spaces) {
		const spaceData = parseJsonEntry<ExportSpaceData>(zip, `spaces/${slug}/data.json`);
		if (!spaceData) {
			result.errors.push(`Missing data.json for space: ${slug}`);
			continue;
		}

		const exists = slugExists(slug);
		let finalSlug = slug;

		if (exists) {
			switch (options.conflict_mode) {
				case 'skip':
					result.skipped_spaces.push(slug);
					continue;
				case 'rename':
					finalSlug = findAvailableSlug(slug);
					break;
				case 'replace':
					deleteExistingSpace(slug);
					break;
			}
		}

		try {
			importSpace(zip, spaceData, finalSlug, tagIdMap, manifest.include_files);
			result.imported_spaces.push(finalSlug);
		} catch (err) {
			result.errors.push(`Failed to import space ${slug}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	if (result.errors.length > 0 && result.imported_spaces.length === 0) {
		result.success = false;
	}

	return result;
}
