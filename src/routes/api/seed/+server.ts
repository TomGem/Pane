import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSpaceAccess, requireWriteAccess } from '$lib/server/space';
import { getUserDb } from '$lib/server/db';
import { slugify } from '$lib/utils/slugify';
import { emit } from '$lib/server/events';

export const POST: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });

		const access = resolveSpaceAccess(locals, url);
		requireWriteAccess(access);
		const { db, spaceSlug } = access;

		// Guard against duplicate seeding
		const existing = db.prepare('SELECT COUNT(*) AS count FROM categories WHERE space_slug = ?').get(spaceSlug) as { count: number };
		if (existing.count > 0) {
			return json({ error: 'Database already contains data' }, { status: 409 });
		}

		// --- Tags (per-user, idempotent) ---
		const userDb = getUserDb(locals.userId);
		const insertTag = userDb.prepare('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)');
		const getTagId = userDb.prepare('SELECT id FROM tags WHERE name = ?');
		const tagIds: Record<string, number> = {};

		const tags: [string, string][] = [
			['Beginner', '#22c55e'],
			['Tutorial', '#3b82f6'],
			['Reference', '#a855f7'],
			['Tips', '#f59e0b'],
			['Video', '#ef4444'],
			['Essential', '#ec4899']
		];

		for (const [name, color] of tags) {
			insertTag.run(name, color);
			const row = getTagId.get(name) as { id: number };
			tagIds[name] = row.id;
		}

		const seed = db.transaction(() => {

			// --- Categories ---
			const insertCategory = db.prepare(
				'INSERT INTO categories (space_slug, name, slug, color, sort_order, parent_id) VALUES (?, ?, ?, ?, ?, ?)'
			);

			const cat1 = insertCategory.run(spaceSlug, 'Getting Started', slugify('Getting Started'), '#22c55e', 1, null).lastInsertRowid as number;
			const cat2 = insertCategory.run(spaceSlug, 'Claude Code', slugify('Claude Code'), '#6366f1', 2, null).lastInsertRowid as number;
			const cat3 = insertCategory.run(spaceSlug, 'Prompting for Code', slugify('Prompting for Code'), '#f59e0b', 3, null).lastInsertRowid as number;
			const cat4 = insertCategory.run(spaceSlug, 'Tools & Ecosystem', slugify('Tools & Ecosystem'), '#ef4444', 4, null).lastInsertRowid as number;

			// Subcategories
			const cat1Sub = insertCategory.run(spaceSlug, 'Setup Guides', slugify('Setup Guides'), '#22c55e', 1, cat1).lastInsertRowid as number;
			const cat2SubGS = insertCategory.run(spaceSlug, 'Getting Started', slugify('Getting Started CC'), '#6366f1', 1, cat2).lastInsertRowid as number;
			const cat2Sub = insertCategory.run(spaceSlug, 'Advanced Features', slugify('Advanced Features'), '#6366f1', 2, cat2).lastInsertRowid as number;

			// --- Items ---
			const insertItem = db.prepare(
				`INSERT INTO items (category_id, type, title, content, description, favicon_url, sort_order)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			);
			const insertItemTag = db.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)');

			function addItem(
				categoryId: number,
				type: 'link' | 'note',
				title: string,
				content: string | null,
				description: string | null,
				sortOrder: number,
				itemTags: string[],
				faviconUrl: string | null = null
			) {
				const id = insertItem.run(categoryId, type, title, content, description, faviconUrl, sortOrder).lastInsertRowid as number;
				for (const tag of itemTags) {
					if (tagIds[tag]) {
						insertItemTag.run(id, tagIds[tag]);
					}
				}
			}

			// Favicon URLs
			const favAnthropic = 'https://www.anthropic.com/favicon.ico';
			const favGitHub = 'https://github.githubassets.com/favicons/favicon.svg';
			const favCursor = 'https://cursor.com/favicon.ico';
			const favAider = 'https://aider.chat/assets/icons/favicon-32x32.png';
			const favMCP = 'https://modelcontextprotocol.io/favicon.svg';
			const favGoogle = 'https://www.google.com/favicon.ico';
			const favOpenAI = 'https://openai.com/favicon.ico';
			const favV0 = 'https://v0.dev/favicon.ico';
			const favBolt = 'https://bolt.new/favicon.ico';
			const favReplit = 'https://replit.com/public/icons/favicon-32.png';
			const favDevTo = 'https://dev.to/favicon.ico';

			// ===== GETTING STARTED =====
			addItem(cat1, 'note', 'What is Vibe Coding?',
				'**Vibe coding** is a style of programming where you describe what you want in natural language and an AI agent writes the code for you. You guide the direction, review the output, and iterate — but the AI handles the heavy lifting.\n\n## Why It Works\n- **Speed** — Go from idea to working code in minutes, not hours\n- **Accessibility** — You don\'t need to memorise every API or syntax detail\n- **Learning** — See how experienced-level code is structured as it\'s generated\n- **Focus** — Spend your energy on *what* to build, not *how* to type it\n\n## The Workflow\n1. **Describe** what you want (a feature, a fix, a refactor)\n2. **Review** the generated code — always read what the AI produces\n3. **Iterate** — refine your prompt if the result isn\'t right\n4. **Commit** — once you\'re happy, save your work\n\n## Key Mindset Shift\nYou\'re not "writing code with AI help" — you\'re **directing an agent** that happens to output code. The better you communicate intent, the better the results.',
				'What vibe coding is, why it works, and the core workflow loop.',
				1, ['Beginner', 'Essential']);

			addItem(cat1, 'link', 'Anthropic Documentation — Getting Started',
				'https://docs.anthropic.com/en/docs/welcome',
				'Official Anthropic docs covering Claude models, capabilities, and API basics.',
				2, ['Beginner', 'Reference'], favAnthropic);

			addItem(cat1, 'link', 'Introduction to Claude Code — Official Docs',
				'https://docs.anthropic.com/en/docs/claude-code/overview',
				'Overview of Claude Code: what it is, how to install it, and your first steps.',
				3, ['Beginner', 'Tutorial'], favAnthropic);

			addItem(cat1, 'link', 'Vibe Coding 101 — Practical Tips for AI-First Development',
				'https://dev.to/stripe/vibe-coding-101-a-practical-guide-5df1',
				'Practical guide to getting started with AI-driven development, from prompting to reviewing output.',
				4, ['Beginner', 'Tips'], favDevTo);

			// ===== SETUP GUIDES (subcategory of Getting Started) =====
			addItem(cat1Sub, 'note', 'Setting Up Your Environment',
				'## Prerequisites\n- **Node.js 18+** — Required to run Claude Code\n- **Git** — For version control integration\n- **A code editor** — VS Code, Cursor, or JetBrains\n\n## Installation\n```bash\n# macOS / Linux\ncurl -fsSL https://claude.ai/install.sh | bash\n\n# Windows PowerShell\nirm https://claude.ai/install.ps1 | iex\n```\n\n## First Run\n```bash\ncd your-project\nclaude\n```\nYou\'ll be prompted to log in on first use.\n\n## Recommended Setup\n1. Run `claude /init` to generate a `CLAUDE.md` for your project\n2. Install the VS Code extension for IDE integration\n3. Try `claude "what does this project do?"` to verify everything works',
				'Step-by-step checklist for installing Claude Code and setting up your development environment.',
				1, ['Beginner', 'Essential']);

			addItem(cat1Sub, 'link', 'Claude Code Quickstart',
				'https://docs.anthropic.com/en/docs/claude-code/quickstart',
				'Official quickstart guide: install Claude Code, log in, and run your first commands in minutes.',
				2, ['Beginner', 'Tutorial'], favAnthropic);

			addItem(cat1Sub, 'link', 'Claude Code in VS Code',
				'https://docs.anthropic.com/en/docs/claude-code/ide-integrations',
				'Set up the Claude Code VS Code extension for inline diffs, @-mentions, and integrated chat.',
				3, ['Beginner', 'Tutorial'], favAnthropic);

			// ===== CLAUDE CODE =====
			addItem(cat2, 'note', 'Why Claude Code + Opus 4.6?',
				'Claude Code is Anthropic\'s agentic CLI — it reads your codebase, edits files, runs commands, and iterates autonomously. Powered by **Claude Opus 4.6**, it\'s currently the most capable model for complex coding tasks.\n\n## What Sets It Apart\n- **Deep codebase awareness** — reads files, follows imports, understands architecture\n- **Tool use** — runs shell commands, tests, linters as part of its workflow\n- **Multi-file edits** — can refactor across dozens of files in one session\n- **Memory** — `CLAUDE.md` files give persistent project context across sessions\n- **Transparent** — you see every tool call and can approve or deny actions\n\n## Opus 4.6 Strengths\n- Best-in-class at sustained, multi-step reasoning\n- Excels at large refactors and architectural changes\n- Strong at following complex constraints and conventions\n- Understands nuanced instructions without over-engineering',
				'What makes Claude Code and Opus 4.6 a strong choice for vibe coding.',
				1, ['Essential', 'Reference']);

			addItem(cat2, 'link', 'Best Practices for Claude Code',
				'https://docs.anthropic.com/en/docs/claude-code/best-practices',
				'Official guide on writing effective CLAUDE.md files, structuring prompts, and getting the most out of Claude Code.',
				2, ['Tips', 'Essential'], favAnthropic);

			addItem(cat2, 'link', 'Claude Code GitHub Repository',
				'https://github.com/anthropics/claude-code',
				'Source code, issues, and discussions for Claude Code. Star it to follow updates.',
				3, ['Reference'], favGitHub);

			addItem(cat2, 'note', 'Claude Code Cheat Sheet',
				'## Essential Commands\n- `claude` — Start interactive REPL\n- `claude "prompt"` — One-shot command\n- `cat file | claude "explain this"` — Pipe input\n- `claude -c` — Continue last conversation\n- `claude -r "instructions"` — Add a system prompt\n\n## Slash Commands\n- `/help` — Show all commands\n- `/clear` — Reset conversation\n- `/compact` — Summarize context to save tokens\n- `/init` — Generate a CLAUDE.md for your project\n- `/cost` — Show token usage and cost\n\n## Keyboard Shortcuts\n- `Ctrl+C` — Cancel current generation\n- `Esc` — Interrupt multi-turn tool use\n- `Shift+Enter` — Multi-line input\n\n## Pro Tips\n- Use `CLAUDE.md` files to give project context\n- Start with small tasks and build up\n- Review all changes before accepting\n- Use `/compact` when context gets large\n- Run `claude --model opus` to ensure you\'re on Opus 4.6',
				'Quick reference for Claude Code commands, shortcuts, and tips.',
				4, ['Essential', 'Reference']);

			// ===== GETTING STARTED — subcategory of Claude Code =====
			addItem(cat2SubGS, 'note', 'Your First Session',
				'## Step 1 — Open a Project\n```bash\ncd my-project\nclaude\n```\n\n## Step 2 — Orient Yourself\nAsk Claude to explain what\'s there:\n> "What does this project do? Give me a brief overview of the architecture."\n\n## Step 3 — Make a Small Change\nStart with something concrete:\n> "Add a /health endpoint that returns { status: \'ok\' }"\n\n## Step 4 — Review and Commit\nClaude will show you every file it edits. Read the diff, then:\n> "Looks good, commit this with message \'Add health endpoint\'"\n\n## Step 5 — Build Up Gradually\nNow try bigger tasks. Each session teaches you how to prompt more effectively.\n\n## Golden Rule\n**Read what it writes.** Vibe coding doesn\'t mean blind trust — it means fast iteration with human oversight.',
				'A walkthrough of your first Claude Code session, from opening a project to committing changes.',
				1, ['Beginner', 'Tutorial']);

			addItem(cat2SubGS, 'link', 'Claude Code Overview — How It Works',
				'https://docs.anthropic.com/en/docs/claude-code/overview',
				'Understand the agentic loop, built-in tools, and how Claude Code interacts with your project.',
				2, ['Beginner', 'Reference'], favAnthropic);

			addItem(cat2SubGS, 'link', 'Claude Code Quickstart',
				'https://docs.anthropic.com/en/docs/claude-code/quickstart',
				'Install, authenticate, and run your first command — the official 5-minute guide.',
				3, ['Beginner', 'Tutorial'], favAnthropic);

			addItem(cat2SubGS, 'note', 'Writing a Good CLAUDE.md',
				'Your `CLAUDE.md` file is the single most important thing for getting great results. It\'s loaded into every conversation automatically.\n\n## What to Include\n- **Build commands** — `pnpm dev`, `pnpm test`, `pnpm build`\n- **Architecture overview** — key directories, data flow, patterns\n- **Conventions** — naming, style, framework version, no-go areas\n- **Important context** — "we use Svelte 5 runes, not legacy syntax"\n\n## What to Skip\n- Obvious things (don\'t explain what JavaScript is)\n- Volatile info that changes every session\n- Lengthy prose — keep it scannable with headers and bullet points\n\n## Example Structure\n```markdown\n# Project Name\n## Commands\n## Architecture\n## Conventions\n## Key Files\n```\n\nRun `claude /init` to generate a starter CLAUDE.md, then refine it as your project evolves.',
				'How to write an effective CLAUDE.md that gives Claude Code the context it needs.',
				4, ['Beginner', 'Essential']);

			// ===== ADVANCED FEATURES (subcategory of Claude Code) =====
			addItem(cat2Sub, 'note', 'Advanced Claude Code Workflows',
				'## Multi-File Edits\nDescribe the change at a high level and let Claude find the relevant files. Works best when your CLAUDE.md documents the architecture.\n\n## Headless / CI Mode\nRun Claude Code non-interactively in scripts and CI pipelines:\n```bash\nclaude -p "fix all TypeScript errors" --allowedTools Edit,Bash\n```\n\n## Hooks\nAutomate workflows with hooks — shell commands that run at specific lifecycle points (e.g., lint after every edit, run tests before commit).\n\n## MCP Servers\nConnect to external tools (databases, APIs, issue trackers) via the Model Context Protocol. Claude can query a Postgres DB or read GitHub issues directly.\n\n## Memory with CLAUDE.md\n- **Project-level**: `CLAUDE.md` at project root — shared conventions\n- **User-level**: `~/.claude/CLAUDE.md` — personal preferences\n- **Auto-memory**: Claude saves patterns it learns across sessions\n\n## Custom Slash Commands\nCreate reusable prompts as `.md` files in `.claude/commands/` to standardise team workflows:\n```\n.claude/commands/review.md → /review\n.claude/commands/deploy.md → /deploy\n```\n\n## Parallel Agents\nFor large tasks, Claude can spawn sub-agents to explore code or run searches in parallel, keeping the main context clean.',
				'Power-user features: headless mode, hooks, MCP, memory, custom commands, and sub-agents.',
				1, ['Tips', 'Reference']);

			addItem(cat2Sub, 'link', 'Hooks — Automate Claude Code Workflows',
				'https://docs.anthropic.com/en/docs/claude-code/hooks',
				'Reference for hook events, configuration, and examples for automating tasks around edits and commits.',
				2, ['Reference', 'Tips'], favAnthropic);

			addItem(cat2Sub, 'link', 'MCP in Claude Code',
				'https://docs.anthropic.com/en/docs/claude-code/mcp',
				'Connect Claude Code to external tools and data sources via the Model Context Protocol.',
				3, ['Reference', 'Tutorial'], favAnthropic);

			addItem(cat2Sub, 'link', 'Claude Code GitHub Actions',
				'https://docs.anthropic.com/en/docs/claude-code/github-actions',
				'Run Claude Code in CI/CD — automated code review, issue triage, and PR generation.',
				4, ['Reference', 'Tips'], favAnthropic);

			addItem(cat2Sub, 'note', 'Useful Slash Command Ideas',
				'Create these as `.md` files in `.claude/commands/` to share with your team:\n\n## `/review`\n```\nReview the staged git changes. Check for bugs, security issues,\nand style violations. Be concise.\n```\n\n## `/test`\n```\nLook at the most recently edited files and write or update\nunit tests to cover the changes.\n```\n\n## `/simplify`\n```\nReview the changed code for unnecessary complexity,\nduplication, or over-engineering. Suggest simplifications.\n```\n\n## `/document`\n```\nAdd JSDoc comments to all exported functions in the\nmost recently edited files. Keep them concise.\n```\n\nEach file becomes a slash command you can invoke in any session.',
				'Ready-to-use custom slash command templates for common workflows.',
				5, ['Tips']);

			// ===== PROMPTING FOR CODE =====
			addItem(cat3, 'note', 'The Anatomy of a Good Coding Prompt',
				'Writing effective prompts is the most important skill for vibe coding.\n\n## Structure\n1. **Context** — What project, language, framework\n2. **Task** — What you want done, specifically\n3. **Constraints** — Style, patterns, libraries to use or avoid\n4. **Examples** — Show input/output if relevant\n\n## Good vs Bad\n\n**Bad:** `fix the bug`\n\n**Good:** `The login form on /auth/login throws a 422 when the email contains a + character. The validation regex in src/lib/validate.ts is too strict. Fix it to allow RFC 5322 compliant emails.`\n\n## Key Principles\n- Be **specific** about files, functions, and behaviour\n- Provide **error messages** verbatim\n- State the **desired outcome**, not just the problem\n- Break large tasks into **small steps**',
				'How to structure effective prompts with context, task, constraints, and examples.',
				1, ['Essential', 'Tips']);

			addItem(cat3, 'link', 'Prompt Engineering Guide — Anthropic',
				'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview',
				'Comprehensive guide to crafting effective prompts for Claude models.',
				2, ['Tutorial', 'Reference'], favAnthropic);

			addItem(cat3, 'note', 'Common Prompting Mistakes',
				'## Mistakes to Avoid\n\n### 1. Being Too Vague\n`make it better` → Better: `Refactor this function to use early returns instead of nested if-else`\n\n### 2. Asking for Too Much at Once\nBreak `build me a todo app` into: create the data model → build the API → add the UI → write tests\n\n### 3. Not Providing Context\nAlways mention the framework, language version, and relevant conventions — or put it in your CLAUDE.md.\n\n### 4. Ignoring the Output\nAlways **read and understand** generated code before accepting it. AI can produce plausible-looking but incorrect code.\n\n### 5. Not Iterating\nYour first prompt rarely gives the perfect result. Refine and follow up — that\'s the whole point of vibe coding.',
				'Five common prompting mistakes and how to avoid them.',
				3, ['Beginner', 'Tips']);

			addItem(cat3, 'link', 'Prompt Engineering Interactive Tutorial',
				'https://github.com/anthropics/prompt-eng-interactive-tutorial',
				'Hands-on Jupyter notebook course for learning prompt engineering with Claude.',
				4, ['Tutorial', 'Beginner'], favGitHub);

			// ===== TOOLS & ECOSYSTEM =====
			addItem(cat4, 'note', 'AI Coding Tools — The Landscape',
				'## Terminal-Based (Agentic)\n- **Claude Code** (Anthropic) — CLI agent powered by Opus 4.6. Reads/writes files, runs commands, uses tools autonomously.\n- **Gemini CLI** (Google) — Open-source agentic CLI for Gemini models. Strong at multi-modal tasks.\n- **OpenAI Codex CLI** (OpenAI) — Lightweight open-source CLI agent using OpenAI models.\n- **Aider** — Open-source AI pair programming in the terminal. Supports Claude, GPT, Gemini, and local models.\n\n## Browser-Based (Generative)\n- **V0** (Vercel) — Generate UI components from text prompts. Outputs React/Next.js/Tailwind code.\n- **Bolt.new** (StackBlitz) — Full-stack app generation in the browser with live preview.\n- **Replit Agent** — Describe an app and Replit builds it end-to-end in a cloud IDE.\n\n## Editor-Integrated\n- **GitHub Copilot** — Inline suggestions in VS Code, JetBrains, Neovim. Free tier available.\n- **Cursor** — VS Code fork with built-in AI chat, autocomplete, and codebase awareness.\n- **Windsurf** — AI-first IDE with deep context and autonomous editing.\n- **Cline** — Open-source VS Code extension for agentic coding with any model.\n\n## When to Use What\n- **Quick UI prototypes** → V0, Bolt.new\n- **Full app from scratch** → Replit Agent, Bolt.new\n- **Complex multi-file work** → Claude Code, Gemini CLI, Aider\n- **Quick edits & autocomplete** → Copilot, Cursor\n- **Learning & exploration** → Claude Code (interactive mode)',
				'Overview of the AI coding landscape: terminal agents, browser tools, and editor integrations.',
				1, ['Reference', 'Beginner']);

			addItem(cat4, 'link', 'Gemini CLI — Google\'s Agentic Coding Tool',
				'https://github.com/google-gemini/gemini-cli',
				'Open-source terminal agent from Google. Supports Gemini models with tool use, file editing, and shell access.',
				2, ['Reference'], favGoogle);

			addItem(cat4, 'link', 'OpenAI Codex CLI',
				'https://github.com/openai/codex',
				'Lightweight open-source CLI agent from OpenAI. Runs locally, reads your codebase, and executes commands.',
				3, ['Reference'], favOpenAI);

			addItem(cat4, 'link', 'V0 — AI UI Generation by Vercel',
				'https://v0.dev',
				'Generate production-ready React components from text prompts. Great for rapid UI prototyping.',
				4, ['Reference', 'Beginner'], favV0);

			addItem(cat4, 'link', 'Bolt.new — Full-Stack App Generation',
				'https://bolt.new',
				'Describe an app and get a live full-stack project in the browser. Built on StackBlitz WebContainers.',
				5, ['Reference', 'Beginner'], favBolt);

			addItem(cat4, 'link', 'Cursor — The AI Code Editor',
				'https://www.cursor.com',
				'AI-first code editor built on VS Code with chat, autocomplete, and codebase-aware features.',
				6, ['Reference'], favCursor);

			addItem(cat4, 'link', 'Aider — AI Pair Programming in the Terminal',
				'https://aider.chat',
				'Open-source command-line tool for AI-assisted coding. Supports Claude, GPT, Gemini, and local models.',
				7, ['Reference'], favAider);

			addItem(cat4, 'link', 'Replit Agent',
				'https://replit.com',
				'Cloud IDE with an AI agent that can build, deploy, and iterate on full applications from a text description.',
				8, ['Beginner', 'Reference'], favReplit);

			addItem(cat4, 'link', 'Model Context Protocol (MCP)',
				'https://modelcontextprotocol.io',
				'Open standard for connecting AI assistants to external data sources and tools. Supported by Claude Code, Cursor, and others.',
				9, ['Reference', 'Tips'], favMCP);

			addItem(cat4, 'link', 'GitHub Copilot',
				'https://github.com/features/copilot',
				'AI-powered code suggestions directly in your editor. Free tier available for individual developers.',
				10, ['Beginner', 'Reference'], favGitHub);
		});

		seed();

		emit(access.ownerId, access.spaceSlug, { type: 'space:seeded', timestamp: Date.now() }, locals.userId);
		return json({ success: true }, { status: 201 });
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to seed database:', err);
		return json({ error: 'Failed to seed database' }, { status: 500 });
	}
};
