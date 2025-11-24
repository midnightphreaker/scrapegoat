import Alert from "./Alert";
import Tooltip from "./Tooltip";
import FetcherSelector from "./Fetcher/FetcherSelector";
import Crawl4AIOptions from "./Fetcher/Crawl4AIOptions";

interface ScrapeFormContentProps {
  defaultExcludePatterns?: string[];
}

/**
 * Renders the form fields for queuing a new scrape job.
 * Includes basic fields (URL, Library, Version) and collapsible advanced options.
 * Updated with Context7 design system.
 */
const ScrapeFormContent = ({
  defaultExcludePatterns,
}: ScrapeFormContentProps) => {
  // Format default patterns for display in textarea (one per line)
  const defaultExcludePatternsText = defaultExcludePatterns?.join("\n") || "";

  return (
    <div class="mt-4 p-6 bg-white rounded-lg shadow-context7-md border border-stone-200">
      <h3 class="text-xl font-semibold text-stone-800 mb-4">
        Queue New Scrape Job
      </h3>
      <form
        hx-post="/web/jobs/scrape"
        hx-target="#job-response"
        hx-swap="innerHTML"
        class="space-y-4"
        x-data="{
        url: '',
        hasPath: false,
        headers: [],
        fetcher: 'auto',
        fetcherHelp: '',
        showAdvanced: false,
        checkUrlPath() {
          try {
            const url = new URL(this.url);
            this.hasPath = url.pathname !== '/' && url.pathname !== '';
          } catch (e) {
            this.hasPath = false;
          }
        },
        updateFetcherHelp() {
          const helps = {
            auto: 'Automatically selects the best fetcher for the URL',
            http: 'Fast HTTP-only fetching, no JavaScript execution',
            crawl4ai: 'AI-optimized markdown with optional screenshots and media'
          };
          this.fetcherHelp = helps[this.fetcher] || '';
        }
      }"
      x-init="updateFetcherHelp()"
      >
        {/* === ALWAYS VISIBLE FIELDS === */}

        {/* URL Field */}
        <div>
          <div class="flex items-center mb-2">
            <label
              for="url"
              class="block text-sm font-medium text-stone-800"
            >
              URL
            </label>
            <Tooltip
              text={
                <div>
                  <p>Enter the URL of the documentation you want to scrape.</p>
                  <p class="mt-2">
                    For local files/folders, you must use the{" "}
                    <code>file://</code> prefix and ensure the path is
                    accessible to the server.
                  </p>
                  <p class="mt-2">
                    If running in Docker, <b>mount the folder</b> (see README
                    for details).
                  </p>
                </div>
              }
            />
          </div>
          <input
            type="url"
            name="url"
            id="url"
            required
            x-model="url"
            x-on:input="checkUrlPath"
            x-on:paste="$nextTick(() => checkUrlPath())"
            class="block w-full px-3 py-2 border border-stone-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white text-stone-800 transition-colors duration-150"
            placeholder="https://docs.example.com"
          />
          <div
            x-show="hasPath && !(url.startsWith('file://'))"
            x-cloak
            x-transition:enter="transition ease-out duration-150"
            x-transition:enter-start="opacity-0 transform -translate-y-2"
            x-transition:enter-end="opacity-100 transform translate-y-0"
            class="mt-2"
          >
            <Alert
              type="info"
              message="By default, only subpages under the given URL will be scraped. To scrape the whole website, adjust the 'Scope' option in Advanced Options."
            />
          </div>
        </div>

        {/* Library Name Field */}
        <div>
          <div class="flex items-center mb-2">
            <label
              for="library"
              class="block text-sm font-medium text-stone-800"
            >
              Library Name
            </label>
            <Tooltip text="The name of the library you're documenting. This will be used when searching." />
          </div>
          <input
            type="text"
            name="library"
            id="library"
            required
            class="block w-full px-3 py-2 border border-stone-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white text-stone-800 transition-colors duration-150"
            placeholder="react"
          />
        </div>

        {/* Version Field */}
        <div>
          <div class="flex items-center mb-2">
            <label
              for="version"
              class="block text-sm font-medium text-stone-800"
            >
              Version (optional)
            </label>
            <Tooltip text="Specify the version of the library documentation you're indexing. This allows for version-specific searches." />
          </div>
          <input
            type="text"
            name="version"
            id="version"
            class="block w-full max-w-sm px-3 py-2 border border-stone-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white text-stone-800 transition-colors duration-150"
            placeholder="18.2.0"
          />
        </div>

        {/* === ADVANCED OPTIONS (COLLAPSIBLE) === */}
        <div class="border-t border-stone-200 pt-4">
          {/* Advanced Options Toggle Button */}
          <button
            type="button"
            x-on:click="showAdvanced = !showAdvanced"
            class="flex items-center gap-2 w-full text-left text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors duration-150"
          >
            <svg
              x-bind:class="{'rotate-180': showAdvanced}"
              class="w-5 h-5 transition-transform duration-150 ease-in-out text-stone-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
            <span>Advanced Options</span>
          </button>

          {/* Collapsible Panel */}
          <div
            x-show="showAdvanced"
            x-transition:enter="transition ease-out duration-150"
            x-transition:enter-start="opacity-0 -translate-y-2"
            x-transition:enter-end="opacity-100 translate-y-0"
            x-transition:leave="transition ease-in duration-150"
            x-transition:leave-start="opacity-100 translate-y-0"
            x-transition:leave-end="opacity-0 -translate-y-2"
            x-cloak
            class="mt-4 space-y-4 p-4 bg-stone-50 rounded-lg border border-stone-200"
          >
            {/* Fetcher Selection - NOW INSIDE Advanced Options */}
            <FetcherSelector />

            {/* Crawl4AI Options - NOW INSIDE Advanced Options */}
            <Crawl4AIOptions />

            {/* Max Pages */}
            <div>
              <div class="flex items-center mb-2">
                <label
                  for="maxPages"
                  class="block text-sm font-medium text-stone-800"
                >
                  Max Pages
                </label>
                <Tooltip text="The maximum number of pages to scrape. Default is 1000. Setting this too high may result in longer processing times." />
              </div>
              <input
                type="number"
                name="maxPages"
                id="maxPages"
                min="1"
                placeholder="1000"
                class="block w-full max-w-sm px-3 py-2 border border-stone-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white text-stone-800 transition-colors duration-150"
              />
            </div>

            {/* Max Depth */}
            <div>
              <div class="flex items-center mb-2">
                <label
                  for="maxDepth"
                  class="block text-sm font-medium text-stone-800"
                >
                  Max Depth
                </label>
                <Tooltip text="How many links deep the scraper should follow. Default is 3. Higher values capture more content but increase processing time." />
              </div>
              <input
                type="number"
                name="maxDepth"
                id="maxDepth"
                min="0"
                placeholder="3"
                class="block w-full max-w-sm px-3 py-2 border border-stone-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white text-stone-800 transition-colors duration-150"
              />
            </div>

            {/* Scope */}
            <div>
              <div class="flex items-center mb-2">
                <label
                  for="scope"
                  class="block text-sm font-medium text-stone-800"
                >
                  Scope
                </label>
                <Tooltip
                  text={
                    <div>
                      Controls which pages are scraped:
                      <ul class="list-disc pl-5">
                        <li>
                          'Subpages' only scrapes under the given URL path,
                        </li>
                        <li>
                          'Hostname' scrapes all content on the same host (e.g.,
                          all of docs.example.com),
                        </li>
                        <li>
                          'Domain' scrapes all content on the domain and its
                          subdomains (e.g., all of example.com).
                        </li>
                      </ul>
                    </div>
                  }
                />
              </div>
              <select
                name="scope"
                id="scope"
                class="block w-full max-w-sm px-3 py-2 text-sm border border-stone-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 bg-white text-stone-800 transition-colors duration-150"
              >
                <option value="subpages" selected>
                  Subpages (Default)
                </option>
                <option value="hostname">Hostname</option>
                <option value="domain">Domain</option>
              </select>
            </div>

            {/* Include Patterns */}
            <div>
              <div class="flex items-center mb-2">
                <label
                  for="includePatterns"
                  class="block text-sm font-medium text-stone-800"
                >
                  Include Patterns
                </label>
                <Tooltip text="Glob or regex patterns for URLs to include. One per line or comma-separated. Regex patterns must be wrapped in slashes, e.g. /pattern/." />
              </div>
              <textarea
                name="includePatterns"
                id="includePatterns"
                rows="2"
                placeholder="e.g. docs/* or /api\/v1.*/"
                class="block w-full max-w-sm px-3 py-2 border border-stone-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white text-stone-800 transition-colors duration-150 font-mono"
              ></textarea>
            </div>

            {/* Exclude Patterns */}
            <div>
              <div class="flex items-center mb-2">
                <label
                  for="excludePatterns"
                  class="block text-sm font-medium text-stone-800"
                >
                  Exclude Patterns
                </label>
                <Tooltip text="Glob or regex patterns for URLs to exclude. One per line or comma-separated. Exclude takes precedence over include. Regex patterns must be wrapped in slashes, e.g. /pattern/. Edit or clear this field to customize exclusions." />
              </div>
              <textarea
                name="excludePatterns"
                id="excludePatterns"
                rows="5"
                safe
                class="block w-full max-w-sm px-3 py-2 border border-stone-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white text-stone-800 transition-colors duration-150 font-mono text-xs"
              >
                {defaultExcludePatternsText}
              </textarea>
              <p class="mt-1 text-xs text-stone-500">
                Default patterns are pre-filled. Edit to customize or clear to
                exclude nothing.
              </p>
            </div>

            {/* Custom HTTP Headers */}
            <div>
              <div class="flex items-center mb-2">
                <label class="block text-sm font-medium text-stone-800">
                  Custom HTTP Headers
                </label>
                <Tooltip text="Add custom HTTP headers (e.g., for authentication). These will be sent with every HTTP request." />
              </div>
              <div>
                {/* AlpineJS dynamic header rows */}
                <template x-for="(header, idx) in headers">
                  <div class="flex space-x-2 mb-2">
                    <input
                      type="text"
                      class="w-1/3 px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-800 text-sm transition-colors duration-150"
                      placeholder="Header Name"
                      x-model="header.name"
                      required
                    />
                    <span class="text-stone-500 flex items-center">:</span>
                    <input
                      type="text"
                      class="w-1/2 px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-800 text-sm transition-colors duration-150"
                      placeholder="Header Value"
                      x-model="header.value"
                      required
                    />
                    <button
                      type="button"
                      class="px-3 py-2 text-red-600 hover:text-red-700 text-sm font-medium transition-colors duration-150"
                      x-on:click="headers.splice(idx, 1)"
                    >
                      Remove
                    </button>
                    <input
                      type="hidden"
                      name="header[]"
                      x-bind:value="header.name && header.value ? header.name + ':' + header.value : ''"
                    />
                  </div>
                </template>
                <button
                  type="button"
                  class="mt-2 px-4 py-2 bg-transparent border border-primary-600 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors duration-150"
                  x-on:click="headers.push({ name: '', value: '' })"
                >
                  + Add Header
                </button>
              </div>
            </div>

            {/* Follow Redirects */}
            <div class="flex items-center">
              <input
                id="followRedirects"
                name="followRedirects"
                type="checkbox"
                checked
                class="h-4 w-4 text-primary-600 focus:ring-primary-600 border-stone-300 rounded bg-white transition-colors duration-150"
              />
              <label
                for="followRedirects"
                class="ml-2 block text-sm text-stone-800"
              >
                Follow Redirects
              </label>
            </div>

            {/* Ignore Errors */}
            <div class="flex items-center">
              <input
                id="ignoreErrors"
                name="ignoreErrors"
                type="checkbox"
                checked
                class="h-4 w-4 text-primary-600 focus:ring-primary-600 border-stone-300 rounded bg-white transition-colors duration-150"
              />
              <label
                for="ignoreErrors"
                class="ml-2 block text-sm text-stone-800"
              >
                Ignore Errors During Scraping
              </label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div class="pt-2">
          <button
            type="submit"
            class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 transition-colors duration-150"
          >
            Queue Job
          </button>
        </div>
      </form>
      {/* Target div for HTMX response */}
      <div id="job-response" class="mt-4 text-sm"></div>

      {/* Script to handle HTMX error responses */}
      <script>
        {`
          document.addEventListener('htmx:responseError', function(evt) {
            // Handle error responses from the form submission
            if (evt.detail.xhr && evt.detail.xhr.response) {
              const responseDiv = document.getElementById('job-response');
              if (responseDiv) {
                responseDiv.innerHTML = evt.detail.xhr.response;
              }
            }
          });
        `}
      </script>
    </div>
  );
};

export default ScrapeFormContent;
