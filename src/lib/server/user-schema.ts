import type Database from 'better-sqlite3';

export function initUserSchema(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS spaces (
			slug TEXT PRIMARY KEY,
			display_name TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			color TEXT NOT NULL DEFAULT '#8b5cf6'
		);

		CREATE TABLE IF NOT EXISTS categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			space_slug TEXT NOT NULL REFERENCES spaces(slug) ON DELETE CASCADE,
			name TEXT NOT NULL,
			slug TEXT NOT NULL,
			color TEXT NOT NULL DEFAULT '#6366f1',
			sort_order INTEGER NOT NULL DEFAULT 0,
			parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now')),
			UNIQUE(space_slug, slug)
		);
		CREATE INDEX IF NOT EXISTS idx_categories_space ON categories(space_slug);
		CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
		CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
		CREATE INDEX IF NOT EXISTS idx_categories_parent_sort ON categories(parent_id, sort_order);

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
		CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
		CREATE INDEX IF NOT EXISTS idx_items_sort ON items(category_id, sort_order);

		CREATE TABLE IF NOT EXISTS item_tags (
			item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
			tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
			PRIMARY KEY (item_id, tag_id)
		);

		CREATE TABLE IF NOT EXISTS changelog (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			space_slug TEXT NOT NULL REFERENCES spaces(slug) ON DELETE CASCADE,
			action TEXT NOT NULL,
			entity_type TEXT NOT NULL,
			entity_id INTEGER,
			entity_title TEXT,
			user_id TEXT,
			user_name TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE INDEX IF NOT EXISTS idx_changelog_space ON changelog(space_slug);
		CREATE INDEX IF NOT EXISTS idx_changelog_created ON changelog(space_slug, created_at DESC);
	`);
}

export function createSpace(db: Database.Database, slug: string, displayName: string) {
	db.prepare('INSERT INTO spaces (slug, display_name) VALUES (?, ?)').run(slug, displayName);
}

export function spaceExists(db: Database.Database, slug: string): boolean {
	const row = db.prepare('SELECT slug FROM spaces WHERE slug = ?').get(slug);
	return !!row;
}

export function listUserSpaces(db: Database.Database): { slug: string; name: string }[] {
	return db.prepare('SELECT slug, display_name AS name FROM spaces ORDER BY display_name').all() as { slug: string; name: string }[];
}
