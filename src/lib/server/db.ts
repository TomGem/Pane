import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initSchema, getMeta } from './schema';
import type { Space } from '$lib/types';

const DATA_DIR = path.resolve('data');
const cache = new Map<string, Database.Database>();
let globalDb: Database.Database | null = null;

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export function validateSpaceSlug(slug: string): boolean {
	return SLUG_RE.test(slug);
}

export function slugExists(slug: string): boolean {
	if (!SLUG_RE.test(slug)) return false;
	return fs.existsSync(path.join(DATA_DIR, `${slug}.db`));
}

function openDb(slug: string): Database.Database {
	const dbPath = path.join(DATA_DIR, `${slug}.db`);
	const db = new Database(dbPath);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	return db;
}

export function getDb(slug: string): Database.Database {
	let db = cache.get(slug);
	if (!db) {
		if (!SLUG_RE.test(slug) || !fs.existsSync(path.join(DATA_DIR, `${slug}.db`))) {
			throw new Error(`Space '${slug}' does not exist`);
		}
		db = openDb(slug);
		cache.set(slug, db);
	}
	return db;
}

export function createDb(slug: string, displayName: string): Database.Database {
	const db = openDb(slug);
	initSchema(db, displayName);
	cache.set(slug, db);
	return db;
}

export function closeDb(slug: string) {
	const db = cache.get(slug);
	if (db) {
		db.close();
		cache.delete(slug);
	}
}

export function getGlobalDb(): Database.Database {
	if (!globalDb) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
		const dbPath = path.join(DATA_DIR, '_global.db');
		globalDb = new Database(dbPath);
		globalDb.pragma('journal_mode = WAL');
		globalDb.pragma('foreign_keys = ON');
	}
	return globalDb;
}

function closeAll() {
	for (const [, db] of cache) {
		try { db.close(); } catch { /* ignore */ }
	}
	cache.clear();
	if (globalDb) {
		try { globalDb.close(); } catch { /* ignore */ }
		globalDb = null;
	}
}

process.on('exit', closeAll);
process.on('SIGTERM', () => { closeAll(); process.exit(0); });
process.on('SIGINT', () => { closeAll(); process.exit(0); });

export function listSpaces(): Space[] {
	fs.mkdirSync(DATA_DIR, { recursive: true });
	const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.db') && !f.endsWith('-journal') && !f.endsWith('-wal') && !f.endsWith('-shm') && f !== '_global.db');
	const spaces: Space[] = [];

	for (const file of files) {
		const slug = file.replace(/\.db$/, '');
		try {
			const db = getDb(slug);
			const name = getMeta(db, 'display_name') ?? slug;
			spaces.push({ slug, name });
		} catch {
			// Skip corrupted/unreadable DBs
		}
	}

	return spaces.sort((a, b) => a.name.localeCompare(b.name));
}
