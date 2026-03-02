import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { previewImport, executeImport } from '$lib/server/import';
import type { ConflictMode } from '$lib/types/export';

const MAX_SIZE = 500 * 1024 * 1024; // 500MB

export const POST: RequestHandler = async ({ url, request }) => {
	const action = url.searchParams.get('action');
	if (!action || !['preview', 'execute'].includes(action)) {
		throw error(400, 'Missing or invalid action parameter (preview or execute)');
	}

	const contentType = request.headers.get('content-type') ?? '';
	if (!contentType.includes('multipart/form-data')) {
		throw error(400, 'Expected multipart/form-data');
	}

	const formData = await request.formData();
	const file = formData.get('file');
	if (!file || !(file instanceof File)) {
		throw error(400, 'Missing file in form data');
	}

	if (file.size > MAX_SIZE) {
		throw error(400, `File too large (max ${MAX_SIZE / 1024 / 1024}MB)`);
	}

	const arrayBuffer = await file.arrayBuffer();
	const zipBuffer = Buffer.from(arrayBuffer);

	if (action === 'preview') {
		const preview = previewImport(zipBuffer);
		return json(preview);
	}

	// action === 'execute'
	const conflictMode = (url.searchParams.get('conflict_mode') ?? 'skip') as ConflictMode;
	if (!['skip', 'rename', 'replace'].includes(conflictMode)) {
		throw error(400, 'Invalid conflict_mode (skip, rename, or replace)');
	}

	const result = executeImport(zipBuffer, { conflict_mode: conflictMode });
	return json(result, { status: result.success ? 200 : 500 });
};
