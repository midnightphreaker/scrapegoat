<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import Header from '$lib/components/layout/Header.svelte';
	import { Toaster } from 'svelte-sonner';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-stone-50 dark:bg-stone-950">
	<Header />
	<main class="container mx-auto px-4 py-6">
		{@render children()}
	</main>
</div>
<Toaster position="bottom-right" />
