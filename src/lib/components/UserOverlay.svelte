<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import Icon from './Icon.svelte';
	import type { ThemeMode } from '$lib/stores/theme.svelte';
	import { PALETTES, type PaletteId } from '$lib/stores/palette.svelte';

	interface Props {
		user?: { id: string; email: string; display_name: string; role: string } | null;
		themeMode: ThemeMode;
		paletteId: PaletteId;
		singleUser?: boolean;
		onclose: () => void;
		onthemechange?: (mode: ThemeMode) => void;
		onpalettechange?: (id: PaletteId) => void;
		onexportimport?: () => void;
		onlogout: () => void;
	}

	let { user = null, themeMode, paletteId, singleUser = false, onclose, onthemechange, onpalettechange, onexportimport, onlogout }: Props = $props();

	// Storage
	let liveStorage = $state<{ used_bytes: number; quota_bytes: number } | null>(null);

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		const val = bytes / Math.pow(1024, i);
		return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
	}

	async function fetchStorage() {
		try {
			const res = await fetch('/api/storage');
			if (res.ok) liveStorage = await res.json();
		} catch { /* ignore */ }
	}

	// Privacy preference
	let showEmail = $state(false);
	let privacyLoading = $state(false);

	async function fetchPreferences() {
		try {
			const res = await fetch('/api/preferences');
			if (res.ok) {
				const data = await res.json();
				showEmail = data.show_email === 1;
			}
		} catch { /* ignore */ }
	}

	async function toggleShowEmail() {
		privacyLoading = true;
		try {
			const res = await fetch('/api/preferences', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ show_email: !showEmail })
			});
			if (res.ok) {
				const data = await res.json();
				showEmail = data.show_email === 1;
			}
		} catch { /* ignore */ }
		privacyLoading = false;
	}

	$effect(() => {
		fetchStorage();
		if (!singleUser) fetchPreferences();
	});

	// Password change
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let passwordError = $state('');
	let passwordSuccess = $state('');
	let passwordLoading = $state(false);

	async function handleChangePassword() {
		passwordError = '';
		passwordSuccess = '';

		if (newPassword !== confirmPassword) {
			passwordError = 'Passwords do not match';
			return;
		}

		passwordLoading = true;
		try {
			const res = await fetch('/api/auth/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
			});
			const data = await res.json();
			if (!res.ok) {
				passwordError = data.error || 'Failed to change password';
				return;
			}
			passwordSuccess = 'Password changed successfully';
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch {
			passwordError = 'Failed to change password';
		} finally {
			passwordLoading = false;
		}
	}

	let isDark = $derived(themeMode === 'dark' || (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches));

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
<div class="overlay" onclick={(e) => { if (e.target === e.currentTarget) onclose(); }} onkeydown={(e) => { if (e.key === 'Escape') onclose(); }} role="dialog" aria-modal="true" aria-label="User settings" tabindex="-1" use:trapFocus>
	<div class="panel glass-strong">
		<div class="panel-header">
			<h2 class="panel-title">{singleUser ? 'Settings' : user?.display_name ?? 'Settings'}</h2>
			<button class="panel-close" onclick={onclose} aria-label="Close" title="Close">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
		<div class="panel-body">
			{#if !singleUser && user}
				<section class="section">
					<h3 class="section-title">Account</h3>
					<div class="account-info">
						<span class="account-email">{user.email}</span>
						{#if liveStorage}
							{@const pct = liveStorage.quota_bytes > 0 ? Math.min(100, (liveStorage.used_bytes / liveStorage.quota_bytes) * 100) : 0}
							<div class="storage-row">
								<div class="storage-header">
									<span>Storage</span>
									<span>{formatBytes(liveStorage.used_bytes)} / {formatBytes(liveStorage.quota_bytes)}</span>
								</div>
								<div class="storage-bar">
									<div class="storage-fill" class:storage-warning={pct > 90} style="width: {pct}%"></div>
								</div>
							</div>
						{/if}
					</div>
				</section>

				<section class="section">
					<h3 class="section-title">Privacy</h3>
					<label class="toggle-row">
						<span class="toggle-label">Allow other users to see my email address</span>
						<button
							class="toggle-switch"
							class:active={showEmail}
							onclick={toggleShowEmail}
							disabled={privacyLoading}
							role="switch"
							aria-checked={showEmail}
							aria-label="Allow other users to see my email address"
						>
							<span class="toggle-knob"></span>
						</button>
					</label>
				</section>
			{/if}

			<section class="section">
				<h3 class="section-title">Theme</h3>
				<ThemeToggle mode={themeMode} onchange={onthemechange} />
			</section>

			<section class="section">
				<h3 class="section-title">Accent colour</h3>
				<div class="palette-grid">
					{#each PALETTES as p (p.id)}
						<button
							class="palette-swatch"
							class:active={paletteId === p.id}
							onclick={() => onpalettechange?.(p.id)}
							title={p.name}
							aria-label="{p.name} palette"
						>
							<span
								class="swatch-circle"
								style:background-color={isDark ? p.dark : p.light}
							>
								{#if paletteId === p.id}
									<svg class="swatch-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="20 6 9 17 4 12" />
									</svg>
								{/if}
							</span>
							<span class="swatch-name">{p.name}</span>
						</button>
					{/each}
				</div>
			</section>

			{#if !singleUser}
				<section class="section">
					<h3 class="section-title">Password</h3>
					<form class="password-form" onsubmit={(e) => { e.preventDefault(); handleChangePassword(); }}>
						{#if passwordError}
							<div class="password-msg password-error">{passwordError}</div>
						{/if}
						{#if passwordSuccess}
							<div class="password-msg password-success">{passwordSuccess}</div>
						{/if}
						<input
							class="input"
							type="password"
							bind:value={currentPassword}
							placeholder="Current password"
							required
							autocomplete="current-password"
						/>
						<input
							class="input"
							type="password"
							bind:value={newPassword}
							placeholder="New password (min 8 chars)"
							required
							minlength="8"
							autocomplete="new-password"
						/>
						<input
							class="input"
							type="password"
							bind:value={confirmPassword}
							placeholder="Confirm new password"
							required
							minlength="8"
							autocomplete="new-password"
						/>
						<button class="action-btn" type="submit" disabled={passwordLoading}>
							<Icon name="lock" size={16} />
							<span>{passwordLoading ? 'Changing...' : 'Change password'}</span>
						</button>
					</form>
				</section>
			{/if}

			<section class="section">
				<h3 class="section-title">Data</h3>
				<button class="action-btn" onclick={() => onexportimport?.()}>
					<Icon name="download" size={16} />
					<span>Export & Import</span>
				</button>
			</section>
		</div>

		{#if !singleUser}
			<div class="panel-footer">
				{#if user?.role === 'admin'}
					<a class="footer-link" href="/admin" onclick={onclose}>
						<Icon name="shield" size={14} />
						<span>Admin Panel</span>
					</a>
				{/if}
				<button class="footer-link logout" onclick={onlogout}>
					<Icon name="log-out" size={14} />
					<span>Sign out</span>
				</button>
			</div>
		{/if}
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
		max-width: 420px;
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

	.panel-body {
		padding: 16px 20px 20px;
	}

	.section {
		margin-bottom: 20px;
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
		margin-bottom: 10px;
	}

	/* Account */
	.account-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.account-email {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.storage-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.storage-header {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: var(--text-muted);
	}

	.storage-bar {
		width: 100%;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
	}

	.storage-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.storage-fill.storage-warning {
		background: var(--danger);
	}

	/* Privacy toggle */
	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		cursor: pointer;
	}

	.toggle-label {
		font-size: 13px;
		color: var(--text-primary);
	}

	.toggle-switch {
		position: relative;
		width: 40px;
		height: 22px;
		border-radius: 11px;
		background: var(--border);
		cursor: pointer;
		transition: background-color var(--transition);
		flex-shrink: 0;
	}

	.toggle-switch.active {
		background: var(--accent);
	}

	.toggle-switch:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		transition: transform var(--transition);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.toggle-switch.active .toggle-knob {
		transform: translateX(18px);
	}

	/* Palette */
	.palette-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}

	.palette-swatch {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 8px 4px;
		border-radius: var(--radius);
		cursor: pointer;
		transition: background-color var(--transition);
	}

	.palette-swatch:hover {
		background: var(--accent-soft);
	}

	.palette-swatch.active {
		background: var(--accent-soft);
	}

	.swatch-circle {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: box-shadow var(--transition);
	}

	.palette-swatch.active .swatch-circle {
		box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px currentColor;
	}

	.swatch-check {
		color: white;
	}

	.swatch-name {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-secondary);
	}

	/* Action buttons */
	.action-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 9px 12px;
		border-radius: var(--radius);
		font-size: 13px;
		font-weight: 500;
		color: var(--text-primary);
		background: var(--bg-secondary);
		cursor: pointer;
		transition: background-color var(--transition);
	}

	.action-btn:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}

	/* Password */
	.password-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.password-msg {
		padding: 8px 10px;
		border-radius: var(--radius);
		font-size: 12px;
	}

	.password-error {
		background: rgba(239, 68, 68, 0.1);
		color: var(--danger);
	}

	.password-success {
		background: rgba(34, 197, 94, 0.1);
		color: var(--success, #22c55e);
	}

	/* Footer */
	.panel-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
	}

	.footer-link {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--text-secondary);
		text-decoration: none;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background-color var(--transition), color var(--transition);
	}

	.footer-link:hover {
		background: var(--accent-soft);
		color: var(--accent);
		text-decoration: none;
	}

	.footer-link.logout:hover {
		color: var(--danger);
		background: rgba(239, 68, 68, 0.1);
	}
</style>
