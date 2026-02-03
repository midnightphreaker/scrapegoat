/**
 * Tests for focus management utilities
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSkipLink,
  ensureFocusStyles,
  focusNext,
  focusPrevious,
  getFirstFocusable,
  getFocusableElements,
  getLastFocusable,
  isFocusable,
  restoreFocus,
  saveFocus,
  setupEscapeClose,
  setupListNavigation,
  trapFocus,
} from "./focus";

describe("focus utilities", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("getFirstFocusable", () => {
    it("returns the first focusable element", () => {
      container.innerHTML = `
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      `;
      const first = getFirstFocusable(container);
      expect(first?.textContent).toBe("First");
    });

    it("returns null if no focusable elements", () => {
      container.innerHTML = `<div>No buttons here</div>`;
      const first = getFirstFocusable(container);
      expect(first).toBeNull();
    });
  });

  describe("getLastFocusable", () => {
    it("returns the last focusable element", () => {
      container.innerHTML = `
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      `;
      const last = getLastFocusable(container);
      expect(last?.textContent).toBe("Third");
    });

    it("returns null if no focusable elements", () => {
      container.innerHTML = `<div>No buttons here</div>`;
      const last = getLastFocusable(container);
      expect(last).toBeNull();
    });
  });

  describe("getFocusableElements", () => {
    it("returns all focusable elements in tab order", () => {
      container.innerHTML = `
        <a href="#">Link</a>
        <button>Button</button>
        <input type="text" />
        <button>Another Button</button>
      `;
      const focusable = getFocusableElements(container);
      expect(focusable).toHaveLength(4);
      expect(focusable[0].tagName).toBe("A");
      expect(focusable[1].tagName).toBe("BUTTON");
    });

    it("excludes disabled elements", () => {
      container.innerHTML = `
        <button>Enabled</button>
        <button disabled>Disabled</button>
      `;
      const focusable = getFocusableElements(container);
      expect(focusable).toHaveLength(1);
      expect(focusable[0].textContent).toBe("Enabled");
    });

    it("excludes elements with negative tabindex", () => {
      container.innerHTML = `
        <button tabindex="0">Focusable</button>
        <button tabindex="-1">Not Focusable</button>
      `;
      const focusable = getFocusableElements(container);
      expect(focusable).toHaveLength(1);
    });
  });

  describe("isFocusable", () => {
    it("returns true for focusable elements", () => {
      const button = document.createElement("button");
      expect(isFocusable(button)).toBe(true);

      const input = document.createElement("input");
      expect(isFocusable(input)).toBe(true);

      const link = document.createElement("a");
      link.href = "#";
      expect(isFocusable(link)).toBe(true);
    });

    it("returns false for non-focusable elements", () => {
      const div = document.createElement("div");
      expect(isFocusable(div)).toBe(false);

      const span = document.createElement("span");
      expect(isFocusable(span)).toBe(false);
    });

    it("returns false for disabled elements", () => {
      const button = document.createElement("button");
      button.disabled = true;
      expect(isFocusable(button)).toBe(false);
    });

    it("returns false for elements with negative tabindex", () => {
      const div = document.createElement("div");
      div.tabIndex = -1;
      expect(isFocusable(div)).toBe(false);
    });

    it("returns true for elements with positive tabindex", () => {
      const div = document.createElement("div");
      div.tabIndex = 0;
      expect(isFocusable(div)).toBe(true);
    });
  });

  describe("focusNext", () => {
    beforeEach(() => {
      container.innerHTML = `
        <button id="btn1">First</button>
        <button id="btn2">Second</button>
        <button id="btn3">Third</button>
      `;
    });

    it("focuses next element when current is provided", () => {
      const current = container.querySelector<HTMLElement>("#btn1");
      const next = container.querySelector<HTMLElement>("#btn2");

      focusNext(container, current!);
      expect(document.activeElement).toBe(next);
    });

    it("wraps to beginning when at end", () => {
      const current = container.querySelector<HTMLElement>("#btn3");
      const first = container.querySelector<HTMLElement>("#btn1");

      focusNext(container, current!);
      expect(document.activeElement).toBe(first);
    });

    it("focuses first element when no current is provided", () => {
      const first = container.querySelector<HTMLElement>("#btn1");

      focusNext(container);
      expect(document.activeElement).toBe(first);
    });
  });

  describe("focusPrevious", () => {
    beforeEach(() => {
      container.innerHTML = `
        <button id="btn1">First</button>
        <button id="btn2">Second</button>
        <button id="btn3">Third</button>
      `;
    });

    it("focuses previous element when current is provided", () => {
      const current = container.querySelector<HTMLElement>("#btn3");
      const prev = container.querySelector<HTMLElement>("#btn2");

      focusPrevious(container, current!);
      expect(document.activeElement).toBe(prev);
    });

    it("wraps to end when at beginning", () => {
      const current = container.querySelector<HTMLElement>("#btn1");
      const last = container.querySelector<HTMLElement>("#btn3");

      focusPrevious(container, current!);
      expect(document.activeElement).toBe(last);
    });
  });

  describe("saveFocus and restoreFocus", () => {
    it("saves and restores focused element", () => {
      container.innerHTML = `<button id="btn1">Button 1</button>`;
      const btn1 = container.querySelector<HTMLElement>("#btn1")!;

      btn1.focus();
      expect(document.activeElement).toBe(btn1);

      const saved = saveFocus();
      expect(saved).toBe(btn1);

      // Focus something else
      document.body.focus();

      restoreFocus(saved);
      expect(document.activeElement).toBe(btn1);
    });

    it("handles null when nothing is focused", () => {
      const saved = saveFocus();
      expect(saved).toBe(document.body); // body is default focus

      restoreFocus(null);
      // Should not throw
    });
  });

  describe("createSkipLink", () => {
    it("creates a skip link with correct attributes", () => {
      const link = createSkipLink();

      expect(link.tagName).toBe("A");
      expect(link.href).toContain("#main-content");
      expect(link.textContent).toBe("Skip to main content");
      expect(link.tabIndex).toBe(0);
    });

    it("uses custom target ID when provided", () => {
      const link = createSkipLink("custom-target");
      expect(link.href).toContain("#custom-target");
    });
  });

  describe("setupEscapeClose", () => {
    it("calls callback when Escape is pressed", () => {
      const onClose = vi.fn();
      const cleanup = setupEscapeClose(container, onClose);

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      container.dispatchEvent(event);

      expect(onClose).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it("does not call callback for other keys", () => {
      const onClose = vi.fn();
      const cleanup = setupEscapeClose(container, onClose);

      const event = new KeyboardEvent("keydown", { key: "Enter" });
      container.dispatchEvent(event);

      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });

    it("removes event listener on cleanup", () => {
      const onClose = vi.fn();
      const cleanup = setupEscapeClose(container, onClose);

      cleanup();

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      container.dispatchEvent(event);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("setupListNavigation", () => {
    beforeEach(() => {
      container.innerHTML = `
        <ul id="list">
          <li><button>Item 1</button></li>
          <li><button>Item 2</button></li>
          <li><button>Item 3</button></li>
        </ul>
      `;
    });

    it("handles ArrowDown navigation", () => {
      const onSelect = vi.fn();
      const list = container.querySelector<HTMLElement>("#list")!;
      const items = container.querySelectorAll("button");

      const cleanup = setupListNavigation(list, onSelect);

      items[0].focus();

      const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
      items[0].dispatchEvent(downEvent);

      expect(document.activeElement).toBe(items[1]);

      cleanup();
    });

    it("handles ArrowUp navigation", () => {
      const onSelect = vi.fn();
      const list = container.querySelector<HTMLElement>("#list")!;
      const items = container.querySelectorAll("button");

      const cleanup = setupListNavigation(list, onSelect);

      items[2].focus();

      const upEvent = new KeyboardEvent("keydown", { key: "ArrowUp" });
      items[2].dispatchEvent(upEvent);

      expect(document.activeElement).toBe(items[1]);

      cleanup();
    });

    it("handles Home key", () => {
      const onSelect = vi.fn();
      const list = container.querySelector<HTMLElement>("#list")!;
      const items = container.querySelectorAll("button");

      const cleanup = setupListNavigation(list, onSelect);

      items[2].focus();

      const homeEvent = new KeyboardEvent("keydown", { key: "Home" });
      items[2].dispatchEvent(homeEvent);

      expect(document.activeElement).toBe(items[0]);

      cleanup();
    });

    it("handles End key", () => {
      const onSelect = vi.fn();
      const list = container.querySelector<HTMLElement>("#list")!;
      const items = container.querySelectorAll("button");

      const cleanup = setupListNavigation(list, onSelect);

      items[0].focus();

      const endEvent = new KeyboardEvent("keydown", { key: "End" });
      items[0].dispatchEvent(endEvent);

      expect(document.activeElement).toBe(items[2]);

      cleanup();
    });

    it("calls onSelect when Enter is pressed", () => {
      const onSelect = vi.fn();
      const list = container.querySelector<HTMLElement>("#list")!;
      const items = container.querySelectorAll("button");

      const cleanup = setupListNavigation(list, onSelect);

      items[1].focus();

      const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
      items[1].dispatchEvent(enterEvent);

      expect(onSelect).toHaveBeenCalledWith(items[1]);

      cleanup();
    });
  });

  describe("trapFocus", () => {
    it("traps focus within container", () => {
      container.innerHTML = `
        <button id="btn1">First</button>
        <button id="btn2">Second</button>
        <button id="btn3">Third</button>
      `;

      const btn1 = container.querySelector<HTMLElement>("#btn1")!;
      const _btn3 = container.querySelector<HTMLElement>("#btn3")!;

      const cleanup = trapFocus(container);

      // Should focus first element initially
      expect(document.activeElement).toBe(btn1);

      // Simulate Tab on first element (should stay on first)
      const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
      Object.defineProperty(tabEvent, "shiftKey", { value: false, writable: false });
      btn1.dispatchEvent(tabEvent);

      // Focus should still be within container
      expect(container.contains(document.activeElement)).toBe(true);

      cleanup();
    });
  });

  describe("ensureFocusStyles", () => {
    it("adds focus styles to document if not present", () => {
      // Remove any existing focus styles
      const existing = document.getElementById("focus-styles");
      if (existing) existing.remove();

      ensureFocusStyles();

      const style = document.getElementById("focus-styles");
      expect(style).toBeTruthy();
      expect(style?.tagName).toBe("STYLE");
    });

    it("does not duplicate if already present", () => {
      ensureFocusStyles();
      ensureFocusStyles();

      const styles = document.querySelectorAll("#focus-styles");
      expect(styles).toHaveLength(1);
    });
  });
});
