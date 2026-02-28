import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const STORAGE_ROOT = path.resolve('storage');

export function ensureCategoryDir(slug: string): string {
	const dir = path.join(STORAGE_ROOT, slug);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

export function saveFile(categorySlug: string, originalName: string, data: Buffer): { filePath: string; fileName: string } {
	const dir = ensureCategoryDir(categorySlug);
	const ext = path.extname(originalName);
	const uuid = randomUUID();
	const fileName = `${uuid}${ext}`;
	const filePath = path.join(categorySlug, fileName);
	fs.writeFileSync(path.join(dir, fileName), data);
	return { filePath, fileName: originalName };
}

export function moveFile(oldPath: string, newCategorySlug: string): string {
	const oldFull = path.join(STORAGE_ROOT, oldPath);
	if (!fs.existsSync(oldFull)) return oldPath;

	const baseName = path.basename(oldPath);
	const newDir = ensureCategoryDir(newCategorySlug);
	const newPath = path.join(newCategorySlug, baseName);
	fs.renameSync(oldFull, path.join(newDir, baseName));
	return newPath;
}

export function deleteFile(filePath: string) {
	const full = path.join(STORAGE_ROOT, filePath);
	if (fs.existsSync(full)) {
		fs.unlinkSync(full);
	}
}

export function deleteCategoryDir(slug: string) {
	const dir = path.join(STORAGE_ROOT, slug);
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}
