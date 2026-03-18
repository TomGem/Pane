<script lang="ts">
	import { goto } from '$app/navigation';

	let email = $state('');
	let error = $state('');
	let success = $state(false);
	let loading = $state(false);

	async function handleSubmit() {
		error = '';
		loading = true;
		try {
			const res = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Failed to send reset code';
				return;
			}
			success = true;
		} catch {
			error = 'Failed to send reset code';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Forgot Password - Pane</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-card glass-strong">
		<h1 class="auth-title">Pane</h1>
		<p class="auth-subtitle">Reset your password</p>

		{#if success}
			<div class="auth-success">
				If an account exists for <strong>{email}</strong>, a reset code has been sent.
			</div>
			<button class="btn btn-primary auth-submit" onclick={() => goto(`/reset-password?email=${encodeURIComponent(email)}`)}>
				Enter reset code
			</button>
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

				<button class="btn btn-primary auth-submit" type="submit" disabled={loading}>
					{loading ? 'Sending...' : 'Send reset code'}
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
		margin-bottom: 16px;
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
