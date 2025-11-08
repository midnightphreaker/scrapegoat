import Tooltip from "../Tooltip";

/**
 * Options panel for Crawl4AI-specific features
 *
 * Appears when Crawl4AI fetcher is selected, providing toggles for:
 * - Screenshot capture (viewport or fullpage)
 * - Media extraction (images, videos, audio)
 * - Link extraction
 * - Advanced settings (waitFor, waitForTimeout, customJs, cacheMode, headers)
 */
const Crawl4AIOptions = () => {
  return (
    <div
      x-show="fetcher === 'crawl4ai'"
      x-transition:enter="transition ease-out duration-200"
      x-transition:enter-start="opacity-0 transform -translate-y-2"
      x-transition:enter-end="opacity-100 transform translate-y-0"
      x-cloak
      class="border-l-4 border-pink-500 pl-4 space-y-3 mt-3"
      x-data="{
        enableScreenshot: true,
        enableMedia: true,
        enableLinks: true,
        screenshotMode: 'fullpage',
        cacheMode: 'fresh'
      }"
    >
      <h4 class="font-medium text-gray-900 dark:text-white">Content Enhancement</h4>

      {/* Screenshot capture toggle */}
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="enableScreenshot"
            x-model="enableScreenshot"
            checked
            class="rounded border-gray-300 dark:border-[#3c3c3c] text-primary-500 focus:ring-primary-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">Capture screenshots</span>
          <Tooltip text="Save a PNG screenshot of each page. Useful for visual documentation. (Default: enabled)" />
        </label>

        {/* Screenshot mode selection (shown when screenshot is enabled) */}
        <div
          x-show="enableScreenshot"
          x-transition
          class="ml-6 mt-2 space-y-2"
        >
          <p class="text-xs text-gray-500 dark:text-gray-400">Screenshot mode:</p>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="screenshotMode"
                value="viewport"
                x-model="screenshotMode"
                class="border-gray-300 dark:border-[#3c3c3c] text-primary-500 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">Viewport</span>
              <Tooltip text="Captures only the visible viewport (faster, smaller file size)" />
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="screenshotMode"
                value="fullpage"
                x-model="screenshotMode"
                checked
                class="border-gray-300 dark:border-[#3c3c3c] text-primary-500 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">Full page</span>
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
          class="rounded border-gray-300 dark:border-[#3c3c3c] text-primary-500 focus:ring-primary-500"
        />
        <span class="text-sm text-gray-700 dark:text-gray-300">
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
          class="rounded border-gray-300 dark:border-[#3c3c3c] text-primary-500 focus:ring-primary-500"
        />
        <span class="text-sm text-gray-700 dark:text-gray-300">Extract links</span>
        <Tooltip text="Extract all hyperlinks from the page with their text and URLs. (Default: enabled)" />
      </label>

      {/* Advanced Crawl4AI Settings */}
      <details class="bg-gray-50 dark:bg-[#181818] p-3 rounded-md mt-3">
        <summary class="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
          Advanced Crawl4AI Settings
        </summary>
        <div class="mt-3 space-y-3">
          {/* Wait For Selector */}
          <div>
            <div class="flex items-center">
              <label
                for="crawl4ai_waitFor"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
              class="mt-1 block w-full max-w-md px-2 py-1 border border-gray-300 dark:border-[#3c3c3c] rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-[#181818] text-gray-900 dark:text-white"
            />
          </div>

          {/* Wait For Timeout */}
          <div>
            <div class="flex items-center">
              <label
                for="crawl4ai_waitForTimeout"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
              class="mt-1 block w-full max-w-xs px-2 py-1 border border-gray-300 dark:border-[#3c3c3c] rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-[#181818] text-gray-900 dark:text-white"
            />
          </div>

          {/* Custom JavaScript */}
          <div>
            <div class="flex items-center">
              <label
                for="crawl4ai_customJs"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
              class="mt-1 block w-full max-w-md px-2 py-1 border border-gray-300 dark:border-[#3c3c3c] rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-[#181818] text-gray-900 dark:text-white font-mono text-xs"
            ></textarea>
          </div>

          {/* Cache Mode */}
          <div>
            <div class="flex items-center">
              <label
                for="crawl4ai_cacheMode"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Cache Mode
              </label>
              <Tooltip text="Control Crawl4AI internal caching. 'Fresh' always fetches new content (recommended for documentation). Default: fresh" />
            </div>
            <select
              name="crawl4ai_cacheMode"
              id="crawl4ai_cacheMode"
              x-model="cacheMode"
              class="mt-1 block w-full max-w-xs px-2 py-1 border border-gray-300 dark:border-[#3c3c3c] rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-[#181818] text-gray-900 dark:text-white"
            >
              <option value="fresh" selected>Fresh (always fetch new)</option>
              <option value="enabled">Enabled (use cache)</option>
              <option value="disabled">Disabled</option>
              <option value="bypass">Bypass</option>
            </select>
          </div>

          {/* Custom Headers */}
          <div>
            <div class="flex items-center">
              <label
                for="crawl4ai_headers"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
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
              class="mt-1 block w-full max-w-md px-2 py-1 border border-gray-300 dark:border-[#3c3c3c] rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-[#181818] text-gray-900 dark:text-white font-mono text-xs"
            ></textarea>
          </div>
        </div>
      </details>
    </div>
  );
};

export default Crawl4AIOptions;
