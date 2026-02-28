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

No test framework is configured. Use `pnpm check` to validate types before committing.

## Architecture

**Pane** is a local-only Kanban dashboard built with SvelteKit 2 + SQLite. It organizes links, notes, and documents into draggable columns. All data stays on the local machine. Supports multiple isolated **Spaces**, each with its own database and file storage.

### Data flow

```
hooks.server.ts (migration + default space)
  → /s/[space]/+layout.server.ts (validate space, load spaces list)
  → /s/[space]/+page.server.ts (SSR load categories+items+tags)
  → Board store (client state, space-aware API calls)
  → API routes (mutations with ?space= param)
  → SQLite (per-space DB)
```

Root `/` redirects to `/s/pane`. The space layout validates the space slug and provides space metadata to the toolbar. The page server load hydrates the board. All mutations go through the `BoardStore` (`$lib/stores/board.svelte.ts`), which appends `?space={slug}` to all API calls. The store uses Svelte 5 runes (`$state`, `$derived`, `$effect`).

### Spaces (Multi-Database)

Each space has its own SQLite database (`data/{slug}.db`) and storage directory (`storage/{slug}/`). Spaces are discovered by scanning `data/*.db` files and reading the `display_name` from each DB's `meta` table.

- **`$lib/server/db.ts`** — Connection cache (`Map<string, Database>`), `getDb(slug)`, `createDb(slug, name)`, `closeDb(slug)`, `listSpaces()`, `slugExists(slug)`, `validateSpaceSlug(slug)`
- **`$lib/server/space.ts`** — `getSpaceSlug(url)` and `getSpaceDb(url)` helpers that read `?space=` from the URL
- **Space API** — `GET/POST /api/spaces`, `PUT/DELETE /api/spaces/[slug]`

### Database

SQLite via `better-sqlite3` (synchronous API). Connection cache in `$lib/server/db.ts`, schema in `$lib/server/schema.ts`, initialized in `hooks.server.ts`. WAL mode, foreign keys ON. DB files: `data/{slug}.db` (gitignored, auto-created).

Five tables: `categories` (with optional `parent_id` for hierarchy), `items` (single table with `type` discriminator: link/note/document), `tags`, `item_tags` (junction), `meta` (key-value for space metadata like `display_name`). Items share a sort space per category to simplify cross-column drag-and-drop.

### Route structure

```
/                           → redirect to /s/pane
/s/[space]/                 → space layout (toolbar + context) + page (board)
/s/[space]/+error.svelte    → "Space not found" error page
```

Root layout (`+layout.svelte`) owns theme only. Space layout (`/s/[space]/+layout.svelte`) owns the Toolbar and app context bridge.

### Hierarchical navigation

Categories can be nested via `parent_id`. The board store tracks `currentParentId` and `breadcrumb` state. Drilling into a subcategory re-fetches categories and items scoped to that parent. Breadcrumb navigation allows jumping back to any ancestor level.

### Layout ↔ Page communication

Space layout (`/s/[space]/+layout.svelte`) owns the Toolbar and theme. Page (`/s/[space]/+page.svelte`) registers callbacks via `setContext('app')` / `getContext('app')` so the Toolbar's Add/Search/Tag actions trigger the page's modals and filtering. The context object exposes reactive getters and setter functions — not plain values.

### File storage

Documents stored at `storage/{space-slug}/{category-slug}/{uuid}.{ext}`. Original filename kept in DB. Moving items between categories physically moves files. Served via `/api/files/[...path]?space={slug}`. Both `data/` and `storage/` are gitignored.

### Theming

CSS custom properties on `:root` (light) and `[data-theme="dark"]`. Theme store in `$lib/stores/theme.svelte.ts` persists to localStorage, respects `prefers-color-scheme`. Flash prevention via inline script in `app.html`. Glass effect uses `backdrop-filter: blur()`.

### Drag-and-drop

`svelte-dnd-action` for internal reorder (columns and items). Native HTML5 drag events on Column for external URL and file drops. Reorder persisted via batch transaction endpoints (`/api/categories/reorder`, `/api/items/reorder`).

### Markdown rendering

Notes and descriptions render markdown via `marked` with HTML sanitized through `DOMPurify` to prevent XSS.

### Seed endpoint

`POST /api/seed?space={slug}` populates an empty database with curated sample data (categories, tags, items). Guards against duplicate seeding by checking if any categories exist. Called from the empty board state UI.

## Conventions

- **Svelte 5 runes only** — `$state`, `$derived`, `$effect`, `$props()`, `$bindable()`. No legacy `let` exports or `createEventDispatcher`.
- **Callback props for events** — e.g. `onsubmit`, `onclose`, `onadd` (not `dispatch`).
- **API routes return `json()`** from `@sveltejs/kit`. Errors return `{ error: string }` with appropriate status codes. All API routes require `?space={slug}` query parameter (read via `getSpaceDb(url)` from `$lib/server/space`).
- **DB operations are synchronous** — `.run()`, `.get()`, `.all()`. Use `db.transaction()` for multi-statement writes.
- **Types** live in `$lib/types/index.ts`. `CategoryWithItems` is the joined type used by components. `Space` is `{ slug: string; name: string }`.
- **Scoped CSS** — styles are component-scoped via `<style>` blocks. Global variables defined in `app.css`.
