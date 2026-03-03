export async function extractWeblocUrl(file: File): Promise<string | null> {
	// Try XML plist first
	const text = await file.text();
	try {
		const doc = new DOMParser().parseFromString(text, 'text/xml');
		const keys = doc.getElementsByTagName('key');
		for (let i = 0; i < keys.length; i++) {
			if (keys[i].textContent === 'URL') {
				const sibling = keys[i].nextElementSibling;
				if (sibling?.tagName === 'string' && sibling.textContent) {
					return sibling.textContent;
				}
			}
		}
	} catch {
		/* not XML */
	}
	const xmlMatch = text.match(/<string>(https?:\/\/[^<]+)<\/string>/);
	if (xmlMatch) return xmlMatch[1];

	// Binary plist: scan raw bytes for an ASCII URL
	const bytes = new Uint8Array(await file.arrayBuffer());
	let ascii = '';
	for (let i = 0; i < bytes.length; i++) {
		const b = bytes[i];
		ascii += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ' ';
	}
	const binMatch = ascii.match(/https?:\/\/[^\s]+/);
	return binMatch?.[0] ?? null;
}
