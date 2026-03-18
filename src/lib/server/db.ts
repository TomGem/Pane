import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initUserSchema, listUserSpaces } from './user-schema';
import { initAuthSchema } from './auth-schema';
import type { Space } from '$lib/types';

const DATA_DIR = path.resolve('data');
const cache = new Map<string, Database.Database>();

const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function validateSpaceSlug(slug: string): boolean {
	return SLUG_RE.test(slug);
}

export function validateUserId(userId: string): boolean {
	return UUID_RE.test(userId) || userId === 'single-user';
}

function openDbAt(dbPath: string): Database.Database {
	const db = new Database(dbPath);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	return db;
}

// --- Auth DB ---

export function getAuthDb(): Database.Database {
	let db = cache.get('_auth');
	if (!db) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
		db = openDbAt(path.join(DATA_DIR, '_auth.db'));
		initAuthSchema(db);
		cache.set('_auth', db);
	}
	return db;
}

export function authDbExists(): boolean {
	return fs.existsSync(path.join(DATA_DIR, '_auth.db'));
}

// --- Per-User DB ---

export function getUserDb(userId: string): Database.Database {
	if (!validateUserId(userId)) {
		throw new Error(`Invalid user ID: '${userId}'`);
	}
	const cacheKey = `user:${userId}`;
	let db = cache.get(cacheKey);
	if (!db) {
		const dbPath = path.join(DATA_DIR, `${userId}.db`);
		if (!fs.existsSync(dbPath)) {
			throw new Error(`User database not found for '${userId}'`);
		}
		db = openDbAt(dbPath);
		cache.set(cacheKey, db);
	}
	return db;
}

export function createUserDb(userId: string): Database.Database {
	if (!validateUserId(userId)) {
		throw new Error(`Invalid user ID: '${userId}'`);
	}
	const cacheKey = `user:${userId}`;
	const dbPath = path.join(DATA_DIR, `${userId}.db`);
	fs.mkdirSync(DATA_DIR, { recursive: true });
	const db = openDbAt(dbPath);
	initUserSchema(db);
	cache.set(cacheKey, db);
	return db;
}

export function userDbExists(userId: string): boolean {
	return fs.existsSync(path.join(DATA_DIR, `${userId}.db`));
}

// --- Space listing (per-user) ---

export function listSpaces(userId: string): Space[] {
	const db = getUserDb(userId);
	return listUserSpaces(db);
}

// --- Storage quota ---

const DEFAULT_QUOTA = 1073741824; // 1 GB

export function getUserStorageUsage(userId: string): number {
	const db = getUserDb(userId);
	const row = db.prepare(
		'SELECT COALESCE(SUM(file_size), 0) AS total FROM items WHERE file_size IS NOT NULL'
	).get() as { total: number };
	return row.total;
}

export function getUserQuota(userId: string): number {
	const authDb = getAuthDb();
	const row = authDb.prepare(
		'SELECT storage_quota_bytes FROM users WHERE id = ?'
	).get(userId) as { storage_quota_bytes: number } | undefined;
	return row?.storage_quota_bytes ?? DEFAULT_QUOTA;
}

// --- Legacy DB access (used during migration only) ---

function openLegacyDb(slug: string): Database.Database {
	const dbPath = path.join(DATA_DIR, `${slug}.db`);
	const db = new Database(dbPath);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	return db;
}

export function getLegacyDb(slug: string): Database.Database {
	const cacheKey = `legacy:${slug}`;
	let db = cache.get(cacheKey);
	if (!db) {
		if (!SLUG_RE.test(slug) || !fs.existsSync(path.join(DATA_DIR, `${slug}.db`))) {
			throw new Error(`Space '${slug}' does not exist`);
		}
		db = openLegacyDb(slug);
		cache.set(cacheKey, db);
	}
	return db;
}

export function closeLegacyDb(slug: string) {
	const cacheKey = `legacy:${slug}`;
	const db = cache.get(cacheKey);
	if (db) {
		db.close();
		cache.delete(cacheKey);
	}
}

export function getLegacyGlobalDb(): Database.Database | null {
	const cacheKey = '_legacy_global';
	let db = cache.get(cacheKey);
	if (!db) {
		const dbPath = path.join(DATA_DIR, '_global.db');
		if (!fs.existsSync(dbPath)) return null;
		db = openDbAt(dbPath);
		cache.set(cacheKey, db);
	}
	return db;
}

export function listLegacySpaces(): { slug: string; name: string }[] {
	fs.mkdirSync(DATA_DIR, { recursive: true });
	const files = fs.readdirSync(DATA_DIR).filter(
		(f) =>
			f.endsWith('.db') &&
			!f.endsWith('-journal') &&
			!f.endsWith('-wal') &&
			!f.endsWith('-shm') &&
			f !== '_global.db' &&
			f !== '_auth.db' &&
			!UUID_RE.test(f.replace(/\.db$/, ''))
	);
	const spaces: { slug: string; name: string }[] = [];

	for (const file of files) {
		const slug = file.replace(/\.db$/, '');
		if (!SLUG_RE.test(slug)) continue;
		try {
			const db = getLegacyDb(slug);
			const row = db.prepare("SELECT value FROM meta WHERE key = 'display_name'").get() as { value: string } | undefined;
			spaces.push({ slug, name: row?.value ?? slug });
		} catch {
			// Skip corrupted DBs
		}
	}

	return spaces.sort((a, b) => a.name.localeCompare(b.name));
}

export function getDataDir(): string {
	return DATA_DIR;
}

// --- Cleanup ---

function closeAll() {
	for (const [, db] of cache) {
		try {
			db.close();
		} catch {
			/* ignore */
		}
	}
	cache.clear();
}

process.on('exit', closeAll);
process.on('SIGTERM', () => {
	closeAll();
	process.exit(0);
});
process.on('SIGINT', () => {
	closeAll();
	process.exit(0);
});
