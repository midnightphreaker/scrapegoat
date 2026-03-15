<script lang="ts">
  import Badge from "$lib/components/ui/badge/badge.svelte";
  import Input from "$lib/components/ui/input/input.svelte";

  interface Props {
    version: string | null;
    status?: string;
    library?: string;
    onRename?: (newVersion: string) => void;
  }

  let { version, status = "completed", library, onRename }: Props = $props();

  const statusColors: Record<string, string> = {
    completed:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    queued:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  };

  let editing = $state(false);
  let editValue = $state("");
  let saving = $state(false);

  function startEditing() {
    if (!onRename || !version) return;
    editValue = version;
    editing = true;
  }

  async function saveEdit() {
    if (!onRename || !version) {
      editing = false;
      return;
    }

    const trimmed = editValue.trim();
    if (trimmed && trimmed !== version) {
      saving = true;
      try {
        await onRename(trimmed);
      } finally {
        saving = false;
      }
    }
    editing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      editing = false;
    }
  }

  function handleBlur() {
    saveEdit();
  }
</script>

{#if editing}
  <Input
    type="text"
    bind:value={editValue}
    onkeydown={handleKeydown}
    onblur={handleBlur}
    disabled={saving}
    class="h-6 w-24 text-xs px-1"
    autofocus
  />
{:else}
  <Badge
    variant="outline"
    class={`${statusColors[status] || statusColors.completed} ${onRename ? "cursor-pointer" : ""}`}
    ondblclick={startEditing}
  >
    {version || "Unversioned"}
  </Badge>
{/if}
