const requests = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

export function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const timestamps = requests.get(ip) ?? [];
	const recent = timestamps.filter((t) => now - t < WINDOW_MS);
	if (recent.length >= MAX_REQUESTS) {
		requests.set(ip, recent);
		return true;
	}
	recent.push(now);
	requests.set(ip, recent);
	return false;
}

// Periodic cleanup to prevent memory leaks
setInterval(() => {
	const now = Date.now();
	for (const [ip, timestamps] of requests) {
		const recent = timestamps.filter((t) => now - t < WINDOW_MS);
		if (recent.length === 0) requests.delete(ip);
		else requests.set(ip, recent);
	}
}, WINDOW_MS);
