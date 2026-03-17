import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const STORAGE_ROOT = path.resolve('storage');

function assertWithinStorage(resolvedPath: string, userId: string, spaceSlug: string): void {
	const spaceRoot = path.join(STORAGE_ROOT, userId, spaceSlug) + path.sep;
	if (!resolvedPath.startsWith(spaceRoot) && resolvedPath !== spaceRoot.slice(0, -1)) {
		throw new Error('Path traversal detected');
	}
}

export function ensureSpaceDir(userId: string, spaceSlug: string): string {
	const dir = path.join(STORAGE_ROOT, userId, spaceSlug);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

export function deleteSpaceDir(userId: string, spaceSlug: string) {
	const dir = path.resolve(STORAGE_ROOT, userId, spaceSlug);
	const userRoot = path.join(STORAGE_ROOT, userId) + path.sep;
	if (!dir.startsWith(userRoot)) {
		throw new Error('Path traversal detected');
	}
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

export function deleteUserDir(userId: string) {
	const dir = path.resolve(STORAGE_ROOT, userId);
	if (!dir.startsWith(STORAGE_ROOT + path.sep)) {
		throw new Error('Path traversal detected');
	}
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

export function ensureCategoryDir(userId: string, spaceSlug: string, categorySlug: string): string {
	const dir = path.resolve(STORAGE_ROOT, userId, spaceSlug, categorySlug);
	assertWithinStorage(dir, userId, spaceSlug);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

export function saveFile(userId: string, spaceSlug: string, categorySlug: string, originalName: string, data: Buffer): { filePath: string; fileName: string } {
	const dir = ensureCategoryDir(userId, spaceSlug, categorySlug);
	const ext = path.extname(originalName);
	const uuid = randomUUID();
	const fileName = `${uuid}${ext}`;
	const filePath = path.join(categorySlug, fileName);
	fs.writeFileSync(path.join(dir, fileName), data);
	return { filePath, fileName: originalName };
}

export function moveFile(userId: string, spaceSlug: string, oldPath: string, newCategorySlug: string): string {
	const oldFull = path.resolve(STORAGE_ROOT, userId, spaceSlug, oldPath);
	assertWithinStorage(oldFull, userId, spaceSlug);
	if (!fs.existsSync(oldFull)) {
		console.warn(`moveFile: source file not found at ${oldFull}, keeping old path`);
		return oldPath;
	}

	const baseName = path.basename(oldPath);
	const newDir = ensureCategoryDir(userId, spaceSlug, newCategorySlug);
	const newPath = path.join(newCategorySlug, baseName);
	fs.renameSync(oldFull, path.join(newDir, baseName));
	return newPath;
}

export function deleteFile(userId: string, spaceSlug: string, filePath: string) {
	const full = path.resolve(STORAGE_ROOT, userId, spaceSlug, filePath);
	assertWithinStorage(full, userId, spaceSlug);
	if (fs.existsSync(full)) {
		fs.unlinkSync(full);
	}
}

export function renameCategoryDir(userId: string, spaceSlug: string, oldCategorySlug: string, newCategorySlug: string) {
	if (oldCategorySlug === newCategorySlug) return;
	const oldDir = path.resolve(STORAGE_ROOT, userId, spaceSlug, oldCategorySlug);
	const newDir = path.resolve(STORAGE_ROOT, userId, spaceSlug, newCategorySlug);
	assertWithinStorage(oldDir, userId, spaceSlug);
	assertWithinStorage(newDir, userId, spaceSlug);
	if (fs.existsSync(oldDir)) {
		fs.mkdirSync(path.dirname(newDir), { recursive: true });
		fs.renameSync(oldDir, newDir);
	}
}

export function deleteCategoryDir(userId: string, spaceSlug: string, categorySlug: string) {
	const dir = path.resolve(STORAGE_ROOT, userId, spaceSlug, categorySlug);
	assertWithinStorage(dir, userId, spaceSlug);
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

export function copyCategoryDirAcrossSpaces(
	sourceUserId: string,
	sourceSpace: string,
	targetUserId: string,
	targetSpace: string,
	categorySlug: string
): void {
	const sourceDir = path.resolve(STORAGE_ROOT, sourceUserId, sourceSpace, categorySlug);
	const targetDir = path.resolve(STORAGE_ROOT, targetUserId, targetSpace, categorySlug);
	assertWithinStorage(sourceDir, sourceUserId, sourceSpace);
	assertWithinStorage(targetDir, targetUserId, targetSpace);

	if (!fs.existsSync(sourceDir)) return;

	fs.mkdirSync(path.dirname(targetDir), { recursive: true });
	fs.cpSync(sourceDir, targetDir, { recursive: true });
}

export function moveCategoryDirAcrossSpaces(
	sourceUserId: string,
	sourceSpace: string,
	targetUserId: string,
	targetSpace: string,
	categorySlug: string
): void {
	copyCategoryDirAcrossSpaces(sourceUserId, sourceSpace, targetUserId, targetSpace, categorySlug);
	deleteCategoryDir(sourceUserId, sourceSpace, categorySlug);
}

export function getStorageRoot(): string {
	return STORAGE_ROOT;
}
