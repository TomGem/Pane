<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let displayName = $state('');
	let inviteCode = $state($page.url.searchParams.get('code') ?? '');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		error = '';
		loading = true;
		try {
			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					password,
					display_name: displayName,
					invite_code: inviteCode || undefined
				})
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Registration failed';
				return;
			}
			goto('/verify-email');
		} catch {
			error = 'Registration failed';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Register - Pane</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-card glass-strong">
		<h1 class="auth-title">Pane</h1>
		<p class="auth-subtitle">Create your account</p>

		<form class="auth-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			{#if error}
				<div class="auth-error">{error}</div>
			{/if}

			<label class="auth-label">
				<span>Display name</span>
				<input
					class="input"
					type="text"
					bind:value={displayName}
					placeholder="Your name"
					required
					autocomplete="name"
				/>
			</label>

			<label class="auth-label">
				<span>Email</span>
				<input
					class="input"
					type="email"
					bind:value={email}
					placeholder="you@example.com"
					required
					autocomplete="email"
				/>
			</label>

			<label class="auth-label">
				<span>Password</span>
				<input
					class="input"
					type="password"
					bind:value={password}
					placeholder="At least 8 characters"
					required
					minlength="8"
					autocomplete="new-password"
				/>
			</label>

			<label class="auth-label">
				<span>Invitation code</span>
				<input
					class="input"
					type="text"
					bind:value={inviteCode}
					placeholder="Enter your invite code"
					autocomplete="off"
				/>
			</label>

			<button class="btn btn-primary auth-submit" type="submit" disabled={loading}>
				{loading ? 'Creating account...' : 'Create account'}
			</button>
		</form>

		<p class="auth-footer">
			Already have an account? <a href="/login">Sign in</a>
		</p>
		{#if data.legalEnabled}
			<p class="auth-footer legal-links" style="margin-top: 16px;">
				<a href="/legal">Privacy Policy</a>
				<span class="legal-sep">&middot;</span>
				<a href="/legal?tab=legal">Legal Notice</a>
			</p>
		{/if}
	</div>
</div>

<style>
	.auth-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 20px;
	}

	.auth-card {
		width: 100%;
		max-width: 400px;
		padding: 32px;
		border-radius: var(--radius-lg);
	}

	.auth-title {
		font-size: 24px;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text-primary);
		text-align: center;
		margin-bottom: 4px;
	}

	.auth-subtitle {
		font-size: 14px;
		color: var(--text-muted);
		text-align: center;
		margin-bottom: 24px;
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.auth-label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.auth-error {
		padding: 10px 12px;
		border-radius: var(--radius);
		background: rgba(239, 68, 68, 0.1);
		color: var(--danger);
		font-size: 13px;
	}

	.auth-submit {
		width: 100%;
		margin-top: 4px;
	}

	.auth-footer {
		margin-top: 20px;
		text-align: center;
		font-size: 13px;
		color: var(--text-muted);
	}

	.legal-links {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}

	.legal-sep {
		color: var(--text-muted);
		opacity: 0.5;
	}
</style>
