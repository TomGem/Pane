import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createExportZip } from '$lib/server/export';
import { validateSpaceSlug, listSpaces } from '$lib/server/db';

export const GET: RequestHandler = ({ url, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorized');

	const spacesParam = url.searchParams.get('spaces');
	if (!spacesParam) {
		throw error(400, 'Missing spaces parameter');
	}

	const includeFiles = url.searchParams.get('include_files') === 'true';

	let spaceSlugs: string[];
	if (spacesParam === 'all') {
		spaceSlugs = ['all'];
	} else {
		spaceSlugs = spacesParam.split(',').map((s) => s.trim()).filter(Boolean);
		for (const slug of spaceSlugs) {
			if (!validateSpaceSlug(slug)) {
				throw error(400, `Invalid space slug: ${slug}`);
			}
		}
		const existing = new Set(listSpaces(locals.userId).map((s) => s.slug));
		for (const slug of spaceSlugs) {
			if (!existing.has(slug)) {
				throw error(404, `Space not found: ${slug}`);
			}
		}
	}

	const { stream, filename } = createExportZip(locals.userId, spaceSlugs, includeFiles);

	return new Response(stream as unknown as ReadableStream, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
