import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceSlug } from '$lib/server/space';
import fs from 'fs';
import path from 'path';

const STORAGE_ROOT = path.resolve('storage');

export const GET: RequestHandler = async ({ params, url }) => {
	const spaceSlug = getSpaceSlug(url);
	const filePath = path.join(STORAGE_ROOT, spaceSlug, params.path);

	// Prevent directory traversal
	if (!filePath.startsWith(path.join(STORAGE_ROOT, spaceSlug))) {
		throw error(403, 'Forbidden');
	}

	if (!fs.existsSync(filePath)) {
		throw error(404, 'File not found');
	}

	const data = fs.readFileSync(filePath);
	const ext = path.extname(filePath).toLowerCase();
	const mimeTypes: Record<string, string> = {
		'.pdf': 'application/pdf',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.gif': 'image/gif',
		'.svg': 'image/svg+xml',
		'.webp': 'image/webp',
		'.txt': 'text/plain',
		'.md': 'text/markdown',
		'.html': 'text/html',
		'.json': 'application/json',
		'.csv': 'text/csv',
		'.zip': 'application/zip',
		'.mp4': 'video/mp4',
		'.mp3': 'audio/mpeg'
	};

	return new Response(data, {
		headers: {
			'Content-Type': mimeTypes[ext] || 'application/octet-stream',
			'Content-Disposition': `inline; filename="${path.basename(filePath)}"`
		}
	});
};
