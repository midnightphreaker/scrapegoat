<script lang="ts">
	import ScrapeForm from '$lib/components/scrape/ScrapeForm.svelte';
	import JobList from '$lib/components/jobs/JobList.svelte';
	import LibraryList from '$lib/components/libraries/LibraryList.svelte';
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
			<h2 class="text-xl font-semibold mb-4 text-stone-800 dark:text-stone-100">
				Indexed Libraries
			</h2>
			<LibraryList />
		</section>
	</div>
</div>
