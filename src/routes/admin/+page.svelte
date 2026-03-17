<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import type { InviteCode, User } from '$lib/types';

	let { data } = $props();

	let codes = $state<InviteCode[]>([]);
	let users = $state<User[]>([]);
	let storageUsage = $state<Record<string, number>>({});

	$effect(() => {
		users = data.users;
	});

	$effect(() => {
		codes = data.codes;
	});

	$effect(() => {
		storageUsage = data.storageUsage;
	});
	let maxUses = $state(1);
	let expiresIn = $state('');
	let creating = $state(false);
	let error = $state('');
	let copiedCode = $state<string | null>(null);
	let editingQuotaUser = $state<string | null>(null);
	let quotaInput = $state('');

	async function createCode() {
		error = '';
		creating = true;
		try {
			let expires_at: string | null = null;
			if (expiresIn) {
				const days = parseInt(expiresIn);
				if (days > 0) {
					expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
				}
			}

			const res = await fetch('/api/admin/invite-codes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ max_uses: maxUses, expires_at })
			});
			const result = await res.json();
			if (!res.ok) {
				error = result.error || 'Failed to create code';
				return;
			}
			codes = [result.code, ...codes];
			maxUses = 1;
			expiresIn = '';
		} catch {
			error = 'Failed to create code';
		} finally {
			creating = false;
		}
	}

	async function deleteCode(code: string) {
		try {
			const res = await fetch(`/api/admin/invite-codes/${code}`, { method: 'DELETE' });
			if (res.ok) {
				codes = codes.filter((c) => c.code !== code);
			}
		} catch { /* ignore */ }
	}

	async function copyCode(code: string) {
		await navigator.clipboard.writeText(code);
		copiedCode = code;
		setTimeout(() => { if (copiedCode === code) copiedCode = null; }, 2000);
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric', month: 'short', day: 'numeric'
		});
	}

	function isExpired(code: InviteCode): boolean {
		if (!code.expires_at) return false;
		return new Date(code.expires_at) < new Date();
	}

	function isUsedUp(code: InviteCode): boolean {
		return code.use_count >= code.max_uses;
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		const val = bytes / Math.pow(1024, i);
		return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
	}

	function quotaPresets(): { label: string; bytes: number }[] {
		return [
			{ label: '500 MB', bytes: 500 * 1024 * 1024 },
			{ label: '1 GB', bytes: 1024 * 1024 * 1024 },
			{ label: '2 GB', bytes: 2 * 1024 * 1024 * 1024 },
			{ label: '5 GB', bytes: 5 * 1024 * 1024 * 1024 },
			{ label: '10 GB', bytes: 10 * 1024 * 1024 * 1024 },
		];
	}

	function startEditQuota(user: User) {
		editingQuotaUser = user.id;
		quotaInput = String(Math.round(user.storage_quota_bytes / (1024 * 1024)));
	}

	async function saveQuota(user: User) {
		const mb = parseInt(quotaInput);
		if (isNaN(mb) || mb < 0) return;
		const bytes = mb * 1024 * 1024;
		try {
			const res = await fetch(`/api/admin/users/${user.id}/quota`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ quota_bytes: bytes })
			});
			if (res.ok) {
				users = users.map((u) =>
					u.id === user.id ? { ...u, storage_quota_bytes: bytes } : u
				);
			}
		} catch { /* ignore */ }
		editingQuotaUser = null;
	}

	async function setQuotaPreset(user: User, bytes: number) {
		try {
			const res = await fetch(`/api/admin/users/${user.id}/quota`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ quota_bytes: bytes })
			});
			if (res.ok) {
				users = users.map((u) =>
					u.id === user.id ? { ...u, storage_quota_bytes: bytes } : u
				);
			}
		} catch { /* ignore */ }
		editingQuotaUser = null;
	}

	async function toggleBlock(user: User) {
		const newBlocked = !user.blocked;
		try {
			const res = await fetch(`/api/admin/users/${user.id}/block`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ blocked: newBlocked })
			});
			if (res.ok) {
				users = users.map((u) =>
					u.id === user.id ? { ...u, blocked: newBlocked ? 1 : 0 } : u
				);
			}
		} catch { /* ignore */ }
	}
</script>

<svelte:head>
	<title>Admin - Pane</title>
</svelte:head>

<header class="toolbar glass-strong">
	<div class="toolbar-left">
		<a class="toolbar-title" href="/" title="Back to spaces">Pane</a>
		<span class="toolbar-subtitle">Admin</span>
	</div>
	<div class="toolbar-right">
	</div>
</header>

<main class="admin-page">
	<section class="admin-section">
		<h2 class="section-title">Invite Codes</h2>
		<p class="section-desc">Generate codes to invite new users</p>

		<div class="create-code-form">
			<div class="create-code-fields">
				<label class="field">
					<span>Max uses</span>
					<input class="input" type="number" bind:value={maxUses} min="1" max="1000" />
				</label>
				<label class="field">
					<span>Expires in (days)</span>
					<input class="input" type="number" bind:value={expiresIn} placeholder="Never" min="1" />
				</label>
				<button class="btn btn-primary create-btn" onclick={createCode} disabled={creating}>
					{creating ? 'Creating...' : 'Generate Code'}
				</button>
			</div>
			{#if error}
				<div class="form-error">{error}</div>
			{/if}
		</div>

		{#if codes.length === 0}
			<p class="empty-state">No invite codes yet</p>
		{:else}
			<div class="codes-list">
				{#each codes as code (code.code)}
					<div class="code-row" class:expired={isExpired(code)} class:used-up={isUsedUp(code)}>
						<div class="code-main">
							<button class="code-value" onclick={() => copyCode(code.code)} title="Click to copy">
								{code.code}
								{#if copiedCode === code.code}
									<span class="copied-badge">Copied!</span>
								{/if}
							</button>
							<div class="code-meta">
								<span>{code.use_count}/{code.max_uses} uses</span>
								<span>Created {formatDate(code.created_at)}</span>
								{#if code.expires_at}
									<span class:text-danger={isExpired(code)}>
										{isExpired(code) ? 'Expired' : `Expires ${formatDate(code.expires_at)}`}
									</span>
								{:else}
									<span>No expiry</span>
								{/if}
							</div>
						</div>
						<button class="btn btn-sm btn-ghost code-delete" onclick={() => deleteCode(code.code)} title="Delete code">
							<Icon name="trash" size={14} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section class="admin-section">
		<h2 class="section-title">Users</h2>
		<p class="section-desc">{users.length} registered {users.length === 1 ? 'user' : 'users'}</p>

		<div class="users-list">
			{#each users as user (user.id)}
				{@const used = storageUsage[user.id] ?? 0}
				{@const quota = user.storage_quota_bytes}
				{@const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0}
				<div class="user-row" class:user-blocked={user.blocked}>
					<div class="user-info">
						<span class="user-name">{user.display_name}</span>
						<span class="user-email">{user.email}</span>
					</div>
					<div class="user-storage">
						<div class="storage-bar-row">
							<span class="storage-text">{formatBytes(used)} / {formatBytes(quota)}</span>
							{#if editingQuotaUser === user.id}
								<div class="quota-edit">
									<input
										class="input quota-input"
										type="number"
										bind:value={quotaInput}
										min="0"
										onkeydown={(e) => { if (e.key === 'Enter') saveQuota(user); if (e.key === 'Escape') editingQuotaUser = null; }}
									/>
									<span class="quota-edit-unit">MB</span>
									<button class="btn btn-sm btn-primary" onclick={() => saveQuota(user)}>Save</button>
									<button class="btn btn-sm btn-ghost" onclick={() => editingQuotaUser = null}>Cancel</button>
								</div>
								<div class="quota-presets">
									{#each quotaPresets() as preset}
										<button class="btn btn-sm btn-ghost" onclick={() => setQuotaPreset(user, preset.bytes)}>{preset.label}</button>
									{/each}
								</div>
							{:else}
								<button class="btn btn-sm btn-ghost" onclick={() => startEditQuota(user)} title="Change quota">
									<Icon name="edit" size={12} />
								</button>
							{/if}
						</div>
						<div class="storage-bar">
							<div class="storage-bar-fill" class:storage-warning={pct > 90} style="width: {pct}%"></div>
						</div>
					</div>
					<div class="user-meta">
						{#if user.role === 'admin'}
							<span class="badge role-admin">Admin</span>
						{/if}
						{#if user.blocked}
							<span class="badge role-blocked">Blocked</span>
						{:else if user.email_verified}
							<span class="badge role-verified">Verified</span>
						{:else}
							<span class="badge role-unverified">Unverified</span>
						{/if}
						<span class="user-date">Joined {formatDate(user.created_at)}</span>
						{#if user.role !== 'admin'}
							<button
								class="btn btn-sm {user.blocked ? 'btn-ghost' : 'btn-danger'}"
								onclick={() => toggleBlock(user)}
							>
								{user.blocked ? 'Unblock' : 'Block'}
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>
</main>

<style>
	.toolbar {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 10px 20px;
		border-bottom: 1px solid var(--border);
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.toolbar-title {
		font-size: 18px;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text-primary);
		text-decoration: none;
		padding: 2px 6px;
		margin: -2px -6px;
		border-radius: var(--radius-sm);
		transition: color var(--transition), background-color var(--transition);
	}

	.toolbar-title:hover {
		color: var(--accent);
		background: var(--accent-soft);
		text-decoration: none;
	}

	.toolbar-subtitle {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-muted);
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.admin-page {
		max-width: 720px;
		margin: 0 auto;
		padding: 24px 20px;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.admin-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.section-desc {
		font-size: 13px;
		color: var(--text-muted);
	}

	.create-code-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px;
		border-radius: var(--radius);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
	}

	.create-code-fields {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		flex-wrap: wrap;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.field .input {
		width: 140px;
	}

	.create-btn {
		flex-shrink: 0;
	}

	.form-error {
		font-size: 13px;
		color: var(--danger);
	}

	.empty-state {
		padding: 24px;
		text-align: center;
		font-size: 13px;
		color: var(--text-muted);
		border: 1px dashed var(--border);
		border-radius: var(--radius);
	}

	.codes-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.code-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		border-radius: var(--radius);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
	}

	.code-row.expired,
	.code-row.used-up {
		opacity: 0.5;
	}

	.code-main {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	.code-value {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 600;
		color: var(--accent);
		cursor: pointer;
		text-align: left;
	}

	.code-value:hover {
		text-decoration: underline;
	}

	.copied-badge {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
		color: #16a34a;
	}

	.code-meta {
		display: flex;
		gap: 12px;
		font-size: 12px;
		color: var(--text-muted);
		flex-wrap: wrap;
	}

	.text-danger {
		color: var(--danger);
	}

	.code-delete {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.code-delete:hover {
		color: var(--danger);
	}

	.users-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.user-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		border-radius: var(--radius);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		flex-wrap: wrap;
	}

	.user-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.user-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.user-email {
		font-size: 12px;
		color: var(--text-muted);
	}

	.user-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.role-admin {
		background-color: var(--accent-soft);
		color: var(--accent);
	}

	.role-verified {
		background-color: rgba(34, 197, 94, 0.1);
		color: #16a34a;
	}

	.role-unverified {
		background-color: rgba(239, 68, 68, 0.1);
		color: var(--danger);
	}

	.role-blocked {
		background-color: rgba(239, 68, 68, 0.1);
		color: var(--danger);
	}

	.user-blocked {
		opacity: 0.6;
	}

	.user-date {
		font-size: 12px;
		color: var(--text-muted);
	}

	.user-storage {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
	}

	.storage-bar-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.storage-text {
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 500;
	}

	.storage-bar {
		width: 100%;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
	}

	.storage-bar-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.storage-bar-fill.storage-warning {
		background: var(--danger);
	}

	.quota-edit {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.quota-input {
		width: 80px;
		font-size: 12px;
	}

	.quota-edit-unit {
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 500;
	}

	.quota-presets {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
</style>
