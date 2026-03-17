import { json } from '@sveltejs/kit';
import { randomBytes, randomInt } from 'crypto';
import type { RequestHandler } from './$types';
import { getAuthDb } from '$lib/server/db';
import type { InviteCode } from '$lib/types';

const adjectives = [
	'bold', 'brave', 'bright', 'calm', 'clever', 'cool', 'crisp', 'cute',
	'daring', 'eager', 'fair', 'fast', 'fierce', 'fresh', 'gentle', 'glad',
	'grand', 'happy', 'keen', 'kind', 'lively', 'lucky', 'merry', 'neat',
	'noble', 'proud', 'quick', 'quiet', 'rapid', 'sharp', 'sleek', 'smart',
	'snowy', 'soft', 'steady', 'still', 'sunny', 'sure', 'swift', 'vivid',
	'warm', 'wild', 'wise', 'witty', 'young', 'zesty'
];

const nouns = [
	'badger', 'birch', 'brook', 'cedar', 'cliff', 'cloud', 'coral', 'crane',
	'creek', 'dawn', 'delta', 'dove', 'dune', 'eagle', 'elm', 'ember',
	'falcon', 'fern', 'finch', 'flame', 'flint', 'fox', 'frost', 'grove',
	'hawk', 'heron', 'hill', 'iris', 'ivy', 'jade', 'lake', 'lark',
	'leaf', 'lily', 'lynx', 'maple', 'marsh', 'moon', 'oak', 'otter',
	'peak', 'pine', 'pond', 'raven', 'reef', 'ridge', 'river', 'robin',
	'sage', 'shore', 'sky', 'slate', 'snow', 'spark', 'star', 'stone',
	'storm', 'swan', 'thorn', 'tide', 'trail', 'vale', 'wolf', 'wren'
];

function generateInviteCode(): string {
	const adj = adjectives[randomInt(adjectives.length)];
	const noun = nouns[randomInt(nouns.length)];
	const suffix = randomBytes(2).toString('hex');
	return `${adj}-${noun}-${suffix}`;
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const authDb = getAuthDb();
	const codes = authDb.prepare(
		'SELECT code, created_by, max_uses, use_count, expires_at, created_at FROM invite_codes ORDER BY created_at DESC'
	).all() as InviteCode[];

	return json({ codes });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const maxUses = Math.max(1, Math.min(1000, Number(body.max_uses) || 1));
		const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;

		const code = generateInviteCode();
		const authDb = getAuthDb();

		authDb.prepare(
			'INSERT INTO invite_codes (code, created_by, max_uses, expires_at) VALUES (?, ?, ?, ?)'
		).run(code, locals.user.id, maxUses, expiresAt);

		const created = authDb.prepare('SELECT * FROM invite_codes WHERE code = ?').get(code) as InviteCode;

		return json({ code: created }, { status: 201 });
	} catch (err) {
		console.error('Failed to create invite code:', err);
		return json({ error: 'Failed to create invite code' }, { status: 500 });
	}
};
