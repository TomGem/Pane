import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { subscribeUser } from '$lib/server/events';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorized');

	const userId = locals.userId;
	let unsubscribe: (() => void) | undefined;

	const stream = new ReadableStream<string>({
		start(controller) {
			unsubscribe = subscribeUser(userId, controller);
		},
		cancel() {
			unsubscribe?.();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
