import type { JobInfo } from "../../tools/GetJobInfoTool";
import JobItem from "./JobItem";

/**
 * Props for the JobList component.
 */
interface JobListProps {
  jobs: JobInfo[];
}

/**
 * Renders a list of JobItem components or a message if the list is empty.
 * Also renders an out-of-band swap for the "Clear Completed Jobs" button state.
 * @param props - Component props including the array of jobs.
 */
const JobList = ({ jobs }: JobListProps) => {
  const hasJobs = jobs.length > 0;

  return (
    <>
      <div id="job-list" class="space-y-2 animate-[fadeSlideIn_0.2s_ease-out]">
        {hasJobs ? (
          jobs.map((job) => <JobItem job={job} />)
        ) : (
          <div class="rounded-lg border border-dashed border-slate-700/70 bg-slate-950/40 px-4 py-6 text-center text-sm sg-muted">
            No pending jobs.
          </div>
        )}
      </div>
      {/* Out-of-band swap for the Clear Completed Jobs button */}
      <button
        id="clear-completed-btn"
        hx-swap-oob="true"
        type="button"
        class={
          hasJobs
            ? "sg-button sg-button-secondary px-3 py-1.5 text-xs"
            : "sg-button sg-button-ghost px-3 py-1.5 text-xs"
        }
        title="Clear all completed, cancelled, and failed jobs"
        hx-post="/web/jobs/clear-completed"
        hx-trigger="click"
        hx-on="htmx:afterRequest: document.dispatchEvent(new Event('job-list-refresh'))"
        hx-swap="none"
        disabled={!hasJobs}
      >
        Clear Completed Jobs
      </button>
    </>
  );
};

export default JobList;
