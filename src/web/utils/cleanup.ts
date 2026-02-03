/**
 * Cleanup utilities for preventing memory leaks
 * Provides consistent resource cleanup patterns
 */

/**
 * Represents a cleanup function that can be called to release resources
 */
export type CleanupFunction = () => void;

/**
 * A registry for managing cleanup functions
 */
class CleanupRegistry {
  private cleanupFunctions: Set<CleanupFunction> = new Set();
  private isCleaned = false;

  /**
   * Register a cleanup function
   */
  register(cleanup: CleanupFunction): void {
    if (this.isCleaned) {
      cleanup();
      return;
    }
    this.cleanupFunctions.add(cleanup);
  }

  /**
   * Unregister a cleanup function
   */
  unregister(cleanup: CleanupFunction): void {
    this.cleanupFunctions.delete(cleanup);
  }

  /**
   * Execute all cleanup functions
   */
  cleanup(): void {
    if (this.isCleaned) return;

    for (const cleanup of this.cleanupFunctions) {
      try {
        cleanup();
      } catch (error) {
        console.error("Error during cleanup:", error);
      }
    }

    this.cleanupFunctions.clear();
    this.isCleaned = true;
  }

  /**
   * Check if cleanup has been performed
   */
  get cleaned(): boolean {
    return this.isCleaned;
  }
}

/**
 * Create a new cleanup registry
 */
export function createCleanupRegistry(): CleanupRegistry {
  return new CleanupRegistry();
}

/**
 * Safe event listener registration that returns cleanup function
 */
export function addEventListenerSafe<T extends EventTarget>(
  target: T,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions | boolean,
): CleanupFunction {
  target.addEventListener(event, handler, options);

  return () => {
    target.removeEventListener(event, handler, options);
  };
}

/**
 * Safe interval creation that returns cleanup function
 */
export function setIntervalSafe(callback: () => void, delay: number): CleanupFunction {
  const id = setInterval(callback, delay);

  return () => {
    clearInterval(id);
  };
}

/**
 * Safe timeout creation that returns cleanup function
 */
export function setTimeoutSafe(callback: () => void, delay: number): CleanupFunction {
  const id = setTimeout(callback, delay);

  return () => {
    clearTimeout(id);
  };
}

/**
 * Safe requestAnimationFrame that returns cleanup function
 */
export function requestAnimationFrameSafe(callback: () => void): CleanupFunction {
  const id = requestAnimationFrame(callback);

  return () => {
    cancelAnimationFrame(id);
  };
}

/**
 * Safe ResizeObserver creation that returns cleanup function
 */
export function observeResizeSafe(
  target: Element,
  callback: ResizeObserverCallback,
): CleanupFunction {
  const observer = new ResizeObserver(callback);
  observer.observe(target);

  return () => {
    observer.disconnect();
  };
}

/**
 * Safe MutationObserver creation that returns cleanup function
 */
export function observeMutationSafe(
  target: Node,
  options: MutationObserverInit,
  callback: MutationCallback,
): CleanupFunction {
  const observer = new MutationObserver(callback);
  observer.observe(target, options);

  return () => {
    observer.disconnect();
  };
}

/**
 * Safe IntersectionObserver creation that returns cleanup function
 */
export function observeIntersectionSafe(
  targets: Element[],
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit,
): CleanupFunction {
  const observer = new IntersectionObserver(callback, options);

  for (const target of targets) {
    observer.observe(target);
  }

  return () => {
    observer.disconnect();
  };
}

/**
 * Track Alpine.js component cleanup
 * Call this when an Alpine component is destroyed
 */
export function trackAlpineCleanup(
  component: Record<string, unknown>,
  registry: CleanupRegistry,
): void {
  const originalDestroy = component.$destroy;

  if (typeof originalDestroy === "function") {
    component.$destroy = () => {
      registry.cleanup();
      originalDestroy.call(component);
    };
  }
}

/**
 * HTMX event listener with automatic cleanup
 */
export function addHtmxEventListener(
  eventName: string,
  handler: (event: Event) => void,
  selector?: string,
): CleanupFunction {
  const wrappedHandler = (event: Event) => {
    if (!selector || (event.target as Element)?.matches(selector)) {
      handler(event);
    }
  };

  document.body.addEventListener(eventName, wrappedHandler);

  return () => {
    document.body.removeEventListener(eventName, wrappedHandler);
  };
}

/**
 * Auto-cleanup for element lifecycle
 * Returns a cleanup function that runs when element is removed from DOM
 */
export function cleanupOnRemove(element: Element, cleanup: CleanupFunction): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (node === element || (node as Node).contains?.(element)) {
          cleanup();
          observer.disconnect();
          return;
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Debounced function with cleanup
 */
export function debounceSafe<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): { fn: T; cleanup: CleanupFunction } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  }) as T;

  const cleanup = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return { fn: debounced, cleanup };
}

/**
 * Throttled function with cleanup
 */
export function throttleSafe<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number,
): { fn: T; cleanup: CleanupFunction } {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args;

    if (!inThrottle) {
      inThrottle = true;

      func(...args);

      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    }
  }) as T;

  const cleanup = () => {
    inThrottle = false;
    lastArgs = null;
  };

  return { fn: throttled, cleanup };
}

/**
 * Memory usage tracker for debugging
 */
export class MemoryTracker {
  private measurements: Map<string, number[]> = new Map();

  /**
   * Record a memory measurement for a category
   */
  record(category: string, value: number): void {
    if (!this.measurements.has(category)) {
      this.measurements.set(category, []);
    }
    this.measurements.get(category)?.push(value);
  }

  /**
   * Get average memory usage for a category
   */
  getAverage(category: string): number {
    const values = this.measurements.get(category);
    if (!values || values.length === 0) return 0;

    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * Get trend for a category (increasing/decreasing/stable)
   */
  getTrend(category: string): "increasing" | "decreasing" | "stable" | "unknown" {
    const values = this.measurements.get(category);
    if (!values || values.length < 3) return "unknown";

    const first = values[0];
    const last = values[values.length - 1];
    if (first === undefined || last === undefined) return "unknown";
    const threshold = 0.1; // 10% threshold

    const diff = (last - first) / first;

    if (diff > threshold) return "increasing";
    if (diff < -threshold) return "decreasing";
    return "stable";
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
  }

  /**
   * Get current memory usage if available
   */
  static getCurrentMB(): number | null {
    if ("memory" in performance && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024);
    }
    return null;
  }
}

/**
 * Check for potential memory leaks in event listeners
 * Logs warning if too many listeners are attached to an element
 */
export function auditEventListeners(element: Element, threshold = 10): void {
  // This is a basic check - actual listener counting is not available in standard DOM APIs
  // For more accurate auditing, use Chrome DevTools or a dedicated library

  // Check for common memory leak patterns
  const checks = [
    // Elements with many data attributes (potential stale data)
    () => {
      const dataAttrs = Array.from(element.attributes).filter((attr) =>
        attr.name.startsWith("data-"),
      );
      return dataAttrs.length > threshold;
    },
    // Elements deeply nested in detached DOM
    () => {
      return !document.body.contains(element) && element.children.length > 50;
    },
  ];

  for (const check of checks) {
    if (check()) {
      console.warn("Potential memory leak detected:", element);
    }
  }
}

/**
 * Cleanup utility for components using Alpine.js
 * Provides a hook-based API for managing resources
 */
export function createAlpineCleanup() {
  const registry = createCleanupRegistry();

  return {
    /**
     * Register a cleanup function
     */
    onCleanup: (cleanup: CleanupFunction) => {
      registry.register(cleanup);
    },

    /**
     * Execute all cleanups
     */
    cleanup: () => {
      registry.cleanup();
    },

    /**
     * Check if cleaned
     */
    get cleaned(): boolean {
      return registry.cleaned;
    },
  };
}
