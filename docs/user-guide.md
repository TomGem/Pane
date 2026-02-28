# User Guide

## Spaces

Pane supports multiple **spaces** — isolated workspaces, each with its own categories, items, tags, and file storage.

- Click **Pane** in the toolbar to open the Spaces overview.
- From there you can switch between spaces, create new ones, rename them, or delete them.
- The last space cannot be deleted. If all spaces are removed, a default one is recreated automatically.
- Each space stores its data in a separate SQLite database (`data/{slug}.db`) and file directory (`storage/{slug}/`).

## Categories

Categories are the columns on your board.

- Click **Add category** (or `Cmd+Shift+N`) to create a new column.
- Drag columns left and right to reorder them.
- Click the column menu (`...`) to edit or delete a category.
- Click the column name to drill down into subcategories.

### Subcategories

Categories can be nested. From the column menu, choose **Add subcategory** to create a child category. Click the subcategory card to drill down into it. Use the breadcrumb trail at the top to navigate back up.

## Items

There are three item types:

### Links
Add a URL with a title and optional description. Click a link card to open the URL in a new tab.

### Notes
Create text notes with full **markdown** support — headings, bold, italic, lists, code blocks, and more. Click a note card to open it in a full-screen reader with rendered markdown.

### Documents
Upload files (images, PDFs, etc.) to a category. Click a document card to preview or download it. Files are stored locally in the `storage/` directory.

## Adding items

- Click the **+** button on a column header, or use `Cmd+N`.
- Choose the item type (link, note, or document).
- Assign a category, add tags, and fill in the details.
- You can also **drop a URL** or **drag a file** directly onto a column to add it instantly.

## Tags & filtering

- Create tags with custom names and colours when adding or editing items.
- Click a **tag badge** on any card to filter the board by that tag.
- Use the **tag dropdown** (next to the search box) to filter by multiple tags.
- Search and tag filters combine — an item must match both to appear.

## Search

Type in the search box (or press `/` or `Cmd+K`) to filter items across all columns. Search matches against titles, descriptions, and content. Press `Esc` to clear.

## Appearance

### Theme

Toggle between **light**, **dark**, and **system** themes using the icons in the toolbar, or from the Settings overlay.

### Accent palette

Open **Settings** (gear icon) to choose from 8 accent colour palettes: Indigo (default), Blue, Teal, Green, Orange, Red, Pink, and Grey. The palette affects buttons, links, tags, and other accent-coloured elements.

Both theme and palette preferences are saved to localStorage and persist across sessions.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `/` or `Cmd+K` | Focus search |
| `Cmd+N` | New item |
| `Cmd+Shift+N` | New category |
| `Esc` | Close modal / overlay / clear search |

## Sample data

On an empty board, click **Load Sample Data** to populate it with curated content. This is useful for exploring the app's features without creating your own data first.

## Privacy

All data stays on your local machine. There are no accounts, no cloud sync, and no telemetry. Databases and uploaded files live in the `data/` and `storage/` directories alongside the app.
