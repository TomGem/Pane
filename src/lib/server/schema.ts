import type Database from 'better-sqlite3';

export function initSchema(db: Database.Database) {
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
			sort_order INTEGER NOT NULL DEFAULT 0,
			is_pinned INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			color TEXT NOT NULL DEFAULT '#8b5cf6'
		);

		CREATE TABLE IF NOT EXISTS item_tags (
			item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
			tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
			PRIMARY KEY (item_id, tag_id)
		);

		CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
		CREATE INDEX IF NOT EXISTS idx_items_sort ON items(category_id, sort_order);
		CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
	`);

	// Migration: add parent_id for hierarchical categories
	const columns = db.prepare('PRAGMA table_info(categories)').all() as { name: string }[];
	if (!columns.some((c) => c.name === 'parent_id')) {
		db.exec(`
			ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE;
			CREATE INDEX idx_categories_parent ON categories(parent_id);
			CREATE INDEX idx_categories_parent_sort ON categories(parent_id, sort_order);
		`);
	}
}
