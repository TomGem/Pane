import type { SpaceEvent } from '$lib/types';

interface Subscriber {
	userId: string;
	send: (event: SpaceEvent) => void;
	close: () => void;
}

const channels = new Map<string, Set<Subscriber>>();

function channelKey(ownerId: string, spaceSlug: string): string {
	return `${ownerId}:${spaceSlug}`;
}

export function subscribe(
	ownerId: string,
	spaceSlug: string,
	userId: string,
	controller: ReadableStreamDefaultController
): () => void {
	const key = channelKey(ownerId, spaceSlug);
	if (!channels.has(key)) {
		channels.set(key, new Set());
	}

	const subscriber: Subscriber = {
		userId,
		send(event: SpaceEvent) {
			try {
				controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
			} catch {
				// Connection dead — will be cleaned up
			}
		},
		close() {
			try {
				controller.close();
			} catch {
				// Already closed
			}
		}
	};

	channels.get(key)!.add(subscriber);

	// Heartbeat to keep connection alive through proxies
	const heartbeat = setInterval(() => {
		try {
			controller.enqueue(`: heartbeat\n\n`);
		} catch {
			clearInterval(heartbeat);
		}
	}, 30_000);

	return () => {
		clearInterval(heartbeat);
		const subs = channels.get(key);
		if (subs) {
			subs.delete(subscriber);
			if (subs.size === 0) {
				channels.delete(key);
			}
		}
	};
}

export function subscribeUser(
	userId: string,
	controller: ReadableStreamDefaultController
): () => void {
	const key = `user:${userId}`;
	if (!channels.has(key)) {
		channels.set(key, new Set());
	}

	const subscriber: Subscriber = {
		userId,
		send(event: SpaceEvent) {
			try {
				controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
			} catch {
				// Connection dead
			}
		},
		close() {
			try {
				controller.close();
			} catch {
				// Already closed
			}
		}
	};

	channels.get(key)!.add(subscriber);

	const heartbeat = setInterval(() => {
		try {
			controller.enqueue(`: heartbeat\n\n`);
		} catch {
			clearInterval(heartbeat);
		}
	}, 30_000);

	return () => {
		clearInterval(heartbeat);
		const subs = channels.get(key);
		if (subs) {
			subs.delete(subscriber);
			if (subs.size === 0) {
				channels.delete(key);
			}
		}
	};
}

export function emitToUser(userId: string, event: SpaceEvent): void {
	const key = `user:${userId}`;
	const subs = channels.get(key);
	if (!subs) return;

	for (const sub of subs) {
		sub.send(event);
	}
}

export function emit(
	ownerId: string,
	spaceSlug: string,
	event: SpaceEvent,
	excludeUserId?: string | null
): void {
	const key = channelKey(ownerId, spaceSlug);
	const subs = channels.get(key);
	if (!subs) return;

	for (const sub of subs) {
		if (excludeUserId && sub.userId === excludeUserId) continue;
		sub.send(event);
	}
}
