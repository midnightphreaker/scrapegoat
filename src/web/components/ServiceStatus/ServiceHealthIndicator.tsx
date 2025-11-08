interface ServiceHealthIndicatorProps {
  status: "ok" | "degraded" | "down";
  serviceName: string;
}

/**
 * Visual indicator for service health status
 * 
 * Displays a colored dot and service name with appropriate styling
 * based on the service health status.
 */
const ServiceHealthIndicator = ({
  status,
  serviceName,
}: ServiceHealthIndicatorProps) => {
  const colors = {
    ok: "bg-green-500",
    degraded: "bg-yellow-500",
    down: "bg-red-500",
  };

  const textColors = {
    ok: "text-green-700",
    degraded: "text-yellow-700",
    down: "text-red-700",
  };

  const icons = {
    ok: "✓",
    degraded: "⚠",
    down: "✗",
  };

  return (
    <div class="flex items-center gap-2">
      <div class={`w-3 h-3 rounded-full ${colors[status]}`} />
      <span class={`font-medium ${textColors[status]}`}>{serviceName}</span>
      <span class="text-sm text-gray-500">{icons[status]}</span>
    </div>
  );
};

export default ServiceHealthIndicator;
