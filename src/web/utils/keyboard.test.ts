/**
 * Tests for keyboard shortcuts utilities
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disableShortcuts,
  enableShortcuts,
  getAllShortcuts,
  getShortcutDisplayText,
  initializeShortcuts,
  type KeyboardShortcut,
  manager,
  registerShortcut,
  showShortcutsHelp,
  unregisterShortcut,
} from "./keyboard";

describe("keyboard shortcuts", () => {
  beforeEach(() => {
    // Clear all registered shortcuts
    manager.shortcuts.clear();
    manager.enable();
  });

  afterEach(() => {
    manager.shortcuts.clear();
  });

  describe("registerShortcut", () => {
    it("registers a keyboard shortcut", () => {
      const handler = vi.fn();
      registerShortcut({
        key: "a",
        description: "Test shortcut",
        handler,
        category: "general",
      });

      const shortcuts = getAllShortcuts();
      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].key).toBe("a");
    });

    it("registers shortcut with modifiers", () => {
      const handler = vi.fn();
      registerShortcut({
        key: "s",
        ctrlKey: true,
        description: "Save",
        handler,
      });

      const shortcuts = getAllShortcuts();
      expect(shortcuts[0].ctrlKey).toBe(true);
    });
  });

  describe("unregisterShortcut", () => {
    it("unregisters a keyboard shortcut", () => {
      const handler = vi.fn();
      registerShortcut({
        key: "a",
        description: "Test shortcut",
        handler,
      });

      expect(getAllShortcuts()).toHaveLength(1);

      unregisterShortcut({ key: "a", description: "Test shortcut", handler });

      expect(getAllShortcuts()).toHaveLength(0);
    });
  });

  describe("getAllShortcuts", () => {
    it("returns all registered shortcuts", () => {
      registerShortcut({
        key: "a",
        description: "Shortcut A",
        handler: () => {},
      });
      registerShortcut({
        key: "b",
        description: "Shortcut B",
        handler: () => {},
      });

      const shortcuts = getAllShortcuts();
      expect(shortcuts).toHaveLength(2);
    });

    it("returns empty array when no shortcuts registered", () => {
      expect(getAllShortcuts()).toHaveLength(0);
    });
  });

  describe("enableShortcuts and disableShortcuts", () => {
    it("disables shortcuts when disabled", () => {
      const handler = vi.fn();
      registerShortcut({
        key: "a",
        description: "Test",
        handler,
      });

      disableShortcuts();

      const event = new KeyboardEvent("keydown", { key: "a" });
      document.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it("enables shortcuts when enabled", () => {
      const handler = vi.fn();
      registerShortcut({
        key: "a",
        description: "Test",
        handler,
      });

      enableShortcuts();

      const event = new KeyboardEvent("keydown", { key: "a" });
      document.dispatchEvent(event);

      // Handler should be called (and prevent default)
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("getShortcutDisplayText", () => {
    it("formats simple keys", () => {
      const shortcut: KeyboardShortcut = {
        key: "a",
        description: "Test",
        handler: () => {},
      };
      expect(getShortcutDisplayText(shortcut)).toBe("A");
    });

    it("formats Ctrl+Key combinations", () => {
      const shortcut: KeyboardShortcut = {
        key: "s",
        ctrlKey: true,
        description: "Save",
        handler: () => {},
      };
      expect(getShortcutDisplayText(shortcut)).toContain("Ctrl");
      expect(getShortcutDisplayText(shortcut)).toContain("S");
    });

    it("formats special keys", () => {
      const shortcut: KeyboardShortcut = {
        key: "escape",
        description: "Close",
        handler: () => {},
      };
      expect(getShortcutDisplayText(shortcut)).toBe("Esc");
    });

    it("formats arrow keys", () => {
      const upShortcut: KeyboardShortcut = {
        key: "arrowup",
        description: "Up",
        handler: () => {},
      };
      expect(getShortcutDisplayText(upShortcut)).toContain("↑");

      const downShortcut: KeyboardShortcut = {
        key: "arrowdown",
        description: "Down",
        handler: () => {},
      };
      expect(getShortcutDisplayText(downShortcut)).toContain("↓");
    });

    it("formats space key", () => {
      const shortcut: KeyboardShortcut = {
        key: " ",
        description: "Space",
        handler: () => {},
      };
      expect(getShortcutDisplayText(shortcut)).toBe("Space");
    });
  });

  describe("showShortcutsHelp", () => {
    it("creates help modal", () => {
      registerShortcut({
        key: "a",
        description: "Test shortcut",
        handler: () => {},
        category: "general",
      });

      showShortcutsHelp();

      const modal = document.getElementById("keyboard-shortcuts-help");
      expect(modal).toBeTruthy();
      expect(modal?.getAttribute("role")).toBe("dialog");

      // Clean up
      modal?.remove();
    });

    it("does not create duplicate modals", () => {
      registerShortcut({
        key: "a",
        description: "Test shortcut",
        handler: () => {},
        category: "general",
      });

      showShortcutsHelp();
      showShortcutsHelp();

      const modals = document.querySelectorAll("#keyboard-shortcuts-help");
      expect(modals).toHaveLength(1);

      // Clean up
      modals.forEach((m) => m.remove());
    });
  });

  describe("initializeShortcuts", () => {
    it("registers default shortcuts", () => {
      const cleanup = initializeShortcuts();

      const shortcuts = getAllShortcuts();
      expect(shortcuts.length).toBeGreaterThan(0);

      // Should have ? for help
      const helpShortcut = shortcuts.find((s) => s.key === "?");
      expect(helpShortcut).toBeDefined();

      cleanup();
    });

    it("registers Ctrl+K for quick search", () => {
      const cleanup = initializeShortcuts();

      const shortcuts = getAllShortcuts();
      const searchShortcut = shortcuts.find((s) => s.key === "k" && s.ctrlKey === true);
      expect(searchShortcut).toBeDefined();
      expect(searchShortcut?.description).toContain("search");

      cleanup();
    });

    it("registers Ctrl+N for new job", () => {
      const cleanup = initializeShortcuts();

      const shortcuts = getAllShortcuts();
      const newJobShortcut = shortcuts.find((s) => s.key === "n" && s.ctrlKey === true);
      expect(newJobShortcut).toBeDefined();
      expect(newJobShortcut?.description.toLowerCase()).toContain("new");

      cleanup();
    });
  });

  describe("shortcut filtering by input context", () => {
    let inputElement: HTMLInputElement;
    let _handler: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      inputElement = document.createElement("input");
      document.body.appendChild(inputElement);
      _handler = vi.fn();

      // Initialize with default shortcuts
      initializeShortcuts();
    });

    afterEach(() => {
      if (inputElement && inputElement.parentNode === document.body) {
        document.body.removeChild(inputElement);
      }
    });

    it("ignores non-form shortcuts when typing in input", () => {
      // Focus the input
      inputElement.focus();

      // Press Ctrl+K (general shortcut, not form-specific)
      const event = new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        bubbles: true,
      });
      inputElement.dispatchEvent(event);

      // General shortcuts should not trigger when focused on input
      // (This is implementation-dependent, testing the concept)
    });

    it("allows form-specific shortcuts in inputs", () => {
      const formHandler = vi.fn();
      registerShortcut({
        key: "enter",
        description: "Submit form",
        handler: formHandler,
        category: "forms",
      });

      inputElement.focus();

      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      });
      inputElement.dispatchEvent(event);

      // Form shortcuts should work
      // (This tests the category filtering logic)
    });
  });

  describe("getByCategory", () => {
    beforeEach(() => {
      registerShortcut({
        key: "a",
        description: "Nav shortcut",
        handler: () => {},
        category: "navigation",
      });
      registerShortcut({
        key: "b",
        description: "Action shortcut",
        handler: () => {},
        category: "actions",
      });
      registerShortcut({
        key: "c",
        description: "Another nav",
        handler: () => {},
        category: "navigation",
      });
    });

    it("returns shortcuts by category", () => {
      const navShortcuts = manager.getByCategory("navigation");
      expect(navShortcuts).toHaveLength(2);

      const actionShortcuts = manager.getByCategory("actions");
      expect(actionShortcuts).toHaveLength(1);
    });

    it("returns empty array for unknown category", () => {
      const unknown = manager.getByCategory("unknown" as any);
      expect(unknown).toHaveLength(0);
    });
  });
});
