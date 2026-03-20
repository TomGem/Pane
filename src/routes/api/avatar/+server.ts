import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';
import fs from 'fs';
import path from 'path';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/gif': 'gif',
	'image/webp': 'webp'
};

function getAvatarDir(userId: string): string {
	return path.join('storage', userId);
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const authDb = getAuthDb();
	const row = authDb.prepare('SELECT avatar_path FROM users WHERE id = ?').get(locals.userId) as { avatar_path: string | null } | undefined;

	if (!row?.avatar_path) {
		return new Response(null, { status: 404 });
	}

	const filePath = path.join('storage', locals.userId, row.avatar_path);

	// Prevent path traversal
	const resolved = path.resolve(filePath);
	const storageRoot = path.resolve('storage', locals.userId);
	if (!resolved.startsWith(storageRoot)) {
		return json({ error: 'Invalid path' }, { status: 400 });
	}

	if (!fs.existsSync(filePath)) {
		return new Response(null, { status: 404 });
	}

	const ext = path.extname(row.avatar_path).slice(1).toLowerCase();
	const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
	const contentType = mimeMap[ext] || 'application/octet-stream';

	const buffer = fs.readFileSync(filePath);
	return new Response(buffer, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'private, max-age=3600'
		}
	});
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		return json({ error: 'File is required' }, { status: 400 });
	}

	if (file.size > MAX_AVATAR_SIZE) {
		return json({ error: 'File size exceeds the 2 MB limit' }, { status: 413 });
	}

	if (!ALLOWED_TYPES.includes(file.type)) {
		return json({ error: 'Only JPEG, PNG, GIF, and WebP images are allowed' }, { status: 400 });
	}

	const ext = MIME_TO_EXT[file.type];
	const avatarFilename = `avatar.${ext}`;
	const avatarDir = getAvatarDir(locals.userId);

	// Delete old avatar if exists
	const authDb = getAuthDb();
	const existing = authDb.prepare('SELECT avatar_path FROM users WHERE id = ?').get(locals.userId) as { avatar_path: string | null } | undefined;
	if (existing?.avatar_path) {
		const oldPath = path.join('storage', locals.userId, existing.avatar_path);
		if (fs.existsSync(oldPath)) {
			fs.unlinkSync(oldPath);
		}
	}

	// Save new avatar
	fs.mkdirSync(avatarDir, { recursive: true });
	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);
	fs.writeFileSync(path.join(avatarDir, avatarFilename), buffer);

	// Update DB
	authDb.prepare('UPDATE users SET avatar_path = ?, updated_at = datetime(?) WHERE id = ?')
		.run(avatarFilename, new Date().toISOString(), locals.userId);

	return json({ avatar_path: avatarFilename });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const authDb = getAuthDb();
	const row = authDb.prepare('SELECT avatar_path FROM users WHERE id = ?').get(locals.userId) as { avatar_path: string | null } | undefined;

	if (row?.avatar_path) {
		const filePath = path.join('storage', locals.userId, row.avatar_path);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
	}

	authDb.prepare('UPDATE users SET avatar_path = NULL, updated_at = datetime(?) WHERE id = ?')
		.run(new Date().toISOString(), locals.userId);

	return json({ success: true });
};
