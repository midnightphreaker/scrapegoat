# Context7 Design System Analysis

**Source**: https://context7.com/
**Date**: 2025-11-09
**Purpose**: Style guide reference for Scrapegoat Web UI redesign

---

## Design Philosophy

Context7 employs a **modern, minimalist design** with:
- Clean, neutral color palette (stone/gray base)
- Emerald green as primary accent
- System fonts for optimal performance
- Tailwind CSS utility-first approach
- Light/dark mode support via CSS custom properties
- Subtle shadows and rounded corners
- Smooth transitions and animations

---

## 1. Color System

### Primary Colors

```css
/* HSL Format - Light Mode */
--background: 0 0% 100%;        /* #ffffff - Pure white */
--foreground: 0 0% 3.9%;        /* #0a0a0a - Near black */
--primary: 0 0% 9%;             /* #171717 - Dark gray */
--primary-foreground: 0 0% 98%; /* #fafafa - Off white */

/* HSL Format - Dark Mode */
--background: 0 0% 3.9%;        /* #0a0a0a - Near black */
--foreground: 0 0% 98%;         /* #fafafa - Off white */
--primary: 0 0% 98%;            /* #fafafa - Off white */
--primary-foreground: 0 0% 9%;  /* #171717 - Dark gray */
```

### Semantic Colors

```css
/* Emerald (Primary Accent) */
emerald-50:  #f0fdf4
emerald-100: #dcfce7
emerald-200: #bbf7d0
emerald-300: #86efac
emerald-400: #4ade80
emerald-500: #22c55e
emerald-600: #059669  /* Primary accent color */
emerald-700: #047857
emerald-800: #065f46
emerald-900: #064e3b

/* Stone (Neutral Base) */
stone-50:  #fafaf9  /* Page background */
stone-100: #f5f5f4
stone-200: #e7e5e4
stone-300: #d6d3d1
stone-400: #a8a29e
stone-500: #78716c
stone-600: #57534e
stone-700: #44403c
stone-800: #292524
stone-900: #1c1917

/* Gray (Text & Borders) */
gray-50:  #f9fafb
gray-100: #f3f4f6
gray-200: #e5e7eb
gray-300: #d1d5db
gray-400: #9ca3af
gray-500: #6b7280  /* Secondary text */
gray-600: #4b5563
gray-700: #374151
gray-800: #1f2937  /* Primary text */
gray-900: #111827
```

### Additional UI Colors

```css
--secondary: 0 0% 96.1%;      /* #f5f5f5 - Light gray */
--muted: 0 0% 96.1%;          /* #f5f5f5 - Muted backgrounds */
--accent: 0 0% 96.1%;         /* #f5f5f5 - Accent backgrounds */
--destructive: 0 84.2% 60.2%; /* #ef4444 - Red for errors/delete */
--border: 0 0% 89.8%;         /* #e5e5e5 - Border color */
--ring: 0 0% 3.9%;            /* #0a0a0a - Focus ring */
```

### Chart Colors

```css
--chart-1: 12 76% 61%;   /* Orange */
--chart-2: 173 58% 39%;  /* Teal */
--chart-3: 197 37% 24%;  /* Dark blue */
--chart-4: 43 74% 66%;   /* Yellow */
--chart-5: 27 87% 67%;   /* Coral */
```

---

## 2. Typography

### Font Stack

```css
/* Primary Font */
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
             "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans",
             sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
             "Segoe UI Symbol", "Noto Color Emoji";

/* Monospace Font */
font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
             "Liberation Mono", "Courier New", monospace;
```

### Font Sizes

```css
xs:   0.75rem    /* 12px */
sm:   0.875rem   /* 14px */
base: 1rem       /* 16px */
lg:   1.125rem   /* 18px */
xl:   1.25rem    /* 20px */
2xl:  1.5rem     /* 24px */
3xl:  1.875rem   /* 30px */
4xl:  2.25rem    /* 36px */
5xl:  3rem       /* 48px */
```

### Font Weights

```css
normal:    400
medium:    500
semibold:  600
bold:      700
extrabold: 800
black:     900
```

### Line Heights

```css
none:    1
tight:   1.25
snug:    1.375
normal:  1.5
relaxed: 1.625
loose:   1.75
```

### Letter Spacing

```css
tighter: -0.05em
tight:   -0.025em
normal:  0
wide:    0.025em
wider:   0.05em
widest:  0.1em
```

### Typography Utilities

```css
.antialiased {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.subpixel-antialiased {
  -webkit-font-smoothing: auto;
  -moz-osx-font-smoothing: auto;
}
```

---

## 3. Spacing & Layout

### Spacing Scale

```css
0:    0px
px:   1px
0.5:  0.125rem   /* 2px */
1:    0.25rem    /* 4px */
1.5:  0.375rem   /* 6px */
2:    0.5rem     /* 8px */
2.5:  0.625rem   /* 10px */
3:    0.75rem    /* 12px */
3.5:  0.875rem   /* 14px */
4:    1rem       /* 16px */
5:    1.25rem    /* 20px */
6:    1.5rem     /* 24px */
7:    1.75rem    /* 28px */
8:    2rem       /* 32px */
9:    2.25rem    /* 36px */
10:   2.5rem     /* 40px */
11:   2.75rem    /* 44px */
12:   3rem       /* 48px */
14:   3.5rem     /* 56px */
16:   4rem       /* 64px */
20:   5rem       /* 80px */
```

### Layout Structure

```css
/* Main Container */
.container {
  width: 100%;
  margin-right: auto;
  margin-left: auto;
  padding-right: 1rem;
  padding-left: 1rem;
}

/* Page Layout Pattern */
body {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  overflow-x: hidden;
  background-color: #fafaf9; /* stone-50 */
  font-smoothing: antialiased;
}
```

---

## 4. Shadows

### Shadow Definitions

```css
/* Small shadow - Subtle depth */
shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);

/* Medium shadow - Default for cards */
shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1),
           0 2px 4px -2px rgb(0 0 0 / 0.1);

/* Large shadow - Elevated components */
shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1),
           0 4px 6px -4px rgb(0 0 0 / 0.1);

/* Extra large shadow - Modals, popovers */
shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1),
           0 8px 10px -6px rgb(0 0 0 / 0.1);

/* 2XL shadow - Maximum elevation */
shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
```

---

## 5. Borders & Radius

### Border Widths

```css
border-0: 0px
border:   1px
border-2: 2px
border-4: 4px
border-8: 8px
```

### Border Radius

```css
--radius: 0.5rem;  /* Default: 8px */

rounded-none: 0px
rounded-sm:   2px
rounded:      4px
rounded-md:   6px
rounded-lg:   8px    /* Most common */
rounded-xl:   12px
rounded-2xl:  16px
rounded-3xl:  24px
rounded-full: 9999px
```

### Border Styles

```css
border-solid
border-dashed
border-dotted
border-double
```

---

## 6. Components

### Buttons

```css
/* Primary Button */
.btn-primary {
  background-color: #059669; /* emerald-600 */
  color: #ffffff;
  padding: 0.5rem 1rem;      /* py-2 px-4 */
  border-radius: 0.5rem;     /* rounded-lg */
  font-weight: 500;          /* medium */
  transition: all 150ms;
}

.btn-primary:hover {
  background-color: #047857; /* emerald-700 */
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

/* Secondary Button */
.btn-secondary {
  background-color: #f5f5f5; /* gray-100 */
  color: #1f2937;            /* gray-800 */
  border: 1px solid #e5e7eb; /* gray-200 */
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 150ms;
}

.btn-secondary:hover {
  background-color: #e5e7eb; /* gray-200 */
}

/* Destructive Button */
.btn-destructive {
  background-color: #ef4444; /* red-500 */
  color: #ffffff;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 150ms;
}
```

### Cards

```css
.card {
  background-color: #ffffff;
  border: 1px solid #e5e7eb;      /* gray-200 */
  border-radius: 0.5rem;          /* rounded-lg */
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
  padding: 1.5rem;                /* p-6 */
}

.card-header {
  margin-bottom: 1rem;            /* mb-4 */
  padding-bottom: 0.75rem;        /* pb-3 */
  border-bottom: 1px solid #e5e7eb;
}

.card-title {
  font-size: 1.125rem;            /* text-lg */
  font-weight: 600;               /* font-semibold */
  color: #1f2937;                 /* gray-800 */
}
```

### Forms

```css
/* Input Fields */
.input {
  width: 100%;
  padding: 0.5rem 0.75rem;        /* py-2 px-3 */
  border: 1px solid #e5e7eb;      /* gray-200 */
  border-radius: 0.5rem;          /* rounded-lg */
  font-size: 0.875rem;            /* text-sm */
  background-color: #ffffff;
  transition: all 150ms;
}

.input:focus {
  outline: 2px solid #059669;     /* emerald-600 */
  outline-offset: 2px;
  border-color: #059669;
}

/* Labels */
.label {
  display: block;
  font-size: 0.875rem;            /* text-sm */
  font-weight: 500;               /* medium */
  color: #1f2937;                 /* gray-800 */
  margin-bottom: 0.5rem;          /* mb-2 */
}

/* Helper Text */
.helper-text {
  font-size: 0.75rem;             /* text-xs */
  color: #6b7280;                 /* gray-500 */
  margin-top: 0.25rem;            /* mt-1 */
}
```

### Tables

```css
.table {
  width: 100%;
  border-collapse: collapse;
}

.table thead {
  background-color: #f9fafb;      /* gray-50 */
  border-bottom: 1px solid #e5e7eb;
}

.table th {
  padding: 0.75rem 1rem;          /* py-3 px-4 */
  text-align: left;
  font-size: 0.75rem;             /* text-xs */
  font-weight: 600;               /* font-semibold */
  color: #6b7280;                 /* gray-500 */
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.875rem;
  color: #1f2937;
}

.table tr:hover {
  background-color: #f9fafb;
}
```

### Navigation

```css
/* Header/Navigation Bar */
.nav {
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 50;
}

.nav-link {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  transition: color 150ms;
}

.nav-link:hover {
  color: #1f2937;
}

.nav-link.active {
  color: #059669;
  border-bottom: 2px solid #059669;
}
```

---

## 7. Animations & Transitions

### Transition Durations

```css
transition-75:   75ms
transition-100:  100ms
transition-150:  150ms   /* Default */
transition-200:  200ms
transition-300:  300ms
transition-500:  500ms
transition-700:  700ms
transition-1000: 1000ms
```

### Transition Timing Functions

```css
ease-linear:     cubic-bezier(0, 0, 1, 1)
ease-in:         cubic-bezier(0.4, 0, 1, 1)
ease-out:        cubic-bezier(0, 0, 0.2, 1)
ease-in-out:     cubic-bezier(0.4, 0, 0.2, 1)
```

### Keyframe Animations

```css
/* Pulse Animation */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Spin Animation */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Enter Animation (Fade + Scale) */
@keyframes enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Exit Animation */
@keyframes exit {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}
```

---

## 8. Responsive Design

### Breakpoints

```css
sm:  640px   /* Small devices (landscape phones) */
md:  768px   /* Medium devices (tablets) */
lg:  1024px  /* Large devices (desktops) */
xl:  1280px  /* Extra large devices */
2xl: 1536px  /* 2X Extra large devices */
```

### Mobile-First Approach

```html
<!-- Stack on mobile, row on desktop -->
<div class="flex flex-col lg:flex-row gap-4">
  <!-- Content -->
</div>

<!-- Full width on mobile, half on tablet, third on desktop -->
<div class="w-full md:w-1/2 lg:w-1/3">
  <!-- Content -->
</div>
```

---

## 9. Implementation Notes

### Tailwind CSS Configuration

Context7 uses **Tailwind CSS** as the primary styling framework with:

1. **Custom Properties** for theming (light/dark mode)
2. **JIT (Just-In-Time)** compilation for optimal bundle size
3. **Utility-first** approach with minimal custom CSS
4. **Component composition** via utility classes
5. **Dark mode** support via `class` strategy

### Key Tailwind Classes Used

```html
<!-- Layout -->
flex, grid, container, min-h-screen, overflow-x-hidden

<!-- Spacing -->
p-4, px-6, py-2, m-4, mx-auto, gap-4, space-y-4

<!-- Typography -->
text-sm, text-lg, font-medium, font-semibold, antialiased

<!-- Colors -->
bg-stone-50, text-gray-800, border-gray-200

<!-- Effects -->
shadow-md, rounded-lg, transition-all

<!-- Responsive -->
sm:flex-row, md:w-1/2, lg:grid-cols-3
```

### CSS Custom Properties Pattern

```css
:root {
  /* Light mode variables */
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  /* ... */
}

.dark {
  /* Dark mode overrides */
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  /* ... */
}

/* Usage in components */
.component {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

---

## 10. Design Patterns

### Page Structure

```html
<body class="flex min-h-screen flex-col overflow-x-hidden bg-stone-50 antialiased">
  <!-- Navigation -->
  <nav class="sticky top-0 z-50 bg-white border-b border-gray-200">
    <!-- Nav content -->
  </nav>

  <!-- Main Content -->
  <main class="flex-1 container mx-auto px-4 py-8">
    <!-- Page content -->
  </main>

  <!-- Footer -->
  <footer class="border-t border-gray-200 bg-white">
    <!-- Footer content -->
  </footer>
</body>
```

### Content Container Pattern

```html
<!-- Centered content with max width -->
<div class="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
  <!-- Content -->
</div>
```

### Card Grid Pattern

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
    <!-- Card content -->
  </div>
</div>
```

---

## 11. Accessibility

### Focus Styles

```css
/* Focus ring using emerald accent */
.focus-ring:focus {
  outline: 2px solid #059669;
  outline-offset: 2px;
}

/* Focus visible only for keyboard navigation */
.focus-visible:focus-visible {
  outline: 2px solid #059669;
  outline-offset: 2px;
}
```

### Color Contrast

All text color combinations meet **WCAG AA** standards:
- Dark text (#1f2937) on white background (#ffffff) - 12.63:1
- Medium text (#6b7280) on white background - 4.69:1
- White text on emerald (#059669) - 4.52:1

---

## 12. Summary

### Core Design Principles

1. **Minimalist Aesthetic** - Clean, uncluttered interfaces
2. **Neutral Base** - Stone/gray colors with emerald accents
3. **System Fonts** - Native fonts for performance
4. **Subtle Depth** - Light shadows and borders
5. **Smooth Interactions** - 150ms transitions
6. **Responsive First** - Mobile-first breakpoints
7. **Accessibility** - High contrast, focus indicators

### Quick Reference

| Element | Value |
|---------|-------|
| Primary Color | `#059669` (emerald-600) |
| Background | `#fafaf9` (stone-50) |
| Text Primary | `#1f2937` (gray-800) |
| Text Secondary | `#6b7280` (gray-500) |
| Border | `#e5e7eb` (gray-200) |
| Border Radius | `8px` (0.5rem) |
| Shadow | `0 1px 2px rgb(0 0 0 / 0.05)` |
| Transition | `150ms ease-in-out` |

---

**Analysis Complete**: 2025-11-09
**Next Steps**: Apply this design system to Scrapegoat Web UI components
