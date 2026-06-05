// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("flowbite", () => ({
  initFlowbite: vi.fn(),
}));

vi.mock("htmx.org", () => ({
  default: {
    ajax: vi.fn(),
    defineExtension: vi.fn(),
  },
}));

vi.mock("idiomorph/htmx", () => ({}));

vi.mock("./EventClient", () => ({
  EventClient: vi.fn(() => ({
    subscribe: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

describe("web client bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    delete (window as Window & { htmx?: unknown }).htmx;
  });

  it("exposes htmx globally for Alpine inline handlers", async () => {
    await import("./main.client");

    expect((window as Window & { htmx?: { ajax?: unknown } }).htmx?.ajax).toBeTypeOf(
      "function",
    );
  });
});
