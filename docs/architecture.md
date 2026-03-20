# Architecture

Technical overview for developers working on or extending Pane.

## Data flow

```
hooks.server.ts (migration + auth middleware + session cleanup + rate limiting)
  → +layout.server.ts (pass user to all pages)
  → /+page.server.ts (spaces dashboard: own spaces + shared with me)
  → /s/[space]/+layout.server.ts (validate space ownership or shared access)
  → /s/[space]/+page.server.ts (SSR load categories + items + tags from user DB)
  → BoardStore (client state, space+owner-aware API calls)
  → API routes (mutations with ?space=&owner= params via resolveSpaceAccess)
  → SQLite (per-user DB + central auth DB)
```

Root `/` is a **spaces dashboard** showing the user's own spaces (with category/item counts, create/delete) and a **"Shared with me"** section. If a space slug doesn't exist, the layout redirects back to `/`.

## Route structure

```
/                           → spaces dashboard (own spaces + shared with me)
/login                      → login page (with "Forgot password?" link)
/register                   → registration page (with invite code)
/verify-email               → email verification (6-digit code)
/forgot-password            → request password reset code via email
/reset-password             → enter reset code + new password
/admin                      → admin panel (invite codes, user list, quotas, legal settings)
/legal                      → privacy policy and legal notice (public, when enabled)
/s/[space]/                 → space layout (toolbar + context) + page (board)
/s/[space]?owner={id}       → shared space view
/s/[space]/+error.svelte    → error page (unknown slugs redirect to /)
```

The root layout (`+layout.svelte`) owns theme and palette stores. Root `+layout.server.ts` passes `user` from `event.locals` to all pages. The space layout (`/s/[space]/+layout.svelte`) owns the Toolbar and app context bridge.

## Database

SQLite via `better-sqlite3` (synchronous API). WAL mode, foreign keys ON. All DB files are in `data/` (gitignored, auto-created).

### Multi-user database architecture

**One SQLite DB per user** (`data/{userId}.db`) containing all their spaces, tags, categories, and items. **Central auth DB** (`data/_auth.db`) for users, sessions, invite codes, space shares, and OAuth accounts (prepared but not active).

### Auth database schema (`auth-schema.ts`)

| Table | Purpose |
|-------|---------|
| `users` | User accounts: email, password hash, display name, role (admin/user), blocked status, storage quota, `show_email` privacy preference, `avatar_path` |
| `sessions` | Server-side sessions with 30-day expiry |
| `email_verifications` | 6-digit verification codes (15-min expiry) |
| `password_resets` | 6-digit password reset codes (15-min expiry) |
| `invite_codes` | Admin-generated registration codes with optional max uses and expiration |
| `space_shares` | Sharing records: owner, space slug, shared-with user, permission (read/write) |
| `oauth_accounts` | Prepared for OAuth providers (not yet active) |
| `chat_messages` | Real-time chat messages scoped to owner+space, with user attribution |
| `meta` | Key-value metadata store |

### Per-user database schema (`user-schema.ts`)

| Table | Purpose |
|-------|---------|
| `spaces` | Space slugs and display names |
| `tags` | User's tags (shared across all their spaces) |
| `categories` | Columns on the board, with optional `parent_id` for hierarchy and `space_slug` FK |
| `items` | Single table with `type` discriminator: `link`, `note`, `document`. Includes `favicon_url` for links and `file_size` for documents. |
| `item_tags` | Junction table linking items to tags |
| `changelog` | Activity log tracking changes to items, categories, and tags per space |

### Key modules

- **`$lib/server/db.ts`** — `getAuthDb()`, `getUserDb(userId)`, `createUserDb(userId)`, `listSpaces(userId)`, `validateSpaceSlug(slug)`. Connection cache keyed by `auth` or `user:{userId}`. Slug regex: `/^[a-z0-9-]{1,64}$/`.
- **`$lib/server/auth-schema.ts`** — Auth DB table creation
- **`$lib/server/user-schema.ts`** — Per-user DB table creation
- **`$lib/server/space.ts`** — `resolveSpaceAccess(locals, url)`: central function for all API routes. Returns `{ db, spaceSlug, permission, ownerId }`. Checks own space first, then `space_shares` for shared access via `?owner=` param. `requireWriteAccess(access)` throws 403 if read-only.
- **`$lib/server/storage.ts`** — All functions take `userId` as first parameter: `saveFile(userId, spaceSlug, ...)`, `deleteFile(userId, spaceSlug, ...)`, etc. Storage path: `storage/{userId}/{spaceSlug}/{categorySlug}/{uuid}.{ext}`. Path traversal defense via `assertWithinStorage`.
- **`$lib/server/auth.ts`** — Password hashing via Node's `crypto.scrypt` (no native dependency).
- **`$lib/server/session.ts`** — Server-side sessions stored in auth DB. `createSession()`, `validateSession()`, `invalidateSession()`, `cleanExpiredSessions()`. 30-day expiry. Cookie: `pane_session`, HttpOnly, SameSite=Lax, Secure in production.
- **`$lib/server/email.ts`** — SMTP email via `nodemailer`. `sendVerificationEmail()` (6-digit code), `sendPasswordResetEmail()` (6-digit code), `sendSpaceInvitationEmail()`. Falls back to console.log when SMTP not configured.
- **`$lib/server/migration.ts`** — One-time migration from old one-DB-per-space layout to one-DB-per-user. Archives old DBs to `data/_migrated/`.
- **`$lib/server/export.ts`** — Creates ZIP archives with JSON manifest, space data, and optional files.
- **`$lib/server/import.ts`** — Validates and imports ZIP archives with preview mode, conflict resolution, and rollback.
- **`$lib/server/rate-limit.ts`** — In-memory per-IP rate limiter (100 requests per 60-second window).
- **`$lib/server/events.ts`** — Server-sent events (SSE) module. `emitToUser(userId, event)` broadcasts events to connected clients. Used for real-time share notifications.

## Authentication & sessions

**Auth middleware** in `hooks.server.ts`:
1. If `SINGLE_USER=true`: inject synthetic user, skip auth
2. Rate limiting for `/api/*`
3. Read session cookie → `validateSession()` → set `locals.user`/`locals.userId`
4. If no user and not public path: redirect to `/login` (pages) or 401 (API)

Public paths: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/legal`, `/api/auth/*`, `/api/legal`

**Auth API routes**:
- `POST /api/auth/register` — Validate invite code (first user skips), create user+DB, send verification email
- `POST /api/auth/login` — Verify password, create session
- `POST /api/auth/logout` — Invalidate session, clear cookie
- `POST /api/auth/verify-email` — Check 6-digit code, mark `email_verified=1`
- `POST /api/auth/resend-verification` — Rate-limited (60s), new code
- `POST /api/auth/change-password` — Authenticated. Verify current password, set new one, invalidate all sessions (creates fresh session)
- `POST /api/auth/forgot-password` — Send 6-digit reset code via email (15-min TTL, rate-limited 60s). Always returns success to prevent email enumeration
- `POST /api/auth/reset-password` — Validate reset code, set new password, invalidate all sessions
- `POST /api/auth/delete-account` — Authenticated. Verify password, delete user account, databases, storage, sessions, and shared access.

**Auth UI pages**: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` — centered card layout using existing CSS classes.

## Spaces & access control

Each space lives within a user's database. Storage directory: `storage/{userId}/{spaceSlug}/`.

- **Space API** — `GET/POST /api/spaces`, `GET/PUT/DELETE /api/spaces/[slug]`
- Deleting the last space is prevented by the API.
- A default `desk` space is created when a new user registers.

### Space sharing

Users can share spaces with other registered users by email (read-only or read-write).

- **Sharing API** — `GET/POST /api/spaces/[slug]/shares`, `PUT/DELETE /api/spaces/[slug]/shares/[id]`
- **User search** — `GET /api/users/search?q={query}` returns up to 8 matching users by display name (respects `show_email` privacy preference). Used for username autocomplete in the sharing overlay.
- **Shared space URLs**: `/s/{spaceSlug}?owner={ownerId}` — the `owner` param tells the server whose DB to query
- **Read-only enforcement**: Server returns 403 for non-GET requests on read-only shares. Client hides add/edit/delete buttons and disables DnD via `isReadonly` flag.
- **Real-time notifications** — Server-sent events (SSE) via `GET /api/events/user` notify users when spaces are shared or unshared with them. The dashboard auto-refreshes on these events.
- **Real-time chat** — `GET/POST/DELETE /api/chat` for space-scoped messaging. `GET /api/chat/presence` for online user tracking. Messages broadcast via SSE. 2000-char limit, 50-message pagination. Owner can clear chat history.
- **User avatars** — `GET/POST/DELETE /api/avatar`. Upload JPEG/PNG/GIF/WebP up to 2 MB. Stored at `storage/{userId}/avatar.{ext}`. Displayed in chat and presence indicators.

## Admin panel

Admin-only page at `/admin` for:
- **Invite codes** — Generate/revoke registration codes (`GET/POST /api/admin/invite-codes`, `DELETE /api/admin/invite-codes/[code]`)
- **User management** — View users, block/unblock (`PUT /api/admin/users/[id]/block`), delete non-admin users (`DELETE /api/admin/users/[id]`)
- **Storage quotas** — View/adjust per-user quotas (`GET/PUT /api/admin/users/[id]/quota`)
- **Legal pages** — Enable/disable and edit privacy policy and legal notice (`GET/PUT /api/admin/legal`). Public endpoint: `GET /api/legal`

## Client stores

| Store | File | Purpose |
|-------|------|---------|
| `BoardStore` | `$lib/stores/board.svelte.ts` | Categories, items, tags, breadcrumb, current parent, `readonly` flag, optional `ownerId` for shared spaces. Space-scoped mutations append `?space={slug}&owner={ownerId}`. Tag mutations call `/api/tags` directly. Hierarchy mutations: `promoteCategory()`, `demoteCategory()`. Folder import: `importFolder()`. |
| `ChatStore` | `$lib/stores/chat.svelte.ts` | Chat messages, presence, SSE connection for real-time updates. `sendMessage()`, `loadMessages()`, `loadMore()`, `clearChat()`, `loadPresence()`. |
| `ThemeStore` | `$lib/stores/theme.svelte.ts` | `'light' \| 'dark' \| 'system'`, persists to localStorage, respects `prefers-color-scheme`. |
| `PaletteStore` | `$lib/stores/palette.svelte.ts` | Accent colour palette (8 choices). Sets `data-palette` attribute, persists to localStorage. |
| `FontStore` | `$lib/stores/font.svelte.ts` | Sans-serif font choice (System, Fira Sans, Inter, Ubuntu). Sets `data-font` attribute, persists to localStorage. |
| `MonoFontStore` | `$lib/stores/mono-font.svelte.ts` | Monospace font choice (System, Fira Code, JetBrains Mono, Source Code Pro). Sets `data-mono-font` attribute, persists to localStorage. |

All stores use Svelte 5 runes (`$state`, `$derived`, `$effect`).

## Layout / page communication

The space layout owns the Toolbar and exposes a context object via `setContext('app')`. The page registers callbacks through this context so the Toolbar's Add / Search / Tag actions trigger the page's modals and filtering. The context object exposes reactive getters and setter functions — not plain values.

## API routes

Errors return `{ error: string }` with appropriate status codes (201, 400, 401, 403, 404, 409, 429, 500). Space-scoped routes require `?space={slug}` (read via `resolveSpaceAccess(locals, url)`). Shared spaces add `&owner={userId}`. Rate limited: 100 requests per 60-second window per IP; returns `429` with `Retry-After` header.

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login, create session |
| `/api/auth/logout` | POST | Logout, clear session |
| `/api/auth/verify-email` | POST | Verify email with 6-digit code |
| `/api/auth/resend-verification` | POST | Resend verification code |
| `/api/auth/change-password` | POST | Change password (authenticated) |
| `/api/auth/forgot-password` | POST | Request password reset code |
| `/api/auth/reset-password` | POST | Reset password with code |
| `/api/auth/delete-account` | POST | Delete own account (password required) |
| `/api/admin/invite-codes` | GET, POST | List / create invite codes |
| `/api/admin/invite-codes/[code]` | DELETE | Revoke an invite code |
| `/api/admin/users/[id]/block` | PUT | Block / unblock a user |
| `/api/admin/users/[id]` | DELETE | Delete a non-admin user |
| `/api/admin/users/[id]/quota` | GET, PUT | View / update storage quota |
| `/api/admin/legal` | GET, PUT | View / update legal page settings |
| `/api/legal` | GET | Public: get legal page content (if enabled) |
| `/api/categories` | GET, POST | List / create categories |
| `/api/categories/[id]` | GET, PUT, DELETE | Get / update / delete a category |
| `/api/categories/[id]/breadcrumb` | GET | Ancestor chain via recursive CTE (root-first) |
| `/api/categories/[id]/move` | POST | Move category subtree to a different space |
| `/api/categories/reorder` | PUT | Batch reorder categories |
| `/api/items` | GET, POST | List / create items (POST fetches link metadata) |
| `/api/items/[id]` | GET, PUT, DELETE | Get / update / delete an item |
| `/api/items/[id]/refresh` | POST | Refetch link metadata |
| `/api/items/reorder` | PUT | Batch reorder items |
| `/api/items/upload` | POST | Upload a document (100 MB max) |
| `/api/tags` | GET, POST | List / create tags (per-user) |
| `/api/tags/[id]` | PUT, DELETE | Update / delete a tag |
| `/api/files/[...path]` | GET | Serve uploaded files (`?space=&owner=`) |
| `/api/storage` | GET | Current user's storage usage and quota |
| `/api/spaces` | GET, POST | List / create spaces |
| `/api/spaces/[slug]` | GET, PUT, DELETE | Get / rename / delete a space |
| `/api/spaces/[slug]/shares` | GET, POST | List / create shares for a space |
| `/api/spaces/[slug]/shares/[id]` | PUT, DELETE | Update / remove a share |
| `/api/users/search` | GET | Search users by display name (autocomplete, max 8 results) |
| `/api/preferences` | GET, PUT | Get / update user preferences (e.g. `show_email`) |
| `/api/events/user` | GET (SSE) | Server-sent events for real-time sharing notifications |
| `/api/seed` | POST | Populate an empty space with sample data |
| `/api/export` | POST | Export spaces as ZIP archive |
| `/api/import` | POST | Import ZIP archive (preview or execute) |
| `/api/chat` | GET, POST, DELETE | List / send / clear chat messages (space-scoped) |
| `/api/chat/presence` | GET | Online users in a shared space |
| `/api/avatar` | GET, POST, DELETE | Get / upload / remove user avatar |
| `/api/changelog` | GET | Activity log for a space |

## File storage

Documents are stored at `storage/{userId}/{space-slug}/{category-slug}/{uuid}.{ext}`. Original filenames are kept in the database. Moving items between categories physically moves files. Files are served via `/api/files/[...path]?space={slug}&owner={ownerId}`. Both `data/` and `storage/` are gitignored.

## Theming

CSS custom properties on `:root` (light) and `[data-theme="dark"]`. Accent colours via `[data-palette]` attribute with 8 palette options. Font choices via `[data-font]` and `[data-mono-font]` attributes with self-hosted WOFF2 web fonts in `static/fonts/`. Theme, palette, and font stores persist to localStorage. Flash prevention via inline script in `app.html`. Glass effect uses `backdrop-filter: blur()`.

## Drag-and-drop

`svelte-dnd-action` handles internal reordering (columns and items). Native HTML5 drag events on Column handle external URL and file drops (`.webloc` files auto-convert to links, `.md` files to notes). Dropping items onto collapsed subcategories is supported. **Entire folders** (including subfolders) can be dropped onto a column — subdirectories are created as subcategories with all files imported automatically (`$lib/utils/folder-drop.ts`). Reorder is persisted via batch transaction endpoints (`/api/categories/reorder`, `/api/items/reorder`). Disabled for read-only shared spaces.

## Markdown rendering

Notes and descriptions render markdown via `marked` with HTML sanitized through `DOMPurify` to prevent XSS.

## Link meta-fetching

When creating link items, the server fetches up to 100 KB of HTML to extract `<title>`, meta description, and favicon URL (`favicon_url` stored in items table). 5-second timeout, max 5 redirects. Rejects private IPs and non-http(s) URLs.

## Export & import

- **`$lib/server/export.ts`** — `createExportZip()` builds a ZIP with a JSON manifest, per-space data, referenced tags, and optionally files.
- **`$lib/server/import.ts`** — `previewImport()` validates a ZIP without changes; `executeImport()` imports with conflict resolution (`skip` / `rename` / `replace`). Safety limits: 1 GB decompressed, 50 MB per JSON, 50 000 entries.

## Rate limiting

In-memory per-IP rate limiter in `$lib/server/rate-limit.ts`. Applied to all `/api/*` routes via `hooks.server.ts`. 100 requests per 60-second window; returns `429` with `Retry-After` header.

## Project structure

```
src/
  lib/
    components/       Svelte 5 components
      Board.svelte        Board container with column drag-and-drop
      Breadcrumb.svelte   Navigation breadcrumb for nested categories
      Card.svelte         Item card (link, note, document)
      CategoryForm.svelte Category create/edit form
      ChangelogOverlay.svelte Space activity log with clickable navigation
      ChatPanel.svelte    Real-time chat for shared spaces with presence
      Column.svelte       Single column with item list and drop zone
      Icon.svelte         Centralized SVG icon component
      ItemForm.svelte     Item create/edit form with tag input
      MediaOverlay.svelte Full-screen document/image viewer
      Modal.svelte        Reusable modal dialog
      NoteOverlay.svelte  Full-screen markdown note reader
      ExportImportOverlay.svelte  Export/import spaces as ZIP archives
      SettingsOverlay.svelte  Theme and palette settings
      SpaceSharingOverlay.svelte  Share space by email, manage permissions
      SubcategoryCard.svelte  Subcategory display within a column
      TagInput.svelte     Tag selector with create-on-the-fly
      TextFileOverlay.svelte  Full-screen text/markdown file viewer
      ThemeToggle.svelte  Light/dark/system toggle
      Toast.svelte        Notification toast
      Toolbar.svelte      App toolbar with search, actions, settings, help
      HelpPanel.svelte    In-app help documentation
    server/             Server-only modules
      auth.ts             Password hashing (crypto.scrypt)
      auth-schema.ts      Auth DB table creation
      db.ts               SQLite connection cache, user/auth DB management
      email.ts            SMTP email (nodemailer) with console fallback
      export.ts           ZIP archive creation for space export
      import.ts           ZIP archive parsing and import with conflict resolution
      migration.ts        One-time migration from old per-space to per-user DBs
      changelog.ts        Activity logging (logChange, getChangelog)
      events.ts           Server-sent events (SSE) for real-time notifications
      rate-limit.ts       In-memory per-IP rate limiter
      session.ts          Server-side session management
      space.ts            resolveSpaceAccess() — central auth + DB resolution
      storage.ts          File storage operations with path traversal defense
      user-schema.ts      Per-user DB table creation
    stores/             Reactive stores (Svelte 5 runes)
      board.svelte.ts     Board state and API mutations (incl. folder import)
      chat.svelte.ts      Chat state, messages, presence, SSE connection
      font.svelte.ts      Sans-serif font preference
      mono-font.svelte.ts Monospace font preference
      palette.svelte.ts   Accent colour palette
      theme.svelte.ts     Theme mode (light/dark/system)
    types/
      index.ts            TypeScript interfaces
      export.ts           Export/import types (manifest, preview, conflict modes)
    actions/
      trapFocus.ts        Svelte action: traps keyboard focus within modals/overlays
    utils/
      api.ts              Typed fetch wrapper
      folder-drop.ts      HTML5 folder drag-and-drop with recursive traversal
      slugify.ts          URL-safe slug generation
  routes/
    +layout.svelte        Root layout (theme + palette context)
    +layout.server.ts     Pass user from locals to all pages
    +page.server.ts       Load spaces with stats + shared spaces
    +page.svelte          Spaces dashboard (own + shared, create/delete)
    login/                Login page
    register/             Registration page (with invite code)
    verify-email/         Email verification page
    forgot-password/      Request password reset
    reset-password/       Enter reset code + new password
    admin/                Admin panel (invite codes, users, quotas, legal settings)
    legal/                Privacy policy and legal notice (public, when enabled)
    s/[space]/
      +layout.server.ts   Validate space ownership or shared access
      +layout.svelte      Space layout (Toolbar + app context)
      +page.server.ts     SSR load categories + items
      +page.svelte        Board page with modals and keyboard shortcuts
      +error.svelte       Error page for invalid space slugs
    api/                  REST endpoints (see API routes table above)
data/                   SQLite databases (gitignored, auto-created)
  {userId}.db             Per-user database (spaces, tags, categories, items)
  _auth.db                Central auth database (users, sessions, shares)
storage/                Uploaded files (gitignored)
  {userId}/{spaceSlug}/   Per-user, per-space file storage
static/                 Static assets (favicon)
docs/                   Documentation
```

## CI/CD

GitHub Actions workflow (`.github/workflows/docker-publish.yml`) builds and pushes a Docker image to `ghcr.io/tomgem/pane` on every tagged release (`v*`). Tags: `{version}`, `{major}.{minor}`, and `latest`. Uses `GITHUB_TOKEN` for authentication — no extra secrets required.

## Conventions

- **Svelte 5 runes only** — `$state`, `$derived`, `$effect`, `$props()`, `$bindable()`. No legacy `let` exports or `createEventDispatcher`.
- **Callback props for events** — e.g. `onsubmit`, `onclose`, `onadd` (not `dispatch`).
- **API routes return `json()`** from `@sveltejs/kit`. Space-scoped routes require `?space={slug}` (read via `resolveSpaceAccess(locals, url)`). Shared spaces add `&owner={userId}`.
- **DB operations are synchronous** — `.run()`, `.get()`, `.all()`. Use `db.transaction()` for multi-statement writes.
- **Types** live in `$lib/types/index.ts`. Key types: `CategoryWithItems`, `Item`, `Tag`, `Space`, `SpaceWithStats`, `BreadcrumbSegment`, `ReorderMove`, `User`, `Session`, `InviteCode`, `SpaceShare`, `SharedSpaceInfo`, `StorageQuotaInfo`. Export/import types in `$lib/types/export.ts`.
- **Scoped CSS** — component-scoped via `<style>` blocks. Global variables in `app.css`.
