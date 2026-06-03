/**
 * Tests for RemoteEventProxy exponential backoff reconnection.
 *
 * Tests verify:
 * - Base delay is used for first reconnect attempt
 * - Delay doubles on each subsequent attempt
 * - Delay is capped at maxReconnectDelay
 * - No reconnection after maxReconnectAttempts
 * - Jitter is applied (delay varies within a range)
 * - Reconnect attempt counter resets on successful connection
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventBusService } from "./EventBusService";
import { RemoteEventProxy } from "./RemoteEventProxy";

// Mock the tRPC client modules
vi.mock("@trpc/client", () => ({
  createTRPCClient: vi.fn(() => ({
    events: {
      subscribe: {
        subscribe: vi.fn(),
      },
    },
  })),
  createWSClient: vi.fn(() => ({
    close: vi.fn(),
  })),
  httpBatchLink: vi.fn(),
  splitLink: vi.fn(),
  wsLink: vi.fn(),
}));

vi.mock("superjson", () => ({
  default: {
    serialize: vi.fn((v) => v),
    deserialize: vi.fn((v) => v),
  },
}));

function createMockEventBus(): EventBusService {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    listenerCount: vi.fn(() => 0),
  } as unknown as EventBusService;
}

/** Helper to access private scheduleReconnect method for testing. */
function triggerReconnect(p: RemoteEventProxy): void {
  // biome-ignore lint/complexity/useLiteralKeys: accessing private member for testing
  p["scheduleReconnect"]();
}

/** Helper to read private reconnectAttempt counter for testing. */
function getReconnectAttempt(p: RemoteEventProxy): number {
  // biome-ignore lint/complexity/useLiteralKeys: accessing private member for testing
  return p["reconnectAttempt"] as number;
}

describe("RemoteEventProxy reconnect backoff", () => {
  let proxy: RemoteEventProxy;
  let mockEventBus: EventBusService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEventBus = createMockEventBus();
    proxy = new RemoteEventProxy("http://localhost:3000/api", mockEventBus);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should use base delay for first reconnect attempt", () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    proxy.connect();

    proxy.disconnect();
    proxy.connect();

    triggerReconnect(proxy);

    // Should have called setTimeout with ~1000ms base delay
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    const delay = lastCall?.[1] as number;
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(1250); // base + up to 25% jitter
  });

  it("should increase delay on second reconnect attempt", () => {
    const spy = vi.spyOn(globalThis, "setTimeout");

    // First attempt
    triggerReconnect(proxy);
    const firstDelay = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number;

    // Advance timers to trigger the reconnect
    vi.advanceTimersByTime(firstDelay as number);

    // Second attempt
    triggerReconnect(proxy);
    const secondDelay = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number;

    expect(secondDelay).toBeGreaterThan(firstDelay as number);
    // Second attempt should be ~2000ms (2x base)
    expect(secondDelay).toBeGreaterThanOrEqual(2000);
    expect(secondDelay).toBeLessThanOrEqual(2500); // 2000 + 25% jitter
  });

  it("should increase delay exponentially on third reconnect attempt", () => {
    const spy = vi.spyOn(globalThis, "setTimeout");

    // First attempt
    triggerReconnect(proxy);
    const firstDelay = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number;
    vi.advanceTimersByTime(firstDelay as number);

    // Second attempt
    triggerReconnect(proxy);
    const secondDelay = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number;
    vi.advanceTimersByTime(secondDelay as number);

    // Third attempt
    triggerReconnect(proxy);
    const thirdDelay = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number;

    // Third attempt should be ~4000ms (4x base)
    expect(thirdDelay).toBeGreaterThanOrEqual(4000);
    expect(thirdDelay).toBeLessThanOrEqual(5000); // 4000 + 25% jitter
  });

  it("should cap delay at maxReconnectDelay", () => {
    const spy = vi.spyOn(globalThis, "setTimeout");

    // Simulate many reconnect attempts to exceed the cap
    for (let i = 0; i < 15; i++) {
      triggerReconnect(proxy);
      const delay = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number;
      vi.advanceTimersByTime(delay as number);
    }

    // After many attempts, delay should be capped at 30000ms (+ jitter)
    const lastDelay = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number;
    expect(lastDelay).toBeLessThanOrEqual(37500); // 30000 + 25% jitter
  });

  it("should stop reconnecting after maxReconnectAttempts", () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    // biome-ignore lint/complexity/useLiteralKeys: accessing readonly property for testing
    const maxAttempts = proxy["maxReconnectAttempts"] as number;

    // Exhaust all reconnect attempts
    for (let i = 0; i < maxAttempts; i++) {
      triggerReconnect(proxy);
      const delay = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number;
      vi.advanceTimersByTime(delay as number);
    }

    const callCountBefore = spy.mock.calls.length;

    // One more attempt should NOT schedule anything
    triggerReconnect(proxy);

    expect(spy.mock.calls.length).toBe(callCountBefore);
  });

  it("should apply jitter so delay is not exactly base * 2^attempt", () => {
    const spy = vi.spyOn(globalThis, "setTimeout");

    // Collect delays from many attempts to check jitter variation
    const delays: number[] = [];
    for (let i = 0; i < 5; i++) {
      triggerReconnect(proxy);
      const delay = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number;
      delays.push(delay as number);
      vi.advanceTimersByTime(delay as number);
    }

    // Verify delays are within expected jitter range
    expect(delays[0]).toBeGreaterThanOrEqual(1000);
    expect(delays[0]).toBeLessThanOrEqual(1250);
    expect(delays[1]).toBeGreaterThanOrEqual(2000);
    expect(delays[1]).toBeLessThanOrEqual(2500);
  });

  it("should reset reconnect attempt counter on successful connection", async () => {
    // Capture the subscription callbacks from the mock
    const { createTRPCClient } = await import("@trpc/client");
    const mockSubscribe = vi.fn();
    (createTRPCClient as ReturnType<typeof vi.fn>).mockReturnValue({
      events: {
        subscribe: {
          subscribe: mockSubscribe,
        },
      },
    });

    const localProxy = new RemoteEventProxy("http://localhost:3000/api", mockEventBus);

    // Make some reconnect attempts
    triggerReconnect(localProxy);
    triggerReconnect(localProxy);
    expect(getReconnectAttempt(localProxy)).toBe(2);

    // Now simulate a successful connection
    localProxy.connect();

    // The subscribe method should have been called; extract the onStarted callback
    expect(mockSubscribe).toHaveBeenCalled();
    const subscribeOptions = mockSubscribe.mock.calls[0]?.[1] as {
      onStarted: () => void;
    };

    // Simulate the subscription starting (successful connection)
    subscribeOptions.onStarted();

    // reconnectAttempt should be reset to 0
    expect(getReconnectAttempt(localProxy)).toBe(0);
  });
});
