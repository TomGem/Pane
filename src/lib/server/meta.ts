const MAX_FETCH_SIZE = 1024 * 1024; // 1 MB — YouTube inlines ~600KB of JS before meta tags

export function isPrivateUrl(urlStr: string): boolean {
	try {
		const parsed = new URL(urlStr);
		if (!['http:', 'https:'].includes(parsed.protocol)) return true;
		const hostname = parsed.hostname;
		if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return true;
		// Reject private IP ranges
		const parts = hostname.split('.').map(Number);
		if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
			if (parts[0] === 10) return true;
			if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
			if (parts[0] === 192 && parts[1] === 168) return true;
			if (parts[0] === 169 && parts[1] === 254) return true;
			if (parts[0] === 0) return true;
		}
		return false;
	} catch {
		return true;
	}
}

export async function fetchPageMeta(url: string): Promise<{ title: string | null; description: string | null; favicon: string | null; unavailable: boolean }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);
	const unavailableResult = { title: null, description: null, favicon: null, unavailable: true };
	try {
		let currentUrl = url;
		let redirects = 0;
		const MAX_REDIRECTS = 5;

		while (redirects < MAX_REDIRECTS) {
			if (isPrivateUrl(currentUrl)) return unavailableResult;

			const res = await fetch(currentUrl, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'en-US,en;q=0.9'
				},
				signal: controller.signal,
				redirect: 'manual'
			});

			if (res.status >= 300 && res.status < 400) {
				const location = res.headers.get('location');
				if (!location) return unavailableResult;
				currentUrl = new URL(location, currentUrl).href;
				redirects++;
				continue;
			}

			if (!res.ok) return unavailableResult;

			const contentType = res.headers.get('content-type') ?? '';
			if (!contentType.includes('text/html')) return { title: null, description: null, favicon: null, unavailable: false };
			const contentLength = Number(res.headers.get('content-length'));
			if (contentLength > MAX_FETCH_SIZE) return { title: null, description: null, favicon: null, unavailable: false };
			const reader = res.body?.getReader();
			if (!reader) return { title: null, description: null, favicon: null, unavailable: false };
			const chunks: Uint8Array[] = [];
			let totalSize = 0;
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				totalSize += value.byteLength;
				chunks.push(value);
				if (totalSize >= MAX_FETCH_SIZE) break;
			}
			reader.cancel().catch(() => {});
			const text = new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_FETCH_SIZE));
			let title: string | null = null;
			const ogTitleMatch = text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
				?? text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
			const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
			if (ogTitleMatch?.[1]) {
				title = ogTitleMatch[1].trim().replace(/\s+/g, ' ') || null;
			} else if (titleMatch?.[1]) {
				title = titleMatch[1].trim().replace(/\s+/g, ' ') || null;
			}
			let description: string | null = null;
			const ogDescMatch = text.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
				?? text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
			const descMatch = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
				?? text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
			if (ogDescMatch?.[1]) {
				description = ogDescMatch[1].trim() || null;
			} else if (descMatch?.[1]) {
				description = descMatch[1].trim() || null;
			}

			// Extract favicon
			let favicon: string | null = null;
			const origin = new URL(currentUrl).origin;
			const iconMatch = text.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
				?? text.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
			const appleTouchMatch = text.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i)
				?? text.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);
			if (iconMatch?.[1]) {
				favicon = new URL(iconMatch[1], currentUrl).href;
			} else if (appleTouchMatch?.[1]) {
				favicon = new URL(appleTouchMatch[1], currentUrl).href;
			} else {
				favicon = `${origin}/favicon.ico`;
			}

			return { title, description, favicon, unavailable: false };
		}
		return unavailableResult;
	} catch {
		return unavailableResult;
	} finally {
		clearTimeout(timeout);
	}
}
