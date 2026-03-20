<script lang="ts">
	import Icon from './Icon.svelte';
	import type { ChatStore } from '$lib/stores/chat.svelte';

	interface Props {
		chat: ChatStore;
		isOwner: boolean;
		onclose: () => void;
	}

	let { chat, isOwner, onclose }: Props = $props();

	let inputText = $state('');
	let messagesEl = $state<HTMLDivElement | null>(null);
	let confirmClear = $state(false);
	let shouldAutoScroll = $state(true);
	let inputEl = $state<HTMLTextAreaElement | null>(null);

	function scrollToBottom() {
		if (messagesEl && shouldAutoScroll) {
			requestAnimationFrame(() => {
				messagesEl!.scrollTop = messagesEl!.scrollHeight;
			});
		}
	}

	$effect(() => {
		chat.messages;
		scrollToBottom();
	});

	$effect(() => {
		if (chat.isOpen) {
			setTimeout(() => {
				inputEl?.focus();
				scrollToBottom();
			}, 100);
		}
	});

	function handleScroll() {
		if (!messagesEl) return;
		const { scrollTop, scrollHeight, clientHeight } = messagesEl;
		shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 60;
	}

	async function handleSend() {
		const text = inputText.trim();
		if (!text) return;
		inputText = '';
		try {
			await chat.sendMessage(text);
		} catch (e) {
			console.error('Failed to send message:', e);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		} else if (e.key === 'Escape') {
			onclose();
		}
	}

	async function handleClearChat() {
		try {
			await chat.clearChat();
		} catch (e) {
			console.error('Failed to clear chat:', e);
		}
		confirmClear = false;
	}

	function formatTime(dateStr: string): string {
		try {
			const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'Z');
			const now = new Date();
			const diffMs = now.getTime() - d.getTime();
			const diffMins = Math.floor(diffMs / 60000);
			if (diffMins < 1) return 'now';
			if (diffMins < 60) return `${diffMins}m`;
			const diffHours = Math.floor(diffMins / 60);
			if (diffHours < 24) return `${diffHours}h`;
			const diffDays = Math.floor(diffHours / 24);
			if (diffDays < 7) return `${diffDays}d`;
			return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		} catch {
			return '';
		}
	}

	function getInitial(name: string): string {
		return name.charAt(0).toUpperCase();
	}

	const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

	function avatarColor(userId: string): string {
		let hash = 0;
		for (let i = 0; i < userId.length; i++) {
			hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
		}
		return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
	}
</script>

<aside class="chat-panel glass-strong">
	<div class="chat-header">
		<div class="chat-header-left">
			<span class="chat-title">Chat</span>
			{#if chat.onlineUsers.length > 0}
				<div class="presence-avatars">
					{#each chat.onlineUsers as user (user.id)}
						<span class="presence-user" title={user.display_name}>
							{#if user.avatar_path}
								<img class="presence-avatar" src="/api/avatar?user={user.id}" alt={user.display_name} />
							{:else}
								<span class="presence-initial" style:background-color={avatarColor(user.id)}>
									{getInitial(user.display_name)}
								</span>
							{/if}
							<span class="presence-online-dot"></span>
						</span>
					{/each}
				</div>
			{/if}
		</div>
		<div class="chat-header-right">
			{#if isOwner && chat.messages.length > 0}
				{#if confirmClear}
					<button class="btn-clear-confirm" onclick={handleClearChat}>Confirm</button>
					<button class="btn-clear-cancel" onclick={() => confirmClear = false}>Cancel</button>
				{:else}
					<button class="btn-clear" onclick={() => confirmClear = true} title="Clear chat history">
						<Icon name="trash" size={14} />
					</button>
				{/if}
			{/if}
			<button class="btn-close" onclick={onclose} title="Close chat">
				<Icon name="close" size={16} />
			</button>
		</div>
	</div>

	<div class="chat-messages" bind:this={messagesEl} onscroll={handleScroll}>
		{#if chat.hasMore}
			<button class="btn-load-more" onclick={() => chat.loadMore()} disabled={chat.loading}>
				{chat.loading ? 'Loading...' : 'Load older messages'}
			</button>
		{/if}

		{#if chat.messages.length === 0 && !chat.loading}
			<div class="chat-empty">
				<Icon name="message-circle" size={32} />
				<p>No messages yet</p>
				<p class="chat-empty-sub">Start the conversation!</p>
			</div>
		{/if}

		{#each chat.messages as msg, i (msg.id)}
			{@const isOwn = msg.user_id === chat.currentUserId}
			{@const showAvatar = i === 0 || chat.messages[i - 1].user_id !== msg.user_id}
			<div class="chat-msg" class:own={isOwn} class:grouped={!showAvatar}>
				{#if showAvatar && !isOwn}
					<div class="msg-header">
						{#if msg.avatar_path}
							<img class="msg-avatar" src="/api/avatar?user={msg.user_id}" alt="" />
						{:else}
							<span class="msg-avatar-initial" style:background-color={avatarColor(msg.user_id)}>
								{getInitial(msg.display_name)}
							</span>
						{/if}
						<span class="msg-name">{msg.display_name}</span>
						<span class="msg-time">{formatTime(msg.created_at)}</span>
					</div>
				{:else if showAvatar && isOwn}
					<div class="msg-header own">
						<span class="msg-time">{formatTime(msg.created_at)}</span>
					</div>
				{/if}
				<div class="msg-bubble" class:own={isOwn}>{msg.message}</div>
			</div>
		{/each}
	</div>

	<div class="chat-input-area">
		<textarea
			bind:this={inputEl}
			class="chat-input"
			placeholder="Type a message..."
			bind:value={inputText}
			onkeydown={handleKeydown}
			rows="1"
		></textarea>
		<button
			class="btn-send"
			onclick={handleSend}
			disabled={!inputText.trim()}
			title="Send message"
		>
			<Icon name="send" size={16} />
		</button>
	</div>
</aside>

<style>
	.chat-panel {
		width: 360px;
		min-width: 360px;
		height: 100%;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--border);
		background: var(--bg-primary);
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.chat-header-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.chat-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.presence-avatars {
		display: flex;
		align-items: center;
	}

	.presence-user {
		position: relative;
		display: flex;
		margin-left: -4px;
	}

	.presence-user:first-child {
		margin-left: 0;
	}

	.presence-avatar {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--bg-primary);
	}

	.presence-initial {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 600;
		color: white;
		border: 2px solid var(--bg-primary);
	}

	.presence-online-dot {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #22c55e;
		border: 1.5px solid var(--bg-primary);
	}

	.chat-header-right {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.btn-clear, .btn-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		transition: background-color var(--transition), color var(--transition);
	}

	.btn-clear:hover {
		background: rgba(239, 68, 68, 0.1);
		color: var(--danger);
	}

	.btn-close:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.btn-clear-confirm, .btn-clear-cancel {
		font-size: 11px;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.btn-clear-confirm {
		background: var(--danger);
		color: white;
	}

	.btn-clear-cancel {
		color: var(--text-muted);
		background: var(--bg-secondary);
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.btn-load-more {
		align-self: center;
		font-size: 12px;
		color: var(--accent);
		padding: 6px 12px;
		border-radius: var(--radius-sm);
		margin-bottom: 8px;
		transition: background-color var(--transition);
	}

	.btn-load-more:hover:not(:disabled) {
		background: var(--accent-soft);
	}

	.btn-load-more:disabled {
		opacity: 0.5;
	}

	.chat-empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		gap: 8px;
		padding: 40px 0;
	}

	.chat-empty p {
		margin: 0;
		font-size: 14px;
	}

	.chat-empty-sub {
		font-size: 12px !important;
		opacity: 0.7;
	}

	.chat-msg {
		padding: 2px 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.chat-msg.own {
		align-items: flex-end;
	}


	.msg-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 2px;
		margin-top: 8px;
	}

	.msg-header.own {
		justify-content: flex-end;
	}

	.chat-msg:first-child .msg-header,
	.chat-msg:first-of-type .msg-header {
		margin-top: 0;
	}

	.msg-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.msg-avatar-initial {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 600;
		color: white;
		flex-shrink: 0;
	}

	.msg-name {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.msg-time {
		font-size: 11px;
		color: var(--text-muted);
	}

	.msg-bubble {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.45;
		padding: 6px 10px;
		border-radius: var(--radius);
		word-break: break-word;
		white-space: pre-wrap;
		max-width: 85%;
		background: var(--bg-secondary);
	}

	.chat-msg:not(.own) .msg-bubble {
		margin-left: 32px;
	}

	.msg-bubble.own {
		background: var(--accent);
		color: white;
	}

	.chat-input-area {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding: 12px 16px;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}

	.chat-input {
		flex: 1;
		resize: none;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 8px 12px;
		font-size: 13px;
		line-height: 1.4;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-family: inherit;
		max-height: 100px;
		overflow-y: auto;
	}

	.chat-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.chat-input::placeholder {
		color: var(--text-muted);
	}

	.btn-send {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: var(--radius);
		background: var(--accent);
		color: white;
		transition: opacity var(--transition);
		flex-shrink: 0;
	}

	.btn-send:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-send:disabled {
		opacity: 0.4;
	}

	@media (max-width: 767px) {
		.chat-panel {
			position: fixed;
			inset: 0;
			width: 100%;
			min-width: unset;
			z-index: 200;
		}
	}
</style>
