export function trapFocus(node: HTMLElement) {
	const previouslyFocused = document.activeElement as HTMLElement;

	function getFocusable() {
		return node.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
	}

	requestAnimationFrame(() => {
		const focusable = getFocusable();
		(focusable[0] as HTMLElement)?.focus();
	});

	function handleTab(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;
		const focusable = getFocusable();
		if (focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (e.shiftKey) {
			if (document.activeElement === first) {
				e.preventDefault();
				last.focus();
			}
		} else {
			if (document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	node.addEventListener('keydown', handleTab);

	return {
		destroy() {
			node.removeEventListener('keydown', handleTab);
			previouslyFocused?.focus();
		}
	};
}
