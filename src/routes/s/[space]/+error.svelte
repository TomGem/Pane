<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="error-page">
	<div class="error-content glass">
		<h1>{$page.status}</h1>
		<p>{$page.error?.message ?? 'Space not found'}</p>
		<a href="/" class="btn btn-primary">Go to default space</a>
	</div>
</div>

<style>
	.error-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		padding: 20px;
	}

	.error-content {
		text-align: center;
		padding: 40px 60px;
		border-radius: var(--radius-lg);
	}

	.error-content h1 {
		font-size: 48px;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.error-content p {
		font-size: 16px;
		color: var(--text-muted);
		margin-bottom: 24px;
	}
</style>
