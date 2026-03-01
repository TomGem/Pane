import type { Handle } from '@sveltejs/kit';
import { getDb, createDb, slugExists, getGlobalDb, listSpaces } from '$lib/server/db';
import { initSchema, initGlobalSchema, migrateTagsToGlobal } from '$lib/server/schema';
import { isRateLimited } from '$lib/server/rate-limit';
import fs from 'fs';
import path from 'path';

fs.mkdirSync('data', { recursive: true });
fs.mkdirSync('storage', { recursive: true });

// Initialize global tags database
const globalDb = getGlobalDb();
initGlobalSchema(globalDb);

if (slugExists('pane')) {
	// Existing install: open and ensure schema + meta table
	const db = getDb('pane');
	initSchema(db, 'Pane');

	// Migration: move flat storage/* into storage/pane/ if not already namespaced
	const paneStorageDir = path.resolve('storage', 'pane');
	if (!fs.existsSync(paneStorageDir)) {
		const storageRoot = path.resolve('storage');
		const entries = fs.readdirSync(storageRoot);
		// If there are any subdirectories (old category-slug dirs), move them
		const dirsToMove = entries.filter((e) => {
			const full = path.join(storageRoot, e);
			return fs.statSync(full).isDirectory() && e !== 'pane';
		});
		if (dirsToMove.length > 0) {
			fs.mkdirSync(paneStorageDir, { recursive: true });
			for (const dir of dirsToMove) {
				fs.renameSync(path.join(storageRoot, dir), path.join(paneStorageDir, dir));
			}
		}
	}
} else if (!slugExists('desk')) {
	// Fresh install: create default space
	createDb('desk', 'Desk');
}

// Run schema migrations and tag migration for all existing spaces (idempotent)
for (const space of listSpaces()) {
	const spaceDb = getDb(space.slug);
	initSchema(spaceDb);
	migrateTagsToGlobal(spaceDb, globalDb);
}

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/')) {
		const ip = event.getClientAddress();
		if (isRateLimited(ip)) {
			return new Response(JSON.stringify({ error: 'Too many requests' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
			});
		}
	}
	return resolve(event);
};
