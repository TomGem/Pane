<script lang="ts">
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		error = '';
		loading = true;
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Login failed';
				return;
			}
			if (!data.email_verified) {
				goto('/verify-email');
			} else {
				goto('/');
			}
		} catch {
			error = 'Login failed';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Login - Pane</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-card glass-strong">
		<h1 class="auth-title">Pane</h1>
		<p class="auth-subtitle">Sign in to your account</p>

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
				<span>Password</span>
				<input
					class="input"
					type="password"
					bind:value={password}
					placeholder="Your password"
					required
					autocomplete="current-password"
				/>
			</label>

			<button class="btn btn-primary auth-submit" type="submit" disabled={loading}>
				{loading ? 'Signing in...' : 'Sign in'}
			</button>
		</form>

		<p class="auth-footer">
			<a href="/forgot-password">Forgot password?</a>
		</p>
		<p class="auth-footer" style="margin-top: 8px;">
			Don't have an account? <a href="/register">Register</a>
		</p>
		<p class="auth-footer" style="margin-top: 8px;">
			<a href="/demo.html" target="_blank">See what Pane can do</a>
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
</style>
