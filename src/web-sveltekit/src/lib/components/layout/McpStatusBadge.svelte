<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";

  let status = $state<"checking" | "connected" | "disconnected">("checking");
  let mcpUrl = $state("");

  async function checkMcpHealth() {
    try {
      const response = await fetch("/api/health/mcp");
      const data = await response.json();
      status = data.status === "ok" ? "connected" : "disconnected";
      mcpUrl = data.url || "";
    } catch {
      status = "disconnected";
    }
  }

  $effect(() => {
    checkMcpHealth();
    const interval = setInterval(checkMcpHealth, 30000);
    return () => clearInterval(interval);
  });
</script>

<div class="flex items-center gap-2">
  <Badge variant={status === "connected" ? "default" : "secondary"} class="cursor-default">
    MCP: {status}
  </Badge>
</div>
