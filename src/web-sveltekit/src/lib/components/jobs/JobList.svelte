<script lang="ts">
  import JobItem from "./JobItem.svelte";
  import { jobsStore } from "$lib/stores/jobs.svelte";
  import { subscribeToJobUpdates } from "$lib/api/sse";
  import { onMount } from "svelte";
  import type { Job } from "$lib/api/types";

  interface Props {
    jobs?: Job[];
  }

  let { jobs: initialJobs }: Props = $props();

  onMount(() => {
    jobsStore.fetch();
    const unsubscribe = subscribeToJobUpdates((event) => {
      jobsStore.updateJob(event.payload);
    });
    return unsubscribe;
  });

  const activeJobs = $derived(
    (initialJobs ?? jobsStore.jobs).filter(
      (j) => j.status === "running" || j.status === "queued",
    ),
  );
</script>

<div class="space-y-2">
  {#if activeJobs.length === 0}
    <div class="text-center py-8 text-stone-500 dark:text-stone-400">
      <p>No active jobs</p>
      <p class="text-sm mt-1">Submit a scrape job to see it here</p>
    </div>
  {:else}
    {#each activeJobs as job (job.id)}
      <JobItem {job} />
    {/each}
  {/if}
</div>
