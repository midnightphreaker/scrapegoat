<script lang="ts">
  import Card from "$lib/components/ui/card/card.svelte";
  import CardHeader from "$lib/components/ui/card/card-header.svelte";
  import CardTitle from "$lib/components/ui/card/card-title.svelte";
  import CardContent from "$lib/components/ui/card/card-content.svelte";
  import CardAction from "$lib/components/ui/card/card-action.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import Input from "$lib/components/ui/input/input.svelte";
  import VersionBadge from "./VersionBadge.svelte";
  import type { Library } from "$lib/api/types";

  interface Props {
    library: Library;
    onDeleteVersion?: (library: string, version: string) => void;
    onRename?: (newName: string) => void;
    onRescrape?: (library: string, version: string) => void;
  }

  let { library, onDeleteVersion, onRename, onRescrape }: Props = $props();

  let isEditing = $state(false);
  let editValue = $state("");
  let deleteConfirmVersion = $state<string | null>(null);
  let rescrapeConfirmVersion = $state<string | null>(null);

  function startEdit() {
    editValue = library.name;
    isEditing = true;
  }

  function commitEdit() {
    if (editValue.trim() && editValue !== library.name) {
      onRename?.(editValue.trim());
    }
    isEditing = false;
  }

  function cancelEdit() {
    isEditing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      commitEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }

  function handleDeleteClick(version: string) {
    if (deleteConfirmVersion === version) {
      onDeleteVersion?.(library.name, version);
      deleteConfirmVersion = null;
    } else {
      deleteConfirmVersion = version;
      rescrapeConfirmVersion = null;
    }
  }

  function handleRescrapeClick(version: string) {
    if (rescrapeConfirmVersion === version) {
      onRescrape?.(library.name, version);
      rescrapeConfirmVersion = null;
    } else {
      rescrapeConfirmVersion = version;
      deleteConfirmVersion = null;
    }
  }

  function formatDate(isoString: string | null): string {
    if (!isoString) return "N/A";
    return new Date(isoString).toLocaleDateString();
  }
</script>

<Card>
  <CardHeader>
    <CardTitle class="flex items-center gap-2">
      {#if isEditing}
        <Input
          type="text"
          bind:value={editValue}
          onkeydown={handleKeydown}
          onblur={commitEdit}
          class="h-8 w-40"
          autofocus
        />
      {:else}
        <a
          href="/libraries/{library.name}"
          class="hover:underline cursor-pointer"
          ondblclick={startEdit}
        >
          {library.name}
        </a>
      {/if}
    </CardTitle>
  </CardHeader>

  <CardContent>
    <div class="space-y-3">
      {#each library.versions as version}
        <div class="flex items-center justify-between border-b pb-2 last:border-b-0">
          <div class="flex items-center gap-3">
            <VersionBadge version={version.version} status={version.status} />
            <div class="text-sm text-stone-500">
              <span>{version.documentCount} docs</span>
              <span class="mx-1">|</span>
              <span>{version.uniqueUrlCount} URLs</span>
              <span class="mx-1">|</span>
              <span>{formatDate(version.indexedAt)}</span>
            </div>
          </div>

          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onclick={() => handleRescrapeClick(version.version)}
            >
              {#if rescrapeConfirmVersion === version.version}
                Confirm?
              {:else}
                Rescrape
              {/if}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onclick={() => handleDeleteClick(version.version)}
            >
              {#if deleteConfirmVersion === version.version}
                Confirm?
              {:else}
                Delete
              {/if}
            </Button>
          </div>
        </div>
      {/each}
    </div>
  </CardContent>
</Card>
