import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { resolveSpaceAccess } from '$lib/server/space';
import { getAuthDb } from '$lib/server/db';
import { emit } from '$lib/server/events';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.userId) throw error(401, 'Unauthorized');

	const access = resolveSpaceAccess(locals, url);
	const authDb = getAuthDb();

	const before = url.searchParams.get('before');
	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 100);

	let messages;
	if (before) {
		messages = authDb.prepare(`
			SELECT cm.id, cm.user_id, u.display_name, u.avatar_path, cm.message, cm.created_at
			FROM chat_messages cm
			JOIN users u ON u.id = cm.user_id
			WHERE cm.owner_id = ? AND cm.space_slug = ? AND cm.id < ?
			ORDER BY cm.created_at DESC, cm.id DESC
			LIMIT ?
		`).all(access.ownerId, access.spaceSlug, parseInt(before, 10), limit);
	} else {
		messages = authDb.prepare(`
			SELECT cm.id, cm.user_id, u.display_name, u.avatar_path, cm.message, cm.created_at
			FROM chat_messages cm
			JOIN users u ON u.id = cm.user_id
			WHERE cm.owner_id = ? AND cm.space_slug = ?
			ORDER BY cm.created_at DESC, cm.id DESC
			LIMIT ?
		`).all(access.ownerId, access.spaceSlug, limit);
	}

	// Reverse so they're in chronological order
	messages.reverse();

	return json(messages);
};

export const POST: RequestHandler = async ({ locals, url, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorized');

	const access = resolveSpaceAccess(locals, url);
	const authDb = getAuthDb();

	const body = await request.json();
	const message = (body.message ?? '').trim();

	if (!message) {
		throw error(400, 'Message is required');
	}
	if (message.length > 2000) {
		throw error(400, 'Message too long (max 2000 characters)');
	}

	const result = authDb.prepare(`
		INSERT INTO chat_messages (owner_id, space_slug, user_id, message)
		VALUES (?, ?, ?, ?)
	`).run(access.ownerId, access.spaceSlug, locals.userId, message);

	const user = authDb.prepare('SELECT display_name, avatar_path FROM users WHERE id = ?')
		.get(locals.userId) as { display_name: string; avatar_path: string | null };

	const chatMessage = {
		id: result.lastInsertRowid as number,
		user_id: locals.userId,
		display_name: user.display_name,
		avatar_path: user.avatar_path,
		message,
		created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
	};

	emit(access.ownerId, access.spaceSlug, {
		type: 'chat:message',
		timestamp: Date.now(),
		data: chatMessage
	}, locals.userId);

	return json(chatMessage, { status: 201 });
};

export const DELETE: RequestHandler = async ({ locals, url }) => {
	if (!locals.userId) throw error(401, 'Unauthorized');

	const access = resolveSpaceAccess(locals, url);

	if (access.permission !== 'owner') {
		throw error(403, 'Only the space owner can clear chat');
	}

	const authDb = getAuthDb();
	authDb.prepare('DELETE FROM chat_messages WHERE owner_id = ? AND space_slug = ?')
		.run(access.ownerId, access.spaceSlug);

	emit(access.ownerId, access.spaceSlug, {
		type: 'chat:cleared',
		timestamp: Date.now()
	}, locals.userId);

	return json({ success: true });
};
