# Getting Started

## Requirements

- **Node.js** 20 or later
- **pnpm** (recommended) — npm or yarn also work but the lockfile is pnpm-based
- A C/C++ toolchain for compiling the native SQLite binding

### Platform-specific build tools

`better-sqlite3` compiles a native SQLite binding during `pnpm install`. This requires a C/C++ compiler:

**macOS**

```bash
xcode-select --install
```

**Linux (Debian / Ubuntu)**

```bash
sudo apt-get install build-essential python3
```

**Linux (Fedora)**

```bash
sudo dnf groupinstall "Development Tools"
```

**Windows**

Open PowerShell as Administrator:

```powershell
npm install -g windows-build-tools
```

Or install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload.

## Installation

```bash
git clone https://github.com/TomGem/Pane.git
cd Pane
pnpm install
```

## Running the dev server

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

On first launch a default space called **Pane** is created automatically. You'll see an empty board — click **Load Sample Data** to populate it with curated content, or start creating your own categories.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server at http://localhost:5173 |
| `pnpm build` | Production build (uses `adapter-node`) |
| `pnpm preview` | Preview the production build locally |
| `pnpm check` | Run `svelte-check` for type errors |
| `pnpm check:watch` | Continuous type-checking in watch mode |
