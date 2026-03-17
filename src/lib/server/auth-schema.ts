import type Database from 'better-sqlite3';

export function initAuthSchema(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			email_verified INTEGER NOT NULL DEFAULT 0,
			password_hash TEXT NOT NULL,
			display_name TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
			blocked INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
		CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

		CREATE TABLE IF NOT EXISTS email_verifications (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			code TEXT NOT NULL,
			expires_at TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);

		CREATE TABLE IF NOT EXISTS invite_codes (
			code TEXT PRIMARY KEY,
			created_by TEXT NOT NULL REFERENCES users(id),
			max_uses INTEGER NOT NULL DEFAULT 1,
			use_count INTEGER NOT NULL DEFAULT 0,
			expires_at TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS space_shares (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			space_slug TEXT NOT NULL,
			shared_with TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			permission TEXT NOT NULL DEFAULT 'read' CHECK(permission IN ('read', 'write')),
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			UNIQUE(owner_id, space_slug, shared_with)
		);
		CREATE INDEX IF NOT EXISTS idx_space_shares_shared_with ON space_shares(shared_with);
		CREATE INDEX IF NOT EXISTS idx_space_shares_owner ON space_shares(owner_id, space_slug);

		CREATE TABLE IF NOT EXISTS oauth_accounts (
			provider TEXT NOT NULL,
			provider_user_id TEXT NOT NULL,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (provider, provider_user_id)
		);
		CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);

		CREATE TABLE IF NOT EXISTS meta (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`);

	// Add missing columns (migration for existing DBs)
	const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
	if (!cols.some((c) => c.name === 'blocked')) {
		db.exec("ALTER TABLE users ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0");
	}
	if (!cols.some((c) => c.name === 'storage_quota_bytes')) {
		db.exec("ALTER TABLE users ADD COLUMN storage_quota_bytes INTEGER NOT NULL DEFAULT 1073741824");
	}
}

export function getAuthMeta(db: Database.Database, key: string): string | null {
	const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
	return row?.value ?? null;
}

export function setAuthMeta(db: Database.Database, key: string, value: string) {
	db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
}
