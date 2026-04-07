<script lang="ts">
  import { page } from '$app/stores';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { trpc } from '$lib/api/trpc';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let query = $state('');
  let searching = $state(false);
  let results = $state<{ url: string; content: string; score: number | null }[]>([]);
  let selectedVersion = $state(data.library?.versions[0]?.ref.version || '');

  async function handleSearch() {
    if (!query.trim()) return;
    
    searching = true;
    try {
      const result = await trpc.search.query({
        library: data.name,
        version: selectedVersion || undefined,
        query: query.trim(),
        limit: 10,
      });
      results = result;
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      searching = false;
    }
  }
</script>

<svelte:head>
  <title>{data.name} - Scrapegoat</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-stone-800 dark:text-stone-100">
      {data.name}
    </h1>
    
    {#if data.library}
      <div class="flex items-center gap-2 mt-2">
        {#each data.library.versions as v}
          <Badge
            variant={v.ref.version === selectedVersion ? 'default' : 'outline'}
            class="cursor-pointer"
            onclick={() => selectedVersion = v.ref.version ?? ''}
          >
            {v.ref.version || 'Unversioned'}
          </Badge>
        {/each}
      </div>
      
      <div class="mt-4 text-sm text-stone-600 dark:text-stone-400">
        <span class="mr-4">{data.library.versions[0]?.counts.documents || 0} pages</span>
        <span class="mr-4">{data.library.versions[0]?.counts.uniqueUrls || 0} URLs</span>
        <span>Indexed: {data.library.versions[0]?.indexedAt ? new Date(data.library.versions[0].indexedAt).toLocaleDateString() : 'N/A'}</span>
      </div>
    {:else}
      <p class="text-stone-500 dark:text-stone-400 mt-2">Library not found</p>
    {/if}
  </div>

  <!-- Search Form -->
  <Card class="p-4">
    <form onsubmit={(e) => { e.preventDefault(); handleSearch(); }} class="flex gap-2">
      <Input
        bind:value={query}
        placeholder="Search documentation..."
        class="flex-1"
      />
      <Button type="submit" disabled={searching}>
        {searching ? 'Searching...' : 'Search'}
      </Button>
    </form>
  </Card>

  <!-- Search Results -->
  {#if results.length > 0}
    <div class="space-y-4">
      {#each results as result (result.url)}
        <Card class="p-4">
          <div class="prose dark:prose-invert max-w-none">
            {result.content}
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-primary-600 hover:underline mt-2 block"
          >
            {result.url}
          </a>
        </Card>
      {/each}
    </div>
  {/if}
</div>
