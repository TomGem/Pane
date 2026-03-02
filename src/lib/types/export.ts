import type { Category, Item, ItemTag, Tag } from './index';

export interface ExportManifest {
	version: 1;
	app: 'pane';
	exported_at: string;
	spaces: string[];
	include_files: boolean;
	stats: {
		spaces: number;
		categories: number;
		items: number;
		tags: number;
	};
}

export interface ExportSpaceData {
	slug: string;
	display_name: string;
	meta: Record<string, string>;
	categories: Category[];
	items: Item[];
	item_tags: ItemTag[];
}

export interface ExportTags {
	tags: Tag[];
}

export interface ImportPreviewSpace {
	slug: string;
	display_name: string;
	categories: number;
	items: number;
	exists: boolean;
}

export interface ImportPreviewTag {
	name: string;
	color: string;
	exists: boolean;
}

export interface ImportPreview {
	manifest: ExportManifest;
	spaces: ImportPreviewSpace[];
	tags: ImportPreviewTag[];
	valid: boolean;
	errors: string[];
}

export type ConflictMode = 'skip' | 'rename' | 'replace';

export interface ImportOptions {
	conflict_mode: ConflictMode;
}

export interface ImportResult {
	success: boolean;
	imported_spaces: string[];
	imported_tags: number;
	skipped_spaces: string[];
	errors: string[];
}
