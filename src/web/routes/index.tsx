import type { FastifyInstance } from "fastify";
import AddJobButton from "../components/AddJobButton";
import Layout from "../components/Layout";

/**
 * Registers the root route that serves the main HTML page.
 * @param server - The Fastify instance.
 * @param externalWorkerUrl - Optional URL for external worker service.
 */
export function registerIndexRoute(
  server: FastifyInstance,
  externalWorkerUrl?: string
) {
  server.get("/", async (_, reply) => {
    reply.type("text/html");

    // Determine if we're using a remote worker
    const useRemoteWorker = Boolean(externalWorkerUrl);
    const trpcUrl = externalWorkerUrl ? `${externalWorkerUrl}/api` : undefined;

    // Use the Layout component and define the main content within it
    return (
      "<!DOCTYPE html>" +
      (
        <Layout
          title="ScrapeGoat"
          eventClientConfig={{
            useRemoteWorker,
            trpcUrl,
          }}
        >
          {/* Analytics Section */}
          <div class="space-y-5">
            <div
              id="analytics-stats"
              hx-get="/web/stats"
              hx-trigger="load, library-change from:body"
              hx-swap="morph:innerHTML"
            >
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 animate-pulse">
                <div class="sg-card h-20" />
                <div class="sg-card h-20" />
                <div class="sg-card h-20" />
              </div>
            </div>

            {/* Job Queue Section */}
            <section class="sg-panel">
              <div class="mb-3 flex items-center justify-between gap-3">
                <h2 class="sg-section-title">Job Queue</h2>
                <button
                  id="clear-completed-btn"
                  type="button"
                  class="sg-button sg-button-ghost px-3 py-1.5 text-xs"
                  title="Clear all completed, cancelled, and failed jobs"
                  hx-post="/web/jobs/clear-completed"
                  hx-trigger="click"
                  hx-on="htmx:afterRequest: document.dispatchEvent(new Event('job-list-refresh'))"
                  hx-swap="none"
                  disabled
                >
                  Clear Completed Jobs
                </button>
              </div>
              {/* Container for the job list, loaded via HTMX and updated via SSE */}
              <div
                id="job-queue"
                hx-get="/web/jobs"
                hx-trigger="load, job-status-change from:body, job-progress from:body, job-list-change from:body, job-list-refresh from:body"
                hx-swap="morph:innerHTML"
              >
                {/* Initial loading state */}
                <div class="animate-pulse space-y-2">
                  <div class="h-3 w-48 rounded-full bg-white/10" />
                  <div class="h-3 w-full rounded-full bg-white/10" />
                  <div class="h-3 w-5/6 rounded-full bg-white/10" />
                </div>
              </div>
            </section>

            {/* Add New Job Section */}
            <section>
              {/* Button to reveal the scrape form, loaded via HTMX */}
              <div id="addJobForm">
                <AddJobButton />
              </div>
            </section>

            {/* Indexed Documentation Section */}
            <section class="space-y-3">
              <h2 class="sg-section-title">Indexed Documentation</h2>
              <div
                id="indexed-docs"
                hx-get="/web/libraries"
                hx-trigger="load, library-change from:body"
                hx-swap="morph:innerHTML"
              >
                <div class="animate-pulse space-y-2">
                  <div class="h-3 w-48 rounded-full bg-white/10" />
                  <div class="h-3 w-full rounded-full bg-white/10" />
                  <div class="h-3 w-5/6 rounded-full bg-white/10" />
                </div>
              </div>
            </section>
          </div>
        </Layout>
      )
    );
  });
}
