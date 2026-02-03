import Tooltip from "../Tooltip";

/**
 * Options panel for Crawl4AI-specific features
 *
 * Appears when Crawl4AI fetcher is selected, providing toggles for:
 * - Screenshot capture (viewport or fullpage)
 * - Media extraction (images, videos, audio)
 * - Link extraction
 * - Advanced settings (waitFor, waitForTimeout, customJs, cacheMode, headers, stealthMode)
 */
const Crawl4AIOptions = () => {
  return (
    <div
      x-show="fetcher === 'crawl4ai'"
      x-transition:enter="transition ease-out duration-200"
      x-transition:enter-start="opacity-0 transform -translate-y-2"
      x-transition:enter-end="opacity-100 transform translate-y-0"
      x-cloak
      class="border-l-4 border-primary-500 pl-4 space-y-4 mt-4 pt-4"
      x-data="{
        enableScreenshot: true,
        enableMedia: true,
        enableLinks: true,
        screenshotMode: 'fullpage',
        cacheMode: 'fresh'
      }"
    >
      <h4 class="font-semibold text-stone-800 dark:text-stone-100 mb-3">Crawl4AI Content Enhancement</h4>

      {/* Screenshot capture toggle */}
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="enableScreenshot"
            x-model="enableScreenshot"
            checked
            class="h-4 w-4 rounded border-stone-200 text-primary-600 focus:ring-primary-600 transition-colors duration-150"
          />
          <span class="text-sm text-stone-800 dark:text-stone-100">Capture screenshots</span>
          <Tooltip text="Save a PNG screenshot of each page. Useful for visual documentation. (Default: enabled)" />
        </label>

        {/* Screenshot mode selection (shown when screenshot is enabled) */}
        <div
          x-show="enableScreenshot"
          x-transition
          class="ml-6 mt-2 space-y-2"
        >
          <p class="text-xs text-stone-500 dark:text-stone-400">Screenshot mode:</p>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="screenshotMode"
                value="viewport"
                x-model="screenshotMode"
                class="border-stone-200 text-primary-600 focus:ring-primary-600 transition-colors duration-150"
              />
              <span class="text-sm text-stone-800 dark:text-stone-100">Viewport</span>
              <Tooltip text="Captures only the visible viewport (faster, smaller file size)" />
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="screenshotMode"
                value="fullpage"
                x-model="screenshotMode"
                checked
                class="border-stone-200 text-primary-600 focus:ring-primary-600 transition-colors duration-150"
              />
              <span class="text-sm text-stone-800 dark:text-stone-100">Full page</span>
              <Tooltip text="Captures the entire page by scrolling (slower, larger file size). (Default)" />
            </label>
          </div>
        </div>
      </div>

      {/* Media extraction toggle */}
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="enableMedia"
          x-model="enableMedia"
          checked
          class="h-4 w-4 rounded border-stone-200 text-primary-600 focus:ring-primary-600 transition-colors duration-150"
        />
        <span class="text-sm text-stone-800 dark:text-stone-100">
          Extract media (images, videos, audio)
        </span>
        <Tooltip text="Extract metadata about images, videos, and audio elements found on the page. (Default: enabled)" />
      </label>

      {/* Links extraction toggle */}
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="enableLinks"
          x-model="enableLinks"
          checked
          class="h-4 w-4 rounded border-stone-200 text-primary-600 focus:ring-primary-600 transition-colors duration-150"
        />
        <span class="text-sm text-stone-800 dark:text-stone-100">Extract links</span>
        <Tooltip text="Extract all hyperlinks from the page with their text and URLs. (Default: enabled)" />
      </label>

      {/* Advanced Crawl4AI Settings */}
      <details class="bg-stone-50 dark:bg-stone-700 p-4 rounded-lg mt-4 border border-stone-200 dark:border-stone-600">
        <summary class="cursor-pointer text-sm font-medium text-stone-800 dark:text-stone-100">
          Advanced Crawl4AI Settings
        </summary>
        <div class="mt-3 space-y-3">
          {/* Wait For Selector */}
          <div>
            <div class="flex items-center mb-2">
              <label
                for="crawl4ai_waitFor"
                class="block text-sm font-medium text-stone-800 dark:text-stone-100"
              >
                Wait For Selector
              </label>
              <Tooltip text="CSS selector to wait for before capturing content. Useful for SPAs with dynamic content (e.g., '.content-loaded', '#main-data')." />
            </div>
            <input
              type="text"
              name="crawl4ai_waitFor"
              id="crawl4ai_waitFor"
              placeholder="e.g., .content-loaded"
              class="block w-full max-w-md px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 dark:placeholder-stone-400 transition-colors duration-150"
            />
          </div>

          {/* Wait For Timeout */}
          <div>
            <div class="flex items-center mb-2">
              <label
                for="crawl4ai_waitForTimeout"
                class="block text-sm font-medium text-stone-800 dark:text-stone-100"
              >
                Wait Timeout (ms)
              </label>
              <Tooltip text="Maximum time to wait for dynamic content (0-60000ms). Default: 30000ms (30 seconds)." />
            </div>
            <input
              type="number"
              name="crawl4ai_waitForTimeout"
              id="crawl4ai_waitForTimeout"
              min="0"
              max="60000"
              placeholder="30000"
              class="block w-full max-w-xs px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 dark:placeholder-stone-400 transition-colors duration-150"
            />
          </div>

          {/* Custom JavaScript */}
          <div>
            <div class="flex items-center mb-2">
              <label
                for="crawl4ai_customJs"
                class="block text-sm font-medium text-stone-800 dark:text-stone-100"
              >
                Custom JavaScript
              </label>
              <Tooltip text="JavaScript code to execute before capturing content. Useful for closing popups, triggering interactions, or modifying the DOM." />
            </div>
            <textarea
              name="crawl4ai_customJs"
              id="crawl4ai_customJs"
              rows="3"
              placeholder="e.g., document.querySelector('.cookie-banner')?.remove();"
              class="block w-full max-w-md px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 dark:placeholder-stone-400 font-mono transition-colors duration-150"
            ></textarea>
          </div>

          {/* Cache Mode */}
          <div>
            <div class="flex items-center mb-2">
              <label
                for="crawl4ai_cacheMode"
                class="block text-sm font-medium text-stone-800 dark:text-stone-100"
              >
                Cache Mode
              </label>
              <Tooltip text="Control Crawl4AI internal caching. 'Fresh' always fetches new content (recommended for documentation). Default: fresh" />
            </div>
            <select
              name="crawl4ai_cacheMode"
              id="crawl4ai_cacheMode"
              x-model="cacheMode"
              class="block w-full max-w-xs px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 transition-colors duration-150"
            >
              <option value="fresh" selected>Fresh (always fetch new)</option>
              <option value="enabled">Enabled (use cache)</option>
              <option value="disabled">Disabled</option>
              <option value="bypass">Bypass</option>
            </select>
          </div>

          {/* Custom Headers */}
          <div>
            <div class="flex items-center mb-2">
              <label
                for="crawl4ai_headers"
                class="block text-sm font-medium text-stone-800 dark:text-stone-100"
              >
                Custom Headers (JSON)
              </label>
              <Tooltip text='Custom HTTP headers as JSON object. Example: {"Authorization": "Bearer token", "X-Custom": "value"}' />
            </div>
            <textarea
              name="crawl4ai_headers"
              id="crawl4ai_headers"
              rows="3"
              placeholder='{"Authorization": "Bearer token"}'
              class="block w-full max-w-md px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 dark:placeholder-stone-400 font-mono transition-colors duration-150"
            ></textarea>
          </div>

          {/* Stealth Mode */}
          <div>
            <div class="flex items-center mb-2">
              <label
                for="crawl4ai_stealthMode"
                class="block text-sm font-medium text-stone-800 dark:text-stone-100"
              >
                Stealth Mode
              </label>
              <Tooltip text="Helps avoid bot detection. 'Disabled' is fastest, 'Advanced' provides best anti-detection." />
            </div>
            <select
              name="crawl4ai_stealthMode"
              id="crawl4ai_stealthMode"
              class="block w-full max-w-xs px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 transition-colors duration-150"
            >
              <option value="disabled" selected>Disabled (fastest)</option>
              <option value="basic">Basic (minimal anti-detection)</option>
              <option value="advanced">Advanced (full anti-detection)</option>
            </select>
          </div>
        </div>
      </details>
    </div>
  );
};

export default Crawl4AIOptions;
