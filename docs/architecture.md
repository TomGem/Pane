# Architecture

Technical overview for developers working on or extending Pane.

## Data flow

```
hooks.server.ts (migration + default space)
  → /s/[space]/+layout.server.ts (validate space, load spaces list)
  → /s/[space]/+page.server.ts (SSR load categories + items + tags)
  → BoardStore (client state, space-aware API calls)
  → API routes (mutations with ?space= param)
  → SQLite (per-space DB)
```

Root `/` redirects to the first available space (creating a default `pane` space if none exist). If a space slug doesn't exist, the layout redirects back to `/`.

## Route structure

```
/                           → redirect to first available space
/s/[space]/                 → space layout (toolbar + context) + page (board)
/s/[space]/+error.svelte    → error page (unknown slugs redirect to /)
```

The root layout (`+layout.svelte`) owns theme and palette stores. The space layout (`/s/[space]/+layout.svelte`) owns the Toolbar and app context bridge.

## Database

SQLite via `better-sqlite3` (synchronous API). WAL mode, foreign keys ON. DB files: `data/{slug}.db` (gitignored, auto-created).

### Schema

Five tables:

| Table | Purpose |
|-------|---------|
| `categories` | Columns on the board, with optional `parent_id` for hierarchy |
| `items` | Single table with `type` discriminator: `link`, `note`, `document` |
| `tags` | Named, coloured labels |
| `item_tags` | Junction table linking items to tags |
| `meta` | Key-value pairs for space metadata (e.g. `display_name`) |

Items share a sort space per category to simplify cross-column drag-and-drop reordering.

### Key modules

- **`$lib/server/db.ts`** — Connection cache (`Map<string, Database>`), `getDb(slug)`, `createDb(slug, name)`, `closeDb(slug)`, `listSpaces()`, `slugExists(slug)`, `validateSpaceSlug(slug)`
- **`$lib/server/schema.ts`** — Table creation and `meta` table helpers
- **`$lib/server/space.ts`** — `getSpaceSlug(url)` and `getSpaceDb(url)` helpers that read `?space=` from the URL
- **`$lib/server/storage.ts`** — File storage operations (save, move, delete)

## Spaces (multi-database)

Each space has its own SQLite database (`data/{slug}.db`) and storage directory (`storage/{slug}/`). Spaces are discovered by scanning `data/*.db` files and reading the `display_name` from each DB's `meta` table.

- **Space API** — `GET/POST /api/spaces`, `PUT/DELETE /api/spaces/[slug]`
- Deleting the last space is prevented by the API.
- `hooks.server.ts` creates the default `pane` space on first run.

## Client stores

| Store | File | Purpose |
|-------|------|---------|
| `BoardStore` | `$lib/stores/board.svelte.ts` | Categories, items, tags, breadcrumb, current parent. All mutations call API routes with `?space={slug}`. |
| `ThemeStore` | `$lib/stores/theme.svelte.ts` | `'light' \| 'dark' \| 'system'`, persists to localStorage, respects `prefers-color-scheme`. |
| `PaletteStore` | `$lib/stores/palette.svelte.ts` | Accent colour palette (8 choices). Sets `data-palette` attribute, persists to localStorage. |

All stores use Svelte 5 runes (`$state`, `$derived`, `$effect`).

## Layout / page communication

The space layout owns the Toolbar and exposes a context object via `setContext('app')`. The page registers callbacks through this context so the Toolbar's Add / Search / Tag actions trigger the page's modals and filtering. The context object exposes reactive getters and setter functions — not plain values.

## API routes

All API routes require a `?space={slug}` query parameter (read via `getSpaceDb(url)` from `$lib/server/space`). Errors return `{ error: string }` with appropriate status codes.

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/categories` | GET, POST | List / create categories |
| `/api/categories/[id]` | PUT, DELETE | Update / delete a category |
| `/api/categories/[id]/breadcrumb` | GET | Breadcrumb trail for a category |
| `/api/categories/reorder` | POST | Batch reorder categories |
| `/api/items` | GET, POST | List / create items |
| `/api/items/[id]` | PUT, DELETE | Update / delete an item |
| `/api/items/reorder` | POST | Batch reorder items |
| `/api/items/upload` | POST | Upload a document |
| `/api/tags` | GET, POST | List / create tags |
| `/api/tags/[id]` | PUT, DELETE | Update / delete a tag |
| `/api/files/[...path]` | GET | Serve uploaded files |
| `/api/spaces` | GET, POST | List / create spaces |
| `/api/spaces/[slug]` | PUT, DELETE | Rename / delete a space |
| `/api/seed` | POST | Populate an empty space with sample data |

## File storage

Documents are stored at `storage/{space-slug}/{category-slug}/{uuid}.{ext}`. Original filenames are kept in the database. Moving items between categories physically moves files. Files are served via `/api/files/[...path]?space={slug}`. Both `data/` and `storage/` are gitignored.

## Theming

CSS custom properties on `:root` (light) and `[data-theme="dark"]`. Accent colours via `[data-palette]` attribute with 8 palette options. Theme and palette stores persist to localStorage. Flash prevention via inline script in `app.html`. Glass effect uses `backdrop-filter: blur()`.

## Drag-and-drop

`svelte-dnd-action` handles internal reordering (columns and items). Native HTML5 drag events on Column handle external URL and file drops. Reorder is persisted via batch transaction endpoints (`/api/categories/reorder`, `/api/items/reorder`).

## Markdown rendering

Notes and descriptions render markdown via `marked` with HTML sanitized through `DOMPurify` to prevent XSS.

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
      SettingsOverlay.svelte  Theme and palette settings
      SpacesOverlay.svelte    Space management overlay
      SubcategoryCard.svelte  Subcategory display within a column
      TagInput.svelte     Tag selector with create-on-the-fly
      ThemeToggle.svelte  Light/dark/system toggle
      Toast.svelte        Notification toast
      Toolbar.svelte      App toolbar with search, actions, settings, help
    server/             Server-only modules
      db.ts               SQLite connection cache and space management
      schema.ts           Table creation and meta helpers
      space.ts            URL-based space slug extraction
      storage.ts          File storage operations
    stores/             Reactive stores (Svelte 5 runes)
      board.svelte.ts     Board state and API mutations
      palette.svelte.ts   Accent colour palette
      theme.svelte.ts     Theme mode (light/dark/system)
    types/
      index.ts            TypeScript interfaces
    utils/
      api.ts              Fetch helpers
      slugify.ts          URL-safe slug generation
  routes/
    +layout.svelte        Root layout (theme + palette context)
    +page.server.ts       Root redirect to first available space
    +page.svelte          Empty root page (redirect only)
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

## Conventions

- **Svelte 5 runes only** — `$state`, `$derived`, `$effect`, `$props()`, `$bindable()`. No legacy `let` exports or `createEventDispatcher`.
- **Callback props for events** — e.g. `onsubmit`, `onclose`, `onadd` (not `dispatch`).
- **API routes return `json()`** from `@sveltejs/kit`. All routes require `?space={slug}`.
- **DB operations are synchronous** — `.run()`, `.get()`, `.all()`. Use `db.transaction()` for multi-statement writes.
- **Types** live in `$lib/types/index.ts`. Key types: `CategoryWithItems`, `Item`, `Tag`, `Space`.
- **Scoped CSS** — component-scoped via `<style>` blocks. Global variables in `app.css`.
