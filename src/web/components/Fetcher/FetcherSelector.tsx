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
 * - Crawl4AI: AI-optimized markdown with enhanced features
 * @param name - Form input name attribute
 * @default name - "fetcher" if not provided
 * @param defaultValue - Initial selected value
 * @default defaultValue - "auto" if not provided
 */
const FetcherSelector = ({ name = "fetcher", defaultValue = "auto" }: FetcherSelectorProps) => {
  return (
    <div>
      <div class="flex items-center mb-2">
        <label
          for={name}
          class="block text-sm font-medium text-stone-800 dark:text-stone-100"
        >
          Content Fetcher
        </label>
        <Tooltip text="Choose how to fetch documentation pages. Auto-detect is recommended for most cases." />
      </div>
      <select
        name={name}
        id={name}
        aria-describedby={`${name}-description`}
        x-bind:disabled="submitting"
        x-bind:class="submitting ? 'opacity-50 cursor-not-allowed' : ''"
        class="block w-full px-3 py-2 text-sm border border-stone-200 dark:border-stone-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 transition-colors duration-150"
        x-model="fetcher"
        x-on:change="updateFetcherHelp()"
      >
        <option value="auto" selected={defaultValue === "auto"}>
          Auto-detect (recommended)
        </option>
        <option value="http" selected={defaultValue === "http"}>
          HTTP Fetch (fast)
        </option>
        <option value="crawl4ai" selected={defaultValue === "crawl4ai"}>
          Crawl4AI (AI-optimized)
        </option>
      </select>
      <p
        id={`${name}-description`}
        class="mt-2 text-sm text-stone-500 dark:text-stone-400"
        role="status"
        aria-live="polite"
        x-text="fetcherHelp"
        x-show="fetcherHelp"
      />
    </div>
  );
};

export default FetcherSelector;
