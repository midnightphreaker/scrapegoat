<script lang="ts">
  interface Props {
    pages: number;
    totalPages: number;
    indeterminate?: boolean;
  }

  let { pages, totalPages, indeterminate = false }: Props = $props();

  const percentage = $derived(
    totalPages > 0 ? Math.min(100, Math.round((pages / totalPages) * 100)) : 0,
  );
</script>

<div class="w-full">
  <div class="mb-1 flex justify-between text-xs text-stone-600 dark:text-stone-400">
    {#if indeterminate}
      <span>Discovering pages...</span>
    {:else}
      <span>{pages} / {totalPages} pages</span>
      <span>{percentage}%</span>
    {/if}
  </div>

  <div class="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
    {#if indeterminate}
      <div class="h-full w-1/2 animate-pulse rounded-full bg-primary-600"></div>
    {:else}
      <div
        class="h-full rounded-full bg-primary-600 transition-all duration-300"
        style="width: {percentage}%"
      ></div>
    {/if}
  </div>
</div>
