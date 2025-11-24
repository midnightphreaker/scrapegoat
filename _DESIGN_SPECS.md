# Scrapegoat WebUI Design Specifications
**Version:** 1.0.0
**Date:** 2025-11-25
**Design System:** Context7-Inspired with Scrapegoat Branding
**Framework:** Tailwind CSS + Flowbite

---

## Table of Contents
1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Library](#component-library)
6. [Page Layouts](#page-layouts)
7. [Responsive Behavior](#responsive-behavior)
8. [Accessibility Standards](#accessibility-standards)
9. [Asset Requirements](#asset-requirements)
10. [Implementation Guidelines](#implementation-guidelines)

---

## Design Philosophy

### Core Principles
The Scrapegoat UI design system is built on Context7's modern, technical aesthetic with emerald green as the primary brand color. The design emphasizes:

- **Clarity:** Documentation interfaces must be scannable and hierarchical
- **Trust:** Emerald green conveys reliability, growth, and technical sophistication
- **Efficiency:** Minimal friction from search to indexed documentation
- **Accessibility:** WCAG 2.1 AA compliance minimum, AAA where possible

### Color Psychology
- **Emerald Green (#059669):** Growth, technology, trust, eco-friendly data harvesting
- **Stone Neutrals:** Professional, technical, readable
- **White Space:** Breathing room for complex technical content

### Design Tokens
All design decisions are token-based for consistency and maintainability. CSS custom properties in `/src/web/styles/main.css` provide the single source of truth.

---

## Color System

### Primary Palette: Emerald (Brand Color)
```css
--color-primary-50: #f0fdf4   /* Lightest backgrounds */
--color-primary-100: #dcfce7  /* Light backgrounds, hover states */
--color-primary-200: #bbf7d0  /* Borders, dividers */
--color-primary-300: #86efac  /* Disabled states */
--color-primary-400: #4ade80  /* Secondary actions */
--color-primary-500: #22c55e  /* Accent elements */
--color-primary-600: #059669  /* PRIMARY BRAND COLOR - buttons, links, focus */
--color-primary-700: #047857  /* Hover states, active */
--color-primary-800: #065f46  /* Pressed states */
--color-primary-900: #064e3b  /* Dark mode accents */
--color-primary-950: #022c22  /* Darkest accents */
```

### Neutral Palette: Stone (Text & Backgrounds)
```css
--color-stone-50: #fafaf9    /* Page backgrounds */
--color-stone-100: #f5f5f4   /* Card backgrounds, subtle fills */
--color-stone-200: #e7e5e4   /* Borders, dividers */
--color-stone-300: #d6d3d1   /* Borders, inactive states */
--color-stone-400: #a8a29e   /* Placeholder text, borders */
--color-stone-500: #78716c   /* Secondary text, labels */
--color-stone-600: #57534e   /* Tertiary text */
--color-stone-700: #44403c   /* Secondary headings */
--color-stone-800: #292524   /* PRIMARY TEXT COLOR */
--color-stone-900: #1c1917   /* Emphasis text */
```

### Semantic Colors
```css
/* Success States */
--color-success-bg: #dcfce7      /* Success backgrounds */
--color-success-border: #86efac  /* Success borders */
--color-success-text: #065f46    /* Success text */

/* Warning States */
--color-warning-bg: #fef3c7      /* Warning backgrounds */
--color-warning-border: #fcd34d  /* Warning borders */
--color-warning-text: #92400e    /* Warning text */

/* Error States */
--color-error-bg: #fee2e2        /* Error backgrounds */
--color-error-border: #fca5a5    /* Error borders */
--color-error-text: #991b1b      /* Error text */

/* Info States */
--color-info-bg: #dbeafe         /* Info backgrounds */
--color-info-border: #93c5fd     /* Info borders */
--color-info-text: #1e40af       /* Info text */
```

### Color Contrast Compliance
| Combination | Ratio | WCAG AA | WCAG AAA | Usage |
|-------------|-------|---------|----------|-------|
| `stone-800` on `white` | 15.8:1 | ✓ Pass | ✓ Pass | All body text |
| `primary-600` on `white` | 4.54:1 | ✓ Pass | ✗ Fail | Large text, buttons only |
| `white` on `primary-600` | 4.54:1 | ✓ Pass | ✗ Fail | Button text (acceptable) |
| `stone-500` on `white` | 4.6:1 | ✓ Pass (large) | ✗ Fail | Labels, metadata only |

**Rule:** Never use `primary-600` for body text on white. Use `stone-800` for all paragraph content.

---

## Typography

### Font Stack
```css
/* Primary UI Font */
font-family: Inter, "Inter Fallback", ui-sans-serif, system-ui, -apple-system, sans-serif;

/* Monospace (Code, Terminal) */
font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;

/* Brand Font (Logo, Headers) */
font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
```

### Type Scale
| Element | Size | Weight | Line Height | Letter Spacing | Usage |
|---------|------|--------|-------------|----------------|-------|
| **H1** | 24px / 1.5rem | 600 | 32px | -0.6px | Page titles |
| **H2** | 20px / 1.25rem | 600 | 28px | -0.4px | Section headings |
| **H3** | 18px / 1.125rem | 600 | 24px | -0.2px | Card titles, subsections |
| **H4** | 16px / 1rem | 600 | 22px | 0 | Component headers |
| **Body Large** | 18px / 1.125rem | 400 | 28px | 0 | Lead paragraphs |
| **Body** | 16px / 1rem | 400 | 24px | 0 | Default text |
| **Body Small** | 14px / 0.875rem | 400 | 20px | 0 | Labels, metadata |
| **Caption** | 12px / 0.75rem | 400 | 16px | 0 | Timestamps, helpers |
| **Button Text** | 16px / 1rem | 500 | 16px | 0 | Interactive elements |
| **Code Inline** | 14px / 0.875rem | 400 | 20px | 0 | Inline code snippets |

### Typography Classes
```css
/* Headings */
.text-h1 { @apply text-2xl font-semibold tracking-tight leading-8 text-stone-800; }
.text-h2 { @apply text-xl font-semibold tracking-tight leading-7 text-stone-800; }
.text-h3 { @apply text-lg font-semibold tracking-tight leading-6 text-stone-800; }
.text-h4 { @apply text-base font-semibold leading-snug text-stone-800; }

/* Body */
.text-body-lg { @apply text-lg font-normal leading-7 text-stone-700; }
.text-body { @apply text-base font-normal leading-6 text-stone-800; }
.text-body-sm { @apply text-sm font-normal leading-5 text-stone-600; }
.text-caption { @apply text-xs font-normal leading-4 text-stone-500; }

/* Emphasis */
.text-emphasis { @apply font-medium text-stone-900; }
.text-muted { @apply text-stone-500; }
```

### Responsive Typography
```css
/* Mobile (< 640px): Base sizes */
body { font-size: 16px; }
h1 { font-size: 24px; }

/* Tablet (640px+): Slightly larger */
@media (min-width: 640px) {
  h1 { font-size: 28px; }
}

/* Desktop (1024px+): Optimal reading size */
@media (min-width: 1024px) {
  body { font-size: 16px; } /* Keep body at 16px */
  h1 { font-size: 30px; }
}
```

---

## Spacing & Layout

### Spacing Scale (8px Base)
```css
--spacing-0: 0px
--spacing-1: 1px     /* Borders, fine dividers */
--spacing-2: 2px     /* Focus rings, hairline spacing */
--spacing-4: 4px     /* Tight spacing */
--spacing-8: 8px     /* BASE UNIT - button padding, gaps */
--spacing-12: 12px   /* Input padding, small margins */
--spacing-16: 16px   /* Card padding, section margins */
--spacing-24: 24px   /* Large card padding, section spacing */
--spacing-32: 32px   /* Page section spacing */
--spacing-48: 48px   /* Major section breaks */
--spacing-64: 64px   /* Hero sections, page breaks */
--spacing-80: 80px   /* Marketing sections */
```

### Tailwind Spacing Mapping
```css
/* Commonly used in scrapegoat */
p-4: 16px    /* Card padding */
p-6: 24px    /* Large card padding */
gap-3: 12px  /* Flexbox gaps */
gap-4: 16px  /* Grid gaps */
space-y-4: 16px vertical spacing
space-y-6: 24px section spacing
mb-4: 16px   /* Bottom margin */
mb-6: 24px   /* Section bottom margin */
```

### Container & Layout
```css
/* Max Width Containers */
.container { max-width: 672px; } /* max-w-2xl - optimal for documentation */

/* Padding */
Mobile: px-4 (16px)
Tablet: px-6 (24px)
Desktop: px-8 (32px)

/* Vertical Spacing */
Section spacing: space-y-6 (24px)
Card spacing: space-y-4 (16px)
Form element spacing: space-y-3 (12px)
```

### Border Radius
```css
--radius-sm: 4px      /* Subtle rounding */
--radius-md: 8px      /* PRIMARY - buttons, cards, badges */
--radius-lg: 12px     /* Input fields, large cards */
--radius-xl: 16px     /* Modals, overlays */
--radius-full: 9999px /* Pills, circular elements */
```

**Primary Border Radius:** `8px` for consistency (buttons, cards, most UI)
**Exception:** Input fields use `12px` to match Context7 design

### Shadows
```css
/* Shadow Tokens */
--shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
--shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);

/* Usage */
Cards (default): shadow-sm
Cards (hover): shadow-md
Dropdowns: shadow-lg
Modals: shadow-xl
```

---

## Component Library

### Buttons

#### Primary Button (Call-to-Action)
```html
<button class="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800
               text-white font-medium text-base rounded-lg
               focus:outline-none focus:ring-4 focus:ring-primary-600/50
               transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed">
  Primary Action
</button>
```

**CSS Specification:**
```css
.btn-primary {
  background: #059669; /* primary-600 */
  color: #ffffff;
  padding: 10px 24px; /* py-2.5 px-6 */
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  line-height: 16px;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
  min-height: 44px; /* Accessible touch target */
}

.btn-primary:hover {
  background: #047857; /* primary-700 */
}

.btn-primary:active {
  background: #065f46; /* primary-800 */
}

.btn-primary:focus-visible {
  outline: 4px solid rgba(5, 150, 105, 0.5); /* primary-600 at 50% */
  outline-offset: 2px;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### Secondary Button (Alternative Action)
```html
<button class="px-6 py-2.5 bg-transparent border border-stone-300 hover:border-stone-400
               text-stone-800 font-normal text-base rounded-lg
               focus:outline-none focus:ring-4 focus:ring-primary-600/50
               transition-all duration-150">
  Secondary Action
</button>
```

**CSS Specification:**
```css
.btn-secondary {
  background: transparent;
  color: #292524; /* stone-800 */
  padding: 10px 24px;
  border-radius: 8px;
  border: 1px solid #d6d3d1; /* stone-300 */
  font-size: 16px;
  font-weight: 400;
  min-height: 44px;
}

.btn-secondary:hover {
  border-color: #a8a29e; /* stone-400 */
  background: #fafaf9; /* stone-50 */
}
```

#### Tertiary Button (Minimal Action)
```html
<button class="px-4 py-2 bg-transparent text-primary-600 hover:text-primary-700
               font-semibold text-base rounded-lg hover:bg-primary-50
               focus:outline-none focus:ring-4 focus:ring-primary-600/50
               transition-all duration-150">
  Tertiary Action
</button>
```

#### Button Sizes
```css
/* Small */
.btn-sm { padding: 6px 16px; font-size: 14px; min-height: 36px; }

/* Medium (Default) */
.btn-md { padding: 10px 24px; font-size: 16px; min-height: 44px; }

/* Large */
.btn-lg { padding: 14px 32px; font-size: 18px; min-height: 52px; }
```

---

### Input Fields

#### Text Input (Default)
```html
<input type="text"
       class="w-full px-4 py-2.5 bg-white border border-stone-300
              text-stone-800 text-base rounded-xl
              focus:border-primary-600 focus:ring-4 focus:ring-primary-600/20
              placeholder:text-stone-400
              transition-all duration-150"
       placeholder="Enter text...">
```

**CSS Specification:**
```css
.input-text {
  width: 100%;
  padding: 10px 16px;
  background: #ffffff;
  border: 1px solid #d6d3d1; /* stone-300 */
  border-radius: 12px; /* Note: 12px for inputs, different from buttons */
  font-size: 16px; /* Prevents iOS zoom on focus */
  color: #292524; /* stone-800 */
  line-height: 24px;
  min-height: 44px;
  transition: all 150ms ease;
}

.input-text::placeholder {
  color: #a8a29e; /* stone-400 */
}

.input-text:focus {
  outline: none;
  border-color: #059669; /* primary-600 */
  box-shadow: 0 0 0 4px rgba(5, 150, 105, 0.2); /* focus ring */
}

.input-text:disabled {
  background: #f5f5f4; /* stone-100 */
  cursor: not-allowed;
  opacity: 0.6;
}

.input-text.error {
  border-color: #dc2626; /* red-600 */
}
```

#### Input with Icon (Search)
```html
<div class="relative">
  <input type="text"
         class="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300
                text-stone-800 text-base rounded-xl
                focus:border-primary-600 focus:ring-4 focus:ring-primary-600/20"
         placeholder="Search documentation...">
  <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400"
       fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
  </svg>
</div>
```

#### Select Dropdown
```html
<select class="w-full px-4 py-2.5 bg-white border border-stone-300
               text-stone-800 text-base rounded-xl
               focus:border-primary-600 focus:ring-4 focus:ring-primary-600/20
               transition-all duration-150">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

---

### Cards

#### Standard Card
```html
<div class="p-6 bg-white rounded-lg shadow-sm border border-stone-200
            hover:shadow-md transition-shadow duration-150">
  <h3 class="text-lg font-semibold text-stone-800 mb-2">Card Title</h3>
  <p class="text-base text-stone-600">Card content goes here.</p>
</div>
```

**CSS Specification:**
```css
.card {
  background: #ffffff;
  border: 1px solid #e7e5e4; /* stone-200 */
  border-radius: 8px;
  padding: 24px; /* p-6 */
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); /* shadow-sm */
  transition: box-shadow 150ms ease;
}

.card:hover {
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
}
```

#### Compact Card (Lists)
```html
<div class="p-4 bg-white rounded-lg shadow-sm border border-stone-200">
  <!-- Compact content -->
</div>
```

#### Interactive Card (Clickable)
```html
<a href="#" class="block p-6 bg-white rounded-lg shadow-sm border border-stone-200
                    hover:shadow-lg hover:border-primary-200
                    focus:outline-none focus:ring-4 focus:ring-primary-600/50
                    transition-all duration-150">
  <!-- Card content -->
</a>
```

---

### Badges & Status Indicators

#### Status Badge Component
```html
<!-- Success -->
<span class="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800">
  Completed
</span>

<!-- Running -->
<span class="px-2 py-0.5 text-xs font-medium rounded bg-primary-100 text-primary-800">
  Running
</span>

<!-- Warning -->
<span class="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
  Queued
</span>

<!-- Error -->
<span class="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800">
  Failed
</span>

<!-- Neutral -->
<span class="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-800">
  Cancelled
</span>
```

**CSS Specification:**
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px; /* py-0.5 px-2 */
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  border-radius: 4px; /* Subtle rounding for badges */
}

.badge-success { background: #dcfce7; color: #065f46; }
.badge-warning { background: #fef3c7; color: #92400e; }
.badge-error { background: #fee2e2; color: #991b1b; }
.badge-info { background: #dbeafe; color: #1e40af; }
.badge-neutral { background: #f5f5f4; color: #57534e; }
```

#### Version Badge
```html
<span class="text-sm font-normal text-stone-500" title="Version 1.0.0">
  v1.0.0
</span>
```

---

### Links

#### Primary Link (In-Content)
```html
<a href="#" class="text-primary-600 hover:text-primary-700 underline underline-offset-4
              font-medium transition-colors duration-150">
  Link Text
</a>
```

#### Secondary Link (Navigation)
```html
<a href="#" class="text-stone-700 hover:text-stone-900 font-normal
              transition-colors duration-150">
  Navigation Link
</a>
```

#### Subtle Link (Footer, Metadata)
```html
<a href="#" class="text-stone-500 hover:text-stone-700 underline underline-offset-4
              text-sm transition-colors duration-150">
  Metadata Link
</a>
```

---

### Loading States

#### Spinner (HTMX Loading)
```html
<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg"
     fill="none" viewBox="0 0 24 24">
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
  <path class="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>
```

#### Skeleton Loader (Content Placeholders)
```html
<div class="animate-pulse space-y-4">
  <div class="h-4 bg-stone-200 rounded w-3/4"></div>
  <div class="h-4 bg-stone-200 rounded w-full"></div>
  <div class="h-4 bg-stone-200 rounded w-5/6"></div>
</div>
```

#### Progress Bar
```html
<div class="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
  <div class="h-full bg-primary-600 transition-all duration-300"
       style="width: 45%"></div>
</div>
```

---

### Modals & Overlays

#### Modal Dialog
```html
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
     x-show="showModal" x-cloak>
  <div class="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4"
       x-on:click.outside="closeModal()">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-stone-900">Modal Title</h3>
      <button type="button"
              class="text-stone-400 hover:text-stone-600"
              x-on:click="closeModal()">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="mb-6">
      <p class="text-base text-stone-600">Modal content goes here.</p>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3">
      <button class="btn-secondary">Cancel</button>
      <button class="btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

---

### Tables

#### Documentation Library Table
```html
<div class="overflow-x-auto rounded-lg border border-stone-200">
  <table class="w-full text-sm text-left">
    <thead class="text-xs uppercase bg-stone-50 text-stone-700 border-b border-stone-200">
      <tr>
        <th class="px-6 py-3 font-semibold">Library</th>
        <th class="px-6 py-3 font-semibold">Version</th>
        <th class="px-6 py-3 font-semibold">Status</th>
        <th class="px-6 py-3 font-semibold">Actions</th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-stone-200">
      <tr class="hover:bg-stone-50 transition-colors">
        <td class="px-6 py-4 font-medium text-stone-900">react</td>
        <td class="px-6 py-4 text-stone-600">18.2.0</td>
        <td class="px-6 py-4">
          <span class="badge badge-success">Completed</span>
        </td>
        <td class="px-6 py-4">
          <a href="#" class="text-primary-600 hover:text-primary-700">View</a>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

### Forms

#### Complete Form Example
```html
<form class="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-stone-200">
  <!-- Form Header -->
  <div>
    <h2 class="text-xl font-semibold text-stone-800 mb-2">Index New Documentation</h2>
    <p class="text-sm text-stone-600">Enter the documentation URL and library name.</p>
  </div>

  <!-- URL Input -->
  <div>
    <label for="url" class="block text-sm font-medium text-stone-700 mb-2">
      Documentation URL
    </label>
    <input type="url" id="url" name="url" required
           class="input-text"
           placeholder="https://example.com/docs">
    <p class="mt-1 text-xs text-stone-500">The root URL of the documentation site.</p>
  </div>

  <!-- Library Name Input -->
  <div>
    <label for="library" class="block text-sm font-medium text-stone-700 mb-2">
      Library Name
    </label>
    <input type="text" id="library" name="library" required
           class="input-text"
           placeholder="e.g., react">
  </div>

  <!-- Version Input (Optional) -->
  <div>
    <label for="version" class="block text-sm font-medium text-stone-700 mb-2">
      Version (Optional)
    </label>
    <input type="text" id="version" name="version"
           class="input-text"
           placeholder="e.g., 18.2.0">
  </div>

  <!-- Submit Button -->
  <div class="flex justify-end gap-3 pt-4 border-t border-stone-200">
    <button type="button" class="btn-secondary">Cancel</button>
    <button type="submit" class="btn-primary">Start Indexing</button>
  </div>
</form>
```

---

## Page Layouts

### 1. Home/Search Page
**Route:** `/`
**Purpose:** Primary landing page with job queue and library search

```
┌─────────────────────────────────────────────┐
│ Header (sticky)                             │
│ [scrapegoat] v1.0.0    [MCP] [Update]      │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ Job Queue              [Clear Jobs]   │ │
│  │                                       │ │
│  │ ▸ react@18.2.0       Running   45%   │ │
│  │ ▸ typescript@5.0.0   Queued          │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ Add New Documentation Job            │ │
│  │                                       │ │
│  │ URL:      [_____________________]    │ │
│  │ Library:  [_____________________]    │ │
│  │ Version:  [_____________________]    │ │
│  │                    [Start Indexing]  │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Indexed Documentation                      │
│  ┌───────────────────────────────────────┐ │
│  │ Search react@18.2.0  [Latest ▼]      │ │
│  │ [search query...      ] [Search]     │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ react               v18.2.0  Completed│ │
│  │ 1,247 pages indexed                  │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

**Layout Classes:**
```html
<main class="flex-1 container max-w-2xl mx-auto px-4 py-6 space-y-6">
  <!-- Job Queue Section -->
  <section class="p-6 bg-white rounded-lg shadow-sm border border-stone-200">
    <!-- Content -->
  </section>

  <!-- Add Job Section -->
  <section class="p-6 bg-white rounded-lg shadow-sm border border-stone-200">
    <!-- Content -->
  </section>

  <!-- Indexed Docs Section -->
  <section>
    <h2 class="text-xl font-semibold text-stone-800 mb-4">Indexed Documentation</h2>
    <!-- Library cards -->
  </section>
</main>
```

---

### 2. Documentation Library Detail Page
**Route:** `/web/libraries/:libraryName`
**Purpose:** Search and browse indexed documentation for a specific library

```
┌─────────────────────────────────────────────┐
│ Header (sticky)                             │
├─────────────────────────────────────────────┤
│                                             │
│  ← Back to Libraries                        │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ Search react Documentation           │ │
│  │                                       │ │
│  │ Version: [Latest ▼]                  │ │
│  │ Query:   [hooks lifecycle...] [🔍]  │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Search Results (243 matches)               │
│  ┌───────────────────────────────────────┐ │
│  │ ► Using Hooks                         │ │
│  │   Hooks are a new addition in React.. │ │
│  │   react/hooks/intro                   │ │
│  └───────────────────────────────────────┘ │
│  ┌───────────────────────────────────────┐ │
│  │ ► Lifecycle Methods                   │ │
│  │   Learn about component lifecycle...  │ │
│  │   react/components/lifecycle          │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 3. Job Status Page
**Route:** `/web/jobs/:jobId`
**Purpose:** Real-time progress tracking for indexing jobs

```
┌─────────────────────────────────────────────┐
│ Header (sticky)                             │
├─────────────────────────────────────────────┤
│                                             │
│  ← Back to Home                             │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ Indexing: react@18.2.0               │ │
│  │ Status: Running                 [●]  │ │
│  │                                       │ │
│  │ Progress: ████████░░░░░░░░  45%     │ │
│  │                                       │ │
│  │ 234 / 520 pages indexed              │ │
│  │ Elapsed: 2m 34s                      │ │
│  │ Estimated: 3m 12s remaining          │ │
│  │                                       │ │
│  │          [Pause] [Cancel]            │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Activity Log                               │
│  ┌───────────────────────────────────────┐ │
│  │ 14:32:45 - Started indexing           │ │
│  │ 14:33:12 - Crawled homepage           │ │
│  │ 14:33:45 - Processing API docs...     │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 4. Settings/Configuration Page
**Route:** `/web/settings`
**Purpose:** MCP configuration, app settings, preferences

```
┌─────────────────────────────────────────────┐
│ Header (sticky)                             │
├─────────────────────────────────────────────┤
│                                             │
│  Settings                                   │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ MCP Server Configuration             │ │
│  │                                       │ │
│  │ Status: Connected [●]                │ │
│  │                                       │ │
│  │ Configuration:                        │ │
│  │ ┌─────────────────────────────────┐ │ │
│  │ │ {                               │ │ │
│  │ │   "scrapegoat": {               │ │ │
│  │ │     "command": "npx",           │ │ │
│  │ │     "args": ["scrapegoat"]      │ │ │
│  │ │   }                             │ │ │
│  │ │ }                               │ │ │
│  │ └─────────────────────────────────┘ │ │
│  │                          [Copy]      │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ Crawl Settings                        │ │
│  │                                       │ │
│  │ Max Depth:   [3        ]             │ │
│  │ Max Pages:   [1000     ]             │ │
│  │ Follow Links: [✓] Enabled            │ │
│  │                                       │ │
│  │                     [Save Settings]  │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Responsive Behavior

### Breakpoint Strategy
```css
/* Mobile First Approach */

/* Base: 0-639px (Mobile) */
- Single column layouts
- Full-width components
- Stacked navigation
- Touch-optimized (min 44x44px targets)

/* sm: 640px+ (Tablet Portrait) */
- Two-column grids possible
- Inline header elements
- Side-by-side form fields

/* md: 768px+ (Tablet Landscape) */
- Multi-column layouts
- Enhanced spacing
- Full table views

/* lg: 1024px+ (Desktop) */
- Optimal feature set
- Generous whitespace
- Maximum readability

/* xl: 1280px+ (Large Desktop) */
- Container max-width enforced
- No layout changes, just centering

/* 2xl: 1536px+ */
- Same as xl (container prevents over-stretching)
```

### Component Responsive Patterns

#### Header Navigation
```html
<!-- Mobile: Stacked layout -->
<div class="sm:hidden space-y-2">
  <div class="flex justify-center">
    <a href="/" class="text-2xl font-bold">scrapegoat</a>
  </div>
  <div class="flex justify-center gap-2">
    <!-- Status badges -->
  </div>
</div>

<!-- Desktop: Horizontal layout -->
<div class="hidden sm:flex items-center justify-between">
  <div class="flex items-center gap-3">
    <a href="/" class="text-2xl font-bold">scrapegoat</a>
  </div>
  <div class="flex items-center gap-3">
    <!-- Status badges -->
  </div>
</div>
```

#### Form Fields
```html
<!-- Mobile: Stacked -->
<div class="space-y-3">
  <input type="text" class="w-full">
  <button class="w-full">Submit</button>
</div>

<!-- Desktop: Horizontal -->
<div class="flex gap-3">
  <input type="text" class="flex-1">
  <button>Submit</button>
</div>
```

#### Card Grids
```html
<!-- Responsive grid -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- Cards -->
</div>
```

### Typography Scaling
```css
/* Mobile */
.text-h1 { font-size: 24px; }
.text-h2 { font-size: 20px; }
.text-body { font-size: 16px; }

/* Desktop (640px+) */
@media (min-width: 640px) {
  .text-h1 { font-size: 28px; }
  .text-h2 { font-size: 22px; }
  /* Body stays 16px for consistency */
}

/* Large Desktop (1024px+) */
@media (min-width: 1024px) {
  .text-h1 { font-size: 30px; }
  .text-h2 { font-size: 24px; }
}
```

### Mobile Optimizations
1. **Touch Targets:** Minimum 44x44px (currently some buttons are 40px - needs fix)
2. **Input Font Size:** Always 16px to prevent iOS zoom
3. **Horizontal Scroll:** Wrap tables in `overflow-x-auto` containers
4. **Navigation:** Sticky header with minimal height on mobile
5. **Modals:** Full-screen on mobile, overlay on desktop

---

## Accessibility Standards

### WCAG 2.1 Level AA Compliance

#### 1. Color Contrast Requirements
| Element Type | Minimum Ratio | Current Implementation |
|--------------|---------------|------------------------|
| Normal text (< 18px) | 4.5:1 | stone-800 on white (15.8:1) ✓ |
| Large text (≥ 18px) | 3:1 | stone-800 on white (15.8:1) ✓ |
| UI components | 3:1 | primary-600 border (4.54:1) ✓ |
| Disabled state | N/A | 50% opacity maintained |

**Do NOT Use:**
- ✗ primary-600 text on white for body copy (4.54:1 - borderline)
- ✓ primary-600 for large headings, buttons with white text
- ✓ stone-800 for all body text

#### 2. Keyboard Navigation
**Required Behaviors:**
```css
/* Visible focus indicators */
*:focus-visible {
  outline: 2px solid #059669; /* primary-600 */
  outline-offset: 2px;
  /* OR */
  box-shadow: 0 0 0 4px rgba(5, 150, 105, 0.5);
}

/* Never remove focus outlines */
*:focus {
  outline: revert; /* Preserve browser default if no custom style */
}
```

**Tab Order:**
1. Skip link to main content (first focusable element)
2. Logo/home link
3. Primary navigation
4. Main content area
5. Forms (logical field order)
6. Footer links

**Modal Behavior:**
- Trap focus inside modal when open
- Return focus to trigger element on close
- ESC key closes modal
- Prevent background scroll when modal open

#### 3. ARIA Labels & Roles
```html
<!-- Skip Link (add to Layout) -->
<a href="#main-content"
   class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4
          bg-primary-600 text-white px-4 py-2 rounded-lg z-50">
  Skip to main content
</a>

<!-- Main Content -->
<main id="main-content" role="main">
  <!-- Page content -->
</main>

<!-- Loading Spinner -->
<div role="status" aria-live="polite" aria-busy="true">
  <svg class="animate-spin" aria-hidden="true"><!-- spinner --></svg>
  <span class="sr-only">Loading...</span>
</div>

<!-- Status Updates -->
<div role="status" aria-live="polite">
  Update available
</div>

<!-- Modals -->
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h3 id="modal-title">Modal Title</h3>
  <!-- content -->
</div>

<!-- Icon Buttons -->
<button type="button" aria-label="Close modal">
  <svg aria-hidden="true"><!-- X icon --></svg>
</button>

<!-- Form Validation -->
<input type="text"
       aria-invalid="true"
       aria-describedby="error-message">
<p id="error-message" role="alert">This field is required</p>
```

#### 4. Screen Reader Optimizations
```css
/* Screen Reader Only Class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.sr-only.focus\:not-sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: revert;
  margin: revert;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

#### 5. Semantic HTML
```html
<!-- Always use semantic elements -->
<header><!-- Site header --></header>
<nav aria-label="Main navigation"><!-- Navigation --></nav>
<main><!-- Primary content --></main>
<aside aria-label="Related information"><!-- Sidebar --></aside>
<footer><!-- Site footer --></footer>

<!-- Heading hierarchy (never skip levels) -->
<h1>Page Title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
      <h4>Component</h4>

<!-- Form labels -->
<label for="email">Email Address</label>
<input type="email" id="email" name="email">

<!-- Button types -->
<button type="submit">Submit Form</button>
<button type="button">Toggle Panel</button>
```

#### 6. Alternative Text
```html
<!-- Informative images -->
<img src="logo.svg" alt="Scrapegoat Documentation Indexer">

<!-- Decorative images -->
<img src="decoration.svg" alt="" role="presentation">

<!-- Icon-only buttons -->
<button type="button" aria-label="Search documentation">
  <svg aria-hidden="true"><!-- magnifying glass --></svg>
</button>

<!-- Icon with visible text -->
<button type="button">
  <svg aria-hidden="true"><!-- icon --></svg>
  <span>Search</span>
</button>
```

#### 7. Animation & Motion
```css
/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Disable parallax, auto-play video, etc. */
}
```

#### 8. Focus Management
```javascript
// Trap focus in modal
function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  element.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  });
}
```

---

## Asset Requirements

### Logo Assets

#### Primary Logo
- **File:** `/public/logo.svg`
- **Dimensions:** 48x48px (display size, SVG scales infinitely)
- **Format:** SVG (vector)
- **Colors:**
  - Full-color: `#059669` (primary-600)
  - White variant: `#ffffff`
  - Black variant: `#292524` (stone-800)
- **Usage:** Header navigation, favicons, marketing materials
- **Design notes:**
  - Simple, recognizable shape
  - Works at small sizes (16x16px favicon)
  - Monochrome-friendly (one-color versions)

**Logo Placement:**
```html
<a href="/" class="flex items-center gap-3">
  <img src="/logo.svg" alt="Scrapegoat" class="h-8 w-8">
  <span class="text-2xl font-bold font-brand">scrapegoat</span>
</a>
```

#### Wordmark
- **File:** `/public/wordmark.svg`
- **Format:** SVG text with JetBrains Mono font
- **Colors:** Same as primary logo
- **Usage:** Standalone branding without icon

---

### Favicon Package

**Required Files:**
```
/public/
├── favicon.ico                (multi-resolution: 16x16, 32x32, 48x48)
├── favicon-16x16.png          (16x16)
├── favicon-32x32.png          (32x32)
├── favicon-96x96.png          (96x96)
├── apple-icon-57x57.png       (57x57)
├── apple-icon-60x60.png       (60x60)
├── apple-icon-72x72.png       (72x72)
├── apple-icon-76x76.png       (76x76)
├── apple-icon-114x114.png     (114x114)
├── apple-icon-120x120.png     (120x120)
├── apple-icon-144x144.png     (144x144)
├── apple-icon-152x152.png     (152x152)
├── apple-icon-180x180.png     (180x180)
├── android-icon-192x192.png   (192x192)
├── ms-icon-144x144.png        (144x144, Windows tile)
└── manifest.json              (PWA manifest)
```

**Favicon Generation:**
Use service like [RealFaviconGenerator.net](https://realfavicongenerator.net/) with source logo:
- Source: 512x512px PNG with transparent background
- Background color: `#059669` (primary-600) OR `#ffffff` (white)
- Icon color: Contrasting color for legibility

**manifest.json Example:**
```json
{
  "name": "Scrapegoat",
  "short_name": "Scrapegoat",
  "icons": [
    {
      "src": "/android-icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ],
  "theme_color": "#059669",
  "background_color": "#ffffff",
  "display": "standalone"
}
```

---

### Open Graph / Social Media Images

#### OG Image (Social Previews)
- **File:** `/public/og-image.png`
- **Dimensions:** 1200x630px
- **Format:** PNG or JPG
- **Content:**
  - Scrapegoat logo (left-aligned)
  - Tagline: "Documentation Indexer for LLMs"
  - Background: White with subtle emerald gradient
- **Usage:** When sharing URL on social media

**HTML Meta Tags:**
```html
<meta property="og:title" content="Scrapegoat - Documentation Indexer">
<meta property="og:description" content="Index and search technical documentation for LLM consumption">
<meta property="og:image" content="https://yourdomain.com/og-image.png">
<meta property="og:url" content="https://yourdomain.com">
<meta name="twitter:card" content="summary_large_image">
```

---

### Icon System

#### Icon Library: Heroicons v2
- **Source:** https://heroicons.com/
- **Format:** Inline SVG (for dynamic coloring)
- **Style:** Outline (2px stroke-width)
- **Sizes:**
  - Small: 16px (UI elements)
  - Medium: 20px (buttons, inputs)
  - Large: 24px (headers, prominent actions)

**Common Icons:**
```html
<!-- Search Icon -->
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
</svg>

<!-- Close/X Icon -->
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M6 18L18 6M6 6l12 12"/>
</svg>

<!-- Check/Success Icon -->
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M5 13l4 4L19 7"/>
</svg>

<!-- Alert/Warning Icon -->
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
</svg>
```

---

### Illustration Assets (Optional)

#### Empty States
- **File:** `/public/illustrations/empty-state-*.svg`
- **Style:** Simple, outlined, emerald accent
- **Variants:**
  - `empty-search.svg` - No search results
  - `empty-libraries.svg` - No indexed libraries
  - `empty-jobs.svg` - No active jobs

**Example Empty State:**
```html
<div class="flex flex-col items-center justify-center py-12 text-center">
  <img src="/illustrations/empty-search.svg" alt="" class="w-48 h-48 mb-4">
  <h3 class="text-lg font-semibold text-stone-800 mb-2">No Results Found</h3>
  <p class="text-sm text-stone-600 max-w-md">
    Try adjusting your search query or check a different version.
  </p>
</div>
```

#### Error States
- **File:** `/public/illustrations/error-*.svg`
- **Variants:**
  - `error-404.svg` - Page not found
  - `error-500.svg` - Server error
  - `error-network.svg` - Connection failed

---

### Currently Missing Assets (Need Creation)

**All assets in scrapegoat need to be created. None exist currently.**

See separate document: `_REQUIRED_WEBUI_IMAGES.md` for detailed asset requirements and sources.

---

## Implementation Guidelines

### CSS Architecture

#### File Structure
```
src/web/styles/
├── main.css                 (Main entry, Tailwind config)
├── components/
│   ├── buttons.css         (Button variants)
│   ├── forms.css           (Input, select styles)
│   ├── cards.css           (Card components)
│   └── badges.css          (Status badges)
└── utilities/
    └── accessibility.css    (Screen reader, focus styles)
```

#### Tailwind Configuration
Located in `/src/web/styles/main.css`:
```css
@theme {
  /* Design tokens defined here */
  --color-primary-600: #059669;
  /* ... */
}
```

#### Component Classes (Tailwind @layer)
```css
@layer components {
  .btn-primary {
    @apply px-6 py-2.5 bg-primary-600 hover:bg-primary-700
           text-white font-medium rounded-lg
           focus:ring-4 focus:ring-primary-600/50
           transition-all duration-150;
  }
}
```

---

### Performance Optimization

#### CSS Bundle Size
- **Current:** Tailwind + Flowbite (~150KB gzipped)
- **Target:** < 100KB gzipped (purge unused classes)
- **Strategy:**
  - PurgeCSS configured for production
  - Tree-shake Flowbite components (only use needed)
  - Inline critical CSS for above-fold content

#### Image Optimization
- **SVG:** Minify with SVGO, inline for icons
- **PNG:** Compress with pngquant, serve WebP with PNG fallback
- **Responsive images:** Use `srcset` for multi-resolution
- **Lazy loading:** `loading="lazy"` for below-fold images

#### Font Loading Strategy
```css
/* Preload critical fonts */
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>

/* Font-display swap to avoid FOIT */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2-variations');
  font-display: swap;
}
```

---

### Browser Support

#### Target Browsers
```
Chrome: Last 2 versions
Firefox: Last 2 versions
Safari: Last 2 versions
Edge: Last 2 versions
Mobile Safari: iOS 13+
Chrome Android: Last 2 versions
```

#### Progressive Enhancement
- **Base functionality:** Works without JavaScript (HTMX provides server-rendered updates)
- **Enhanced experience:** AlpineJS for client-side interactivity
- **Fallbacks:**
  - CSS Grid → Flexbox → Block layout
  - Custom properties → Static values
  - Backdrop-filter → Solid background

#### CSS Feature Detection
```css
/* Modern browsers */
@supports (backdrop-filter: blur(10px)) {
  .modal-overlay {
    backdrop-filter: blur(10px);
  }
}

/* Fallback */
@supports not (backdrop-filter: blur(10px)) {
  .modal-overlay {
    background: rgba(0, 0, 0, 0.8);
  }
}
```

---

### Testing Checklist

#### Visual Testing
- [ ] All components render correctly on mobile (375px width)
- [ ] All components render correctly on tablet (768px width)
- [ ] All components render correctly on desktop (1440px width)
- [ ] Color contrast meets WCAG AA (use WebAIM Contrast Checker)
- [ ] Focus indicators visible on all interactive elements
- [ ] Hover states work on desktop, not triggered on mobile

#### Functional Testing
- [ ] Keyboard navigation works without mouse
- [ ] Screen reader announces all interactive elements
- [ ] Forms submit correctly with validation errors
- [ ] Modals trap focus and close with ESC
- [ ] HTMX requests show loading states
- [ ] Animations respect prefers-reduced-motion

#### Performance Testing
- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Time to Interactive < 3.5s
- [ ] Lighthouse score > 90 (Performance, Accessibility, Best Practices)

---

## Design System Governance

### Making Changes
1. **Propose change** in design specs document with rationale
2. **Test impact** on existing components
3. **Update tokens** in `/src/web/styles/main.css`
4. **Document change** in this file with version bump
5. **Communicate** to development team

### Versioning
- **Major (1.0.0 → 2.0.0):** Breaking changes (color swap, typography overhaul)
- **Minor (1.0.0 → 1.1.0):** New components, non-breaking additions
- **Patch (1.0.0 → 1.0.1):** Bug fixes, minor tweaks

### Token Naming Convention
```css
/* Format: --category-element-variant-state */
--color-primary-600          /* Base color */
--color-primary-600-hover    /* Interaction state */
--spacing-card-padding       /* Semantic spacing */
--font-size-body             /* Typography scale */
```

---

## Resources & References

### Design Inspiration
- **Context7.com:** Primary design system source
- **Tailwind UI:** Component patterns
- **Flowbite:** Component library

### Tools
- **Figma:** Design mockups and prototypes
- **Tailwind CSS Playground:** Test utility classes
- **WebAIM Contrast Checker:** Verify color accessibility
- **WAVE:** Browser extension for accessibility auditing
- **Lighthouse:** Performance and accessibility testing

### Documentation
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Flowbite Components](https://flowbite.com/docs/getting-started/introduction/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Heroicons](https://heroicons.com/)

---

## Changelog

### Version 1.0.0 (2025-11-25)
- Initial design system specification
- Context7-inspired color palette with emerald primary
- Typography scale with Inter font family
- Component library (buttons, inputs, cards, badges)
- Page layout specifications
- Responsive breakpoint strategy
- WCAG 2.1 AA accessibility standards
- Asset requirements and missing asset documentation

---

**End of Design Specifications**
