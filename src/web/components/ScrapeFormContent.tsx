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
    <div class="mt-4 p-6 bg-white dark:bg-stone-800 rounded-lg shadow-context7-md border border-stone-200 dark:border-stone-700">
      <h3 class="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-4">
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
        urlError: '',
        urlTouched: false,
        headers: [],
        fetcher: 'auto',
        fetcherHelp: '',
        showAdvanced: false,
        submitting: false,
        hasError: false,
        errorMessage: '',
        errorDetails: '',
        errorTimestamp: '',
        get isValidUrl() {
          return !this.urlError && this.url.trim() !== '';
        },
        isValidUrl(urlString) {
          if (!urlString || urlString.trim() === '') {
            return { valid: false, error: 'URL is required' };
          }

          try {
            const url = new URL(urlString);
            const supportedProtocols = ['http:', 'https:', 'file:'];

            if (!supportedProtocols.includes(url.protocol)) {
              return {
                valid: false,
                error: `Unsupported protocol. Only HTTP, HTTPS, and FILE are allowed (found: ${url.protocol.replace(':', '')})`
              };
            }

            if (url.protocol === 'file:') {
              if (!url.pathname) {
                return { valid: false, error: 'Invalid file:// URL: no path specified' };
              }
              if (url.hostname !== '' && url.hostname !== 'localhost') {
                return { valid: false, error: 'Invalid file:// URL: hostname must be empty or localhost' };
              }
            }

            return { valid: true, error: '' };
          } catch (e) {
            return { valid: false, error: 'Invalid URL format' };
          }
        },
        checkUrlPath() {
          try {
            const url = new URL(this.url);
            this.hasPath = url.pathname !== '/' && url.pathname !== '';
          } catch (e) {
            this.hasPath = false;
          }
        },
        validateUrl() {
          this.urlTouched = true;
          const result = this.isValidUrl(this.url);
          this.urlError = result.error;
          this.checkUrlPath();
        },
        updateFetcherHelp() {
          const helps = {
            auto: 'Automatically selects the best fetcher for the URL',
            http: 'Fast HTTP-only fetching, no JavaScript execution',
            crawl4ai: 'AI-optimized markdown with optional screenshots and media'
          };
          this.fetcherHelp = helps[this.fetcher] || '';
        },
        clearError() {
          this.hasError = false;
          this.errorMessage = '';
          this.errorDetails = '';
          this.errorTimestamp = '';
        },
        tryAgain() {
          this.clearError();
          const form = document.querySelector('form[htmx-post]');
          if (form && htmx) {
            htmx.trigger(form, 'submit');
          }
        },
        showError(message, details) {
          this.hasError = true;
          this.errorMessage = message || 'An unexpected error occurred';
          this.errorDetails = details || '';
          this.errorTimestamp = new Date().toLocaleString();
        }
      }"
      x-init="updateFetcherHelp()"
      >
        {/* === ALWAYS VISIBLE FIELDS === */}

        {/* URL Field */}
        <div x-bind:class="submitting ? 'opacity-50 cursor-not-allowed' : ''">
          <div class="flex items-center mb-2">
            <label
              for="url"
              class="block text-sm font-medium text-stone-800 dark:text-stone-100"
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
            x-on:input="validateUrl"
            x-on:paste="$nextTick(() => validateUrl())"
            x-on:blur="validateUrl"
            x-bind:disabled="submitting"
            x-bind:class="{
              'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500': urlTouched && urlError,
              'border-stone-300 dark:border-stone-600 focus:ring-primary-600 focus:border-primary-600': !urlTouched || !urlError
            }"
            class="block w-full px-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="https://docs.example.com"
          />
          {/* URL Error Message */}
          <div
            x-show="urlTouched && urlError"
            x-cloak
            x-transition:enter="transition ease-out duration-150"
            x-transition:enter-start="opacity-0 transform -translate-y-2"
            x-transition:enter-end="opacity-100 transform translate-y-0"
            class="mt-2 text-sm text-red-600 dark:text-red-400 flex items-start gap-2"
          >
            <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <span x-text="urlError"></span>
          </div>
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
        <div x-bind:class="submitting ? 'opacity-50 cursor-not-allowed' : ''">
          <div class="flex items-center mb-2">
            <label
              for="library"
              class="block text-sm font-medium text-stone-800 dark:text-stone-100"
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
            x-bind:disabled="submitting"
            class="block w-full px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="react"
          />
        </div>

        {/* Version Field */}
        <div x-bind:class="submitting ? 'opacity-50 cursor-not-allowed' : ''">
          <div class="flex items-center mb-2">
            <label
              for="version"
              class="block text-sm font-medium text-stone-800 dark:text-stone-100"
            >
              Version (optional)
            </label>
            <Tooltip text="Specify the version of the library documentation you're indexing. This allows for version-specific searches." />
          </div>
          <input
            type="text"
            name="version"
            id="version"
            x-bind:disabled="submitting"
            class="block w-full max-w-sm px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="18.2.0"
          />
        </div>

        {/* === ADVANCED OPTIONS (COLLAPSIBLE) === */}
        <div class="border-t border-stone-200 dark:border-stone-700 pt-4" x-bind:class="submitting ? 'opacity-50 cursor-not-allowed' : ''">
          {/* Advanced Options Toggle Button */}
          <button
            type="button"
            x-on:click="showAdvanced = !showAdvanced"
            x-bind:disabled="submitting"
            x-bind:aria-expanded="showAdvanced"
            aria-controls="advanced-options-panel"
            class="flex items-center gap-2 w-full text-left text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              x-bind:class="{'rotate-180': showAdvanced}"
              class="w-5 h-5 transition-transform duration-150 ease-in-out text-stone-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
            <span>Advanced Options</span>
          </button>

          {/* Collapsible Panel */}
          <div
            id="advanced-options-panel"
            x-show="showAdvanced"
            x-transition:enter="transition ease-out duration-150"
            x-transition:enter-start="opacity-0 -translate-y-2"
            x-transition:enter-end="opacity-100 translate-y-0"
            x-transition:leave="transition ease-in duration-150"
            x-transition:leave-start="opacity-100 translate-y-0"
            x-transition:leave-end="opacity-0 -translate-y-2"
            x-cloak
            role="region"
            aria-labelledby="advanced-options-heading"
            class="mt-4 space-y-4 p-4 bg-stone-50 dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700"
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
                  class="block text-sm font-medium text-stone-800 dark:text-stone-100"
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
                x-bind:disabled="submitting"
                class="block w-full max-w-sm px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Max Depth */}
            <div>
              <div class="flex items-center mb-2">
                <label
                  for="maxDepth"
                  class="block text-sm font-medium text-stone-800 dark:text-stone-100"
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
                x-bind:disabled="submitting"
                class="block w-full max-w-sm px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Scope */}
            <div>
              <div class="flex items-center mb-2">
                <label
                  for="scope"
                  class="block text-sm font-medium text-stone-800 dark:text-stone-100"
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
                x-bind:disabled="submitting"
                class="block w-full max-w-sm px-3 py-2 text-sm border border-stone-200 dark:border-stone-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  class="block text-sm font-medium text-stone-800 dark:text-stone-100"
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
                x-bind:disabled="submitting"
                class="block w-full max-w-sm px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 transition-colors duration-150 font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              ></textarea>
            </div>

            {/* Exclude Patterns */}
            <div>
              <div class="flex items-center mb-2">
                <label
                  for="excludePatterns"
                  class="block text-sm font-medium text-stone-800 dark:text-stone-100"
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
                x-bind:disabled="submitting"
                class="block w-full max-w-sm px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 transition-colors duration-150 font-mono text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {defaultExcludePatternsText}
              </textarea>
              <p class="mt-1 text-xs text-stone-500 dark:text-stone-400">
                Default patterns are pre-filled. Edit to customize or clear to
                exclude nothing.
              </p>
            </div>

            {/* Custom HTTP Headers */}
            <div>
              <div class="flex items-center mb-2">
                <label class="block text-sm font-medium text-stone-800 dark:text-stone-100">
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
                      class="w-1/3 px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Header Name"
                      x-model="header.name"
                      x-bind:disabled="submitting"
                      required
                    />
                    <span class="text-stone-500 dark:text-stone-400 flex items-center">:</span>
                    <input
                      type="text"
                      class="w-1/2 px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-xl bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Header Value"
                      x-model="header.value"
                      x-bind:disabled="submitting"
                      required
                    />
                    <button
                      type="button"
                      class="px-3 py-2 text-red-600 hover:text-red-700 text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      x-on:click="headers.splice(idx, 1)"
                      x-bind:disabled="submitting"
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
                  class="mt-2 px-4 py-2 bg-transparent border border-primary-600 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  x-on:click="headers.push({ name: '', value: '' })"
                  x-bind:disabled="submitting"
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
                x-bind:disabled="submitting"
                class="h-4 w-4 text-primary-600 focus:ring-primary-600 border-stone-300 dark:border-stone-600 rounded bg-white dark:bg-stone-900 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label
                for="followRedirects"
                class="ml-2 block text-sm text-stone-800 dark:text-stone-100"
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
                x-bind:disabled="submitting"
                class="h-4 w-4 text-primary-600 focus:ring-primary-600 border-stone-300 dark:border-stone-600 rounded bg-white dark:bg-stone-900 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label
                for="ignoreErrors"
                class="ml-2 block text-sm text-stone-800 dark:text-stone-100"
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
            x-bind:disabled="!isValidUrl || submitting"
            x-bind:class="(!isValidUrl || submitting) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-700'"
            class="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Spinner Icon - shows when submitting */}
            <svg
              x-show="submitting"
              x-cloak
              class="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>

            {/* Button Text */}
            <span x-show="!submitting">Queue Job</span>
            <span x-show="submitting" x-cloak>Processing...</span>
          </button>
        </div>
      </form>

      {/* Error Recovery Display - Shows after failed scrape */}
      <div
        id="error-alert"
        x-show="hasError"
        x-cloak
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        x-transition:enter="transition ease-out duration-200"
        x-transition:enter-start="opacity-0 transform translate-y-2"
        x-transition:enter-end="opacity-100 transform translate-y-0"
        class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
      >
        <div class="flex items-start gap-3">
          {/* Error Icon */}
          <div class="flex-shrink-0">
            <svg
              class="h-5 w-5 text-red-600 dark:text-red-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
          </div>

          {/* Error Content */}
          <div class="flex-1">
            <h4 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
              Scrape Job Failed
            </h4>
            <p class="text-sm text-red-700 dark:text-red-300 mb-2" x-text="errorMessage"></p>

            {/* Error Details (collapsible) */}
            <div x-show="errorDetails" class="mt-3">
              <details class="text-xs">
                <summary class="cursor-pointer text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium mb-2">
                  View Error Details
                </summary>
                <pre
                  class="mt-2 p-3 bg-red-100 dark:bg-red-950/50 rounded border border-red-200 dark:border-red-800 overflow-x-auto text-red-900 dark:text-red-200"
                  x-text="errorDetails"
                ></pre>
              </details>
            </div>

            {/* Timestamp */}
            <p class="text-xs text-red-600 dark:text-red-400 mt-2" x-text="'Error occurred at: ' + errorTimestamp"></p>

            {/* Action Buttons */}
            <div class="mt-3 flex gap-2">
              <button
                type="button"
                x-on:click="tryAgain()"
                x-bind:disabled="submitting"
                x-bind:class="submitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700'"
                class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-150 flex items-center gap-2"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span x-show="!submitting">Try Again</span>
                <span x-show="submitting">Retrying...</span>
              </button>
              <button
                type="button"
                x-on:click="clearError()"
                class="px-4 py-2 bg-transparent border border-red-600 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-150"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Target div for HTMX response */}
      <div id="job-response" class="mt-4 text-sm"></div>

      {/* Script to handle HTMX error responses and AlpineJS integration */}
      <script>
        {`
          // Store Alpine component reference for error handling
          let scrapeFormAlpine = null;

          document.addEventListener('alpine:init', () => {
            // Get reference to Alpine component when it initializes
            setTimeout(() => {
              const form = document.querySelector('form[htmx-post]');
              if (form && form._x_dataStack) {
                scrapeFormAlpine = form._x_dataStack[0];
              }
            }, 100);
          });

          // Handle HTMX before-request to set submitting state
          document.addEventListener('htmx:beforeRequest', function(evt) {
            const form = document.querySelector('form[htmx-post]');
            if (form && evt.detail.target === form) {
              const alpine = form._x_dataStack && form._x_dataStack[0];
              if (alpine) {
                alpine.submitting = true;
              }
            }
          });

          // Handle HTMX after-request to clear submitting state
          document.addEventListener('htmx:afterRequest', function(evt) {
            const form = document.querySelector('form[htmx-post]');
            if (form && evt.detail.target === form) {
              const alpine = form._x_dataStack && form._x_dataStack[0];
              if (alpine) {
                alpine.submitting = false;
              }
            }
          });

          // Handle HTMX request error
          document.addEventListener('htmx:requestError', function(evt) {
            const form = document.querySelector('form[htmx-post]');
            if (form && evt.detail.target === form) {
              const alpine = form._x_dataStack && form._x_dataStack[0];
              if (alpine) {
                alpine.submitting = false;
              }
            }
          });

          // Enhanced error handler for HTMX responses
          document.addEventListener('htmx:responseError', function(evt) {
            console.error('HTMX response error:', evt);

            // Try to extract error information from the response
            let errorMessage = 'An unexpected error occurred';
            let errorDetails = '';

            if (evt.detail.xhr) {
              const xhr = evt.detail.xhr;

              // Try to parse JSON error response
              try {
                const contentType = xhr.getResponseHeader('content-type');
                if (contentType && contentType.includes('application/json')) {
                  const errorData = JSON.parse(xhr.response);
                  errorMessage = errorData.error || errorData.message || errorMessage;
                  errorDetails = errorData.details || errorData.stack || JSON.stringify(errorData, null, 2);
                } else {
                  // HTML or text response
                  errorMessage = 'Request failed. Please try again.';
                  errorDetails = xhr.responseText || xhr.statusText || 'Unknown error';

                  // Try to extract a meaningful error message from HTML
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = xhr.response;
                  const errorElement = tempDiv.querySelector('[class*="error"], [class*="alert"]');
                  if (errorElement) {
                    errorMessage = errorElement.textContent.trim();
                  }
                }
              } catch (parseError) {
                // If parsing fails, use raw response
                errorDetails = xhr.responseText || xhr.statusText || 'No error details available';
              }

              // Update Alpine component error state
              const form = document.querySelector('form[htmx-post]');
              if (form && form._x_dataStack) {
                const alpine = form._x_dataStack[0];
                if (alpine && typeof alpine.showError === 'function') {
                  alpine.showError(errorMessage, errorDetails);
                }
              }
            }

            // Display error in job-response div for backwards compatibility
            const responseDiv = document.getElementById('job-response');
            if (responseDiv) {
              responseDiv.innerHTML = \`
                <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p class="text-sm text-red-800 dark:text-red-200 font-medium">\${errorMessage}</p>
                </div>
              \`;
            }
          });

          // Clear error on successful response
          document.addEventListener('htmx:afterRequest', function(evt) {
            if (evt.detail.successful) {
              const form = document.querySelector('form[htmx-post]');
              if (form && form._x_dataStack) {
                const alpine = form._x_dataStack[0];
                if (alpine && typeof alpine.clearError === 'function') {
                  alpine.clearError();
                }
              }
            }
          });
        `}
      </script>
    </div>
  );
};

export default ScrapeFormContent;
