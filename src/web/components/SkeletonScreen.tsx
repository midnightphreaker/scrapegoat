/**
 * Skeleton Loading Screen Components
 *
 * Provides placeholder UI while content is loading.
 * Uses animated shimmer effect for better perceived performance.
 */

export interface SkeletonProps {
  /** CSS class name for styling */
  className?: string;
  /** Width of the skeleton (e.g., "100%", "200px") */
  width?: string;
  /** Height of the skeleton (e.g., "20px", "1rem") */
  height?: string;
  /** Whether to show animation */
  animate?: boolean;
}

/**
 * Base skeleton component with shimmer animation
 */
export function Skeleton({
  className = "",
  width = "100%",
  height = "1rem",
  animate = true,
}: SkeletonProps = {}): HTMLDivElement {
  const skeleton = document.createElement("div");
  skeleton.className = [
    "bg-stone-200 dark:bg-stone-700 rounded",
    animate ? "animate-pulse" : "",
    className,
  ].join(" ");
  skeleton.style.width = width;
  skeleton.style.height = height;

  return skeleton;
}

/**
 * Text skeleton for paragraphs
 */
export function TextSkeleton({
  lines = 3,
  className = "",
}: { lines?: number; className?: string } = {}): HTMLDivElement {
  const container = document.createElement("div");
  container.className = ["space-y-2", className].join(" ");

  for (let i = 0; i < lines; i++) {
    const width = i === lines - 1 ? "70%" : "100%";
    container.appendChild(Skeleton({ width, height: "1rem" }));
  }

  return container;
}

/**
 * Title skeleton for headings
 */
export function TitleSkeleton({
  size = "lg",
  className = "",
}: { size?: "sm" | "md" | "lg"; className?: string } = {}): HTMLElement {
  const sizes = {
    sm: { height: "1.5rem", width: "40%" },
    md: { height: "2rem", width: "60%" },
    lg: { height: "2.5rem", width: "70%" },
  };

  return Skeleton({ ...sizes[size], className });
}

/**
 * Card skeleton for card-like content
 */
export function CardSkeleton({
  className = "",
}: { className?: string } = {}): HTMLDivElement {
  const card = document.createElement("div");
  card.className = [
    "bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 p-4 shadow-sm",
    className,
  ].join(" ");

  card.innerHTML = `
    ${TitleSkeleton({ size: "md", className: "mb-4" }).outerHTML}
    ${TextSkeleton({ lines: 3, className: "mb-4" }).outerHTML}
    <div class="flex gap-2 mt-4">
      ${Skeleton({ width: "80px", height: "32px" }).outerHTML}
      ${Skeleton({ width: "80px", height: "32px" }).outerHTML}
    </div>
  `;

  return card;
}

/**
 * List item skeleton for lists/tables
 */
export function ListItemSkeleton({
  hasAvatar = false,
  className = "",
}: { hasAvatar?: boolean; className?: string } = {}): HTMLDivElement {
  const item = document.createElement("div");
  item.className = [
    "flex items-center gap-3 p-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg",
    className,
  ].join(" ");

  let html = "";
  if (hasAvatar) {
    html += Skeleton({ width: "40px", height: "40px", className: "rounded-full flex-shrink-0" }).outerHTML;
  }
  html += `
    <div class="flex-1 space-y-2">
      ${Skeleton({ width: "70%", height: "1rem" }).outerHTML}
      ${Skeleton({ width: "40%", height: "0.875rem" }).outerHTML}
    </div>
  `;
  item.innerHTML = html;

  return item;
}

/**
 * Job list skeleton
 */
export function JobListSkeleton({ count = 5 }: { count?: number } = {}): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "space-y-3";

  for (let i = 0; i < count; i++) {
    container.appendChild(ListItemSkeleton());
  }

  return container;
}

/**
 * Library list skeleton
 */
export function LibraryListSkeleton({ count = 4 }: { count?: number } = {}): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "space-y-4";

  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 p-4";
    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div class="flex-1">
          ${Skeleton({ width: "40%", height: "1.5rem", className: "mb-2" }).outerHTML}
          ${Skeleton({ width: "20%", height: "0.875rem" }).outerHTML}
        </div>
        ${Skeleton({ width: "60px", height: "24px" }).outerHTML}
      </div>
      ${TextSkeleton({ lines: 2 }).outerHTML}
    `;
    container.appendChild(card);
  }

  return container;
}

/**
 * Search results skeleton
 */
export function SearchResultsSkeleton({ count = 3 }: { count?: number } = {}): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "space-y-4";

  for (let i = 0; i < count; i++) {
    const result = document.createElement("div");
    result.className = "bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 p-4";
    result.innerHTML = `
      ${Skeleton({ width: "60%", height: "1.25rem", className: "mb-3" }).outerHTML}
      ${Skeleton({ width: "90%", height: "0.875rem", className: "mb-2" }).outerHTML}
      ${Skeleton({ width: "80%", height: "0.875rem", className: "mb-2" }).outerHTML}
      <div class="flex items-center gap-2 mt-3">
        ${Skeleton({ width: "60px", height: "20px" }).outerHTML}
        ${Skeleton({ width: "40px", height: "20px" }).outerHTML}
      </div>
    `;
    container.appendChild(result);
  }

  return container;
}

/**
 * Loading spinner component
 */
export function LoadingSpinner({
  size = "md",
  text,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
} = {}): HTMLDivElement {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const container = document.createElement("div");
  container.className = ["flex flex-col items-center justify-center gap-3", className].join(" ");

  container.innerHTML = `
    <svg class="animate-spin ${sizes[size]} text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    ${text ? `<p class="text-sm text-stone-600 dark:text-stone-400">${text}</p>` : ""}
  `;

  return container;
}

/**
 * Inline loading indicator (smaller version)
 */
export function InlineLoader({ text = "Loading..." }: { text?: string } = {}): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "inline-flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400";

  span.innerHTML = `
    <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span>${text}</span>
  `;

  return span;
}

/**
 * Full page loading skeleton
 */
export function PageSkeleton(): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "p-4 max-w-7xl mx-auto space-y-6";
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-label", "Loading content");

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      ${TitleSkeleton({ size: "lg" }).outerHTML}
      ${Skeleton({ width: "200px", height: "40px" }).outerHTML}
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${Array.from({ length: 6 }, () => CardSkeleton().outerHTML).join("")}
    </div>
  `;

  return container;
}

/**
 * Create a skeleton wrapper that replaces content with skeleton while loading
 */
export function createSkeletonWrapper<T>(
  element: HTMLElement,
  loader: () => Promise<T>,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    skeleton?: HTMLElement;
  } = {}
): {
  load: () => Promise<void>;
  reset: () => void;
} {
  const { onSuccess, onError, skeleton } = options;
  const originalContent = element.innerHTML;

  const load = async (): Promise<void> => {
    // Show skeleton
    element.innerHTML = "";
    if (skeleton) {
      element.appendChild(skeleton);
    } else {
      element.appendChild(PageSkeleton());
    }

    try {
      const data = await loader();

      // Restore content and handle success
      element.innerHTML = originalContent;
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (error) {
      // Handle error
      element.innerHTML = originalContent;
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };

  const reset = (): void => {
    element.innerHTML = originalContent;
  };

  return { load, reset };
}

/**
 * Progress bar skeleton
 */
export function ProgressBarSkeleton({
  className = "",
}: { className?: string } = {}): HTMLDivElement {
  const container = document.createElement("div");
  container.className = ["w-full", className].join(" ");

  container.innerHTML = `
    <div class="h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
      <div class="h-full bg-stone-300 dark:bg-stone-600 rounded-full animate-pulse" style="width: 60%"></div>
    </div>
  `;

  return container;
}

/**
 * Table skeleton for data tables
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className = "",
}: {
  rows?: number;
  columns?: number;
  className?: string;
} = {}): HTMLTableElement {
  const table = document.createElement("table");
  table.className = [
    "w-full text-sm text-left",
    className,
  ].join(" ");

  // Header row
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (let i = 0; i < columns; i++) {
    const th = document.createElement("th");
    th.className = "px-4 py-3 bg-stone-50 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700";
    th.appendChild(Skeleton({ width: "80%" }));
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body rows
  const tbody = document.createElement("tbody");
  for (let r = 0; r < rows; r++) {
    const row = document.createElement("tr");
    for (let c = 0; c < columns; c++) {
      const td = document.createElement("td");
      td.className = "px-4 py-3 border-b border-stone-200 dark:border-stone-700";
      td.appendChild(Skeleton({ width: c === 0 ? "60%" : "80%" }));
      row.appendChild(td);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  return table;
}
