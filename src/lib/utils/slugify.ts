import slugifyLib from 'slugify';

export function slugify(text: string): string {
	return slugifyLib(text, { lower: true, strict: true });
}
