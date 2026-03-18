<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let email = $state($page.url.searchParams.get('email') || '');
	let code = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let success = $state(false);
	let loading = $state(false);

	async function handleSubmit() {
		error = '';

		if (newPassword !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code, new_password: newPassword })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Failed to reset password';
				return;
			}
			success = true;
			setTimeout(() => goto('/login'), 2000);
		} catch {
			error = 'Failed to reset password';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset Password - Pane</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-card glass-strong">
		<h1 class="auth-title">Pane</h1>
		<p class="auth-subtitle">Enter your reset code</p>

		{#if success}
			<div class="auth-success">
				Password reset successfully. Redirecting to login...
			</div>
		{:else}
			<form class="auth-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				{#if error}
					<div class="auth-error">{error}</div>
				{/if}

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
					<span>Reset code</span>
					<input
						class="input code-input"
						type="text"
						bind:value={code}
						placeholder="000000"
						required
						autocomplete="one-time-code"
						inputmode="numeric"
						maxlength="6"
					/>
				</label>

				<label class="auth-label">
					<span>New password</span>
					<input
						class="input"
						type="password"
						bind:value={newPassword}
						placeholder="At least 8 characters"
						required
						minlength="8"
						autocomplete="new-password"
					/>
				</label>

				<label class="auth-label">
					<span>Confirm password</span>
					<input
						class="input"
						type="password"
						bind:value={confirmPassword}
						placeholder="Confirm your new password"
						required
						minlength="8"
						autocomplete="new-password"
					/>
				</label>

				<button class="btn btn-primary auth-submit" type="submit" disabled={loading}>
					{loading ? 'Resetting...' : 'Reset password'}
				</button>
			</form>
		{/if}

		<p class="auth-footer">
			<a href="/login">Back to login</a>
		</p>
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

	.auth-success {
		padding: 10px 12px;
		border-radius: var(--radius);
		background: rgba(34, 197, 94, 0.1);
		color: var(--success, #22c55e);
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

	.code-input {
		font-family: monospace;
		font-size: 20px;
		letter-spacing: 6px;
		text-align: center;
	}
</style>
