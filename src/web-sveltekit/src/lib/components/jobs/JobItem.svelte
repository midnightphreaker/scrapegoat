<script lang="ts">
  import Card from "$lib/components/ui/card/card.svelte";
  import CardHeader from "$lib/components/ui/card/card-header.svelte";
  import CardTitle from "$lib/components/ui/card/card-title.svelte";
  import CardContent from "$lib/components/ui/card/card-content.svelte";
  import CardAction from "$lib/components/ui/card/card-action.svelte";
  import Badge from "$lib/components/ui/badge/badge.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "$lib/components/ui/dialog";
  import ProgressBar from "./ProgressBar.svelte";
  import type { Job } from "$lib/api/types";

  interface Props {
    job: Job;
    onCancel?: (jobId: string) => void;
  }

  let { job, onCancel }: Props = $props();

  const statusVariant = $derived(
    job.status === "completed"
      ? "default"
      : job.status === "failed"
        ? "destructive"
        : job.status === "running"
          ? "secondary"
          : "outline",
  );

  const canCancel = $derived(job.status === "queued" || job.status === "running");

  function handleCancel() {
    onCancel?.(job.id);
  }

  function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleString();
  }
</script>

<Card>
  <CardHeader>
    <CardTitle class="flex items-center gap-2">
      <span>{job.library}</span>
      {#if job.version}
        <Badge variant="secondary">{job.version}</Badge>
      {/if}
    </CardTitle>
    <CardAction>
      <Badge variant={statusVariant}>{job.status}</Badge>
    </CardAction>
  </CardHeader>

  <CardContent>
    {#if job.progress}
      <ProgressBar pages={job.progress.pages} totalPages={job.progress.totalPages} />
    {/if}

    {#if job.error}
      <p class="mt-2 text-sm text-red-600 dark:text-red-400">{job.error}</p>
    {/if}

    <div class="mt-3 flex items-center justify-between text-xs text-stone-500">
      <span>{formatDate(job.createdAt)}</span>

      {#if canCancel}
        <Dialog>
          <DialogTrigger>
            <Button variant="destructive" size="sm">Cancel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Job?</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel indexing "{job.library}"? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">No, keep it</Button>
              <Button variant="destructive" onclick={handleCancel}>Yes, cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      {/if}
    </div>
  </CardContent>
</Card>
