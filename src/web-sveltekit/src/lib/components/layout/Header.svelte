<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import McpStatusBadge from './McpStatusBadge.svelte';
</script>

<header class="border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
	<div class="container mx-auto px-4 py-3 flex items-center justify-between">
		<a href="/" class="flex items-center gap-2 text-xl font-bold text-stone-800 dark:text-stone-100">
			<svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
			</svg>
			Scrapegoat
		</a>
		
		<div class="flex items-center gap-4">
			<McpStatusBadge />
			<ThemeToggle />
		</div>
	</div>
</header>
