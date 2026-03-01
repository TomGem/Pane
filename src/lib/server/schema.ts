import type Database from 'better-sqlite3';

export function initGlobalSchema(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			color TEXT NOT NULL DEFAULT '#8b5cf6'
		);
	`);
}

export function migrateTagsToGlobal(spaceDb: Database.Database, globalDb: Database.Database) {
	// Check if the space still has a local tags table
	const hasTagsTable = spaceDb.prepare(
		"SELECT name FROM sqlite_master WHERE type='table' AND name='tags'"
	).get();
	if (!hasTagsTable) return; // Already migrated

	// Copy tags to global DB (first color wins on name collision)
	const localTags = spaceDb.prepare('SELECT id, name, color FROM tags').all() as { id: number; name: string; color: string }[];
	const insertGlobal = globalDb.prepare('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)');
	const getGlobalId = globalDb.prepare('SELECT id FROM tags WHERE name = ?');

	// Build old→new ID mapping
	const idMap = new Map<number, number>();
	for (const tag of localTags) {
		insertGlobal.run(tag.name, tag.color);
		const row = getGlobalId.get(tag.name) as { id: number };
		idMap.set(tag.id, row.id);
	}

	// Remap item_tags to use global IDs, then drop local tags table
	spaceDb.transaction(() => {
		const itemTags = spaceDb.prepare('SELECT item_id, tag_id FROM item_tags').all() as { item_id: number; tag_id: number }[];

		// Drop old item_tags (has FK to local tags)
		spaceDb.exec('DROP TABLE IF EXISTS item_tags');
		// Drop local tags table
		spaceDb.exec('DROP TABLE IF EXISTS tags');

		// Recreate item_tags without FK to tags (tags are now in global DB)
		spaceDb.exec(`
			CREATE TABLE IF NOT EXISTS item_tags (
				item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
				tag_id INTEGER NOT NULL,
				PRIMARY KEY (item_id, tag_id)
			);
		`);

		// Re-insert with remapped IDs
		const insert = spaceDb.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)');
		for (const it of itemTags) {
			const newTagId = idMap.get(it.tag_id);
			if (newTagId !== undefined) {
				insert.run(it.item_id, newTagId);
			}
		}
	})();
}

export function initSchema(db: Database.Database, displayName?: string) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			slug TEXT NOT NULL UNIQUE,
			color TEXT NOT NULL DEFAULT '#6366f1',
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
			type TEXT NOT NULL CHECK(type IN ('link', 'note', 'document')),
			title TEXT NOT NULL,
			content TEXT,
			file_path TEXT,
			file_name TEXT,
			file_size INTEGER,
			mime_type TEXT,
			description TEXT,
			favicon_url TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0,
			is_pinned INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS item_tags (
			item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
			tag_id INTEGER NOT NULL,
			PRIMARY KEY (item_id, tag_id)
		);

		CREATE TABLE IF NOT EXISTS meta (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
		CREATE INDEX IF NOT EXISTS idx_items_sort ON items(category_id, sort_order);
		CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
	`);

	// Migration: add favicon_url for link items
	const itemColumns = db.prepare('PRAGMA table_info(items)').all() as { name: string }[];
	if (!itemColumns.some((c) => c.name === 'favicon_url')) {
		db.exec('ALTER TABLE items ADD COLUMN favicon_url TEXT');
	}

	// Migration: add parent_id for hierarchical categories
	const columns = db.prepare('PRAGMA table_info(categories)').all() as { name: string }[];
	if (!columns.some((c) => c.name === 'parent_id')) {
		db.exec(`
			ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE;
			CREATE INDEX idx_categories_parent ON categories(parent_id);
			CREATE INDEX idx_categories_parent_sort ON categories(parent_id, sort_order);
		`);
	}

	// Insert display_name into meta if missing
	if (displayName) {
		const existing = getMeta(db, 'display_name');
		if (!existing) {
			setMeta(db, 'display_name', displayName);
		}
	}
}

export function setMeta(db: Database.Database, key: string, value: string) {
	db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
}

export function getMeta(db: Database.Database, key: string): string | null {
	const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
	return row?.value ?? null;
}
