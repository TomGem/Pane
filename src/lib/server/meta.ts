const MAX_FETCH_SIZE = 1024 * 1024; // 1 MB — YouTube inlines ~600KB of JS before meta tags

const HTML_ENTITIES: Record<string, string> = {
	'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'"
};

function decodeHtmlEntities(str: string): string {
	let prev = '';
	let result = str;
	while (result !== prev) {
		prev = result;
		result = result
			.replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => HTML_ENTITIES[m])
			.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
			.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
	}
	return result;
}

function isPrivateIPv4(hostname: string): boolean {
	// Normalize octal/hex notation by letting the URL parser resolve it,
	// then check the decimal form. We parse "http://<hostname>" to get the
	// browser-normalized hostname (e.g. 0177.0.0.1 → 127.0.0.1).
	let normalized = hostname;
	try {
		normalized = new URL(`http://${hostname}`).hostname;
	} catch { /* keep original */ }

	const parts = normalized.split('.').map(Number);
	if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;

	if (parts[0] === 0) return true;                                      // 0.0.0.0/8
	if (parts[0] === 10) return true;                                      // 10.0.0.0/8
	if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // 100.64.0.0/10 (CGNAT)
	if (parts[0] === 127) return true;                                     // 127.0.0.0/8
	if (parts[0] === 169 && parts[1] === 254) return true;                // 169.254.0.0/16
	if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
	if (parts[0] === 192 && parts[1] === 168) return true;                // 192.168.0.0/16
	if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true; // 192.0.0.0/24
	if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true; // 198.18.0.0/15
	if (parts[0] >= 224) return true;                                      // multicast + reserved
	return false;
}

function isPrivateIPv6(hostname: string): boolean {
	// Strip brackets from IPv6 literals: [::1] → ::1
	const raw = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
	const lower = raw.toLowerCase();

	if (lower === '::1') return true;                  // loopback
	if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true; // unspecified
	if (lower.startsWith('fe80:') || lower.startsWith('fe80%')) return true; // link-local
	if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (ULA)
	if (lower.startsWith('::ffff:')) {
		// IPv4-mapped IPv6 — extract the IPv4 part and check it
		const v4 = lower.slice(7);
		if (v4.includes('.')) return isPrivateIPv4(v4);
	}
	return false;
}

export function isPrivateUrl(urlStr: string): boolean {
	try {
		const parsed = new URL(urlStr);
		if (!['http:', 'https:'].includes(parsed.protocol)) return true;
		const hostname = parsed.hostname;

		if (hostname === 'localhost') return true;
		if (hostname.endsWith('.local')) return true;
		if (hostname.endsWith('.localhost')) return true;
		if (hostname.endsWith('.internal')) return true;

		// IPv6
		if (hostname.startsWith('[') || hostname.includes(':')) {
			return isPrivateIPv6(hostname);
		}

		// IPv4 (handles octal/hex via normalization)
		if (isPrivateIPv4(hostname)) return true;

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
				title = decodeHtmlEntities(ogTitleMatch[1].trim().replace(/\s+/g, ' ')) || null;
			} else if (titleMatch?.[1]) {
				title = decodeHtmlEntities(titleMatch[1].trim().replace(/\s+/g, ' ')) || null;
			}
			let description: string | null = null;
			const ogDescMatch = text.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
				?? text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
			const descMatch = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
				?? text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
			if (ogDescMatch?.[1]) {
				description = decodeHtmlEntities(ogDescMatch[1].trim()) || null;
			} else if (descMatch?.[1]) {
				description = decodeHtmlEntities(descMatch[1].trim()) || null;
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
