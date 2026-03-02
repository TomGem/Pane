<script lang="ts">
	import Icon from './Icon.svelte';
	import type { Space } from '$lib/types';
	import type { ImportPreview, ConflictMode } from '$lib/types/export';

	interface Props {
		spaces: Space[];
		onclose: () => void;
	}

	let { spaces, onclose }: Props = $props();

	let activeTab = $state<'export' | 'import'>('export');

	// Export state
	let exportAll = $state(true);
	let selectedSlugs = $state<Set<string>>(new Set());
	let includeFiles = $state(true);
	let exporting = $state(false);

	// Import state
	let importFile = $state<File | null>(null);
	let preview = $state<ImportPreview | null>(null);
	let previewing = $state(false);
	let conflictMode = $state<ConflictMode>('skip');
	let importing = $state(false);
	let importDone = $state(false);
	let importResult = $state<{ imported_spaces: string[]; imported_tags: number; skipped_spaces: string[]; errors: string[] } | null>(null);
	let importError = $state<string | null>(null);

	function toggleSpace(slug: string) {
		const next = new Set(selectedSlugs);
		if (next.has(slug)) next.delete(slug);
		else next.add(slug);
		selectedSlugs = next;
		if (next.size === spaces.length) exportAll = true;
		else exportAll = false;
	}

	function toggleAll() {
		if (exportAll) {
			exportAll = false;
			selectedSlugs = new Set();
		} else {
			exportAll = true;
			selectedSlugs = new Set(spaces.map((s) => s.slug));
		}
	}

	async function handleExport() {
		exporting = true;
		try {
			const slugs = exportAll ? 'all' : [...selectedSlugs].join(',');
			const url = `/api/export?spaces=${encodeURIComponent(slugs)}&include_files=${includeFiles}`;
			const res = await fetch(url);
			if (!res.ok) {
				const data = await res.json().catch(() => ({ error: 'Export failed' }));
				alert(data.error || 'Export failed');
				return;
			}
			const blob = await res.blob();
			const disposition = res.headers.get('content-disposition') ?? '';
			const filenameMatch = disposition.match(/filename="(.+?)"/);
			const filename = filenameMatch?.[1] ?? 'pane-export.zip';

			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = filename;
			a.click();
			URL.revokeObjectURL(a.href);
		} finally {
			exporting = false;
		}
	}

	function handleFileDrop(e: DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer?.files[0];
		if (file && file.name.endsWith('.zip')) {
			importFile = file;
			handlePreview(file);
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			importFile = file;
			handlePreview(file);
		}
	}

	async function handlePreview(file: File) {
		previewing = true;
		importError = null;
		preview = null;
		try {
			const formData = new FormData();
			formData.append('file', file);
			const res = await fetch('/api/import?action=preview', { method: 'POST', body: formData });
			const data = await res.json();
			preview = data;
		} catch {
			importError = 'Failed to read ZIP file';
		} finally {
			previewing = false;
		}
	}

	async function handleImport() {
		if (!importFile) return;
		importing = true;
		importError = null;
		try {
			const formData = new FormData();
			formData.append('file', importFile);
			const res = await fetch(`/api/import?action=execute&conflict_mode=${conflictMode}`, {
				method: 'POST',
				body: formData
			});
			const data = await res.json();
			if (data.success || data.imported_spaces?.length > 0) {
				importResult = data;
				importDone = true;
			} else {
				importError = data.errors?.join(', ') || 'Import failed';
			}
		} catch {
			importError = 'Import failed';
		} finally {
			importing = false;
		}
	}

	function resetImport() {
		importFile = null;
		preview = null;
		importDone = false;
		importResult = null;
		importError = null;
	}

	let canExport = $derived(exportAll || selectedSlugs.size > 0);
	let hasConflicts = $derived(preview?.spaces.some((s) => s.exists) ?? false);

	function trapFocus(node: HTMLElement) {
		const previouslyFocused = document.activeElement as HTMLElement;
		function getFocusable() {
			return node.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
		}
		requestAnimationFrame(() => { getFocusable()[0]?.focus(); });
		function handleTab(e: KeyboardEvent) {
			if (e.key !== 'Tab') return;
			const focusable = getFocusable();
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
			else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
		}
		node.addEventListener('keydown', handleTab);
		return { destroy() { node.removeEventListener('keydown', handleTab); previouslyFocused?.focus(); } };
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="overlay" onclick={(e) => { if (e.target === e.currentTarget) onclose(); }} onkeydown={(e) => { if (e.key === 'Escape') onclose(); }} role="dialog" aria-modal="true" aria-label="Export & Import" tabindex="-1" use:trapFocus>
	<div class="panel glass-strong">
		<div class="panel-header">
			<h2 class="panel-title">Export & Import</h2>
			<button class="panel-close" onclick={onclose} aria-label="Close" title="Close">
				<Icon name="close" size={18} />
			</button>
		</div>

		<div class="tabs">
			<button class="tab" class:active={activeTab === 'export'} onclick={() => activeTab = 'export'}>
				<Icon name="download" size={14} />
				Export
			</button>
			<button class="tab" class:active={activeTab === 'import'} onclick={() => { activeTab = 'import'; resetImport(); }}>
				<Icon name="upload" size={14} />
				Import
			</button>
		</div>

		<div class="panel-body">
			{#if activeTab === 'export'}
				<section class="section">
					<h3 class="section-title">Spaces</h3>
					<label class="checkbox-row">
						<input type="checkbox" checked={exportAll} onchange={toggleAll} />
						<span>Everything ({spaces.length} {spaces.length === 1 ? 'space' : 'spaces'})</span>
					</label>
					{#if !exportAll}
						<div class="space-list">
							{#each spaces as s (s.slug)}
								<label class="checkbox-row">
									<input type="checkbox" checked={selectedSlugs.has(s.slug)} onchange={() => toggleSpace(s.slug)} />
									<span>{s.name}</span>
								</label>
							{/each}
						</div>
					{/if}
				</section>

				<section class="section">
					<h3 class="section-title">Options</h3>
					<label class="checkbox-row">
						<input type="checkbox" bind:checked={includeFiles} />
						<span>Include document files</span>
					</label>
					<p class="hint">Disable to create a smaller export without uploaded documents.</p>
				</section>

				<button class="btn btn-primary export-btn" onclick={handleExport} disabled={!canExport || exporting}>
					{#if exporting}
						Exporting...
					{:else}
						<Icon name="download" size={16} />
						Export ZIP
					{/if}
				</button>

			{:else}
				{#if importDone && importResult}
					<div class="result">
						<div class="result-icon">
							<Icon name="check" size={24} />
						</div>
						<h3 class="result-title">Import complete</h3>
						<div class="result-stats">
							{#if importResult.imported_spaces.length > 0}
								<p>Imported spaces: <strong>{importResult.imported_spaces.join(', ')}</strong></p>
							{/if}
							{#if importResult.imported_tags > 0}
								<p>Tags merged: <strong>{importResult.imported_tags}</strong></p>
							{/if}
							{#if importResult.skipped_spaces.length > 0}
								<p>Skipped: <strong>{importResult.skipped_spaces.join(', ')}</strong></p>
							{/if}
							{#if importResult.errors.length > 0}
								<div class="result-errors">
									{#each importResult.errors as err}
										<p class="error-text">{err}</p>
									{/each}
								</div>
							{/if}
						</div>
						<div class="result-actions">
							<button class="btn" onclick={resetImport}>Import Another</button>
							<button class="btn btn-primary" onclick={() => location.reload()}>Reload App</button>
						</div>
					</div>

				{:else if preview}
					<div class="preview">
						<div class="preview-header">
							<span class="preview-file">{importFile?.name}</span>
							<button class="btn-text" onclick={resetImport}>Change file</button>
						</div>

						{#if !preview.valid}
							<div class="preview-errors">
								{#each preview.errors as err}
									<p class="error-text">{err}</p>
								{/each}
							</div>
						{:else}
							<section class="section">
								<h3 class="section-title">Spaces ({preview.spaces.length})</h3>
								<div class="preview-list">
									{#each preview.spaces as s}
										<div class="preview-item">
											<span class="preview-name">{s.display_name}</span>
											<span class="preview-meta">{s.categories} categories, {s.items} items</span>
											{#if s.exists}
												<span class="badge badge-warning">exists</span>
											{/if}
										</div>
									{/each}
								</div>
							</section>

							{#if preview.tags.length > 0}
								<section class="section">
									<h3 class="section-title">Tags ({preview.tags.length})</h3>
									<div class="preview-tags">
										{#each preview.tags as tag}
											<span class="tag-pill" style:background-color={tag.color}>
												{tag.name}
												{#if tag.exists}
													<span class="tag-exists-dot" title="Already exists"></span>
												{/if}
											</span>
										{/each}
									</div>
								</section>
							{/if}

							{#if hasConflicts}
								<section class="section">
									<h3 class="section-title">Conflict resolution</h3>
									<div class="conflict-options">
										<label class="radio-row">
											<input type="radio" name="conflict" value="skip" bind:group={conflictMode} />
											<div>
												<span class="radio-label">Skip</span>
												<span class="radio-desc">Don't import spaces that already exist</span>
											</div>
										</label>
										<label class="radio-row">
											<input type="radio" name="conflict" value="rename" bind:group={conflictMode} />
											<div>
												<span class="radio-label">Rename</span>
												<span class="radio-desc">Import with a different slug (e.g. desk-2)</span>
											</div>
										</label>
										<label class="radio-row">
											<input type="radio" name="conflict" value="replace" bind:group={conflictMode} />
											<div>
												<span class="radio-label">Replace</span>
												<span class="radio-desc">Delete existing and import fresh</span>
											</div>
										</label>
									</div>
								</section>
							{/if}

							{#if importError}
								<p class="error-text">{importError}</p>
							{/if}

							<button class="btn btn-primary export-btn" onclick={handleImport} disabled={importing}>
								{#if importing}
									Importing...
								{:else}
									<Icon name="upload" size={16} />
									Import
								{/if}
							</button>
						{/if}
					</div>

				{:else}
					<!-- File drop zone -->
					<div
						class="drop-zone"
						ondragover={(e) => e.preventDefault()}
						ondrop={handleFileDrop}
						role="button"
						tabindex="0"
						onkeydown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLElement).querySelector('input')?.click(); }}
					>
						{#if previewing}
							<p class="drop-text">Reading ZIP...</p>
						{:else}
							<Icon name="upload" size={32} class="drop-icon" />
							<p class="drop-text">Drop a Pane export ZIP here</p>
							<p class="drop-hint">or</p>
							<label class="btn browse-btn">
								Browse files
								<input type="file" accept=".zip" onchange={handleFileSelect} hidden />
							</label>
						{/if}
						{#if importError}
							<p class="error-text">{importError}</p>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
	}

	.panel {
		width: 90vw;
		max-width: 480px;
		max-height: 85vh;
		overflow-y: auto;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.panel-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.panel-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.panel-close:hover {
		background: var(--accent-soft);
		color: var(--text-primary);
	}

	.tabs {
		display: flex;
		border-bottom: 1px solid var(--border);
	}

	.tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid transparent;
		transition: color var(--transition), border-color var(--transition);
		cursor: pointer;
	}

	.tab:hover {
		color: var(--text-primary);
	}

	.tab.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.panel-body {
		padding: 16px 20px 20px;
	}

	.section {
		margin-bottom: 16px;
	}

	.section:last-child {
		margin-bottom: 0;
	}

	.section-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		margin-bottom: 8px;
	}

	.checkbox-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 0;
		font-size: 13px;
		color: var(--text-primary);
		cursor: pointer;
	}

	.checkbox-row input[type="checkbox"] {
		accent-color: var(--accent);
	}

	.space-list {
		padding-left: 8px;
		margin-top: 4px;
	}

	.hint {
		font-size: 12px;
		color: var(--text-muted);
		margin-top: 4px;
	}

	.export-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-top: 16px;
		padding: 10px;
	}

	/* Import: drop zone */
	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 32px 20px;
		border: 2px dashed var(--border);
		border-radius: var(--radius);
		text-align: center;
		transition: border-color var(--transition);
	}

	.drop-zone:hover, .drop-zone:focus-within {
		border-color: var(--accent);
	}

	.drop-zone :global(.drop-icon) {
		color: var(--text-muted);
	}

	.drop-text {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary);
	}

	.drop-hint {
		font-size: 12px;
		color: var(--text-muted);
	}

	.browse-btn {
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		padding: 6px 14px;
		border-radius: var(--radius);
		font-size: 13px;
		font-weight: 500;
		color: var(--accent);
		background: var(--accent-soft);
		transition: background-color var(--transition);
	}

	.browse-btn:hover {
		background: var(--accent);
		color: white;
	}

	/* Import: preview */
	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 14px;
	}

	.preview-file {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.btn-text {
		font-size: 12px;
		color: var(--accent);
		cursor: pointer;
		flex-shrink: 0;
	}

	.btn-text:hover {
		text-decoration: underline;
	}

	.preview-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.preview-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		background: var(--bg-secondary);
		font-size: 13px;
	}

	.preview-name {
		font-weight: 600;
		color: var(--text-primary);
	}

	.preview-meta {
		color: var(--text-muted);
		font-size: 12px;
	}

	.badge-warning {
		font-size: 10px;
		font-weight: 600;
		color: #b45309;
		background: #fef3c7;
		padding: 1px 6px;
		border-radius: 9999px;
		margin-left: auto;
		flex-shrink: 0;
	}

	:global([data-theme="dark"]) .badge-warning {
		color: #fbbf24;
		background: rgba(251, 191, 36, 0.15);
	}

	.preview-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.tag-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		font-weight: 500;
		color: white;
		padding: 2px 8px;
		border-radius: 9999px;
	}

	.tag-exists-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.6);
	}

	/* Conflict resolution */
	.conflict-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.radio-row {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		cursor: pointer;
	}

	.radio-row input[type="radio"] {
		margin-top: 3px;
		accent-color: var(--accent);
	}

	.radio-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
		display: block;
	}

	.radio-desc {
		font-size: 12px;
		color: var(--text-muted);
		display: block;
	}

	.error-text {
		font-size: 12px;
		color: var(--danger, #ef4444);
		margin-top: 4px;
	}

	.preview-errors {
		padding: 12px;
		border-radius: var(--radius-sm);
		background: rgba(239, 68, 68, 0.08);
	}

	/* Import result */
	.result {
		text-align: center;
		padding: 12px 0;
	}

	.result-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--accent-soft);
		color: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 12px;
	}

	.result-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 12px;
	}

	.result-stats {
		font-size: 13px;
		color: var(--text-secondary);
		margin-bottom: 16px;
		text-align: left;
	}

	.result-stats p {
		margin: 4px 0;
	}

	.result-errors {
		margin-top: 8px;
	}

	.result-actions {
		display: flex;
		gap: 8px;
		justify-content: center;
	}
</style>
