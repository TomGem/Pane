import { getDb, createDb, slugExists } from '$lib/server/db';
import { initSchema } from '$lib/server/schema';
import fs from 'fs';
import path from 'path';

fs.mkdirSync('data', { recursive: true });
fs.mkdirSync('storage', { recursive: true });

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
} else {
	// Fresh install: create default space
	createDb('pane', 'Pane');
}
