<script lang="ts">
  import Badge from "$lib/components/ui/badge/badge.svelte";

  interface Props {
    version: string | null;
    status?: string;
  }

  let { version, status = "completed" }: Props = $props();

  const statusColors: Record<string, string> = {
    completed:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    queued:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  };
</script>

<Badge
  variant="outline"
  class={statusColors[status] || statusColors.completed}
>
  {version || "Unversioned"}
</Badge>
