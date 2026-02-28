import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const STORAGE_ROOT = path.resolve('storage');

function assertWithinStorage(resolvedPath: string, spaceSlug: string): void {
	const spaceRoot = path.join(STORAGE_ROOT, spaceSlug) + path.sep;
	if (!resolvedPath.startsWith(spaceRoot) && resolvedPath !== spaceRoot.slice(0, -1)) {
		throw new Error('Path traversal detected');
	}
}

export function ensureSpaceDir(spaceSlug: string): string {
	const dir = path.join(STORAGE_ROOT, spaceSlug);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

export function deleteSpaceDir(spaceSlug: string) {
	const dir = path.join(STORAGE_ROOT, spaceSlug);
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

export function ensureCategoryDir(spaceSlug: string, categorySlug: string): string {
	const dir = path.resolve(STORAGE_ROOT, spaceSlug, categorySlug);
	assertWithinStorage(dir, spaceSlug);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

export function saveFile(spaceSlug: string, categorySlug: string, originalName: string, data: Buffer): { filePath: string; fileName: string } {
	const dir = ensureCategoryDir(spaceSlug, categorySlug);
	const ext = path.extname(originalName);
	const uuid = randomUUID();
	const fileName = `${uuid}${ext}`;
	const filePath = path.join(categorySlug, fileName);
	fs.writeFileSync(path.join(dir, fileName), data);
	return { filePath, fileName: originalName };
}

export function moveFile(spaceSlug: string, oldPath: string, newCategorySlug: string): string {
	const oldFull = path.resolve(STORAGE_ROOT, spaceSlug, oldPath);
	assertWithinStorage(oldFull, spaceSlug);
	if (!fs.existsSync(oldFull)) return oldPath;

	const baseName = path.basename(oldPath);
	const newDir = ensureCategoryDir(spaceSlug, newCategorySlug);
	const newPath = path.join(newCategorySlug, baseName);
	fs.renameSync(oldFull, path.join(newDir, baseName));
	return newPath;
}

export function deleteFile(spaceSlug: string, filePath: string) {
	const full = path.resolve(STORAGE_ROOT, spaceSlug, filePath);
	assertWithinStorage(full, spaceSlug);
	if (fs.existsSync(full)) {
		fs.unlinkSync(full);
	}
}

export function deleteCategoryDir(spaceSlug: string, categorySlug: string) {
	const dir = path.resolve(STORAGE_ROOT, spaceSlug, categorySlug);
	assertWithinStorage(dir, spaceSlug);
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

export function getStorageRoot(): string {
	return STORAGE_ROOT;
}
