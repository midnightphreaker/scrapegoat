<script lang="ts">
  import LibraryItem from "./LibraryItem.svelte";
  import { librariesStore } from "$lib/stores/libraries.svelte";
  import { onMount } from "svelte";

  onMount(() => {
    librariesStore.fetch();
  });

  const sortedLibraries = $derived(
    [...librariesStore.libraries].sort((a, b) => a.library.localeCompare(b.library)),
  );

  function handleDeleteVersion(library: string, version: string) {
    librariesStore.deleteVersion(library, version);
  }

  function handleRescrape(versionId: number) {
    librariesStore.rescrapeLibrary(versionId);
  }

  async function handleRenameVersion(library: string, oldVersion: string, newVersion: string) {
    await librariesStore.renameVersion(library, oldVersion, newVersion);
  }

  async function handleRename(oldName: string, newName: string) {
    await librariesStore.rename(oldName, newName);
  }
</script>

<div class="space-y-3">
  {#if librariesStore.loading}
    <div class="text-center py-4">
      <div class="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
    </div>
  {:else if sortedLibraries.length === 0}
    <div class="text-center py-8 text-stone-500 dark:text-stone-400">
      <p>No libraries indexed yet</p>
      <p class="text-sm mt-1">Submit a scrape job to create your first library</p>
    </div>
  {:else}
    {#each sortedLibraries as library (library.library)}
      <LibraryItem
        {library}
        onDeleteVersion={handleDeleteVersion}
        onRename={(newName) => handleRename(library.library, newName)}
        onRenameVersion={handleRenameVersion}
        onRescrape={handleRescrape}
      />
    {/each}
  {/if}
</div>
