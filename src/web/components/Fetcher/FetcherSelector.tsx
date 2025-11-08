import Tooltip from "../Tooltip";

interface FetcherSelectorProps {
  name?: string;
  defaultValue?: string;
}

/**
 * Dropdown selector for choosing content fetcher type
 * 
 * Provides options for auto-detection or explicit fetcher selection:
 * - Auto: Automatically selects the best fetcher (default)
 * - HTTP: Fast HTTP-only fetching
 * - Browser: Full browser with JavaScript support
 * - Crawl4AI: AI-optimized markdown with enhanced features
 */
const FetcherSelector = ({ name = "fetcher", defaultValue = "auto" }: FetcherSelectorProps) => {
  return (
    <div>
      <div class="flex items-center">
        <label
          for={name}
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Content Fetcher
        </label>
        <Tooltip text="Choose how to fetch documentation pages. Auto-detect is recommended for most cases." />
      </div>
      <select
        name={name}
        id={name}
        class="mt-0.5 block w-full px-2 py-1 border border-gray-300 dark:border-[#3c3c3c] rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-[#181818] text-gray-900 dark:text-white"
        x-model="fetcher"
        x-on:change="updateFetcherHelp()"
      >
        <option value="auto" selected={defaultValue === "auto"}>
          Auto-detect (recommended)
        </option>
        <option value="http" selected={defaultValue === "http"}>
          HTTP Fetch (fast)
        </option>
        <option value="browser" selected={defaultValue === "browser"}>
          Browser (JavaScript support)
        </option>
        <option value="crawl4ai" selected={defaultValue === "crawl4ai"}>
          Crawl4AI (AI-optimized)
        </option>
      </select>
      <p
        class="mt-1 text-sm text-gray-500 dark:text-gray-400"
        x-text="fetcherHelp"
        x-show="fetcherHelp"
      />
    </div>
  );
};

export default FetcherSelector;
