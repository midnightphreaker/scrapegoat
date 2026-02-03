/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 *
 * Based on React error boundaries pattern adapted for vanilla JS.
 */

import type { Component, ComponentChildren } from "nano-jsx/esm";

export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ComponentChildren;
  /** Fallback UI to render when an error occurs */
  fallback?: Component | string;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
  /** Custom error message */
  errorMessage?: string;
}

export interface ErrorBoundaryState {
  /** Whether an error has occurred */
  hasError: boolean;
  /** The error that occurred */
  error: Error | null;
}

/**
 * Error state container (simplified for non-React environment)
 * In production, errors should be handled at the component level
 */
export function createErrorBoundary(
  element: HTMLElement,
  props: ErrorBoundaryProps = {}
): {
  render: () => void;
  destroy: () => void;
  getErrorState: () => ErrorBoundaryState;
  reset: () => void;
} {
  let state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  // Error handler for component errors
  const handleError = (event: ErrorEvent) => {
    event.preventDefault();
    const error = event.error || new Error("Unknown error");

    state = {
      hasError: true,
      error,
    };

    // Log error
    console.error("ErrorBoundary caught an error:", error);

    // Call error callback if provided
    if (props.onError) {
      props.onError(error, {
        componentStack: event.colno ? `line ${event.lineno}:${event.colno}` : "unknown",
      });
    }

    // Render error state
    renderError();
  };

  /**
   * Render the error state
   */
  function renderError(): void {
    if (!state.hasError) return;

    const fallback = props.fallback || defaultFallback;

    if (typeof fallback === "string") {
      element.innerHTML = fallback;
    } else if (typeof fallback === "function") {
      element.innerHTML = "";
      element.appendChild(fallback(state.error));
    }
  }

  /**
   * Render normal content
   */
  function render(): void {
    if (state.hasError) {
      renderError();
      return;
    }

    // Render children
    const { children } = props;
    if (typeof children === "string") {
      element.innerHTML = children;
    } else if (typeof children === "function") {
      // Handle function components
      element.innerHTML = "";
      const child = children();
      if (child instanceof HTMLElement) {
        element.appendChild(child);
      }
    }
  }

  /**
   * Reset the error boundary
   */
  function reset(): void {
    state = {
      hasError: false,
      error: null,
    };
    render();
  }

  /**
   * Clean up event listeners
   */
  function destroy(): void {
    element.removeEventListener("error", handleError as EventListener);
  }

  // Set up error handling
  element.addEventListener("error", handleError as EventListener);

  // Initial render
  render();

  return {
    render,
    destroy,
    getErrorState: () => state,
    reset,
  };
}

/**
 * Default fallback error UI
 */
function defaultFallback(error: Error | null): HTMLElement {
  const container = document.createElement("div");
  container.className =
    "min-h-[200px] flex items-center justify-center p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg";

  container.innerHTML = `
    <div class="text-center">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 mb-4">
        <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.932-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.932 3z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
        Something went wrong
      </h3>
      <p class="text-sm text-red-700 dark:text-red-300 mb-4">
        ${error?.message || "An unexpected error occurred. Please try refreshing the page."}
      </p>
      <button
        type="button"
        onclick="location.reload()"
        class="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Reload Page
      </button>
      ${error?.stack ? `
        <details class="mt-4 text-left">
          <summary class="cursor-pointer text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 font-medium">
            Error Details
          </summary>
          <pre class="mt-2 p-3 bg-red-100 dark:bg-red-950/50 rounded text-xs text-red-900 dark:text-red-200 overflow-x-auto">${
            error.stack
              ? error.stack.replace(/</g, "&lt;").replace(/>/g, "&gt;")
              : "No stack trace available"
          }</pre>
        </details>
      ` : ""}
    </div>
  `;

  return container;
}

/**
 * Global error handler for uncaught errors
 */
export function setupGlobalErrorHandler(
  onError?: (error: Error) => void
): () => void {
  const handleError = (event: ErrorEvent) => {
    // Don't interfere with script error handling
    if (event.error instanceof Error) {
      console.error("Global error handler:", event.error);
      if (onError) {
        onError(event.error);
      }
    }
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error("Unhandled promise rejection:", event.reason);
    if (onError && event.reason instanceof Error) {
      onError(event.reason);
    }
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  // Return cleanup function
  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  };
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => unknown>(
  fn: T,
  onError?: (error: Error, ...args: Parameters<T>) => void
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);

      // Handle promises
      if (result instanceof Promise) {
        return result.catch((error) => {
          if (onError) {
            onError(error instanceof Error ? error : new Error(String(error)), ...args);
          }
          throw error;
        });
      }

      return result;
    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)), ...args);
      }
      throw error;
    }
  }) as T;
}

/**
 * Create a component-safe async operation wrapper
 */
export function createAsyncComponent<T>(
  asyncFn: () => Promise<T>,
  options: {
    onSuccess?: (result: T) => void;
    onError?: (error: Error) => void;
    loadingElement?: HTMLElement;
  }
): {
  execute: () => Promise<void>;
  reset: () => void;
} {
  const { onSuccess, onError, loadingElement } = options;
  let currentController: AbortController | null = null;

  const execute = async (): Promise<void> => {
    // Abort previous operation if running
    if (currentController) {
      currentController.abort();
    }

    currentController = new AbortController();
    const { signal } = currentController;

    try {
      // Show loading state if provided
      if (loadingElement) {
        loadingElement.style.display = "";
      }

      const result = await asyncFn();

      // Check if aborted
      if (signal.aborted) return;

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      if (signal.aborted) return;

      if (error instanceof Error || onError) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (onError) {
          onError(err);
        } else {
          console.error("Async component error:", err);
        }
      }

      throw error;
    } finally {
      if (loadingElement) {
        loadingElement.style.display = "none";
      }
      currentController = null;
    }
  };

  const reset = (): void => {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }
  };

  return {
    execute,
    reset,
  };
}
