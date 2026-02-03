import type { FastifyInstance } from "fastify";
import Layout from "../components/Layout"; // Import the Layout component
import { MimeType } from "../../utils/constants";

/**
 * Registers the root route that serves the main HTML page.
 * @param server - The Fastify instance.
 */
export function registerIndexRoute(server: FastifyInstance) {
  server.get("/", async (_, reply) => {
    reply.type(MimeType.HTML);
    // Use the Layout component and define the main content within it
    return (
      "<!DOCTYPE html>" +
      (
        <Layout title="ScrapeGoat">
          {/* Job Queue Section */}
          <section class="mb-6 p-6 bg-white dark:bg-stone-800 rounded-lg shadow-sm border border-gray-200 dark:border-stone-700">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-gray-800 dark:text-stone-100">
                Job Queue
              </h2>
              <button
                type="button"
                class="text-sm px-4 py-2 text-gray-800 dark:text-stone-100 bg-stone-50 dark:bg-stone-700 border border-gray-200 dark:border-stone-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-600 focus:ring-2 focus:outline-none focus:ring-primary-600 transition-colors duration-150 font-medium"
                title="Clear all completed, cancelled, and failed jobs"
                hx-post="/web/jobs/clear-completed"
                hx-trigger="click"
                hx-on="htmx:afterRequest: document.dispatchEvent(new Event('job-list-refresh'))"
                hx-swap="none"
              >
                Clear Completed Jobs
              </button>
            </div>
            {/* Container for the job list, loaded via HTMX */}
            <div id="job-queue" hx-get="/web/jobs" hx-trigger="load, every 1s">
              {/* Initial loading state */}
              <div class="animate-pulse">
                <div class="h-[0.8em] bg-gray-200 rounded-full w-48 mb-4" />
                <div class="h-[0.8em] bg-gray-200 rounded-full w-full mb-2.5" />
                <div class="h-[0.8em] bg-gray-200 rounded-full w-full mb-2.5" />
              </div>
            </div>
          </section>
          {/* Add New Job Section */}
          <section class="mb-8">
            {/* Container for the add job form, loaded via HTMX */}
            <div id="addJobForm" hx-get="/web/jobs/new" hx-trigger="load">
              {/* Initial loading state (optional, could just be empty) */}
              <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200 animate-pulse">
                <div class="h-6 bg-gray-200 rounded-full w-1/3 mb-4" />
                <div class="h-[0.8em] bg-gray-200 rounded-full w-full mb-2.5" />
                <div class="h-[0.8em] bg-gray-200 rounded-full w-full mb-2.5" />
              </div>
            </div>
          </section>
          {/* Indexed Documentation Section */}
          <div>
            <h2 class="text-xl font-semibold mb-4 text-white">
              Indexed Documentation
            </h2>
            <div
              id="indexed-docs"
              hx-get="/web/libraries"
              hx-trigger="load, every 10s"
            >
              <div class="animate-pulse">
                <div class="h-[0.8em] bg-gray-200 rounded-full w-48 mb-4" />
                <div class="h-[0.8em] bg-gray-200 rounded-full w-full mb-2.5" />
                <div class="h-[0.8em] bg-gray-200 rounded-full w-full mb-2.5" />
              </div>
            </div>
          </div>
        </Layout>
      )
    );
  });
}
