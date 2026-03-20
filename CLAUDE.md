# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server (http://localhost:5173)
pnpm build            # Production build (adapter-node)
pnpm preview          # Preview production build
pnpm check            # Type-check with svelte-check
pnpm check:watch      # Continuous type-checking
```

```bash
docker compose up -d  # Run via Docker (port 3000, mounts data/ and storage/)
```

```bash
# Pre-built image from GitHub Container Registry
docker run -d -p 3000:3000 -v ./data:/app/data -v ./storage:/app/storage ghcr.io/tomgem/pane:latest
```

No test framework is configured. Use `pnpm check` to validate types before committing.

## Architecture

**Pane** is a multi-user Kanban dashboard built with SvelteKit 2 + SQLite. It organizes links, notes, and documents into draggable columns. Supports multiple **Spaces** per user, space sharing, and configurable single-user mode (`SINGLE_USER=true`) for self-hosting without authentication.

### Data flow

```
hooks.server.ts (migration + auth middleware + session cleanup)
  → +layout.server.ts (pass user to all pages)
  → /s/[space]/+layout.server.ts (validate space ownership or shared access)
  → /s/[space]/+page.server.ts (SSR load categories+items+tags from user DB)
  → Board store (client state, space+owner-aware API calls)
  → API routes (mutations with ?space=&owner= params via resolveSpaceAccess)
  → SQLite (per-user DB + central auth DB)
```

Root `/` is a spaces dashboard showing the user's own spaces (with category/item counts, create/delete) and a "Shared with me" section. If a space slug doesn't exist, the layout redirects to `/`. The page server load hydrates the board. All mutations go through the `BoardStore` (`$lib/stores/board.svelte.ts`), which appends `?space={slug}&owner={ownerId}` to space-scoped API calls when accessing shared spaces. The store uses Svelte 5 runes (`$state`, `$derived`, `$effect`).

### Authentication & Sessions

- **`$lib/server/auth.ts`** — Password hashing via Node's `crypto.scrypt` (no native dependency).
- **`$lib/server/session.ts`** — Server-side sessions stored in auth DB. `createSession()`, `validateSession()`, `invalidateSession()`, `cleanExpiredSessions()`. 30-day expiry. Cookie: `pane_session`, HttpOnly, SameSite=Lax, Secure in production.
- **`$lib/server/email.ts`** — SMTP email via `nodemailer`. `sendVerificationEmail()` (6-digit code), `sendPasswordResetEmail()` (6-digit code), `sendSpaceInvitationEmail()`. Falls back to console.log when SMTP not configured.

**Auth middleware** in `hooks.server.ts`:
1. If `SINGLE_USER=true`: inject synthetic user, skip auth
2. Rate limiting for `/api/*`
3. Read session cookie → `validateSession()` → set `locals.user`/`locals.userId`
4. If no user and not public path: redirect to `/login` (pages) or 401 (API)

Public paths: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/api/auth/*`

**Auth API routes**:
- `POST /api/auth/register` — Validate invite code (first user skips), create user+DB, send verification email
- `POST /api/auth/login` — Verify password, create session
- `POST /api/auth/logout` — Invalidate session, clear cookie
- `POST /api/auth/verify-email` — Check 6-digit code, mark `email_verified=1`
- `POST /api/auth/resend-verification` — Rate-limited (60s), new code
- `POST /api/auth/change-password` — Authenticated. Verify current password, set new one, invalidate all sessions (creates fresh session)
- `POST /api/auth/forgot-password` — Send 6-digit reset code via email (15-min TTL, rate-limited 60s). Always returns success to prevent email enumeration
- `POST /api/auth/reset-password` — Validate reset code, set new password, invalidate all sessions

**Auth UI pages**: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` — centered card layout using existing CSS classes.

**Admin panel** (`/admin`): Admin-only page for generating/revoking invite codes and viewing registered users.
- `GET/POST /api/admin/invite-codes` — List/create invite codes
- `DELETE /api/admin/invite-codes/[code]` — Revoke

### Multi-User Database Architecture

**One SQLite DB per user** (`data/{userId}.db`) containing all their spaces, tags, categories, items. **Central auth DB** (`data/_auth.db`) for users, sessions, invite codes, space shares, OAuth accounts (prepared but not active).

- **`$lib/server/auth-schema.ts`** — Auth DB schema: `users` (incl. `avatar_path`), `sessions`, `email_verifications`, `password_resets`, `invite_codes`, `space_shares`, `chat_messages`, `oauth_accounts`, `meta`
- **`$lib/server/user-schema.ts`** — Per-user DB schema: `spaces`, `tags`, `categories` (with `space_slug` FK), `items`, `item_tags`, `changelog`
- **`$lib/server/db.ts`** — `getAuthDb()`, `getUserDb(userId)`, `createUserDb(userId)`, `listSpaces(userId)`, `validateSpaceSlug(slug)`. Connection cache keyed by `auth` or `user:{userId}`. Slug regex: `/^[a-z0-9-]{1,64}$/`.
- **`$lib/server/migration.ts`** — One-time migration from old one-DB-per-space layout to one-DB-per-user. Archives old DBs to `data/_migrated/`.

### Spaces & Access Control

- **`$lib/server/space.ts`** — `resolveSpaceAccess(locals, url)`: central function for all API routes. Returns `{ db, spaceSlug, permission: 'owner'|'read'|'write', ownerId }`. Checks own space first, then `space_shares` in auth DB for shared access via `?owner=` param. `requireWriteAccess(access)` throws 403 if read-only.
- **`$lib/server/storage.ts`** — All functions take `userId` as first parameter: `saveFile(userId, spaceSlug, ...)`, `deleteFile(userId, spaceSlug, ...)`, etc. Storage path: `storage/{userId}/{spaceSlug}/{categorySlug}/{uuid}.{ext}`.
- **Space API** — `GET/POST /api/spaces`, `PUT/DELETE /api/spaces/[slug]`

### Space Sharing

Users can share spaces with others by email (read-only or read-write).

- **Sharing API** — `GET/POST /api/spaces/[slug]/shares`, `PUT/DELETE /api/spaces/[slug]/shares/[id]`
- **User search** — `GET /api/users/search?q={query}` returns up to 8 matching users by display name. Respects `show_email` privacy preference.
- **Shared space URLs**: `/s/{spaceSlug}?owner={ownerId}` — the `owner` param tells the server whose DB to query
- **Read-only enforcement**: Server returns 403 for non-GET requests on read-only shares. Client hides add/edit/delete buttons and disables DnD via `isReadonly` flag.
- **SpaceSharingOverlay** — Accessible from Toolbar "Share" button (owner only). Share by username (with autocomplete) or email. Add/remove shares, change permissions.
- **Real-time notifications** — SSE via `GET /api/events/user` (`$lib/server/events.ts`). `emitToUser(userId, event)` broadcasts share events. Dashboard auto-refreshes.
- **Real-time chat** — `GET/POST/DELETE /api/chat` for space-scoped messaging. `GET /api/chat/presence` for online user tracking. Messages broadcast via SSE. 2000-char limit, 50-message pagination. Owner can clear history.
- **Privacy** — `show_email` column on users table (default 0). Toggle in UserOverlay. `GET/PUT /api/preferences`.

### User Avatars

- **Avatar API** — `GET/POST/DELETE /api/avatar`. Upload JPEG/PNG/GIF/WebP up to 2 MB. Stored at `storage/{userId}/avatar.{ext}`. Displayed in chat and presence indicators.

### Space Changelog

- **`$lib/server/changelog.ts`** — `logChange()` records item/category/tag mutations. `getChangelog()` fetches entries with pagination.
- **`$lib/components/ChangelogOverlay.svelte`** — Activity log overlay with clickable navigation to items.
- **Changelog API** — `GET /api/changelog?space={slug}` returns paginated activity entries.

### Route structure

```
/                           → spaces dashboard (own spaces + shared with me)
/login                      → login page (with "Forgot password?" link)
/register                   → registration page (with invite code)
/verify-email               → email verification (6-digit code)
/forgot-password            → request password reset code via email
/reset-password             → enter reset code + new password
/admin                      → admin panel (invite codes, user list)
/s/[space]/                 → space layout (toolbar + context) + page (board)
/s/[space]?owner={id}       → shared space view
/s/[space]/+error.svelte    → error page (unknown slugs redirect to /)
```

Root layout (`+layout.svelte`) owns theme and palette stores. Root `+layout.server.ts` passes `user` from `event.locals` to all pages. Space layout (`/s/[space]/+layout.svelte`) owns the Toolbar and app context bridge.

### Hierarchical navigation

Categories can be nested via `parent_id`. The board store tracks `currentParentId` and `breadcrumb` state. Key store methods: `drillDown(categoryId)` enters a subcategory, `navigateTo(parentId)` jumps to any level (null for root), `fetchBreadcrumb(categoryId)` loads the ancestor chain. Drilling re-fetches categories and items scoped to that parent. Search auto-expands subcategories when matches are found within them.

Categories can be moved up and down the hierarchy: **promote** a subcategory to top-level (`parent_id: null`) via "Make top-level category", or **demote** a top-level category into another via "Make subcategory of...". Both use the existing `PUT /api/categories/[id]` endpoint with `parent_id`. When the name hasn't changed, the existing slug is preserved to avoid UNIQUE constraint collisions.

### Layout ↔ Page communication

Space layout (`/s/[space]/+layout.svelte`) owns the Toolbar and theme. Page (`/s/[space]/+page.svelte`) registers callbacks via `setContext('app')` / `getContext('app')` so the Toolbar's Add/Search/Tag actions trigger the page's modals and filtering. The context object exposes reactive getters and setter functions — not plain values.

### File storage

Documents stored at `storage/{userId}/{space-slug}/{category-slug}/{uuid}.{ext}`. Original filename kept in DB. Moving items between categories physically moves files. Served via `/api/files/[...path]?space={slug}&owner={ownerId}`. Both `data/` and `storage/` are gitignored.

### Client utilities

- **`$lib/utils/api.ts`** — Typed fetch wrapper (`api<T>(url, options)`) used by the board store for all mutations. Parses JSON error bodies automatically.
- **`$lib/utils/slugify.ts`** — Wrapper around `slugify` library for URL-safe slugs.
- **`$lib/utils/folder-drop.ts`** — HTML5 folder drag-and-drop. Uses `webkitGetAsEntry()` for recursive directory traversal. Returns `FolderStructure` with files and subfolders.

### Client stores

- **`$lib/stores/board.svelte.ts`** — Board state (`BoardStore`). Tracks categories, items, tags, breadcrumb, current parent, `readonly` flag, and optional `ownerId` for shared spaces. Space-scoped mutations append `?space={slug}&owner={ownerId}`. Tag mutations call `/api/tags` directly (per-user, no space param). Folder import via `importFolder()`.
- **`$lib/stores/chat.svelte.ts`** — Chat state for shared spaces. Messages, presence, SSE connection. `sendMessage()`, `loadMessages()`, `loadMore()`, `clearChat()`, `loadPresence()`.
- **`$lib/stores/theme.svelte.ts`** — `ThemeMode` (`'light'|'dark'|'system'`), persists to localStorage, respects `prefers-color-scheme`.
- **`$lib/stores/palette.svelte.ts`** — Accent color palette (8 choices: indigo, blue, teal, green, orange, red, pink, grey). Sets `data-palette` attribute and persists to localStorage. Maps to CSS `--accent`, `--accent-hover`, `--accent-soft` variables.
- **`$lib/stores/font.svelte.ts`** — Sans-serif font choice (System, Fira Sans, Inter, Ubuntu). Sets `data-font` attribute, persists to localStorage.
- **`$lib/stores/mono-font.svelte.ts`** — Monospace font choice (System, Fira Code, JetBrains Mono, Source Code Pro). Sets `data-mono-font` attribute, persists to localStorage.

Root layout provides `theme`, `palette`, `font`, and `monoFont` store contexts.

### Theming

CSS custom properties on `:root` (light) and `[data-theme="dark"]`. Accent colors via `[data-palette]` attribute with 8 palette options. Font choices via `[data-font]` and `[data-mono-font]` attributes with self-hosted WOFF2 web fonts in `static/fonts/`. Theme, palette, and font stores persist to localStorage. Flash prevention via inline script in `app.html`. Glass effect uses `backdrop-filter: blur()`.

Global CSS utility classes in `app.css`: `.glass`, `.glass-strong`, `.input`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-sm`, `.badge`. No CSS framework (Tailwind etc.) — all custom properties.

### Drag-and-drop

`svelte-dnd-action` for internal reorder (columns and items). Native HTML5 drag events on Column for external URL and file drops (`.webloc` files auto-convert to links, `.md` files to notes). Dropping items onto collapsed subcategories is supported. **Entire folders** (including subfolders) can be dropped onto a column — subdirectories are created as subcategories with all files imported automatically (`$lib/utils/folder-drop.ts`). Reorder persisted via batch transaction endpoints (`/api/categories/reorder`, `/api/items/reorder`). Disabled for read-only shared spaces.

### Markdown rendering

Notes and descriptions render markdown via `marked` with HTML sanitized through `DOMPurify` to prevent XSS.

### Overlays

Full-screen overlay components follow a shared pattern: glass backdrop (`glass-strong`), Escape key to close, click-outside-to-close, callback props (`onclose`). Key overlays:

- **UserOverlay** — Unified user/settings overlay opened via user icon in Toolbar. Sections: account info & avatar upload & storage bar (multi-user only), privacy toggle (`show_email`), theme toggle, accent palette, font selection (sans-serif + monospace), change password (multi-user only), export/import button. Footer with Admin Panel link (admin, multi-user) and sign out (multi-user). In single-user mode shows only theme, palette, fonts, and data sections.
- **NoteOverlay / MediaOverlay** — Content viewers for notes and documents.
- **TextFileOverlay** — Fetches and displays plain text/markdown files with copy-to-clipboard and markdown rendering.
- **ExportImportOverlay** — Tabbed UI for exporting spaces as ZIP and importing from ZIP (preview + conflict resolution).
- **SpaceSharingOverlay** — Share space by email, manage permissions, remove access.
- **ChangelogOverlay** — Space activity log with clickable item navigation.
- **ChatPanel** — Real-time chat panel for shared spaces with presence indicators.
- **HelpPanel** — App documentation (inline in Toolbar).

### Rate limiting

In-memory per-IP rate limiter in `$lib/server/rate-limit.ts`. Applied to all `/api/*` routes via `hooks.server.ts`. 100 requests per 60-second window; returns `429` with `Retry-After` header.

### Shared components

- **`Icon.svelte`** — Centralized SVG icon component. All icons use this component rather than inline SVGs.
- **`Modal.svelte`** — Reusable dialog wrapper (glass backdrop, focus trap, Escape/click-outside to close). Used by `ItemForm`, `CategoryForm`, and other form modals. Accepts a `title` and renders children via Snippet.
- **`Toast.svelte`** — Notification component (`success`/`error` types) with optional progress bar. Positioned fixed, auto-dismisses.

### Additional API routes

- `POST /api/items/upload?space={slug}` — File upload for document items (100MB max).
- `GET /api/categories/[id]/breadcrumb?space={slug}` — Ancestor chain via recursive CTE (root-first order).
- `POST /api/categories/[id]/move?space={slug}` — Move entire category subtree to a different space (recursive CTE, transaction-based, physical file migration, slug collision handling).
- `POST /api/export?spaces={slug|all}&include_files={true|false}` — Export spaces as ZIP with JSON manifest.
- `POST /api/import?action={preview|execute}&conflict_mode={skip|rename|replace}` — Import ZIP archive.
- `GET/POST/DELETE /api/chat?space={slug}&owner={id}` — Chat messages for shared spaces (50-message pagination, 2000-char limit).
- `GET /api/chat/presence?space={slug}&owner={id}` — Online users in a shared space.
- `GET/POST/DELETE /api/avatar` — User avatar management (2 MB max, JPEG/PNG/GIF/WebP).
- `GET /api/changelog?space={slug}` — Paginated activity log for a space.

### Seed endpoint

`POST /api/seed?space={slug}` populates an empty database with curated sample data (categories, items). Tags are inserted into the user's DB with `INSERT OR IGNORE` (idempotent). Guards against duplicate seeding by checking if any categories exist. Called from the empty board state UI.

### Keyboard shortcuts

- `/` or `Ctrl+K` — Focus search
- `Ctrl+N` — New item
- `Ctrl+Shift+N` — New category
- `Escape` — Close modals/overlays

### Link meta-fetching

When creating link items, the server fetches up to 100KB of HTML to extract `<title>`, meta description, and favicon URL (`favicon_url` stored in items table). 5-second timeout, max 5 redirects. Rejects private IPs and non-http(s) URLs.

### Documentation

User-facing docs in `docs/`: `getting-started.md`, `user-guide.md`, `architecture.md`, `deployment.md`.

### CI/CD

GitHub Actions workflow (`.github/workflows/docker-publish.yml`) builds and pushes a Docker image to `ghcr.io/tomgem/pane` on every tagged release (`v*`). Tags: `{version}`, `{major}.{minor}`, and `latest`.

## Environment Variables

```
SINGLE_USER=true|false     # Default: false. When true, no auth required (current single-user behavior)
SMTP_HOST=                 # SMTP server hostname
SMTP_PORT=587              # SMTP port (default: 587)
SMTP_USER=                 # SMTP username
SMTP_PASS=                 # SMTP password
SMTP_FROM=                 # From address for emails (default: "Pane <SMTP_USER>")
SMTP_SECURE=false          # true for port 465
```

When SMTP is not configured, verification codes, password reset codes, and sharing notifications are logged to the console.

## Conventions

- **Svelte 5 runes only** — `$state`, `$derived`, `$effect`, `$props()`, `$bindable()`. No legacy `let` exports or `createEventDispatcher`.
- **Callback props for events** — e.g. `onsubmit`, `onclose`, `onadd` (not `dispatch`).
- **API routes return `json()`** from `@sveltejs/kit`. Errors return `{ error: string }` with status codes: 201 (created), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (conflict), 429 (rate limited), 500 (server error). Space-scoped routes require `?space={slug}` (read via `resolveSpaceAccess(locals, url)`). Shared spaces add `&owner={userId}`. Tag routes (`/api/tags`) also use `resolveSpaceAccess` so they work correctly in shared spaces.
- **DB operations are synchronous** — `.run()`, `.get()`, `.all()`. Use `db.transaction()` for multi-statement writes.
- **Types** live in `$lib/types/index.ts`. `CategoryWithItems` is the joined type used by components. `Space` is `{ slug: string; name: string }`. `SpaceWithStats` extends with category/item counts. `User`, `Session`, `InviteCode`, `SpaceShare`, `SharedSpaceInfo` for auth types. `BreadcrumbSegment` for hierarchical navigation. `ReorderMove` for batch sort operations.
- **Scoped CSS** — styles are component-scoped via `<style>` blocks. Global variables defined in `app.css`.
- **`app.d.ts`** — Defines `App.Locals` with `user: { id, email, display_name, role } | null` and `userId: string | null`.
