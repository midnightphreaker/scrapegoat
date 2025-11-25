/**
 * Defines the shared HTML skeleton for all web pages, including the global
 * header with version badge and the hook for client-side update notifications.
 * The component resolves the current version from props or package metadata
 * and renders placeholders that AlpineJS hydrates at runtime.
 */
import type { PropsWithChildren } from "@kitajs/html";
import { readFileSync } from "node:fs";
import { logger } from "../../utils/logger";
import Context7Logo from "./Context7Logo";

/**
 * Props for the Layout component.
 */
interface LayoutProps extends PropsWithChildren {
  title: string;
  /** Optional version string to display next to the title. */
  version?: string;
}

/**
 * Base HTML layout component for all pages.
 * Includes common head elements, header, and scripts.
 * @param props - Component props including title, version, and children.
 */
const Layout = ({ title, version, children }: LayoutProps) => {
  let versionString = version;
  if (!versionString) {
    // If no version is provided, use the version from package.json
    // We cannot bake the version into the bundle, as the package.json will
    // be updated by the build process, after the bundle is created.
    try {
      const packageJson = JSON.parse(readFileSync("package.json", "utf-8")) as {
        version: string;
      };
      versionString = packageJson.version;
      logger.debug(`Resolved version from package.json: ${versionString}`);
    } catch (error) {
      logger.error(`Error reading package.json: ${error}`);
    }
  }
  const versionInitializer = `versionUpdate({ currentVersion: ${
    versionString ? `'${versionString}'` : "null"
  } })`;

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title safe>{title}</title>

        {/* Favicons */}
        <link
          rel="apple-touch-icon"
          sizes="57x57"
          href="/apple-icon-57x57.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="60x60"
          href="/apple-icon-60x60.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="72x72"
          href="/apple-icon-72x72.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="76x76"
          href="/apple-icon-76x76.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="114x114"
          href="/apple-icon-114x114.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="120x120"
          href="/apple-icon-120x120.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="144x144"
          href="/apple-icon-144x144.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="/apple-icon-152x152.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-icon-180x180.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="192x192"
          href="/android-icon-192x192.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="96x96"
          href="/favicon-96x96.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-TileImage" content="/ms-icon-144x144.png" />
        <meta name="theme-color" content="#ffffff" />
        {/* Bundled CSS (includes Tailwind and Flowbite) */}
        <link rel="stylesheet" href="/assets/main.css" />
        {/* Add style for htmx-indicator behavior (needed globally) */}
        <style>
          {`
          .htmx-indicator {
            display: none;
          }
          .htmx-request .htmx-indicator {
            display: block;
          }
          .htmx-request.htmx-indicator {
            display: block;
          }
          /* Default: Hide skeleton, show results container */
          #searchResultsContainer .search-skeleton { display: none; }
          #searchResultsContainer .search-results { display: block; } /* Or as needed */

          /* Request in progress: Show skeleton, hide results */
          #searchResultsContainer.htmx-request .search-skeleton { display: block; } /* Or flex etc. */
          #searchResultsContainer.htmx-request .search-results { display: none; }

          /* Keep button spinner logic */
          form .htmx-indicator .spinner { display: flex; }
          form .htmx-indicator .search-text { display: none; }
          form .spinner { display: none; }
          /* Smooth transition for width changes */
          .container {
            transition: max-width 300ms ease-in-out;
          }
          `}
        </style>
      </head>
      <body class="flex min-h-screen flex-col overflow-x-hidden antialiased bg-stone-50 dark:bg-stone-900" x-data="wideModeData()">
        {/* Full-width header with ScrapeGoat branding */}
        <header
          class="sticky top-0 z-50 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 shadow-context7-sm"
          x-data={versionInitializer}
          x-init="queueCheck()"
        >
          <div class="container mx-auto px-4 py-4" x-bind:class="$root.getMaxWidth()">
            {/* Large screens: single row layout */}
            <div class="hidden sm:flex items-center justify-between">
              <div class="flex items-center gap-3">
                <a
                  href="/"
                  class="flex items-center gap-3 hover:opacity-90 transition-opacity duration-150"
                >
                  <Context7Logo className="w-10 h-11" />
                  <span class="text-2xl font-bold text-stone-800 dark:text-stone-100 font-brand">
                    scrapegoat
                  </span>
                </a>
                {versionString ? (
                  <span
                    safe
                    class="text-sm font-normal text-stone-500 dark:text-stone-400"
                    title={`Version ${versionString}`}
                  >
                    v{versionString}
                  </span>
                ) : null}
              </div>
              <div class="flex items-center gap-3">
                {/* Wide Mode Toggle */}
                <button
                  type="button"
                  x-on:click="$root.toggle()"
                  class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 transition-all duration-150"
                  title="Toggle wide mode"
                  aria-label="Toggle wide mode"
                >
                  {/* Expand Icon (visible in normal mode) */}
                  <svg
                    x-show="!$root.wide"
                    class="w-5 h-5 text-stone-600 dark:text-stone-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  {/* Compress Icon (visible in wide mode) */}
                  <svg
                    x-show="$root.wide"
                    class="w-5 h-5 text-stone-600 dark:text-stone-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                    />
                  </svg>
                </button>

                {/* Dark Mode Toggle */}
                <button
                  type="button"
                  x-on:click="$store.darkMode.toggle()"
                  class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 transition-all duration-150"
                  title="Toggle dark mode"
                  aria-label="Toggle dark mode"
                >
                  {/* Sun Icon (visible in dark mode) */}
                  <svg
                    x-show="$store.darkMode.on"
                    class="w-5 h-5 text-stone-600 dark:text-stone-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  {/* Moon Icon (visible in light mode) */}
                  <svg
                    x-show="!$store.darkMode.on"
                    class="w-5 h-5 text-stone-600 dark:text-stone-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                </button>

                {/* MCP Status Indicator */}
                <div x-data="mcpStatus()" x-init="init()">
                  {/* Connected State */}
                  <button
                    type="button"
                    x-show="status === 'connected'"
                    x-on:click="handleClick()"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all duration-150 cursor-pointer"
                    title="Click to view MCP configuration"
                  >
                    <span class="relative flex h-2.5 w-2.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                    </span>
                    <span class="text-sm font-medium text-emerald-700" x-text="`MCP: ${displayText}`"></span>
                  </button>

                  {/* Disconnected State */}
                  <button
                    type="button"
                    x-show="status === 'disconnected'"
                    x-on:click="handleClick()"
                    x-cloak
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 hover:bg-red-100 transition-all duration-150 cursor-pointer"
                    title="Click to retry connection"
                  >
                    <span class="relative flex h-2.5 w-2.5">
                      <span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                    </span>
                    <span class="text-sm font-medium text-red-700">MCP: Disconnected</span>
                  </button>

                  {/* Checking State */}
                  <div
                    x-show="status === 'checking'"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-50 border border-stone-200"
                  >
                    <span class="relative flex h-2.5 w-2.5">
                      <span class="animate-pulse inline-flex h-2.5 w-2.5 rounded-full bg-stone-400"></span>
                    </span>
                    <span class="text-sm font-medium text-stone-700" x-text="`MCP: ${displayText}`"></span>
                  </div>

                  {/* Configuration Popup Modal */}
                  <div
                    x-show="showPopup"
                    x-cloak
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                    x-on:click="if ($event.target === $el) closePopup()"
                  >
                    <div class="bg-white dark:bg-stone-800 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4" x-on:click="$event.stopPropagation()">
                      <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold text-stone-800 dark:text-stone-100">MCP Server Configuration</h3>
                        <button
                          type="button"
                          x-on:click="closePopup()"
                          class="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                        >
                          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <p class="text-sm text-stone-600 dark:text-stone-300 mb-4">
                        Add this configuration to your Claude Desktop settings to connect to the Scrapegoat MCP server:
                      </p>

                      <div class="relative">
                        <pre class="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-lg p-4 overflow-x-auto text-sm font-mono"
                             x-text="configSnippet"></pre>
                        <button
                          type="button"
                          x-on:click="copyToClipboard()"
                          class="absolute top-2 right-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Copy
                        </button>
                      </div>

                      <p class="text-xs text-stone-500 dark:text-stone-400 mt-4">
                        Configuration file location:
                        <code class="bg-stone-100 dark:bg-stone-900 text-stone-800 dark:text-stone-200 px-2 py-0.5 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Version Update Notification */}
                <span
                  x-show="hasUpdate"
                  x-cloak
                  class="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 border border-amber-200"
                  role="status"
                  aria-live="polite"
                >
                  <span class="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-amber-800 text-xs font-bold">
                    !
                  </span>
                  <a
                    x-bind:href="latestReleaseUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-amber-800 transition-colors"
                  >
                    <span class="mr-1">Update available</span>
                  </a>
                </span>
              </div>
            </div>

            {/* Small screens: stacked layout */}
            <div class="sm:hidden space-y-2">
              {/* Row 1: scrapegoat branding */}
              <div class="flex items-center justify-center gap-2">
                <a
                  href="/"
                  class="flex items-center gap-2 hover:opacity-90 transition-opacity duration-150"
                >
                  <Context7Logo className="w-8 h-9" />
                  <span class="text-2xl font-bold text-stone-800 dark:text-stone-100 font-brand">
                    scrapegoat
                  </span>
                </a>
                {versionString ? (
                  <span
                    safe
                    class="text-sm font-normal text-stone-500 dark:text-stone-400"
                    title={`Version ${versionString}`}
                  >
                    v{versionString}
                  </span>
                ) : null}
              </div>

              {/* Row 2: Wide Mode, Dark Mode Toggle, MCP Status and Update notification */}
              <div class="flex justify-center gap-2 flex-wrap">
                {/* Wide Mode Toggle */}
                <button
                  type="button"
                  x-on:click="$root.toggle()"
                  class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 transition-all duration-150"
                  title="Toggle wide mode"
                  aria-label="Toggle wide mode"
                >
                  {/* Expand Icon (visible in normal mode) */}
                  <svg
                    x-show="!$root.wide"
                    class="w-5 h-5 text-stone-600 dark:text-stone-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  {/* Compress Icon (visible in wide mode) */}
                  <svg
                    x-show="$root.wide"
                    class="w-5 h-5 text-stone-600 dark:text-stone-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                    />
                  </svg>
                </button>

                {/* Dark Mode Toggle */}
                <button
                  type="button"
                  x-on:click="$store.darkMode.toggle()"
                  class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 transition-all duration-150"
                  title="Toggle dark mode"
                  aria-label="Toggle dark mode"
                >
                  {/* Sun Icon (visible in dark mode) */}
                  <svg
                    x-show="$store.darkMode.on"
                    class="w-5 h-5 text-stone-600 dark:text-stone-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  {/* Moon Icon (visible in light mode) */}
                  <svg
                    x-show="!$store.darkMode.on"
                    class="w-5 h-5 text-stone-600 dark:text-stone-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                </button>

                {/* MCP Status Indicator */}
                <div x-data="mcpStatus()" x-init="init()">
                  {/* Connected State */}
                  <button
                    type="button"
                    x-show="status === 'connected'"
                    x-on:click="handleClick()"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all duration-150 cursor-pointer"
                    title="Click to view MCP configuration"
                  >
                    <span class="relative flex h-2.5 w-2.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                    </span>
                    <span class="text-sm font-medium text-emerald-700" x-text="`MCP: ${displayText}`"></span>
                  </button>

                  {/* Disconnected State */}
                  <button
                    type="button"
                    x-show="status === 'disconnected'"
                    x-on:click="handleClick()"
                    x-cloak
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 hover:bg-red-100 transition-all duration-150 cursor-pointer"
                    title="Click to retry connection"
                  >
                    <span class="relative flex h-2.5 w-2.5">
                      <span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                    </span>
                    <span class="text-sm font-medium text-red-700">MCP: Disconnected</span>
                  </button>

                  {/* Checking State */}
                  <div
                    x-show="status === 'checking'"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-50 border border-stone-200"
                  >
                    <span class="relative flex h-2.5 w-2.5">
                      <span class="animate-pulse inline-flex h-2.5 w-2.5 rounded-full bg-stone-400"></span>
                    </span>
                    <span class="text-sm font-medium text-stone-700" x-text="`MCP: ${displayText}`"></span>
                  </div>

                  {/* Configuration Popup Modal */}
                  <div
                    x-show="showPopup"
                    x-cloak
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                    x-on:click="if ($event.target === $el) closePopup()"
                  >
                    <div class="bg-white dark:bg-stone-800 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4" x-on:click="$event.stopPropagation()">
                      <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold text-stone-800 dark:text-stone-100">MCP Server Configuration</h3>
                        <button
                          type="button"
                          x-on:click="closePopup()"
                          class="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                        >
                          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <p class="text-sm text-stone-600 dark:text-stone-300 mb-4">
                        Add this configuration to your Claude Desktop settings to connect to the Scrapegoat MCP server:
                      </p>

                      <div class="relative">
                        <pre class="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-lg p-4 overflow-x-auto text-sm font-mono"
                             x-text="configSnippet"></pre>
                        <button
                          type="button"
                          x-on:click="copyToClipboard()"
                          class="absolute top-2 right-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Copy
                        </button>
                      </div>

                      <p class="text-xs text-stone-500 dark:text-stone-400 mt-4">
                        Configuration file location:
                        <code class="bg-stone-100 dark:bg-stone-900 text-stone-800 dark:text-stone-200 px-2 py-0.5 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Version Update Notification */}
                <span
                  x-show="hasUpdate"
                  x-cloak
                  class="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 border border-amber-200"
                  role="status"
                  aria-live="polite"
                >
                  <span class="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-amber-800 text-xs font-bold">
                    !
                  </span>
                  <a
                    x-bind:href="latestReleaseUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-amber-800 transition-colors"
                  >
                    <span class="mr-1">Update available</span>
                  </a>
                </span>
              </div>
            </div>
          </div>
        </header>

        <main class="flex-1 container mx-auto px-4 py-6 sm:px-6 lg:px-8" x-bind:class="getMaxWidth()">
          {children}
        </main>

        {/* Bundled JS (includes Flowbite, HTMX, AlpineJS, and initialization) */}
        <script type="module" src="/assets/main.js"></script>
      </body>
    </html>
  );
};

export default Layout;
