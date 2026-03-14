# Architecture

Technical overview for developers working on or extending Pane.

## Data flow

```
hooks.server.ts (migration + default space + global DB init + rate limiting)
  → /+page.server.ts (spaces dashboard: load all spaces with stats)
  → /s/[space]/+layout.server.ts (validate space, load spaces list)
  → /s/[space]/+page.server.ts (SSR load categories + items from space DB, tags from global DB)
  → BoardStore (client state, space-aware API calls + space-independent tag calls)
  → API routes (mutations with ?space= param; tag routes use global DB directly)
  → SQLite (per-space DB + data/_global.db for tags)
```

Root `/` is a **spaces dashboard** showing all spaces as cards with category and item counts (creating a default `desk` space if none exist). If a space slug doesn't exist, the layout redirects back to `/`.

## Route structure

```
/                           → spaces dashboard (grid of all spaces, create/delete)
/s/[space]/                 → space layout (toolbar + context) + page (board)
/s/[space]/+error.svelte    → error page (unknown slugs redirect to /)
```

The root layout (`+layout.svelte`) owns theme and palette stores. The space layout (`/s/[space]/+layout.svelte`) owns the Toolbar and app context bridge.

## Database

SQLite via `better-sqlite3` (synchronous API). WAL mode, foreign keys ON. DB files: `data/{slug}.db` per space + `data/_global.db` for shared data (all gitignored, auto-created).

### Global database

`data/_global.db` stores the `tags` table, shared across all spaces. The underscore prefix prevents collision with space slugs. On startup, `hooks.server.ts` runs an idempotent migration (`migrateTagsToGlobal`) that moves any per-space tags into the global DB.

### Per-space schema

Four tables per space:

| Table | Purpose |
|-------|---------|
| `categories` | Columns on the board, with optional `parent_id` for hierarchy |
| `items` | Single table with `type` discriminator: `link`, `note`, `document`. Includes `favicon_url` for links. |
| `item_tags` | Junction table linking items to tags (`tag_id` references global DB, no FK constraint) |
| `meta` | Key-value pairs for space metadata (e.g. `display_name`) |

Items share a sort space per category to simplify cross-column drag-and-drop reordering.

### Key modules

- **`$lib/server/db.ts`** — Connection cache (`Map<string, Database>`), `getDb(slug)`, `createDb(slug, name)`, `closeDb(slug)`, `getGlobalDb()`, `listSpaces()`, `slugExists(slug)`, `validateSpaceSlug(slug)`. `listSpaces()` filters out `_global.db`. Slug regex: `/^[a-z0-9-]{1,64}$/`.
- **`$lib/server/schema.ts`** — Table creation and `meta` table helpers
- **`$lib/server/space.ts`** — `getSpaceSlug(url)` and `getSpaceDb(url)` helpers that read `?space=` from the URL
- **`$lib/server/storage.ts`** — File storage with path traversal defense (`assertWithinStorage`). UUID-based filenames on disk, original filename in DB.
- **`$lib/server/export.ts`** — Creates ZIP archives with JSON manifest, space data, and optional files.
- **`$lib/server/import.ts`** — Validates and imports ZIP archives with preview mode, conflict resolution, and rollback.
- **`$lib/server/rate-limit.ts`** — In-memory per-IP rate limiter (100 requests per 60-second window).

## Spaces (multi-database)

Each space has its own SQLite database (`data/{slug}.db`) and storage directory (`storage/{slug}/`). Spaces are discovered by scanning `data/*.db` files and reading the `display_name` from each DB's `meta` table.

- **Space API** — `GET/POST /api/spaces`, `PUT/DELETE /api/spaces/[slug]`
- Deleting the last space is prevented by the API.
- `hooks.server.ts` creates the default `desk` space on first run.

## Client stores

| Store | File | Purpose |
|-------|------|---------|
| `BoardStore` | `$lib/stores/board.svelte.ts` | Categories, items, tags, breadcrumb, current parent. Space-scoped mutations call API routes with `?space={slug}`. Tag mutations call `/api/tags` directly (no space param). Hierarchy mutations: `promoteCategory()`, `demoteCategory()`. |
| `ThemeStore` | `$lib/stores/theme.svelte.ts` | `'light' \| 'dark' \| 'system'`, persists to localStorage, respects `prefers-color-scheme`. |
| `PaletteStore` | `$lib/stores/palette.svelte.ts` | Accent colour palette (8 choices). Sets `data-palette` attribute, persists to localStorage. |

All stores use Svelte 5 runes (`$state`, `$derived`, `$effect`).

## Layout / page communication

The space layout owns the Toolbar and exposes a context object via `setContext('app')`. The page registers callbacks through this context so the Toolbar's Add / Search / Tag actions trigger the page's modals and filtering. The context object exposes reactive getters and setter functions — not plain values.

## API routes

Errors return `{ error: string }` with appropriate status codes (201, 400, 404, 409, 429, 500). Space-scoped routes require `?space={slug}` (read via `getSpaceDb(url)`). Tag routes use `getGlobalDb()` directly — no space param needed. Rate limited: 100 requests per 60-second window per IP; returns `429` with `Retry-After` header.

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/categories` | GET, POST | List / create categories |
| `/api/categories/[id]` | PUT, DELETE | Update / delete a category |
| `/api/categories/[id]/breadcrumb` | GET | Ancestor chain via recursive CTE (root-first) |
| `/api/categories/[id]/move` | POST | Move category subtree to a different space |
| `/api/categories/reorder` | POST | Batch reorder categories |
| `/api/items` | GET, POST | List / create items (POST fetches link metadata) |
| `/api/items/[id]` | PUT, DELETE | Update / delete an item |
| `/api/items/reorder` | POST | Batch reorder items |
| `/api/items/upload` | POST | Upload a document (100 MB max) |
| `/api/tags` | GET, POST | List / create tags (global DB, no space param) |
| `/api/tags/[id]` | PUT, DELETE | Update / delete a tag (global DB) |
| `/api/files/[...path]` | GET | Serve uploaded files |
| `/api/spaces` | GET, POST | List / create spaces |
| `/api/spaces/[slug]` | PUT, DELETE | Rename / delete a space |
| `/api/seed` | POST | Populate an empty space with sample data |
| `/api/export` | GET | Export spaces as ZIP archive |
| `/api/import` | POST | Import ZIP archive (preview or execute) |

## File storage

Documents are stored at `storage/{space-slug}/{category-slug}/{uuid}.{ext}`. Original filenames are kept in the database. Moving items between categories physically moves files. Files are served via `/api/files/[...path]?space={slug}`. Both `data/` and `storage/` are gitignored.

## Theming

CSS custom properties on `:root` (light) and `[data-theme="dark"]`. Accent colours via `[data-palette]` attribute with 8 palette options. Theme and palette stores persist to localStorage. Flash prevention via inline script in `app.html`. Glass effect uses `backdrop-filter: blur()`.

## Drag-and-drop

`svelte-dnd-action` handles internal reordering (columns and items). Native HTML5 drag events on Column handle external URL and file drops. Reorder is persisted via batch transaction endpoints (`/api/categories/reorder`, `/api/items/reorder`).

## Markdown rendering

Notes and descriptions render markdown via `marked` with HTML sanitized through `DOMPurify` to prevent XSS.

## Link meta-fetching

When creating link items, the server fetches up to 100 KB of HTML to extract `<title>`, meta description, and favicon URL (`favicon_url` stored in items table). 5-second timeout, max 5 redirects. Rejects private IPs and non-http(s) URLs.

## Export & import

- **`$lib/server/export.ts`** — `createExportZip()` builds a ZIP with a JSON manifest, per-space data, referenced global tags, and optionally files.
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
      Column.svelte       Single column with item list and drop zone
      ItemForm.svelte     Item create/edit form with tag input
      MediaOverlay.svelte Full-screen document/image viewer
      Modal.svelte        Reusable modal dialog
      NoteOverlay.svelte  Full-screen markdown note reader
      ExportImportOverlay.svelte  Export/import spaces as ZIP archives
      SettingsOverlay.svelte  Theme and palette settings
      SubcategoryCard.svelte  Subcategory display within a column
      TagInput.svelte     Tag selector with create-on-the-fly
      TextFileOverlay.svelte  Full-screen text/markdown file viewer
      ThemeToggle.svelte  Light/dark/system toggle
      Toast.svelte        Notification toast
      Toolbar.svelte      App toolbar with search, actions, settings, help
    server/             Server-only modules
      db.ts               SQLite connection cache, space management, global DB
      schema.ts           Table creation and meta helpers
      space.ts            URL-based space slug extraction
      storage.ts          File storage operations with path traversal defense
      export.ts           ZIP archive creation for space export
      import.ts           ZIP archive parsing and import with conflict resolution
      rate-limit.ts       In-memory per-IP rate limiter
    stores/             Reactive stores (Svelte 5 runes)
      board.svelte.ts     Board state and API mutations
      palette.svelte.ts   Accent colour palette
      theme.svelte.ts     Theme mode (light/dark/system)
    types/
      index.ts            TypeScript interfaces
      export.ts           Export/import types (manifest, preview, conflict modes)
    actions/
      trapFocus.ts        Svelte action: traps keyboard focus within modals/overlays
    utils/
      api.ts              Fetch helpers
      slugify.ts          URL-safe slug generation
  routes/
    +layout.svelte        Root layout (theme + palette context)
    +page.server.ts       Load all spaces with stats for dashboard
    +page.svelte          Spaces dashboard (grid, create/delete)
    s/[space]/
      +layout.server.ts   Validate space, load spaces list
      +layout.svelte      Space layout (Toolbar + app context)
      +page.server.ts     SSR load categories + items
      +page.svelte        Board page with modals and keyboard shortcuts
      +error.svelte       Error page for invalid space slugs
    api/                  REST endpoints (see API routes table above)
data/                   SQLite databases, one per space (gitignored)
storage/                Uploaded files, one directory per space (gitignored)
static/                 Static assets (favicon)
docs/                   Documentation
```

## CI/CD

GitHub Actions workflow (`.github/workflows/docker-publish.yml`) builds and pushes a Docker image to `ghcr.io/tomgem/pane` on every tagged release (`v*`). Tags: `{version}`, `{major}.{minor}`, and `latest`. Uses `GITHUB_TOKEN` for authentication — no extra secrets required.

## Conventions

- **Svelte 5 runes only** — `$state`, `$derived`, `$effect`, `$props()`, `$bindable()`. No legacy `let` exports or `createEventDispatcher`.
- **Callback props for events** — e.g. `onsubmit`, `onclose`, `onadd` (not `dispatch`).
- **API routes return `json()`** from `@sveltejs/kit`. Space-scoped routes require `?space={slug}`. Tag routes use global DB directly (no space param).
- **DB operations are synchronous** — `.run()`, `.get()`, `.all()`. Use `db.transaction()` for multi-statement writes.
- **Types** live in `$lib/types/index.ts`. Key types: `CategoryWithItems`, `Item`, `Tag`, `Space`, `SpaceWithStats`, `BreadcrumbSegment`, `ReorderMove`. Export/import types in `$lib/types/export.ts`.
- **Scoped CSS** — component-scoped via `<style>` blocks. Global variables in `app.css`.
