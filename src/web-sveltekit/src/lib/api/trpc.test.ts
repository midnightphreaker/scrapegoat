import { describe, expect, it } from "vitest";
import { trpc } from "./trpc";

describe("tRPC client", () => {
  it("should be defined", () => {
    expect(trpc).toBeDefined();
  });
});
