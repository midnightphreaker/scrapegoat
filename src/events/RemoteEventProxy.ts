/**
 * Remote event proxy that subscribes to events from a remote tRPC worker
 * and re-emits them to the local EventBusService.
 *
 * This enables the web UI to receive events from remote workers transparently,
 * without needing to know about the remote worker's location or configuration.
 */

import {
  createTRPCClient,
  createWSClient,
  httpBatchLink,
  splitLink,
  wsLink,
} from "@trpc/client";
import superjson from "superjson";
import { logger } from "../utils/logger";
import type { EventBusService } from "./EventBusService";
import type { EventType } from "./types";

/**
 * Manages the connection to a remote worker and forwards its events locally.
 */
export class RemoteEventProxy {
  private trpcClient: ReturnType<typeof createTRPCClient> | null = null;
  private wsClient: ReturnType<typeof createWSClient> | null = null;
  private subscription: { unsubscribe: () => void } | null = null;
  private isConnected = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Maximum number of consecutive reconnection attempts before giving up. */
  readonly maxReconnectAttempts = 10;

  /** Base delay in milliseconds for the first reconnection attempt. */
  readonly baseReconnectDelay = 1000;

  /** Maximum delay in milliseconds for reconnection (caps exponential growth). */
  readonly maxReconnectDelay = 30000;

  constructor(
    private readonly remoteWorkerUrl: string,
    private readonly localEventBus: EventBusService,
  ) {}

  /**
   * Start subscribing to remote events and forwarding them locally.
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn("Remote event proxy already connected");
      return;
    }

    logger.debug(`Connecting to remote worker at ${this.remoteWorkerUrl}`);

    try {
      // Extract base URL without the /api path for WebSocket connection
      // The tRPC WebSocket adapter handles the /api routing internally
      const url = new URL(this.remoteWorkerUrl);
      const baseUrl = `${url.protocol}//${url.host}`;
      const wsUrl = baseUrl.replace(/^http/, "ws");

      // Create WebSocket client for subscriptions
      this.wsClient = createWSClient({
        url: wsUrl,
        onError: (evt) => {
          logger.error(
            `❌ Remote event WebSocket error (${wsUrl}): ${evt ? "connection refused or unavailable" : "unknown error"}`,
          );
        },
        onClose: (cause) => {
          logger.debug(
            `Remote event WebSocket closed (${wsUrl}, code: ${cause?.code ?? "unknown"})`,
          );
        },
      });

      // Create tRPC client with split link:
      // - Subscriptions use WebSocket
      // - Queries and mutations use HTTP
      this.trpcClient = createTRPCClient({
        links: [
          splitLink({
            condition: (op) => op.type === "subscription",
            true: wsLink({ client: this.wsClient, transformer: superjson }),
            false: httpBatchLink({ url: this.remoteWorkerUrl, transformer: superjson }),
          }),
        ],
      });

      // Subscribe to all events from the remote worker
      // biome-ignore lint/suspicious/noExplicitAny: tRPC client type is generic
      this.subscription = (this.trpcClient as any).events.subscribe.subscribe(
        {}, // Subscribe to all event types
        {
          onData: (data: { type: EventType; payload: unknown }) => {
            logger.debug(`Received remote event: ${data.type}`);
            // Re-emit the event on the local event bus
            this.localEventBus.emit(data.type, data.payload as never);
          },
          onError: (error: Error) => {
            logger.error(`❌ Remote event subscription error: ${error}`);
            this.isConnected = false;
            this.scheduleReconnect();
          },
          onStarted: () => {
            logger.debug("Remote event subscription started");
            this.isConnected = true;
            this.reconnectAttempt = 0;
          },
          onComplete: () => {
            logger.debug("Remote event subscription completed");
            this.isConnected = false;
          },
        },
      );
    } catch (error) {
      logger.error(`❌ Failed to connect to remote worker: ${error}`);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the remote worker and stop forwarding events.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    // Close WebSocket connection
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }

    this.isConnected = false;
    logger.info("🚫 Disconnected from remote worker");
  }

  /**
   * Check if the proxy is currently connected to the remote worker.
   */
  isActive(): boolean {
    return this.isConnected;
  }

  /**
   * Schedule a reconnection attempt using exponential backoff with jitter.
   *
   * Delay is calculated as: min(base * 2^attempt, maxDelay) + random jitter
   * where jitter is a random value between 0 and 25% of the calculated delay.
   * After {@link maxReconnectAttempts} failed attempts, reconnection stops.
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      logger.error(
        `❌ Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`,
      );
      return;
    }

    const exponentialDelay = Math.min(
      this.baseReconnectDelay * 2 ** this.reconnectAttempt,
      this.maxReconnectDelay,
    );
    const jitter = exponentialDelay * 0.25 * Math.random();
    const delay = exponentialDelay + jitter;

    this.reconnectAttempt++;

    logger.info(
      `🔄 Scheduling reconnect to remote worker in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt}/${this.maxReconnectAttempts})...`,
    );

    this.reconnectTimer = setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }
}
