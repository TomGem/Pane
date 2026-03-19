import type Database from 'better-sqlite3';
import type { ChangelogEntry } from '$lib/types';

interface LogChangeParams {
	db: Database.Database;
	spaceSlug: string;
	action: string;
	entityType: 'item' | 'category' | 'tag' | 'space';
	entityId?: number | null;
	entityTitle?: string | null;
	userId?: string | null;
	userName?: string | null;
}

export function logChange({ db, spaceSlug, action, entityType, entityId, entityTitle, userId, userName }: LogChangeParams): void {
	db.prepare(
		`INSERT INTO changelog (space_slug, action, entity_type, entity_id, entity_title, user_id, user_name)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`
	).run(spaceSlug, action, entityType, entityId ?? null, entityTitle ?? null, userId ?? null, userName ?? null);
}

export function getChangelog(db: Database.Database, spaceSlug: string, limit = 50, offset = 0): ChangelogEntry[] {
	return db.prepare(
		`SELECT * FROM changelog WHERE space_slug = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
	).all(spaceSlug, limit, offset) as ChangelogEntry[];
}
