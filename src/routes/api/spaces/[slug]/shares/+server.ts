import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthDb, getUserDb, validateSpaceSlug } from '$lib/server/db';
import { spaceExists } from '$lib/server/user-schema';
import { sendSpaceInvitationEmail } from '$lib/server/email';
import { emitToUser } from '$lib/server/events';
import type { SpaceShare, User } from '$lib/types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const slug = params.slug;
	if (!validateSpaceSlug(slug)) return json({ error: 'Invalid space slug' }, { status: 400 });

	const db = getUserDb(locals.userId);
	if (!spaceExists(db, slug)) return json({ error: 'Space not found' }, { status: 404 });

	const authDb = getAuthDb();
	const shares = authDb.prepare(`
		SELECT ss.id, ss.owner_id, ss.space_slug, ss.shared_with, ss.permission, ss.created_at,
		       u.email, u.display_name, u.show_email
		FROM space_shares ss
		JOIN users u ON u.id = ss.shared_with
		WHERE ss.owner_id = ? AND ss.space_slug = ?
		ORDER BY ss.created_at DESC
	`).all(locals.userId, slug) as (SpaceShare & { email: string; display_name: string; show_email: number })[];

	const isAdmin = locals.user?.role === 'admin';

	return json({
		shares: shares.map(s => {
			const { show_email, ...rest } = s;
			return {
				...rest,
				email: (isAdmin || show_email === 1) ? s.email : null
			};
		})
	});
};

export const POST: RequestHandler = async ({ params, request, locals, url }) => {
	if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const slug = params.slug;
	if (!validateSpaceSlug(slug)) return json({ error: 'Invalid space slug' }, { status: 400 });

	const db = getUserDb(locals.userId);
	if (!spaceExists(db, slug)) return json({ error: 'Space not found' }, { status: 404 });

	try {
		const body = await request.json();
		const { permission, user_id } = body;
		const identifier: string | undefined = body.identifier ?? body.email;

		if ((!identifier || typeof identifier !== 'string') && !user_id) {
			return json({ error: 'A username or email is required' }, { status: 400 });
		}

		if (!permission || !['read', 'write'].includes(permission)) {
			return json({ error: 'Permission must be "read" or "write"' }, { status: 400 });
		}

		const authDb = getAuthDb();

		// Cannot share with yourself
		if (user_id && user_id === locals.userId) {
			return json({ error: 'Cannot share a space with yourself' }, { status: 400 });
		}
		const self = authDb.prepare('SELECT email FROM users WHERE id = ?').get(locals.userId) as { email: string } | undefined;

		// Find the target user by user_id, email, or display_name
		let targetUser: Pick<User, 'id' | 'email' | 'display_name'> | undefined;

		if (user_id) {
			targetUser = authDb.prepare('SELECT id, email, display_name FROM users WHERE id = ?')
				.get(user_id) as Pick<User, 'id' | 'email' | 'display_name'> | undefined;
		} else {
			const trimmed = identifier!.trim();
			if (trimmed.includes('@')) {
				const normalizedEmail = trimmed.toLowerCase();
				if (self && self.email === normalizedEmail) {
					return json({ error: 'Cannot share a space with yourself' }, { status: 400 });
				}
				targetUser = authDb.prepare('SELECT id, email, display_name FROM users WHERE email = ?')
					.get(normalizedEmail) as Pick<User, 'id' | 'email' | 'display_name'> | undefined;
			} else {
				// Search by display_name (exact match, case-insensitive)
				const matches = authDb.prepare(
					'SELECT id, email, display_name FROM users WHERE display_name = ? COLLATE NOCASE AND id != ?'
				).all(trimmed, locals.userId) as Pick<User, 'id' | 'email' | 'display_name'>[];
				if (matches.length === 1) {
					targetUser = matches[0];
				} else if (matches.length > 1) {
					return json({ error: 'Multiple users have that name. Please use their email address instead.' }, { status: 400 });
				}
			}
		}

		if (targetUser && targetUser.id === locals.userId) {
			return json({ error: 'Cannot share a space with yourself' }, { status: 400 });
		}

		if (!targetUser) {
			return json({ error: 'No user found. They may need to register first.' }, { status: 404 });
		}

		// Check if share already exists
		const existing = authDb.prepare(
			'SELECT id FROM space_shares WHERE owner_id = ? AND space_slug = ? AND shared_with = ?'
		).get(locals.userId, slug, targetUser.id);

		if (existing) {
			return json({ error: 'Space is already shared with this user' }, { status: 409 });
		}

		// Create the share
		const result = authDb.prepare(
			'INSERT INTO space_shares (owner_id, space_slug, shared_with, permission) VALUES (?, ?, ?, ?)'
		).run(locals.userId, slug, targetUser.id, permission);

		// Get space display name for the email
		const spaceRow = db.prepare('SELECT display_name FROM spaces WHERE slug = ?').get(slug) as { display_name: string } | undefined;
		const spaceName = spaceRow?.display_name ?? slug;

		// Send notification email
		const appUrl = `${url.origin}/s/${slug}?owner=${locals.userId}`;
		await sendSpaceInvitationEmail(
			targetUser.email,
			locals.user!.display_name,
			spaceName,
			permission as 'read' | 'write',
			appUrl
		);

		// Notify the target user's dashboard via SSE
		emitToUser(targetUser.id, { type: 'share:created', timestamp: Date.now() });

		// Check if target user allows showing email
		const targetUserFull = authDb.prepare('SELECT show_email FROM users WHERE id = ?').get(targetUser.id) as { show_email: number } | undefined;
		const canSeeEmail = locals.user?.role === 'admin' || targetUserFull?.show_email === 1;

		return json({
			share: {
				id: result.lastInsertRowid,
				owner_id: locals.userId,
				space_slug: slug,
				shared_with: targetUser.id,
				permission,
				email: canSeeEmail ? targetUser.email : null,
				display_name: targetUser.display_name
			}
		}, { status: 201 });
	} catch (err) {
		console.error('Failed to create share:', err);
		return json({ error: 'Failed to share space' }, { status: 500 });
	}
};
