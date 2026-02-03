/**
 * URL Pattern Management for Crawl4AI v0.8.0
 *
 * Allows users to configure different crawl settings based on URL patterns.
 * For example, docs/* might use different settings than blog/*.
 *
 * Refactored to use centralized Alpine store methods instead of inline DOM manipulation.
 * All event handlers now call clean store methods: $store.crawl4ai.removePattern(),
 * $store.crawl4ai.addPattern(), $store.crawl4ai.updatePattern().
 *
 * Issue #18 Fix: Moved all inline event handler logic to Alpine store.
 * - No DOM manipulation in inline handlers
 * - Clean separation of concerns
 * - Proper state management through centralized store
 */

import Tooltip from "../Tooltip";

/**
 * URL Pattern Manager Component
 *
 * Uses centralized Alpine store for all state management and event handling.
 * No inline DOM manipulation - all logic delegated to store methods.
 * The Alpine store (crawl4ai) is the single source of truth for all patterns.
 * Use $store.crawl4ai.getPatterns() to access patterns for form submission.
 *
 * Issue #23 Fix: Added aria-live region for screen reader announcements.
 * - Status updates announced when patterns are added/removed/modified
 * - Screen reader-only content using .sr-only class
 * - Proper accessibility for dynamic content changes
 */
const UrlPatternManager = () => {
  return (
    <div
      x-data={`{
        lastAction: '',
        lastPattern: '',
        announce(action, pattern) {
          this.lastAction = action;
          this.lastPattern = pattern || '';
        }
      }`}
      class="space-y-4"
    >
      <div class="flex items-center justify-between">
        <h4 class="font-semibold text-stone-800 dark:text-stone-100">
          URL Pattern Configuration
        </h4>
        <Tooltip text="Configure different crawl settings for different URL patterns. Higher priority patterns are checked first." />
      </div>

      {/* Screen reader-only status region for accessibility (Issue #23) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
        x-text="`URL pattern ${lastAction}: ${lastPattern}`"
      />

      <div class="space-y-2" id="url-patterns-container">
        {/* Pattern items rendered dynamically via Alpine store */}
        <div
          x-data={`{
            get patterns() { return $store.crawl4ai.getPatterns(); }
          }`}
        >
          <template x-for="pattern in patterns" x-key="pattern.id">
            <div
              x-bind:class="pattern.enabled 
                ? 'border rounded-lg p-3 transition-all duration-200 border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800' 
                : 'border rounded-lg p-3 transition-all duration-200 border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 opacity-75'"
            >
              <div class="flex items-start gap-3">
                {/* Enable toggle */}
                <div class="pt-1">
                  <input
                    type="checkbox"
                    x-model="pattern.enabled"
                    x-on:change="
                      $store.crawl4ai.updatePattern(pattern.id, { enabled: pattern.enabled });
                      announce(pattern.enabled ? 'enabled' : 'disabled', pattern.pattern || 'unnamed pattern');
                    "
                    class="h-4 w-4 rounded border-stone-200 text-primary-600 focus:ring-primary-600 transition-colors duration-150"
                  />
                </div>

                {/* Pattern details */}
                <div class="flex-1 space-y-2">
                  {/* Pattern and priority row */}
                  <div class="flex gap-3">
                    <div class="flex-1">
                      <label class="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                        URL Pattern
                      </label>
                      <input
                        type="text"
                        x-model="pattern.pattern"
                        x-on:change="
                          $store.crawl4ai.updatePattern(pattern.id, { pattern: pattern.pattern });
                          announce('updated to', pattern.pattern);
                        "
                        placeholder="https://example.com/docs/*"
                        class="block w-full px-3 py-1.5 text-sm border border-stone-200 dark:border-stone-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 dark:placeholder-stone-400"
                      />
                    </div>
                    <div class="w-20">
                      <label class="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                        Priority
                      </label>
                      <input
                        type="number"
                        x-model="pattern.priority"
                        x-on:change="
                          $store.crawl4ai.updatePattern(pattern.id, { priority: pattern.priority });
                          announce('priority set to', pattern.pattern + ' priority ' + pattern.priority);
                        "
                        min="0"
                        max="100"
                        class="block w-full px-3 py-1.5 text-sm border border-stone-200 dark:border-stone-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100"
                      />
                    </div>
                  </div>

                  {/* Pattern-specific options */}
                  <div
                    x-show="pattern.enabled"
                    x-transition:enter="transition ease-out duration-150"
                    x-transition:enter-start="opacity-0 -translate-y-1"
                    x-transition:enter-end="opacity-100 translate-y-0"
                    class="grid grid-cols-2 gap-2 text-sm"
                  >
                    {/* Browser type */}
                    <div>
                      <label class="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                        Browser Type
                      </label>
                      <select
                        x-model="pattern.config.browserType"
                        x-on:change="
                          $store.crawl4ai.updatePattern(pattern.id, { config: pattern.config });
                          announce('browser type changed to', pattern.pattern + ' ' + pattern.config.browserType);
                        "
                        class="w-full px-3 py-1.5 border border-stone-200 dark:border-stone-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100"
                      >
                        <option value="chromium">Chromium</option>
                        <option value="firefox">Firefox</option>
                        <option value="webkit">WebKit</option>
                      </select>
                    </div>

                    {/* Screenshot */}
                    <div class="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        x-model="pattern.config.screenshot"
                        x-on:change="
                          $store.crawl4ai.updatePattern(pattern.id, { config: pattern.config });
                          announce(pattern.config.screenshot ? 'screenshot enabled' : 'screenshot disabled', pattern.pattern);
                        "
                        class="h-4 w-4 rounded border-stone-200 text-primary-600 focus:ring-primary-600"
                      />
                      <span class="text-stone-800 dark:text-stone-100">Screenshot</span>
                    </div>

                    {/* Extract media */}
                    <div class="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        x-model="pattern.config.extractMedia"
                        x-on:change="
                          $store.crawl4ai.updatePattern(pattern.id, { config: pattern.config });
                          announce(pattern.config.extractMedia ? 'media extraction enabled' : 'media extraction disabled', pattern.pattern);
                        "
                        class="h-4 w-4 rounded border-stone-200 text-primary-600 focus:ring-primary-600"
                      />
                      <span class="text-stone-800 dark:text-stone-100">Media</span>
                    </div>

                    {/* Wait for selector */}
                    <div class="col-span-2">
                      <label class="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                        Wait For Selector
                      </label>
                      <input
                        type="text"
                        x-model="pattern.config.waitFor"
                        x-on:change="
                          $store.crawl4ai.updatePattern(pattern.id, { config: pattern.config });
                          announce('wait for selector set to', pattern.pattern + ' ' + (pattern.config.waitFor || 'none'));
                        "
                        placeholder=".content-loaded"
                        class="w-full px-3 py-1.5 text-sm border border-stone-200 dark:border-stone-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 dark:placeholder-stone-400"
                      />
                    </div>
                  </div>

                  {/* Delete button - clean store method call */}
                  <button
                    type="button"
                    x-on:click="
                      $store.crawl4ai.removePattern(pattern.id);
                      announce('removed', pattern.pattern || 'unnamed pattern');
                    "
                    class="text-red-600 hover:text-red-800 dark:text-red-400 text-xs"
                  >
                    Remove pattern
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      {/* Add new pattern button - clean store method call */}
      <button
        type="button"
        x-on:click="
          $store.crawl4ai.addPattern({
            pattern: '',
            priority: 0,
            enabled: true,
            config: { screenshot: false, extractMedia: false, browserType: 'chromium' }
          });
          announce('added', 'new pattern');
        "
        class="w-full px-4 py-2 border border-dashed border-stone-300 dark:border-stone-600 rounded-lg text-stone-600 dark:text-stone-400 hover:border-primary-400 hover:text-primary-600 transition-colors duration-150 text-sm"
      >
        + Add URL Pattern
      </button>
    </div>
  );
};

export default UrlPatternManager;
