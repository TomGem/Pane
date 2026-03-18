# Pane

A multi-user Kanban dashboard for organizing links, notes, and documents into draggable columns. Built with SvelteKit 2, Svelte 5, and SQLite.

![Pane dashboard in dark mode](docs/images/pane.png?v=1.7)

## Features

- **Kanban board** — Organize content into columns with drag-and-drop reordering
- **Three item types** — Links (with auto-fetched metadata & favicons), markdown notes, and file uploads
- **Spaces** — Isolated workspaces, each with its own categories, items, and file storage
- **Space sharing** — Share spaces with other users (read-only or read-write permissions)
- **Multi-user auth** — Registration with invite codes, email verification, and session-based login
- **Admin panel** — Manage users, invite codes, and per-user storage quotas
- **Single-user mode** — Self-host without authentication (`SINGLE_USER=true`)
- **Hierarchical categories** — Nest subcategories for deeper organization
- **Tags & filtering** — Colored tags with multi-tag filtering, combined with search
- **Search** — Full-text search across titles, descriptions, and content
- **Drag and drop** — Reorder items and columns, or drop URLs and files directly onto a column
- **Export & import** — Back up and transfer spaces as ZIP archives
- **Markdown** — Notes render full markdown with syntax highlighting and sanitized HTML
- **Theming** — Light, dark, and system-following themes with 8 accent colour palettes
- **Keyboard shortcuts** — `/` or `Ctrl+K` to search, `Ctrl+N` for new item, `Ctrl+Shift+N` for new category

## Quick start

```bash
git clone https://github.com/TomGem/Pane.git
cd Pane
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). The first user to register becomes the admin (no invite code needed). After logging in, create a space or click **Load Sample Data** on an empty board to get started.

For single-user mode (no auth): `SINGLE_USER=true pnpm dev`

### Docker

No Node.js required — just Docker:

```bash
docker run -d -p 3000:3000 -v ./data:/app/data -v ./storage:/app/storage ghcr.io/tomgem/pane:latest
```

Or clone and build locally:

```bash
git clone https://github.com/TomGem/Pane.git
cd Pane
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000). Data persists in `./data/` and `./storage/`.

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | Installation, requirements, and first run |
| [User Guide](docs/user-guide.md) | How to use Pane — spaces, items, tags, sharing, shortcuts |
| [Architecture](docs/architecture.md) | Technical overview for developers |
| [Deployment](docs/deployment.md) | Production builds and self-hosting |

## Tech stack

- **[SvelteKit 2](https://svelte.dev/docs/kit)** — Full-stack framework with SSR and API routes
- **[Svelte 5](https://svelte.dev/docs/svelte)** — Runes-based reactivity (`$state`, `$derived`, `$effect`)
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** — Synchronous SQLite driver with WAL mode
- **[svelte-dnd-action](https://github.com/isaacHagworthy/svelte-dnd-action)** — Drag-and-drop for columns and items
- **[marked](https://github.com/markedjs/marked)** + **[DOMPurify](https://github.com/cure53/DOMPurify)** — Markdown rendering with XSS sanitization

## License

MIT — see [LICENSE](LICENSE).
