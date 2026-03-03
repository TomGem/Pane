export interface FolderStructure {
	name: string;
	files: File[];
	subfolders: Map<string, File[]>;
}

/**
 * Check DataTransfer items for directory entries.
 * Returns an array of FileSystemDirectoryEntry objects found.
 */
export function getDirectoryEntries(dataTransfer: DataTransfer): FileSystemDirectoryEntry[] {
	const dirs: FileSystemDirectoryEntry[] = [];
	for (let i = 0; i < dataTransfer.items.length; i++) {
		const item = dataTransfer.items[i];
		const entry = item.webkitGetAsEntry?.();
		if (entry?.isDirectory) {
			dirs.push(entry as FileSystemDirectoryEntry);
		}
	}
	return dirs;
}

/**
 * Recursively read all entries from a FileSystemDirectoryReader.
 * readEntries() may return results in batches, so we call it repeatedly until empty.
 */
function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
	return new Promise((resolve, reject) => {
		const results: FileSystemEntry[] = [];
		function readBatch() {
			reader.readEntries(
				(entries) => {
					if (entries.length === 0) {
						resolve(results);
					} else {
						results.push(...entries);
						readBatch();
					}
				},
				reject
			);
		}
		readBatch();
	});
}

/**
 * Convert a FileSystemFileEntry to a File object.
 */
function entryToFile(entry: FileSystemFileEntry): Promise<File> {
	return new Promise((resolve, reject) => {
		entry.file(resolve, reject);
	});
}

function isHidden(name: string): boolean {
	return name.startsWith('.');
}

/**
 * Recursively traverse a directory entry.
 * Top-level files go into `files`. First-level subdirectories become keys in `subfolders`.
 * Files deeper than 1 subfolder level get attached to their nearest subfolder ancestor.
 */
export async function traverseDirectory(dirEntry: FileSystemDirectoryEntry): Promise<FolderStructure> {
	const result: FolderStructure = {
		name: dirEntry.name,
		files: [],
		subfolders: new Map()
	};

	const entries = await readAllEntries(dirEntry.createReader());

	for (const entry of entries) {
		if (isHidden(entry.name)) continue;

		if (entry.isFile) {
			const file = await entryToFile(entry as FileSystemFileEntry);
			result.files.push(file);
		} else if (entry.isDirectory) {
			const subFiles = await collectFilesRecursively(entry as FileSystemDirectoryEntry);
			if (subFiles.length > 0) {
				result.subfolders.set(entry.name, subFiles);
			}
		}
	}

	return result;
}

/**
 * Recursively collect all files from a directory, flattening any deeper nesting.
 */
async function collectFilesRecursively(dirEntry: FileSystemDirectoryEntry): Promise<File[]> {
	const files: File[] = [];
	const entries = await readAllEntries(dirEntry.createReader());

	for (const entry of entries) {
		if (isHidden(entry.name)) continue;

		if (entry.isFile) {
			const file = await entryToFile(entry as FileSystemFileEntry);
			files.push(file);
		} else if (entry.isDirectory) {
			const nested = await collectFilesRecursively(entry as FileSystemDirectoryEntry);
			files.push(...nested);
		}
	}

	return files;
}
