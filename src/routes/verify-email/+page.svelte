<script lang="ts">
	import { goto } from '$app/navigation';

	let code = $state('');
	let error = $state('');
	let success = $state(false);
	let loading = $state(false);
	let resending = $state(false);
	let resendMessage = $state('');

	async function handleVerify() {
		error = '';
		loading = true;
		try {
			const res = await fetch('/api/auth/verify-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Verification failed';
				return;
			}
			success = true;
			setTimeout(() => goto('/'), 1500);
		} catch {
			error = 'Verification failed';
		} finally {
			loading = false;
		}
	}

	async function handleResend() {
		resendMessage = '';
		resending = true;
		try {
			const res = await fetch('/api/auth/resend-verification', {
				method: 'POST'
			});
			const data = await res.json();
			if (!res.ok) {
				resendMessage = data.error || 'Failed to resend';
			} else {
				resendMessage = 'A new code has been sent to your email';
			}
		} catch {
			resendMessage = 'Failed to resend';
		} finally {
			resending = false;
		}
	}
</script>

<svelte:head>
	<title>Verify Email - Pane</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-card glass-strong">
		<h1 class="auth-title">Verify your email</h1>
		<p class="auth-subtitle">Enter the 6-digit code sent to your email</p>

		{#if success}
			<div class="auth-success">Email verified! Redirecting...</div>
		{:else}
			<form class="auth-form" onsubmit={(e) => { e.preventDefault(); handleVerify(); }}>
				{#if error}
					<div class="auth-error">{error}</div>
				{/if}

				<label class="auth-label">
					<span>Verification code</span>
					<input
						class="input code-input"
						type="text"
						bind:value={code}
						placeholder="000000"
						required
						maxlength="6"

						autocomplete="one-time-code"
						inputmode="numeric"
					/>
				</label>

				<button class="btn btn-primary auth-submit" type="submit" disabled={loading}>
					{loading ? 'Verifying...' : 'Verify'}
				</button>
			</form>

			<div class="resend-section">
				{#if resendMessage}
					<p class="resend-message">{resendMessage}</p>
				{/if}
				<button class="resend-btn" onclick={handleResend} disabled={resending}>
					{resending ? 'Sending...' : "Didn't receive a code? Resend"}
				</button>
			</div>
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

	.code-input {
		text-align: center;
		font-size: 24px;
		font-weight: 700;
		letter-spacing: 0.3em;
		font-family: var(--font-mono);
	}

	.auth-error {
		padding: 10px 12px;
		border-radius: var(--radius);
		background: rgba(239, 68, 68, 0.1);
		color: var(--danger);
		font-size: 13px;
	}

	.auth-success {
		padding: 12px;
		border-radius: var(--radius);
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
		font-size: 14px;
		font-weight: 600;
		text-align: center;
	}

	.auth-submit {
		width: 100%;
		margin-top: 4px;
	}

	.resend-section {
		margin-top: 20px;
		text-align: center;
	}

	.resend-message {
		font-size: 13px;
		color: var(--text-muted);
		margin-bottom: 8px;
	}

	.resend-btn {
		font-size: 13px;
		color: var(--accent);
		cursor: pointer;
	}

	.resend-btn:hover {
		text-decoration: underline;
	}

	.resend-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
