import ServiceHealthIndicator from "./ServiceHealthIndicator";

interface HealthStatus {
  status: "ok" | "degraded" | "down";
  version?: string;
  uptime?: number;
}

interface AllHealthResponse {
  http: HealthStatus;
  browser: HealthStatus;
  crawl4ai: HealthStatus;
}

interface ServiceStatusCardProps {
  health?: AllHealthResponse;
}

/**
 * Card displaying health status of all fetcher services
 *
 * Uses HTMX to poll the /api/health/all endpoint every 30 seconds
 * and displays the status of HTTP, Browser, and Crawl4AI services.
 * @param health - Optional health status response object
 * @default health - undefined if not provided (shows loading state)
 */
const ServiceStatusCard = ({ health }: ServiceStatusCardProps) => {
  return (
    <div
      class="mt-4 p-4 bg-white rounded-lg shadow-sm border border-stone-200"
      hx-get="/api/health/all"
      hx-trigger="load, every 30s"
      hx-swap="outerHTML"
      hx-target="this"
    >
      <h3 class="text-lg font-semibold text-stone-900 mb-4">
        Service Health
      </h3>

      {health ? (
        <div class="space-y-2">
          <ServiceHealthIndicator status="ok" serviceName="HTTP Fetcher" />
          <ServiceHealthIndicator status="ok" serviceName="Browser Fetcher" />
          <ServiceHealthIndicator
            status={health.crawl4ai?.status || "down"}
            serviceName="Crawl4AI Service"
          />

          {health.crawl4ai && health.crawl4ai.status !== "down" && (
            <div class="mt-4 pt-4 border-t border-stone-200 text-sm text-stone-600">
              {health.crawl4ai.version && (
                <p>
                  <span class="font-medium">Version:</span>{" "}
                  <span safe>{health.crawl4ai.version}</span>
                </p>
              )}
              {health.crawl4ai.uptime !== undefined && (
                <p>
                  <span class="font-medium">Uptime:</span>{" "}
                  {Math.floor(health.crawl4ai.uptime / 60)}m
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div class="space-y-2">
          <div class="animate-pulse flex items-center gap-2">
            <div class="w-3 h-3 bg-stone-200 rounded-full" />
            <div class="h-4 bg-stone-200 rounded w-32" />
          </div>
          <div class="animate-pulse flex items-center gap-2">
            <div class="w-3 h-3 bg-stone-200 rounded-full" />
            <div class="h-4 bg-stone-200 rounded w-32" />
          </div>
          <div class="animate-pulse flex items-center gap-2">
            <div class="w-3 h-3 bg-stone-200 rounded-full" />
            <div class="h-4 bg-stone-200 rounded w-32" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceStatusCard;
