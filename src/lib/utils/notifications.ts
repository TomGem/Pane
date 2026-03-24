let channel: BroadcastChannel | null = null;
const claimed = new Set<string>();

function getChannel(): BroadcastChannel | null {
	if (typeof BroadcastChannel === 'undefined') return null;
	if (!channel) {
		channel = new BroadcastChannel('pane-notifications');
		channel.onmessage = (e) => {
			if (e.data?.type === 'claim') {
				claimed.add(e.data.id);
			}
		};
	}
	return channel;
}

async function tryClaimNotification(id: string): Promise<boolean> {
	const ch = getChannel();
	if (!ch) return true;
	ch.postMessage({ type: 'claim', id });
	await new Promise((r) => setTimeout(r, 50));
	if (claimed.has(id)) {
		claimed.delete(id);
		return false;
	}
	return true;
}

function isSupported(): boolean {
	return typeof window !== 'undefined' && 'Notification' in window;
}

export function requestPermissionIfNeeded(): void {
	if (!isSupported()) return;
	if (Notification.permission === 'default') {
		Notification.requestPermission();
	}
}

export function isTabHidden(): boolean {
	return typeof document !== 'undefined' && document.hidden;
}

export async function showChatNotification(senderName: string, messageText: string): Promise<void> {
	if (!isSupported() || Notification.permission !== 'granted') return;

	const id = `chat:${Date.now()}:${senderName}`;
	if (!(await tryClaimNotification(id))) return;

	const notification = new Notification(senderName, {
		body: messageText.length > 100 ? messageText.slice(0, 100) + '...' : messageText,
		icon: '/favicon.svg'
	});
	notification.onclick = () => {
		window.focus();
		notification.close();
	};
	setTimeout(() => notification.close(), 5000);
}

export async function showShareNotification(ownerName: string, spaceName: string): Promise<void> {
	if (!isSupported() || Notification.permission !== 'granted') return;

	const id = `share:${Date.now()}:${spaceName}`;
	if (!(await tryClaimNotification(id))) return;

	const notification = new Notification('Pane', {
		body: `${ownerName} shared '${spaceName}' with you`,
		icon: '/favicon.svg'
	});
	notification.onclick = () => {
		window.focus();
		notification.close();
	};
	setTimeout(() => notification.close(), 5000);
}
