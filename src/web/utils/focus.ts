/**
 * Focus management utilities for web components
 * Provides consistent keyboard navigation and focus handling
 */

/**
 * Trap focus within an element (for modals, dropdowns, etc.)
 * Returns a cleanup function to remove the trap
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );

  const firstFocusable = focusableElements[0] as HTMLElement;
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;

    if (event.shiftKey) {
      // Shift+Tab: focus last element if on first
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab: focus first element if on last
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  element.addEventListener("keydown", handleKeyDown);

  // Focus the first element
  firstFocusable?.focus();

  // Return cleanup function
  return () => {
    element.removeEventListener("keydown", handleKeyDown);
  };
}

/**
 * Get the first focusable element within a container
 */
export function getFirstFocusable(container: HTMLElement): HTMLElement | null {
  const focusable = container.querySelector(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ) as HTMLElement;
  return focusable || null;
}

/**
 * Get the last focusable element within a container
 */
export function getLastFocusable(container: HTMLElement): HTMLElement | null {
  const focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  return (focusable[focusable.length - 1] as HTMLElement) || null;
}

/**
 * Get all focusable elements within a container in tab order
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
  );
  return Array.from(focusable) as HTMLElement[];
}

/**
 * Check if an element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (element.tabIndex < 0) return false;
  if (element.disabled) return false;

  const tagName = element.tagName.toLowerCase();
  if (["a", "button", "input", "select", "textarea"].includes(tagName)) {
    return true;
  }

  return element.tabIndex >= 0;
}

/**
 * Move focus to the next focusable element
 */
export function focusNext(container: HTMLElement, current?: HTMLElement): boolean {
  const focusable = getFocusableElements(container);
  const currentIndex = current ? focusable.indexOf(current) : -1;

  if (currentIndex < focusable.length - 1) {
    focusable[currentIndex + 1]?.focus();
    return true;
  }

  // Wrap to beginning
  if (focusable.length > 0) {
    focusable[0]?.focus();
    return true;
  }

  return false;
}

/**
 * Move focus to the previous focusable element
 */
export function focusPrevious(container: HTMLElement, current?: HTMLElement): boolean {
  const focusable = getFocusableElements(container);
  const currentIndex = current ? focusable.indexOf(current) : focusable.length;

  if (currentIndex > 0) {
    focusable[currentIndex - 1]?.focus();
    return true;
  }

  // Wrap to end
  if (focusable.length > 0) {
    focusable[focusable.length - 1]?.focus();
    return true;
  }

  return false;
}

/**
 * Restore focus to a previously focused element
 * Useful for returning focus after closing a modal/dialog
 */
export function restoreFocus(previousElement: HTMLElement | null): void {
  previousElement?.focus();
}

/**
 * Save the current focused element for later restoration
 */
export function saveFocus(): HTMLElement | null {
  return document.activeElement as HTMLElement;
}

/**
 * Create a "Skip to main content" link for accessibility
 * Returns a link element that should be placed at the top of the page
 */
export function createSkipLink(targetId = "main-content"): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = `#${targetId}`;
  link.textContent = "Skip to main content";
  link.className =
    "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-primary-600 focus:ring-2 focus:ring-primary-600 focus:rounded-lg";
  link.tabIndex = 0;
  return link;
}

/**
 * Set up an "Escape key closes" handler for modals/dropdowns
 */
export function setupEscapeClose(element: HTMLElement, onClose: () => void): () => void {
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
    }
  };

  element.addEventListener("keydown", handleEscape);

  return () => {
    element.removeEventListener("keydown", handleEscape);
  };
}

/**
 * Manage focus for a modal dialog
 * Combines focus trap and escape key handling
 */
export function manageModalFocus(modal: HTMLElement, onClose: () => void): () => void {
  // Save previous focus
  const previousFocus = saveFocus();

  // Set up focus trap
  const cleanupTrap = trapFocus(modal);

  // Set up escape key handler
  const cleanupEscape = setupEscapeClose(modal, onClose);

  // Mark modal as a dialog
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  // Return combined cleanup function
  return () => {
    cleanupTrap();
    cleanupEscape();
    restoreFocus(previousFocus);
  };
}

/**
 * Initialize keyboard navigation for a list-like component
 * (e.g., job list, search results)
 */
export function setupListNavigation(
  listElement: HTMLElement,
  onSelect: (element: HTMLElement) => void,
): () => void {
  const items = getFocusableElements(listElement);

  const handleKeyDown = (event: KeyboardEvent) => {
    const focused = document.activeElement as HTMLElement;
    const currentIndex = items.indexOf(focused);

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (currentIndex < items.length - 1) {
          items[currentIndex + 1]?.focus();
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (currentIndex > 0) {
          items[currentIndex - 1]?.focus();
        }
        break;
      case "Home":
        event.preventDefault();
        items[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (focused && items.includes(focused)) {
          onSelect(focused);
        }
        break;
    }
  };

  listElement.addEventListener("keydown", handleKeyDown);

  return () => {
    listElement.removeEventListener("keydown", handleKeyDown);
  };
}

/**
 * Add a visual focus indicator style sheet if not present
 */
export function ensureFocusStyles(): void {
  if (document.getElementById("focus-styles")) return;

  const style = document.createElement("style");
  style.id = "focus-styles";
  style.textContent = `
    /* Ensure focus is always visible */
    *:focus-visible {
      outline: 2px solid rgb(59 130 246);
      outline-offset: 2px;
    }

    /* Hide default focus for mouse users */
    *:focus:not(:focus-visible) {
      outline: none;
    }

    /* Screen reader only class */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .focus\\:not-sr-only:focus {
      position: static;
      width: auto;
      height: auto;
      padding: inherit;
      margin: inherit;
      overflow: visible;
      clip: auto;
      white-space: normal;
    }
  `;
  document.head.appendChild(style);
}
