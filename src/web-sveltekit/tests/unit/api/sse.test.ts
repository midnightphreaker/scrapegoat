import { describe, expect, it, vi } from "vitest";
import { JobEventSource } from "$lib/api/sse";

describe("JobEventSource", () => {
  it("creates event source connection", () => {
    const client = new JobEventSource(() => {});
    expect(client).toBeDefined();
  });
});
