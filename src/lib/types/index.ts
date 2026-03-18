export interface Category {
	id: number;
	name: string;
	slug: string;
	color: string;
	sort_order: number;
	parent_id: number | null;
	created_at: string;
	updated_at: string;
}

export interface Item {
	id: number;
	category_id: number;
	type: 'link' | 'note' | 'document';
	title: string;
	content: string | null;
	file_path: string | null;
	file_name: string | null;
	file_size: number | null;
	mime_type: string | null;
	description: string | null;
	favicon_url: string | null;
	sort_order: number;
	is_pinned: number;
	created_at: string;
	updated_at: string;
	tags?: Tag[];
}

export interface Tag {
	id: number;
	name: string;
	color: string;
}

export interface ItemTag {
	item_id: number;
	tag_id: number;
}

export interface CategoryWithItems extends Category {
	items: Item[];
	children_count: number;
	children: Category[];
}

export interface BreadcrumbSegment {
	id: number | null;
	name: string;
}

export interface ReorderMove {
	id: number;
	category_id: number;
	sort_order: number;
}

export interface Space {
	slug: string;
	name: string;
}

export interface SpaceWithStats extends Space {
	categoryCount: number;
	itemCount: number;
	shareCount: number;
}

export interface User {
	id: string;
	email: string;
	email_verified: number;
	display_name: string;
	role: 'admin' | 'user';
	blocked: number;
	storage_quota_bytes: number;
	show_email: number;
	created_at: string;
	updated_at: string;
}

export interface StorageQuotaInfo {
	used_bytes: number;
	quota_bytes: number;
}

export interface Session {
	id: string;
	user_id: string;
	expires_at: string;
	created_at: string;
}

export interface InviteCode {
	code: string;
	created_by: string;
	max_uses: number;
	use_count: number;
	expires_at: string | null;
	created_at: string;
}

export interface SpaceShare {
	id: number;
	owner_id: string;
	space_slug: string;
	shared_with: string;
	permission: 'read' | 'write';
	created_at: string;
}

export interface SharedSpaceInfo extends Space {
	share_id: number;
	owner_id: string;
	owner_name: string;
	permission: 'read' | 'write';
}

export type SpaceEventType =
	| 'item:created' | 'item:updated' | 'item:deleted' | 'item:reordered'
	| 'category:created' | 'category:updated' | 'category:deleted' | 'category:reordered' | 'category:moved'
	| 'tag:created' | 'tag:updated' | 'tag:deleted'
	| 'space:seeded' | 'space:imported'
	| 'share:created' | 'share:removed';

export interface SpaceEvent {
	type: SpaceEventType;
	timestamp: number;
}
