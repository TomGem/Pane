import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
	getAuthDb,
	authDbExists,
	createUserDb,
	getLegacyDb,
	getLegacyGlobalDb,
	listLegacySpaces,
	closeLegacyDb,
	getDataDir
} from './db';
import { getAuthMeta, setAuthMeta } from './auth-schema';
import { createSpace } from './user-schema';

const MIGRATION_VERSION = '1';
const STORAGE_ROOT = path.resolve('storage');

export function needsMigration(): boolean {
	if (authDbExists()) {
		const authDb = getAuthDb();
		const version = getAuthMeta(authDb, 'migration_version');
		return version !== MIGRATION_VERSION;
	}
	// No auth DB yet — check if there are legacy space DBs to migrate
	const dataDir = getDataDir();
	if (!fs.existsSync(dataDir)) return false;
	const files = fs.readdirSync(dataDir).filter(
		(f) => f.endsWith('.db') && f !== '_global.db' && f !== '_auth.db'
	);
	return files.length > 0;
}

export function runMigration(): string {
	const authDb = getAuthDb();

	// Check if already migrated
	const version = getAuthMeta(authDb, 'migration_version');
	if (version === MIGRATION_VERSION) {
		// Find existing admin user
		const admin = authDb.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: string } | undefined;
		return admin?.id ?? '';
	}

	const legacySpaces = listLegacySpaces();
	if (legacySpaces.length === 0) {
		// Fresh install, no legacy data — just mark as migrated
		setAuthMeta(authDb, 'migration_version', MIGRATION_VERSION);
		return '';
	}

	// Create legacy admin user with placeholder password
	const legacyUserId = randomUUID();
	authDb.prepare(
		`INSERT INTO users (id, email, email_verified, password_hash, display_name, role)
		 VALUES (?, ?, 1, ?, ?, ?)`
	).run(legacyUserId, 'admin@localhost', '__MUST_CHANGE__', 'Admin', 'admin');

	// Create user DB
	const userDb = createUserDb(legacyUserId);

	// Migrate global tags first
	const globalDb = getLegacyGlobalDb();
	const tagIdMap = new Map<number, number>();
	if (globalDb) {
		const globalTags = globalDb.prepare('SELECT id, name, color FROM tags').all() as { id: number; name: string; color: string }[];
		const insertTag = userDb.prepare('INSERT INTO tags (name, color) VALUES (?, ?)');
		for (const tag of globalTags) {
			const result = insertTag.run(tag.name, tag.color);
			tagIdMap.set(tag.id, result.lastInsertRowid as number);
		}
	}

	// Migrate each space
	for (const space of legacySpaces) {
		migrateSpace(space.slug, space.name, legacyUserId, userDb, tagIdMap);
	}

	// Move storage directories
	for (const space of legacySpaces) {
		moveStorageDir(space.slug, legacyUserId);
	}

	// Archive old DB files
	archiveOldDbs(legacySpaces);

	// Mark migration complete
	setAuthMeta(authDb, 'migration_version', MIGRATION_VERSION);

	return legacyUserId;
}

function migrateSpace(
	slug: string,
	displayName: string,
	userId: string,
	userDb: ReturnType<typeof createUserDb>,
	tagIdMap: Map<number, number>
) {
	const legacyDb = getLegacyDb(slug);

	// Create space in user DB
	createSpace(userDb, slug, displayName);

	// Copy categories (maintaining IDs via explicit insert)
	const categories = legacyDb.prepare('SELECT * FROM categories ORDER BY id').all() as Record<string, unknown>[];
	const categoryIdMap = new Map<number, number>();

	// Insert categories in two passes: first without parent_id, then update parent_id
	const insertCategory = userDb.prepare(
		`INSERT INTO categories (space_slug, name, slug, color, sort_order, parent_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
	);

	userDb.transaction(() => {
		for (const cat of categories) {
			const result = insertCategory.run(
				slug,
				cat.name,
				cat.slug,
				cat.color,
				cat.sort_order,
				cat.created_at,
				cat.updated_at
			);
			categoryIdMap.set(cat.id as number, result.lastInsertRowid as number);
		}

		// Update parent_id references
		const updateParent = userDb.prepare('UPDATE categories SET parent_id = ? WHERE id = ?');
		for (const cat of categories) {
			if (cat.parent_id != null) {
				const newId = categoryIdMap.get(cat.id as number);
				const newParentId = categoryIdMap.get(cat.parent_id as number);
				if (newId !== undefined && newParentId !== undefined) {
					updateParent.run(newParentId, newId);
				}
			}
		}

		// Copy items
		const items = legacyDb.prepare('SELECT * FROM items ORDER BY id').all() as Record<string, unknown>[];
		const itemIdMap = new Map<number, number>();
		const insertItem = userDb.prepare(
			`INSERT INTO items (category_id, type, title, content, file_path, file_name, file_size, mime_type, description, favicon_url, sort_order, is_pinned, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);

		for (const item of items) {
			const newCategoryId = categoryIdMap.get(item.category_id as number);
			if (newCategoryId === undefined) continue;
			const result = insertItem.run(
				newCategoryId,
				item.type,
				item.title,
				item.content,
				item.file_path,
				item.file_name,
				item.file_size,
				item.mime_type,
				item.description,
				item.favicon_url,
				item.sort_order,
				item.is_pinned,
				item.created_at,
				item.updated_at
			);
			itemIdMap.set(item.id as number, result.lastInsertRowid as number);
		}

		// Copy item_tags with remapped IDs
		const itemTags = legacyDb.prepare('SELECT item_id, tag_id FROM item_tags').all() as { item_id: number; tag_id: number }[];
		const insertItemTag = userDb.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)');

		for (const it of itemTags) {
			const newItemId = itemIdMap.get(it.item_id);
			const newTagId = tagIdMap.get(it.tag_id);
			if (newItemId !== undefined && newTagId !== undefined) {
				insertItemTag.run(newItemId, newTagId);
			}
		}
	})();

	closeLegacyDb(slug);
}

function moveStorageDir(spaceSlug: string, userId: string) {
	const oldDir = path.join(STORAGE_ROOT, spaceSlug);
	const newDir = path.join(STORAGE_ROOT, userId, spaceSlug);

	if (!fs.existsSync(oldDir)) return;

	fs.mkdirSync(path.dirname(newDir), { recursive: true });
	fs.renameSync(oldDir, newDir);
}

function archiveOldDbs(spaces: { slug: string }[]) {
	const dataDir = getDataDir();
	const archiveDir = path.join(dataDir, '_migrated');
	fs.mkdirSync(archiveDir, { recursive: true });

	for (const space of spaces) {
		const extensions = ['.db', '.db-wal', '.db-shm', '.db-journal'];
		for (const ext of extensions) {
			const src = path.join(dataDir, `${space.slug}${ext}`);
			if (fs.existsSync(src)) {
				fs.renameSync(src, path.join(archiveDir, `${space.slug}${ext}`));
			}
		}
	}

	// Archive global DB
	const globalExtensions = ['.db', '.db-wal', '.db-shm', '.db-journal'];
	for (const ext of globalExtensions) {
		const src = path.join(dataDir, `_global${ext}`);
		if (fs.existsSync(src)) {
			fs.renameSync(src, path.join(archiveDir, `_global${ext}`));
		}
	}
}
