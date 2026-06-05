/**
 * Defines the shared HTML skeleton for all web pages, including the global
 * header with version badge and the hook for client-side update notifications.
 * The component resolves the current version from props or build-time injection
 * and renders placeholders that AlpineJS hydrates at runtime.
 */
import type { PropsWithChildren } from "@kitajs/html";
import Toast from "./Toast";

/**
 * Props for the Layout component.
 */
interface LayoutProps extends PropsWithChildren {
  title: string;
  /** Optional version string to display next to the title. */
  version?: string;
  /** Event client configuration for real-time updates */
  eventClientConfig?: {
    useRemoteWorker: boolean;
    trpcUrl?: string;
  };
}

/**
 * Base HTML layout component for all pages.
 * Includes common head elements, header, and scripts.
 * @param props - Component props including title, version, children, and eventClientConfig.
 */
const Layout = ({
  title,
  version,
  children,
  eventClientConfig,
}: LayoutProps) => {
  // Use provided version prop, or fall back to build-time injected version
  const versionString = version || __APP_VERSION__;
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
          `}
        </style>
      </head>
      <body class="bg-gray-50 dark:bg-gray-900" hx-ext="morph">
        {/* Toast notification component */}
        <Toast />

        {/* Full-width header with ScrapeGoat branding */}
        <header
          class="bg-white border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800"
          x-data={versionInitializer}
          x-init="queueCheck()"
        >
          <div class="container max-w-2xl mx-auto px-4 py-3">
            <div class="flex items-center justify-between gap-4">
              <a href="/" class="block shrink-0" aria-label="ScrapeGoat home">
                <img
                  src="/ScrapeGoat-Banner.svg"
                  alt="ScrapeGoat"
                  class="h-10 sm:h-12 w-auto"
                />
              </a>
              <span
                x-show="hasUpdate"
                x-cloak
                class="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                role="status"
                aria-live="polite"
              >
                <span class="flex h-4 w-4 items-center justify-center rounded-full bg-gray-500 text-white text-xs font-bold">
                  !
                </span>
                <a
                  x-bind:href="latestReleaseUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <span class="mr-1">Update available</span>
                </a>
              </span>
            </div>
          </div>
        </header>

        <div class="container max-w-2xl mx-auto px-4 py-6">
          <main>{children}</main>
        </div>

        {/* Modal container for HTMX-swap modals */}
        <div id="modal-container" />

        {/* Event client configuration */}
        <script>
          {`window.__EVENT_CLIENT_CONFIG__ = ${JSON.stringify(eventClientConfig)};`}
        </script>

        {/* Local upload Alpine.js component (must load before main.js module so alpine:init listener is registered) */}
        <script src="/js/localUpload.js"></script>
        {/* Bundled JS (includes Flowbite, HTMX, AlpineJS, and initialization) */}
        <script type="module" src="/assets/main.js"></script>
      </body>
    </html>
  );
};

export default Layout;
