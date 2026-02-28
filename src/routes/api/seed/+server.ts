import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpaceDb } from '$lib/server/space';
import { slugify } from '$lib/utils/slugify';

export const POST: RequestHandler = async ({ url }) => {
	try {
		const db = getSpaceDb(url);

		// Guard against duplicate seeding
		const existing = db.prepare('SELECT COUNT(*) AS count FROM categories').get() as { count: number };
		if (existing.count > 0) {
			return json({ error: 'Database already contains data' }, { status: 409 });
		}

		const seed = db.transaction(() => {
			// --- Tags ---
			const insertTag = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)');
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
				const result = insertTag.run(name, color);
				tagIds[name] = result.lastInsertRowid as number;
			}

			// --- Categories ---
			const insertCategory = db.prepare(
				'INSERT INTO categories (name, slug, color, sort_order, parent_id) VALUES (?, ?, ?, ?, ?)'
			);

			const cat1 = insertCategory.run('Getting Started', slugify('Getting Started'), '#22c55e', 1, null).lastInsertRowid as number;
			const cat2 = insertCategory.run('Claude Code', slugify('Claude Code'), '#6366f1', 2, null).lastInsertRowid as number;
			const cat3 = insertCategory.run('Prompting for Code', slugify('Prompting for Code'), '#f59e0b', 3, null).lastInsertRowid as number;
			const cat4 = insertCategory.run('Tools & Ecosystem', slugify('Tools & Ecosystem'), '#ef4444', 4, null).lastInsertRowid as number;

			// Subcategories
			insertCategory.run('Setup Guides', slugify('Setup Guides'), '#22c55e', 1, cat1);
			insertCategory.run('Advanced Features', slugify('Advanced Features'), '#6366f1', 1, cat2);

			// --- Items ---
			const insertItem = db.prepare(
				`INSERT INTO items (category_id, type, title, content, description, sort_order)
				 VALUES (?, ?, ?, ?, ?, ?)`
			);
			const insertItemTag = db.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)');

			function addItem(
				categoryId: number,
				type: 'link' | 'note',
				title: string,
				content: string | null,
				description: string | null,
				sortOrder: number,
				itemTags: string[]
			) {
				const id = insertItem.run(categoryId, type, title, content, description, sortOrder).lastInsertRowid as number;
				for (const tag of itemTags) {
					if (tagIds[tag]) {
						insertItemTag.run(id, tagIds[tag]);
					}
				}
			}

			// ===== GETTING STARTED =====
			addItem(cat1, 'note', 'What is AI-Assisted Coding?',
				'AI-assisted coding uses large language models to help you write, debug, and understand code.\n\n## Key Benefits\n- **Speed**: Generate boilerplate and repetitive code instantly\n- **Learning**: Ask questions about unfamiliar code or concepts\n- **Debugging**: Describe a bug and get fix suggestions\n- **Refactoring**: Improve code quality with AI review\n\n## How It Works\nYou describe what you want in natural language, and the AI generates or modifies code. The best results come from being **specific** and **iterative** — start simple, then refine.',
				'Overview of AI-assisted coding and its key benefits.',
				1, ['Beginner', 'Essential']);

			addItem(cat1, 'link', 'Anthropic Documentation — Getting Started',
				'https://docs.anthropic.com/en/docs/welcome',
				'Official Anthropic docs covering Claude models, capabilities, and API basics.',
				2, ['Beginner', 'Reference']);

			addItem(cat1, 'link', 'Introduction to Claude Code — Official Docs',
				'https://docs.anthropic.com/en/docs/claude-code/overview',
				'Overview of Claude Code: what it is, how to install it, and your first steps.',
				3, ['Beginner', 'Tutorial']);

			addItem(cat1, 'link', 'AI-Assisted Programming — Harvard CS50 Lecture (YouTube)',
				'https://www.youtube.com/watch?v=eKKMRhLdIHI',
				'David Malan discusses how AI tools are changing how we learn and write code.',
				4, ['Beginner', 'Video']);

			// ===== CLAUDE CODE =====
			addItem(cat2, 'note', 'Claude Code Cheat Sheet',
				'## Essential Commands\n- `claude` — Start interactive REPL\n- `claude "prompt"` — One-shot command\n- `cat file | claude "explain this"` — Pipe input\n- `claude -c` — Continue last conversation\n\n## Slash Commands\n- `/help` — Show all commands\n- `/clear` — Reset conversation\n- `/compact` — Summarize context to save tokens\n- `/init` — Generate a CLAUDE.md for your project\n\n## Keyboard Shortcuts\n- `Ctrl+C` — Cancel current generation\n- `Esc` — Interrupt multi-turn tool use\n\n## Tips\n- Use `CLAUDE.md` files to give project context\n- Start with small tasks and build up\n- Review all changes before accepting',
				'Quick reference for Claude Code commands, shortcuts, and tips.',
				1, ['Essential', 'Reference']);

			addItem(cat2, 'link', 'Best Practices for Claude Code',
				'https://docs.anthropic.com/en/docs/claude-code/best-practices',
				'Official guide on writing effective CLAUDE.md files, structuring prompts, and getting the most out of Claude Code.',
				2, ['Tips', 'Essential']);

			addItem(cat2, 'link', 'How Claude Code Works — Under the Hood',
				'https://docs.anthropic.com/en/docs/claude-code/overview',
				'Understand the agentic loop, built-in tools, and how Claude Code interacts with your project.',
				3, ['Reference']);

			addItem(cat2, 'link', 'Claude Code GitHub Repository',
				'https://github.com/anthropics/claude-code',
				'Source code, issues, and discussions for Claude Code.',
				4, ['Reference']);

			addItem(cat2, 'link', 'Claude Code Tutorial — Building a Project from Scratch (YouTube)',
				'https://www.youtube.com/watch?v=dGMFkP0IN7A',
				'Step-by-step walkthrough of using Claude Code to build a complete application.',
				5, ['Tutorial', 'Video']);

			// ===== PROMPTING FOR CODE =====
			addItem(cat3, 'note', 'The Anatomy of a Good Coding Prompt',
				'Writing effective prompts is the most important skill for AI-assisted coding.\n\n## Structure\n1. **Context** — What project, language, framework\n2. **Task** — What you want done, specifically\n3. **Constraints** — Style, patterns, libraries to use or avoid\n4. **Examples** — Show input/output if relevant\n\n## Good vs Bad\n\n**Bad:** `fix the bug`\n\n**Good:** `The login form on /auth/login throws a 422 when the email contains a + character. The validation regex in src/lib/validate.ts is too strict. Fix it to allow RFC 5322 compliant emails.`\n\n## Key Principles\n- Be **specific** about files, functions, and behavior\n- Provide **error messages** verbatim\n- State the **desired outcome**, not just the problem\n- Break large tasks into **small steps**',
				'How to structure effective prompts with context, task, constraints, and examples.',
				1, ['Essential', 'Tips']);

			addItem(cat3, 'link', 'Prompt Engineering Guide — Anthropic',
				'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview',
				'Comprehensive guide to crafting effective prompts for Claude models.',
				2, ['Tutorial', 'Reference']);

			addItem(cat3, 'note', 'Common Prompting Mistakes',
				'## Mistakes to Avoid\n\n### 1. Being Too Vague\n`make it better` → Better: `Refactor this function to use early returns instead of nested if-else`\n\n### 2. Asking for Too Much at Once\nBreak `build me a todo app` into: create the data model → build the API → add the UI → write tests\n\n### 3. Not Providing Context\nAlways mention the framework, language version, and relevant conventions.\n\n### 4. Ignoring the Output\nAlways **read and understand** generated code before using it. AI can produce plausible-looking but incorrect code.\n\n### 5. Not Iterating\nYour first prompt rarely gives the perfect result. Refine and follow up.',
				'Five common prompting mistakes and how to avoid them.',
				3, ['Beginner', 'Tips']);

			addItem(cat3, 'link', 'Prompt Engineering Interactive Tutorial',
				'https://github.com/anthropics/prompt-eng-interactive-tutorial',
				'Hands-on Jupyter notebook course for learning prompt engineering with Claude.',
				4, ['Tutorial', 'Beginner']);

			// ===== TOOLS & ECOSYSTEM =====
			addItem(cat4, 'note', 'AI Coding Tools Comparison',
				'## Terminal-Based (Agentic)\n- **Claude Code** — Anthropic\'s CLI agent. Reads/writes files, runs commands, uses tools autonomously.\n- **GitHub Copilot CLI** — GitHub\'s terminal assistant, integrated with `gh`.\n- **Aider** — Open-source AI pair programming in the terminal. Supports multiple LLMs.\n\n## Editor-Integrated\n- **GitHub Copilot** — Inline suggestions in VS Code, JetBrains, Neovim.\n- **Cursor** — VS Code fork with built-in AI chat, autocomplete, and codebase awareness.\n- **Cline** — Open-source VS Code extension for agentic coding with Claude.\n- **Windsurf** — AI-first IDE with deep context awareness.\n\n## When to Use What\n- **Quick edits & autocomplete** → Copilot / Cursor\n- **Complex multi-file tasks** → Claude Code / Aider\n- **Learning & exploration** → Claude Code (interactive mode)',
				'Comparison of terminal-based and editor-integrated AI coding tools.',
				1, ['Reference', 'Beginner']);

			addItem(cat4, 'link', 'Cursor — The AI Code Editor',
				'https://www.cursor.com',
				'AI-first code editor built on VS Code with chat, autocomplete, and codebase-aware features.',
				2, ['Reference']);

			addItem(cat4, 'link', 'Aider — AI Pair Programming in the Terminal',
				'https://aider.chat',
				'Open-source command-line tool for AI-assisted coding. Supports Claude, GPT, and local models.',
				3, ['Reference']);

			addItem(cat4, 'link', 'Model Context Protocol (MCP) — Extending AI Tools',
				'https://modelcontextprotocol.io',
				'Open standard for connecting AI assistants to external data sources and tools.',
				4, ['Reference', 'Tips']);

			addItem(cat4, 'link', 'GitHub Copilot',
				'https://github.com/features/copilot',
				'AI-powered code suggestions directly in your editor. Free tier available for individual developers.',
				5, ['Beginner', 'Reference']);
		});

		seed();

		return json({ success: true }, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to seed database';
		return json({ error: message }, { status: 500 });
	}
};
