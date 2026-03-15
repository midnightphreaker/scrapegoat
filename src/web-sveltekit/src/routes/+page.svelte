<script lang="ts">
	import { RefreshCw } from '@lucide/svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import ScrapeForm from '$lib/components/scrape/ScrapeForm.svelte';
	import JobList from '$lib/components/jobs/JobList.svelte';
	import LibraryList from '$lib/components/libraries/LibraryList.svelte';
	import { librariesStore } from '$lib/stores/libraries.svelte';

	async function handleForceRefresh() {
		await librariesStore.fetch(true);
	}
</script>

<svelte:head>
	<title>Scrapegoat - Documentation Indexer</title>
</svelte:head>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
	<!-- Left Column: Form + Jobs -->
	<div class="space-y-6">
		<section>
			<h2 class="text-xl font-semibold mb-4 text-stone-800 dark:text-stone-100">
				Scrape Documentation
			</h2>
			<ScrapeForm />
		</section>

		<section>
			<h2 class="text-xl font-semibold mb-4 text-stone-800 dark:text-stone-100">
				Job Queue
			</h2>
			<JobList />
		</section>
	</div>

	<!-- Right Column: Libraries -->
	<div>
		<section>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-semibold text-stone-800 dark:text-stone-100">
					Indexed Libraries
				</h2>
				<Button variant="outline" size="sm" onclick={handleForceRefresh}>
					<RefreshCw class="w-4 h-4 mr-1" />
					Force Refresh
				</Button>
			</div>
			<LibraryList />
		</section>
	</div>
</div>
