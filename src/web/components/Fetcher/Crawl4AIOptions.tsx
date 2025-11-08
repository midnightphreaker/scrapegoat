import Tooltip from "../Tooltip";

/**
 * Options panel for Crawl4AI-specific features
 * 
 * Appears when Crawl4AI fetcher is selected, providing toggles for:
 * - Screenshot capture (viewport or full page)
 * - Media extraction (images, videos, audio)
 * - Link extraction
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
    >
      <h4 class="font-medium text-gray-900 dark:text-white">Crawl4AI Options</h4>

      {/* Screenshot capture toggle */}
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="enableScreenshot"
            x-model="enableScreenshot"
            class="rounded border-gray-300 dark:border-[#3c3c3c] text-primary-500 focus:ring-primary-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">Capture screenshots</span>
          <Tooltip text="Save a PNG screenshot of each page. Useful for visual documentation." />
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
                checked
                class="border-gray-300 dark:border-[#3c3c3c] text-primary-500 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">Viewport</span>
              <Tooltip text="Captures only the visible viewport (faster, smaller file size)" />
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="screenshotMode"
                value="full"
                class="border-gray-300 dark:border-[#3c3c3c] text-primary-500 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">Full page</span>
              <Tooltip text="Captures the entire page by scrolling (slower, larger file size)" />
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
          class="rounded border-gray-300 dark:border-[#3c3c3c] text-primary-500 focus:ring-primary-500"
        />
        <span class="text-sm text-gray-700 dark:text-gray-300">
          Extract media (images, videos, audio)
        </span>
        <Tooltip text="Extract metadata about images, videos, and audio elements found on the page." />
      </label>

      {/* Links extraction toggle */}
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="enableLinks"
          x-model="enableLinks"
          class="rounded border-gray-300 dark:border-[#3c3c3c] text-primary-500 focus:ring-primary-500"
        />
        <span class="text-sm text-gray-700 dark:text-gray-300">Extract links</span>
        <Tooltip text="Extract all hyperlinks from the page with their text and URLs." />
      </label>
    </div>
  );
};

export default Crawl4AIOptions;
