/**
 * Bootstraps the client-side experience for the Docs MCP Server web UI.
 * Initializes Alpine stores, HTMX helpers, Flowbite components, and the
 * release checker that surfaces update notifications in the header.
 */
import "./styles/main.css";

import Alpine from "alpinejs";
import { initFlowbite } from "flowbite";
import htmx from "htmx.org";
import { fallbackReleaseLabel, isVersionNewer } from "./utils/versionCheck";

const LATEST_RELEASE_ENDPOINT =
  "https://api.github.com/repos/arabold/scrapegoat/releases/latest";
const LATEST_RELEASE_FALLBACK_URL =
  "https://github.com/arabold/scrapegoat/releases/latest";

interface VersionUpdateConfig {
  currentVersion: string | null;
}

interface GithubReleaseResponse {
  tag_name?: unknown;
  html_url?: unknown;
}

document.addEventListener("alpine:init", () => {
  Alpine.data("versionUpdate", (config: VersionUpdateConfig) => ({
    currentVersion:
      typeof config?.currentVersion === "string" ? config.currentVersion : null,
    hasUpdate: false,
    latestVersionLabel: "",
    latestReleaseUrl: LATEST_RELEASE_FALLBACK_URL,
    hasChecked: false,
    queueCheck() {
      window.setTimeout(() => {
        void this.checkForUpdate();
      }, 0);
    },
    async checkForUpdate() {
      if (this.hasChecked) {
        return;
      }
      this.hasChecked = true;

      if (!this.currentVersion) {
        return;
      }

      try {
        const response = await fetch(LATEST_RELEASE_ENDPOINT, {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "scrapegoat-ui",
          },
        });

        if (!response.ok) {
          console.debug("Release check request failed", response.status);
          return;
        }

        const payload = (await response.json()) as GithubReleaseResponse;
        const tagName = payload.tag_name;

        if (!isVersionNewer(tagName, this.currentVersion)) {
          return;
        }

        const releaseLabel =
          (typeof tagName === "string" && tagName.trim().length > 0
            ? tagName.trim()
            : null) ?? fallbackReleaseLabel(tagName);

        if (!releaseLabel) {
          return;
        }

        this.latestVersionLabel = releaseLabel;
        this.latestReleaseUrl =
          typeof payload.html_url === "string" && payload.html_url.trim().length
            ? payload.html_url
            : LATEST_RELEASE_FALLBACK_URL;
        this.hasUpdate = true;
      } catch (error) {
        console.debug("Release check request threw", error);
      }
    },
  }));

  Alpine.data("mcpStatus", () => ({
    status: "checking",
    mcpUrl: "",
    mcpHost: "",
    mcpPort: 6280,
    displayText: "Checking...",
    showPopup: false,
    configSnippet: "",

    async init() {
      // Fetch MCP config from server
      await this.loadConfig();

      // Initial health check
      await this.checkMcpHealth();

      // Start polling
      this.startPolling();

      // Generate config snippet
      this.generateConfigSnippet();
    },

    async loadConfig() {
      try {
        const response = await fetch("/api/config");
        const config = await response.json();

        if (config.mcp) {
          this.mcpUrl = config.mcp.url;
          this.mcpHost = config.mcp.host;
          this.mcpPort = config.mcp.port;
        }
      } catch (error) {
        console.debug("Failed to load MCP config:", error);
      }
    },

    async checkMcpHealth() {
      try {
        const response = await fetch("/api/health/mcp", {
          signal: AbortSignal.timeout(5000),
        });

        const data = await response.json();

        if (data.connected) {
          this.status = "connected";
          this.displayText = `${this.mcpHost}:${this.mcpPort} - Connected`;
        } else {
          this.status = "disconnected";
          this.displayText = "Disconnected";
        }
      } catch (error) {
        this.status = "disconnected";
        this.displayText = "Disconnected";
      }
    },

    startPolling() {
      setInterval(() => {
        void this.checkMcpHealth();
      }, 30000);
    },

    handleClick() {
      if (this.status === "connected") {
        this.showPopup = true;
      } else {
        void this.retryConnection();
      }
    },

    async retryConnection() {
      this.status = "checking";
      this.displayText = "Connecting...";
      await this.checkMcpHealth();
    },

    generateConfigSnippet() {
      // Build full URL using window.location for the current domain
      const protocol = window.location.protocol; // http: or https:
      const host = window.location.host; // includes port if not default
      const fullUrl = `${protocol}//${host}/mcp`;

      this.configSnippet = JSON.stringify(
        {
          mcpServers: {
            scrapegoat: {
              url: fullUrl,
              transport: {
                type: "sse",
              },
            },
          },
        },
        null,
        2,
      );
    },

    closePopup() {
      this.showPopup = false;
    },

    copyToClipboard() {
      navigator.clipboard.writeText(this.configSnippet);
      // Could add toast notification here
    },
  }));

  Alpine.data("darkMode", () => ({
    isDark: false,

    init() {
      // Check localStorage for saved preference
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark") {
        this.isDark = true;
      } else if (savedTheme === "light") {
        this.isDark = false;
      } else {
        // Default to system preference if no saved preference
        this.isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      // Watch for system theme changes
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", (e) => {
          // Only auto-switch if user hasn't set a preference
          if (!localStorage.getItem("theme")) {
            this.isDark = e.matches;
          }
        });
    },

    toggle() {
      this.isDark = !this.isDark;
      // Save preference to localStorage
      localStorage.setItem("theme", this.isDark ? "dark" : "light");
    },
  }));

  Alpine.data("wideModeData", () => ({
    wide: false,

    init() {
      // Check localStorage for saved preference
      const savedMode = localStorage.getItem("scrapegoat-wide-mode");
      this.wide = savedMode === "true";
    },

    toggle() {
      this.wide = !this.wide;
      // Save preference to localStorage
      localStorage.setItem("scrapegoat-wide-mode", this.wide.toString());
    },

    getMaxWidth() {
      return this.wide ? "max-w-[90%]" : "max-w-2xl";
    },
  }));
});

// Ensure Alpine global store for confirmation actions is initialized before Alpine components render
Alpine.store("confirmingAction", {
  type: null,
  id: null,
  timeoutId: null,
  isDeleting: false,
});

Alpine.start();

// Initialize Flowbite components
initFlowbite();

// Add a global event listener for 'job-list-refresh' that uses HTMX to reload the job list
// This is still useful for manual refresh after actions like clearing jobs
document.addEventListener("job-list-refresh", () => {
  htmx.ajax("get", "/web/jobs", "#job-queue");
});

// Auto-refresh job list every 3 seconds for real-time progress updates
function autoRefreshJobList() {
  // Only refresh if the job queue element exists on the current page
  if (document.querySelector("#job-queue")) {
    htmx.ajax("get", "/web/jobs", "#job-queue");
  }
}

// Global variable to track the current interval
let autoRefreshInterval = setInterval(autoRefreshJobList, 3000);

// Stop auto-refresh when page is hidden to save resources
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInterval(autoRefreshInterval);
  } else {
    // Restart auto-refresh when page becomes visible again
    autoRefreshInterval = setInterval(autoRefreshJobList, 3000);
  }
});

// Add a global event listener for 'version-list-refresh' that reloads the version list container using HTMX
document.addEventListener("version-list-refresh", (event: Event) => {
  const customEvent = event as CustomEvent<{ library: string }>;
  const library = customEvent.detail?.library;
  if (library) {
    htmx.ajax(
      "get",
      `/web/libraries/${encodeURIComponent(library)}/versions`,
      "#version-list",
    );
  }
});

// Listen for htmx swaps after a version delete and dispatch version-list-refresh with payload
document.body.addEventListener("htmx:afterSwap", (event) => {
  // Always re-initialize AlpineJS for swapped-in DOM to fix $store errors
  if (event.target instanceof HTMLElement) {
    Alpine.initTree(event.target);
  }

  // Existing logic for version delete refresh
  const detail = (event as CustomEvent).detail;
  if (
    detail?.xhr?.status === 204 &&
    detail?.requestConfig?.verb === "delete" &&
    (event.target as HTMLElement)?.id?.startsWith("row-")
  ) {
    // Extract library name from the row id: row-<library>-<version>
    const rowId = (event.target as HTMLElement).id;
    const match = rowId.match(/^row-([^-]+)-/);
    const library = match ? match[1] : null;
    if (library) {
      document.dispatchEvent(
        new CustomEvent("version-list-refresh", { detail: { library } }),
      );
    } else {
      window.location.reload();
    }
  }
});
