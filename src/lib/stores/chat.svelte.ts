import type { ChatMessage, PresenceUser } from '$lib/types';
import { api } from '$lib/utils/api';

function chatParams(spaceSlug: string, ownerId?: string): string {
	let p = `space=${encodeURIComponent(spaceSlug)}`;
	if (ownerId) p += `&owner=${encodeURIComponent(ownerId)}`;
	return p;
}

export function createChatStore(spaceSlug: string, ownerId: string | undefined, currentUserId: string) {
	let messages = $state<ChatMessage[]>([]);
	let onlineUsers = $state<PresenceUser[]>([]);
	let unreadCount = $state(0);
	let isOpen = $state(false);
	let loading = $state(false);
	let hasMore = $state(true);

	const params = chatParams(spaceSlug, ownerId);

	// Own SSE connection for chat/presence events
	let eventSource: EventSource | null = null;

	function connectSSE() {
		disconnectSSE();
		if (typeof window === 'undefined') return;
		eventSource = new EventSource(`/api/events?${params}`);
		eventSource.onmessage = (e) => {
			try {
				const event = JSON.parse(e.data);
				if (event.type?.startsWith('chat:') || event.type?.startsWith('presence:')) {
					handleEvent(event);
				}
			} catch {
				// Ignore non-chat events
			}
		};
	}

	function disconnectSSE() {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
	}

	async function loadMessages() {
		loading = true;
		try {
			const msgs = await api<ChatMessage[]>(`/api/chat?${params}`);
			messages = msgs;
			hasMore = msgs.length >= 50;
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (!hasMore || loading || messages.length === 0) return;
		loading = true;
		try {
			const oldest = messages[0];
			const older = await api<ChatMessage[]>(`/api/chat?${params}&before=${oldest.id}&limit=50`);
			if (older.length < 50) hasMore = false;
			if (older.length > 0) {
				messages = [...older, ...messages];
			}
		} finally {
			loading = false;
		}
	}

	async function loadPresence() {
		try {
			onlineUsers = await api<PresenceUser[]>(`/api/chat/presence?${params}`);
		} catch {
			// Ignore presence errors
		}
	}

	async function open() {
		isOpen = true;
		unreadCount = 0;
		await Promise.all([loadMessages(), loadPresence()]);
	}

	function close() {
		isOpen = false;
	}

	async function sendMessage(text: string) {
		const trimmed = text.trim();
		if (!trimmed) return;

		const msg = await api<ChatMessage>(`/api/chat?${params}`, {
			method: 'POST',
			body: JSON.stringify({ message: trimmed })
		});
		messages = [...messages, msg];
	}

	async function clearChat() {
		await api(`/api/chat?${params}`, { method: 'DELETE' });
		messages = [];
		hasMore = false;
	}

	function handleEvent(event: { type: string; data?: unknown }) {
		switch (event.type) {
			case 'chat:message': {
				const msg = event.data as ChatMessage;
				messages = [...messages, msg];
				if (!isOpen) {
					unreadCount++;
				}
				break;
			}
			case 'chat:cleared': {
				messages = [];
				hasMore = false;
				break;
			}
			case 'presence:joined': {
				const { userId } = event.data as { userId: string };
				if (!onlineUsers.some(u => u.id === userId)) {
					loadPresence();
				}
				break;
			}
			case 'presence:left': {
				const { userId } = event.data as { userId: string };
				onlineUsers = onlineUsers.filter(u => u.id !== userId);
				break;
			}
		}
	}

	return {
		get messages() { return messages; },
		get onlineUsers() { return onlineUsers; },
		get unreadCount() { return unreadCount; },
		get isOpen() { return isOpen; },
		get loading() { return loading; },
		get hasMore() { return hasMore; },
		get currentUserId() { return currentUserId; },
		open,
		close,
		sendMessage,
		loadMore,
		clearChat,
		handleEvent,
		connectSSE,
		disconnectSSE
	};
}

export type ChatStore = ReturnType<typeof createChatStore>;
