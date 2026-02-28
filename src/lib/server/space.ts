import type Database from 'better-sqlite3';
import { getDb, validateSpaceSlug } from './db';
import { error } from '@sveltejs/kit';

export function getSpaceSlug(url: URL): string {
	const slug = url.searchParams.get('space');
	if (!slug) {
		throw error(400, 'Missing space parameter');
	}
	if (!validateSpaceSlug(slug)) {
		throw error(400, 'Invalid space slug');
	}
	return slug;
}

export function getSpaceDb(url: URL): Database.Database {
	const slug = getSpaceSlug(url);
	return getDb(slug);
}
