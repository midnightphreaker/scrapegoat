import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import McpStatusBadge from "$lib/components/layout/McpStatusBadge.svelte";

describe("McpStatusBadge", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ status: "ok", url: "http://localhost:8080" }),
        }),
      ) as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows MCP connection status with status text", () => {
    render(McpStatusBadge);
    const badge = screen.getByText(/MCP.*:.*connected|disconnected|checking/i);
    expect(badge).toBeTruthy();
  });
});
