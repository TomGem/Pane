# User Guide

## Spaces

Pane supports multiple **spaces** — isolated workspaces, each with its own categories, items, and file storage. Tags are shared across all spaces.

- The root page is a **Spaces dashboard** showing all your spaces as cards with category and item counts.
- Click **Pane** in the toolbar to return to the dashboard, or use the **space switcher** dropdown to jump between spaces directly.
- From the dashboard you can create new spaces or delete them.
- The last space cannot be deleted. If all spaces are removed, a default one is recreated automatically.
- Each space stores its data in a separate SQLite database (`data/{slug}.db`) and file directory (`storage/{slug}/`).

## Categories

Categories are the columns on your board.

- Click **Add category** (or `Ctrl+Shift+N`) to create a new column.
- Drag columns left and right to reorder them.
- Click the column menu (`...`) to edit or delete a category.
- Click the column name to drill down into subcategories.

### Subcategories

Categories can be nested. From the column menu, choose **Add subcategory** to create a child category. Click the subcategory card to drill down into it. A **breadcrumb trail** appears at the top of the board showing the path from root to the current level — click any segment to jump back up.

### Moving categories between spaces

From the column menu, choose **Move to space** to move an entire category (including all subcategories, items, and files) to a different space. Slug collisions are resolved automatically.

## Items

There are three item types:

### Links
Add a URL with a title and optional description. When you save a link, the server automatically fetches the page title, description, and **favicon** — the favicon is displayed on the card for quick visual identification. Click a link card to open the URL in a new tab.

### Notes
Create text notes with full **markdown** support — headings, bold, italic, lists, code blocks, and more. Click a note card to open it in a full-screen reader with rendered markdown.

### Documents
Upload files (images, PDFs, etc.) up to **100 MB** per file. Click a document card to preview it in a full-screen overlay — **PDFs are displayed inline**, images and videos play natively, and audio files have a built-in player. **Text and markdown files** open in a dedicated reader with syntax rendering and a copy-to-clipboard button. Files are stored locally in the `storage/` directory.

## Adding items

- Click the **+** button on a column header, or use `Ctrl+N`.
- Choose the item type (link, note, or document).
- Assign a category, add tags, and fill in the details.
- You can also **drop a URL** or **drag a file** directly onto a column to add it instantly.

## Tags & filtering

Tags are **shared across all spaces**, so you can use a consistent set of labels everywhere.

- Create tags with custom names and colours when adding or editing items.
- Edit tag names and colours from the **tag dropdown** in the toolbar.
- Click a **tag badge** on any card to filter the board by that tag.
- Use the **tag dropdown** (next to the search box) to filter by multiple tags at once.
- Search and tag filters combine — an item must match both to appear.

## Search

Type in the search box (or press `/` or `Ctrl+K`) to filter items across all columns. Search matches against titles, descriptions, and content. When matches are found inside subcategories, those subcategories are automatically expanded so you can see the results. Press `Esc` to clear.

## Appearance

### Theme

Toggle between **light**, **dark**, and **system** themes from the **Settings** overlay (gear icon).

### Accent palette

Open **Settings** (gear icon) to choose from 8 accent colour palettes: Indigo (default), Blue, Teal, Green, Orange, Red, Pink, and Grey. The palette affects buttons, links, tags, and other accent-coloured elements.

Both theme and palette preferences are saved to localStorage and persist across sessions.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `/` or `Ctrl+K` | Focus search |
| `Ctrl+N` | New item |
| `Ctrl+Shift+N` | New category |
| `Esc` | Close modal / overlay / clear search |

## Sample data

On an empty board, click **Load Sample Data** to populate it with curated content. This is useful for exploring the app's features without creating your own data first.

## Export & import

You can export and import spaces as ZIP archives to back up your data or transfer it between machines.

- Open **Settings** (gear icon) and click **Export & Import**.
- **Export** one or more spaces (or all spaces at once). Optionally include uploaded files in the archive.
- **Import** a previously exported ZIP file. Before importing, you get a **preview** of what will be added.
- When an imported space conflicts with an existing one, choose a conflict mode: **skip** (leave existing), **rename** (auto-suffix the imported space), or **replace** (overwrite the existing space).

## Privacy

All data stays on your local machine. There are no accounts, no cloud sync, and no telemetry. Databases and uploaded files live in the `data/` and `storage/` directories alongside the app.
