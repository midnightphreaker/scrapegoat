/**
 * Keyboard shortcut management system
 * Provides global keyboard navigation and command handling
 */

export interface KeyboardShortcut {
  key: string;
  description: string;
  handler: (event: KeyboardEvent) => void | boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  category?: "navigation" | "actions" | "forms" | "general";
}

/**
 * Keyboard shortcut manager
 */
class KeyboardShortcutManager {
  private _shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isEnabled = true;
  private helpModalVisible = false;

  // Expose shortcuts for testing
  get shortcuts(): Map<string, KeyboardShortcut> {
    return this._shortcuts;
  }

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut);
    this._shortcuts.set(key, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(shortcut: Omit<KeyboardShortcut, "handler">): void {
    const key = this.getShortcutKey(shortcut as KeyboardShortcut);
    this._shortcuts.delete(key);
  }

  /**
   * Generate a unique key for the shortcut
   */
  private getShortcutKey(shortcut: KeyboardShortcut): string {
    return [
      shortcut.ctrlKey ? "ctrl" : "",
      shortcut.altKey ? "alt" : "",
      shortcut.shiftKey ? "shift" : "",
      shortcut.metaKey ? "meta" : "",
      shortcut.key.toLowerCase(),
    ]
      .filter(Boolean)
      .join("+");
  }

  /**
   * Check if an event matches a shortcut
   */
  private matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    return (
      event.key.toLowerCase() === shortcut.key.toLowerCase() &&
      !!event.ctrlKey === !!shortcut.ctrlKey &&
      !!event.altKey === !!shortcut.altKey &&
      !!event.shiftKey === !!shortcut.shiftKey &&
      !!event.metaKey === !!shortcut.metaKey
    );
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isEnabled) return;

    // Ignore if in input fields (unless it's a form-specific shortcut)
    const target = event.target as HTMLElement;
    const isInputElement =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable;

    if (isInputElement) {
      // Only allow form-specific shortcuts in inputs
      const formShortcuts = Array.from(this._shortcuts.values()).filter(
        (s) => s.category === "forms",
      );
      for (const shortcut of formShortcuts) {
        if (this.matchesShortcut(event, shortcut)) {
          const result = shortcut.handler(event);
          if (result !== false) {
            event.preventDefault();
          }
          return;
        }
      }
      return;
    }

    // Check all shortcuts
    for (const shortcut of this._shortcuts.values()) {
      if (this.matchesShortcut(event, shortcut)) {
        const result = shortcut.handler(event);
        if (result !== false) {
          event.preventDefault();
        }
        return;
      }
    }
  };

  /**
   * Enable keyboard shortcuts
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable keyboard shortcuts
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * Get all registered shortcuts
   */
  getAll(): KeyboardShortcut[] {
    return Array.from(this._shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  getByCategory(category: KeyboardShortcut["category"]): KeyboardShortcut[] {
    return Array.from(this._shortcuts.values()).filter((s) => s.category === category);
  }

  /**
   * Get the display text for a shortcut
   */
  getShortcutDisplayText(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];

    if (shortcut.ctrlKey)
      parts.push(window.navigator.platform.startsWith("Mac") ? "⌘" : "Ctrl");
    if (shortcut.altKey) parts.push("Alt");
    if (shortcut.shiftKey) parts.push("Shift");
    if (shortcut.metaKey) parts.push("⌘");

    // Format key for display
    let key = shortcut.key;
    if (key === " ") key = "Space";
    if (key === "escape") key = "Esc";
    if (key === "arrowup") key = "↑";
    if (key === "arrowdown") key = "↓";
    if (key === "arrowleft") key = "←";
    if (key === "arrowright") key = "→";

    // Capitalize first letter
    key = key.charAt(0).toUpperCase() + key.slice(1);

    parts.push(key);

    return parts.join(" + ");
  }

  /**
   * Show help modal with all shortcuts
   */
  showHelp(): void {
    if (this.helpModalVisible) return;

    const modal = document.createElement("div");
    modal.id = "keyboard-shortcuts-help";
    modal.className =
      "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "shortcuts-title");

    const shortcutsByCategory = new Map<string, KeyboardShortcut[]>();
    for (const shortcut of this._shortcuts.values()) {
      const category = shortcut.category || "general";
      if (!shortcutsByCategory.has(category)) {
        shortcutsByCategory.set(category, []);
      }
      shortcutsByCategory.get(category)!.push(shortcut);
    }

    const categoryTitles: Record<string, string> = {
      navigation: "Navigation",
      actions: "Actions",
      forms: "Form Shortcuts",
      general: "General",
    };

    let shortcutsHtml = "";
    for (const [category, shortcuts] of shortcutsByCategory) {
      shortcutsHtml += `
        <div class="mb-6">
          <h3 class="text-sm font-semibold text-stone-800 dark:text-stone-100 mb-2">
            ${categoryTitles[category] || category}
          </h3>
          <ul class="space-y-2">
            ${shortcuts
              .map(
                (s) => `
              <li class="flex justify-between items-center">
                <span class="text-sm text-stone-600 dark:text-stone-400">${s.description}</span>
                <kbd class="px-2 py-1 text-xs font-mono bg-stone-100 dark:bg-stone-700 rounded text-stone-800 dark:text-stone-200">
                  ${this.getShortcutDisplayText(s)}
                </kbd>
              </li>
            `,
              )
              .join("")}
          </ul>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="bg-white dark:bg-stone-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 id="shortcuts-title" class="text-xl font-semibold text-stone-800 dark:text-stone-100">
              Keyboard Shortcuts
            </h2>
            <button
              type="button"
              class="text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
              aria-label="Close"
              onclick="document.getElementById('keyboard-shortcuts-help')?.remove()"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="text-stone-600 dark:text-stone-400 text-sm mb-4">
            Press <kbd class="px-1 py-0.5 text-xs font-mono bg-stone-100 dark:bg-stone-700 rounded">?</kbd> to close this help
          </div>
          ${shortcutsHtml}
        </div>
      </div>
    `;

    // Close on Escape or ?
    const closeHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        modal.remove();
        this.helpModalVisible = false;
        document.removeEventListener("keydown", closeHandler);
      }
    };

    // Close on background click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
        this.helpModalVisible = false;
        document.removeEventListener("keydown", closeHandler);
      }
    });

    document.addEventListener("keydown", closeHandler);
    document.body.appendChild(modal);
    this.helpModalVisible = true;

    // Focus close button
    const closeBtn = modal.querySelector("button");
    closeBtn?.focus();
  }

  /**
   * Initialize the keyboard shortcut system
   */
  initialize(): () => void {
    document.addEventListener("keydown", this.handleKeyDown);

    // Return cleanup function
    return () => {
      document.removeEventListener("keydown", this.handleKeyDown);
    };
  }
}

// Global instance
const manager = new KeyboardShortcutManager();

/**
 * Get display text for a keyboard shortcut (standalone function)
 */
export function getShortcutDisplayText(shortcut: KeyboardShortcut): string {
  return manager.getShortcutDisplayText(shortcut);
}

/**
 * Register a keyboard shortcut
 */
export function registerShortcut(shortcut: KeyboardShortcut): void {
  manager.register(shortcut);
}

/**
 * Unregister a keyboard shortcut
 */
export function unregisterShortcut(shortcut: Omit<KeyboardShortcut, "handler">): void {
  manager.unregister(shortcut);
}

/**
 * Show keyboard shortcuts help modal
 */
export function showShortcutsHelp(): void {
  manager.showHelp();
}

/**
 * Enable keyboard shortcuts
 */
export function enableShortcuts(): void {
  manager.enable();
}

/**
 * Disable keyboard shortcuts
 */
export function disableShortcuts(): void {
  manager.disable();
}

/**
 * Get all registered shortcuts
 */
export function getAllShortcuts(): KeyboardShortcut[] {
  return manager.getAll();
}

/**
 * Initialize keyboard shortcuts with default commands
 */
export function initializeShortcuts(): () => void {
  // Register default shortcuts
  registerShortcut({
    key: "?",
    description: "Show keyboard shortcuts",
    handler: () => showShortcutsHelp(),
    category: "general",
  });

  registerShortcut({
    key: "k",
    ctrlKey: true,
    description: "Quick search",
    handler: () => {
      const searchInput = document.querySelector<HTMLInputElement>(
        'input[type="search"], input[placeholder*="search" i]',
      );
      searchInput?.focus();
    },
    category: "navigation",
  });

  registerShortcut({
    key: "n",
    ctrlKey: true,
    description: "New scrape job",
    handler: () => {
      const urlInput = document.querySelector<HTMLInputElement>("#url");
      urlInput?.focus();
      urlInput?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    category: "actions",
  });

  registerShortcut({
    key: "Escape",
    description: "Close modals/dropdowns",
    handler: () => {
      // Close any open modals
      const modals = document.querySelectorAll('[role="dialog"]');
      modals.forEach((modal) => {
        if (modal.id !== "keyboard-shortcuts-help") {
          modal.remove();
        }
      });
    },
    category: "general",
  });

  return manager.initialize();
}

export { manager, manager as shortcutManager };
export type { KeyboardShortcut };
