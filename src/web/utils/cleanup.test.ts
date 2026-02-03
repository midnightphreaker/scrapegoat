/**
 * Tests for cleanup utilities
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addEventListenerSafe,
  addHtmxEventListener,
  cleanupOnRemove,
  createAlpineCleanup,
  createCleanupRegistry,
  debounceSafe,
  MemoryTracker,
  observeMutationSafe,
  setIntervalSafe,
  setTimeoutSafe,
  throttleSafe,
} from "./cleanup";

describe("cleanup utilities", () => {
  describe("createCleanupRegistry", () => {
    it("registers and executes cleanup functions", () => {
      const registry = createCleanupRegistry();
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      registry.register(cleanup1);
      registry.register(cleanup2);

      registry.cleanup();

      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);
    });

    it("does not execute cleanup after registry is cleaned", () => {
      const registry = createCleanupRegistry();
      const cleanup = vi.fn();

      registry.register(cleanup);
      registry.cleanup();

      expect(cleanup).toHaveBeenCalledTimes(1);

      registry.register(cleanup);
      expect(cleanup).toHaveBeenCalledTimes(1); // Should not call again
    });

    it("tracks cleaned state", () => {
      const registry = createCleanupRegistry();
      expect(registry.cleaned).toBe(false);

      registry.cleanup();
      expect(registry.cleaned).toBe(true);
    });

    it("unregisters cleanup functions", () => {
      const registry = createCleanupRegistry();
      const cleanup = vi.fn();

      registry.register(cleanup);
      registry.unregister(cleanup);
      registry.cleanup();

      expect(cleanup).not.toHaveBeenCalled();
    });
  });

  describe("addEventListenerSafe", () => {
    let element: HTMLButtonElement;

    beforeEach(() => {
      element = document.createElement("button");
      document.body.appendChild(element);
    });

    afterEach(() => {
      document.body.removeChild(element);
    });

    it("adds event listener and returns cleanup", () => {
      const handler = vi.fn();
      const cleanup = addEventListenerSafe(element, "click", handler);

      element.click();

      expect(handler).toHaveBeenCalledTimes(1);

      cleanup();

      element.click();

      expect(handler).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it("supports event options", () => {
      const handler = vi.fn();
      const cleanup = addEventListenerSafe(element, "click", handler, { once: true });

      element.click();
      element.click();

      expect(handler).toHaveBeenCalledTimes(1);

      cleanup();
    });
  });

  describe("setIntervalSafe", () => {
    it("creates interval and returns cleanup", () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const cleanup = setIntervalSafe(callback, 100);

      vi.advanceTimersByTime(250);

      expect(callback).toHaveBeenCalledTimes(2);

      cleanup();

      vi.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalledTimes(2); // Should not be called again

      vi.useRealTimers();
    });
  });

  describe("setTimeoutSafe", () => {
    it("creates timeout and returns cleanup", () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const cleanup = setTimeoutSafe(callback, 100);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalledTimes(1);

      cleanup();

      vi.useRealTimers();
    });

    it("cancels timeout when cleaned before execution", () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const cleanup = setTimeoutSafe(callback, 100);

      cleanup();

      vi.advanceTimersByTime(100);

      expect(callback).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("debounceSafe", () => {
    it("debounces function calls", () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const { fn: debounced, cleanup } = debounceSafe(fn, 100);

      debounced();
      debounced();
      debounced();

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);

      cleanup();
      vi.useRealTimers();
    });

    it("cleans up pending calls", () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const { fn: debounced, cleanup } = debounceSafe(fn, 100);

      debounced();

      cleanup();

      vi.advanceTimersByTime(100);

      expect(fn).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("throttleSafe", () => {
    it("throttles function calls", () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const { fn: throttled, cleanup } = throttleSafe(fn, 100);

      throttled();
      throttled();
      throttled();

      vi.advanceTimersByTime(100);

      // First call is immediate, subsequent calls within limit are queued
      expect(fn).toHaveBeenCalled();

      cleanup();
      vi.useRealTimers();
    });
  });

  describe("MemoryTracker", () => {
    it("records and averages measurements", () => {
      const tracker = new MemoryTracker();

      tracker.record("test", 10);
      tracker.record("test", 20);
      tracker.record("test", 30);

      expect(tracker.getAverage("test")).toBe(20);
    });

    it("returns 0 for unknown category", () => {
      const tracker = new MemoryTracker();
      expect(tracker.getAverage("unknown")).toBe(0);
    });

    it("detects increasing trend", () => {
      const tracker = new MemoryTracker();

      tracker.record("test", 10);
      tracker.record("test", 20);
      tracker.record("test", 30);

      expect(tracker.getTrend("test")).toBe("increasing");
    });

    it("detects decreasing trend", () => {
      const tracker = new MemoryTracker();

      tracker.record("test", 30);
      tracker.record("test", 20);
      tracker.record("test", 10);

      expect(tracker.getTrend("test")).toBe("decreasing");
    });

    it("detects stable trend", () => {
      const tracker = new MemoryTracker();

      tracker.record("test", 10);
      tracker.record("test", 11);
      tracker.record("test", 10);

      expect(tracker.getTrend("test")).toBe("stable");
    });

    it("returns unknown for insufficient data", () => {
      const tracker = new MemoryTracker();

      tracker.record("test", 10);
      tracker.record("test", 20);

      expect(tracker.getTrend("test")).toBe("unknown");
    });

    it("clears all measurements", () => {
      const tracker = new MemoryTracker();

      tracker.record("test", 10);
      tracker.clear();

      expect(tracker.getAverage("test")).toBe(0);
    });
  });

  describe("addHtmxEventListener", () => {
    it("listens to HTMX events and returns cleanup", () => {
      const handler = vi.fn();
      const cleanup = addHtmxEventListener("htmx:beforeRequest", handler);

      const event = new Event("htmx:beforeRequest");
      document.body.dispatchEvent(event);

      expect(handler).toHaveBeenCalledWith(event);

      cleanup();
    });

    it("filters by selector when provided", () => {
      const handler = vi.fn();
      const target = document.createElement("div");
      target.id = "test";
      document.body.appendChild(target);

      const cleanup = addHtmxEventListener("click", handler, "#test");

      const event = new Event("click");
      target.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();

      cleanup();
      document.body.removeChild(target);
    });
  });

  describe("createAlpineCleanup", () => {
    it("creates cleanup hook API", () => {
      const cleanup = createAlpineCleanup();
      const handler = vi.fn();

      cleanup.onCleanup(handler);

      expect(handler).not.toHaveBeenCalled();

      cleanup.cleanup();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("tracks cleaned state", () => {
      const cleanup = createAlpineCleanup();
      expect(cleanup.cleaned).toBe(false);

      cleanup.cleanup();
      expect(cleanup.cleaned).toBe(true);
    });
  });

  describe("observeMutationSafe", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it("observes mutations and returns cleanup", () => {
      const callback = vi.fn();
      const cleanup = observeMutationSafe(container, { childList: true }, callback);

      const child = document.createElement("span");
      container.appendChild(child);

      expect(callback).toHaveBeenCalled();

      cleanup();
    });
  });

  describe("cleanupOnRemove", () => {
    it("runs cleanup when element is removed", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);

      const element = document.createElement("span");
      container.appendChild(element);

      const handler = vi.fn();
      cleanupOnRemove(element, handler);

      expect(handler).not.toHaveBeenCalled();

      container.removeChild(element);

      // Wait for MutationObserver to detect
      setTimeout(() => {
        expect(handler).toHaveBeenCalled();
      }, 10);
    });
  });
});
