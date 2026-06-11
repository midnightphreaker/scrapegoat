import type { JobInfo } from "../../tools/GetJobInfoTool";
import { PipelineJobStatus } from "../../pipeline/types";
import { VersionStatus, isActiveStatus } from "../../store/types";
import VersionBadge from "./VersionBadge";
import StatusBadge from "./StatusBadge";
import ProgressBar from "./ProgressBar";
import LoadingSpinner from "./LoadingSpinner";

/**
 * Props for the JobItem component.
 */
interface JobItemProps {
  job: JobInfo;
}

function getPipelineStatusClasses(
  status: PipelineJobStatus,
  hasError: boolean,
): string {
  if (hasError || status === PipelineJobStatus.FAILED) {
    return "sg-badge sg-badge-danger";
  }

  switch (status) {
    case PipelineJobStatus.COMPLETED:
      return "sg-badge sg-badge-success";
    case PipelineJobStatus.RUNNING:
    case PipelineJobStatus.CANCELLING:
      return "sg-badge sg-badge-cyan";
    case PipelineJobStatus.QUEUED:
      return "sg-badge sg-badge-warning";
    case PipelineJobStatus.CANCELLED:
    default:
      return "sg-badge";
  }
}

/**
 * Renders a single job item with its details and status.
 * @param props - Component props including the job information.
 */
const JobItem = ({ job }: JobItemProps) => {
  // Use database status if available, fallback to pipeline status
  const displayStatus = job.dbStatus || job.status;
  const isActiveJob = job.dbStatus
    ? isActiveStatus(job.dbStatus)
    : job.status === PipelineJobStatus.QUEUED ||
      job.status === PipelineJobStatus.RUNNING;

  // Define state-specific button classes for Alpine toggling
  const defaultStateClasses =
    "sg-button sg-button-ghost min-h-0 px-2 py-1 text-xs";
  const confirmingStateClasses =
    "sg-button sg-button-danger min-h-0 px-2 py-1 text-xs";

  return (
    <div
      id={`job-item-${job.id}`}
      class="sg-row rounded-lg border border-slate-700/70 bg-slate-950/45 p-3"
      data-job-id={job.id}
      x-data="{ jobId: $el.dataset.jobId, confirming: $el.dataset.confirming === 'true', isStopping: false }"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <p class="text-sm font-medium text-white">
            <span safe>{job.library}</span>{" "}
            <VersionBadge version={job.version} />
          </p>

          {/* Timestamps */}
          <div class="text-xs sg-muted mt-1">
            {job.startedAt ? (
              <div>
                Last Indexed:{" "}
                <span safe>{new Date(job.startedAt).toLocaleString()}</span>
              </div>
            ) : null}
          </div>

          {/* Progress bar for active jobs */}
          {job.progress && job.progress.totalPages > 0 && isActiveJob ? (
            <div class="mt-2">
              <ProgressBar progress={job.progress} />
            </div>
          ) : null}

          {/* Error message display */}
          {job.errorMessage || job.error ? (
            <div class="mt-2 rounded-lg border border-rose-500/30 bg-rose-950/40 p-2 text-xs">
              <div class="font-medium text-rose-200 mb-1">
                Error:
              </div>
              <div safe class="text-rose-300">
                {job.errorMessage || job.error}
              </div>
            </div>
          ) : null}
        </div>

        <div class="flex flex-col items-end gap-2 ml-4">
          {/* Status badge */}
          <div class="flex items-center gap-2">
            {job.dbStatus ? (
              <StatusBadge status={job.dbStatus} />
            ) : (
              <span
                class={getPipelineStatusClasses(job.status, Boolean(job.error))}
              >
                {job.status}
              </span>
            )}

            {/* Stop button for active jobs */}
            {isActiveJob && (
              <button
                type="button"
                class="font-medium rounded-lg text-xs p-1 text-center inline-flex items-center transition-colors duration-150 ease-in-out"
                title="Stop this job"
                x-bind:class={`confirming ? '${confirmingStateClasses}' : '${defaultStateClasses}'`}
                x-on:click="
                if (confirming) {
                  isStopping = true;
                  window.confirmationManager.clear($root.id);
                  fetch('/web/jobs/' + jobId + '/cancel', {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' },
                  })
                    .then(r => r.json())
                    .then(() => {
                      confirming = false;
                      isStopping = false;
                      document.dispatchEvent(new CustomEvent('job-list-refresh'));
                    })
                    .catch(() => { isStopping = false; });
                } else {
                  confirming = true;
                  isStopping = false;
                  window.confirmationManager.start($root.id);
                }
              "
                x-bind:disabled="isStopping"
              >
                <span x-show="!confirming && !isStopping">
                  {/* Red Stop Icon */}
                  <svg
                    class="w-4 h-4"
                    aria-hidden="true"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <rect x="5" y="5" width="10" height="10" rx="2" />
                  </svg>
                  <span class="sr-only">Stop job</span>
                </span>
                <span x-show="confirming && !isStopping" class="px-2">
                  Cancel?
                </span>
                <span x-show="isStopping">
                  <LoadingSpinner />
                  <span class="sr-only">Stopping...</span>
                </span>
              </button>
            )}
          </div>
          {job.error ? (
            // Keep the error badge for clarity if an error occurred
            <span class="sg-badge sg-badge-danger">
              Error
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default JobItem;
