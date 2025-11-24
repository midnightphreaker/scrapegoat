# Scrapegoat WebUI Redesign - Context7 Design System Integration

## Implementation Plan v1.0
**Date:** 2025-11-25
**Status:** Planning Complete - Ready for Implementation
**Confidence:** 9/10 (Expert validated by Gemini-2.5-Pro)

---

## Executive Summary

Redesign scrapegoat's web UI to fully adopt the Context7 design system extracted from webui_style.json. Current foundation is **90% aligned** - this plan closes the remaining gaps through systematic integration of Inter font, typography scale, custom shadows, and Context7 branding assets.

**Scope:** 26 components, 7 route files, 1 layout, CSS configuration, asset integration
**Effort Estimate:** 8-12 hours for complete implementation
**Risk Level:** Low (foundation already matches, incremental changes)

---

## 1. Current State Analysis

### ✅ What's Already Aligned (90% Foundation)

| Element | Status | Details |
|---------|--------|---------|
| **Primary Color** | ✅ Complete | Emerald #059669 (emerald-600) already in use |
| **Color Palette** | ✅ Complete | Stone colors (#78716c, #44403c, #a8a29e) defined |
| **Spacing System** | ✅ Complete | 8px scale (Tailwind default matches Context7) |
| **Border Radius** | ✅ Complete | 8px primary (rounded-lg) matches Context7 |
| **Tailwind Version** | ✅ Complete | v4.1.4 with modern @theme syntax |
| **Build System** | ✅ Complete | Vite 6.3.5 with @tailwindcss/vite plugin |
| **Component Framework** | ✅ Complete | HTMX + AlpineJS + Flowbite + @kitajs/html |
| **Transitions** | ✅ Complete | duration-150 (Context7 standard) |

### ❌ Gaps to Close (10% Remaining)

| Element | Current State | Target State | Priority |
|---------|---------------|--------------|----------|
| **Typography - Font Family** | System fonts | Inter font (self-hosted) | HIGH |
| **Typography - Scale** | Generic Tailwind | Context7 scale (14,15,16,18,24px) | HIGH |
| **Typography - Line Heights** | Generic | Context7 specific (20,24,28,32px) | MEDIUM |
| **Typography - Letter Spacing** | None | -0.6px for headings | MEDIUM |
| **Shadows** | Tailwind defaults | Context7 custom shadows (4 types) | MEDIUM |
| **Button Styles** | Close but generic | Context7 exact styles | MEDIUM |
| **Input Border Radius** | 8px (rounded-lg) | 12px (rounded-xl) for inputs | LOW |
| **Logo** | Text "scrapegoat" | Context7 SVG logo | HIGH |
| **Favicons** | Generic set | Context7 branded set | MEDIUM |

---

## 2. Design Token Mapping

### 2.1 Typography System (Context7 → Tailwind)

#### Font Family
```typescript
// tailwind.config.ts
fontFamily: {
  sans: ['Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
  mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
  brand: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'], // Keep existing
}
```

#### Font Sizes (Context7 Scale)
```typescript
fontSize: {
  // Context7 typography scale
  'xs': ['14px', { lineHeight: '20px' }],      // Small text, labels
  'sm': ['15px', { lineHeight: '15px' }],      // Badges, tags
  'base': ['16px', { lineHeight: '24px' }],    // Body text, buttons
  'lg': ['18px', { lineHeight: '28px' }],      // Large body text
  'display': ['24px', {
    lineHeight: '32px',
    letterSpacing: '-0.6px'
  }],                                           // Headings (h1)
}
```

#### Font Weights (Context7)
```typescript
fontWeight: {
  normal: '400',   // Body text
  medium: '500',   // Links, emphasis
  semibold: '600', // Headings, badges
  bold: '700',     // Strong emphasis
}
```

### 2.2 Shadow System (Context7 Custom)

From webui_style.json shadows array:

```typescript
boxShadow: {
  'context7-sm': 'rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px',
  'context7-md': 'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px',
  'context7-lg': 'rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px',
  'context7-none': 'rgba(0, 0, 0, 0) 0px 0px 0px 0px',
}
```

**Usage Mapping:**
- Cards/Containers: `shadow-context7-md` (replaces current `shadow-sm`)
- Buttons: `shadow-context7-sm`
- Modals/Popups: `shadow-context7-lg`
- Flat elements: `shadow-context7-none`

### 2.3 Component-Specific Tokens

#### Buttons (Context7 Style)
```typescript
// Primary Button
bg-primary-600 hover:bg-primary-700
border border-transparent
rounded-lg
px-4 py-2.5
text-sm font-medium text-white
shadow-context7-sm
transition-colors duration-150

// Secondary Button (from webui_style.json)
bg-transparent hover:bg-stone-100
border border-stone-300 hover:border-stone-400
rounded-lg
px-3 py-2.5
text-base font-normal text-stone-800
```

#### Inputs (Context7 Style)
```typescript
// Text Input
border border-primary-600  // Context7 uses emerald for input borders
rounded-xl                  // 12px (Context7 specific for inputs)
px-4 py-2                   // Context7: 0px 40px 0px 16px (for search inputs)
bg-white
focus:outline-stone-800     // Context7 focus style
```

#### Links (Context7 Variants)
From webui_style.json - 6 link color variants:
- Primary: `text-stone-800 hover:text-stone-900` (most common)
- White: `text-white font-medium`
- Dark: `text-stone-700 font-medium`
- Muted: `text-stone-500 underline`
- Light: `text-stone-600`
- Accent: `text-primary-600 font-semibold`

---

## 3. Component Inventory & Modification Plan

### 3.1 Layout Components (Critical Path)

#### Layout.tsx (PRIORITY: HIGH)
**File:** `src/web/components/Layout.tsx`
**Changes Required:**
- [ ] Replace "scrapegoat" text with Context7 Logo component import
- [ ] Update header typography to Context7 scale
- [ ] Update favicon references (lines 53-126) to Context7 set
- [ ] Change `font-brand` to Inter-based system
- [ ] Update MCP status badge colors to Context7 palette
- [ ] Apply shadow-context7-sm to header

**Typography Updates:**
```tsx
// Current (line 169):
class="text-2xl font-bold text-gray-900"

// Context7:
class="text-display font-semibold text-stone-900"
```

**Logo Integration:**
```tsx
// Import Context7 logo component
import Context7Logo from '../assets/Context7Logo';

// Replace text (lines 168-172):
<a href="/" class="flex items-center gap-3">
  <Context7Logo className="w-10 h-11" />
  <span class="text-display font-semibold text-stone-900">scrapegoat</span>
</a>
```

### 3.2 Form Components

#### ScrapeFormContent.tsx (PRIORITY: HIGH)
**File:** `src/web/components/ScrapeFormContent.tsx`
**Changes Required:**
- [ ] Update input border radius: `rounded-lg` → `rounded-xl` (Context7 input style)
- [ ] Update label typography: `text-sm` → consistent Context7 scale
- [ ] Update button styles to exact Context7 button spec
- [ ] Apply shadow-context7-sm to form container
- [ ] Update textarea font to Inter

**Current vs Context7:**
```tsx
// Current input (line 93):
class="border border-gray-200 rounded-lg"

// Context7 input:
class="border border-primary-600 rounded-xl"
```

#### FetcherSelector.tsx + Crawl4AIOptions.tsx
**Files:** `src/web/components/Fetcher/*.tsx`
**Changes:** Typography scale, input border radius

### 3.3 Card Components

#### LibraryDetailCard.tsx (PRIORITY: MEDIUM)
**File:** `src/web/components/LibraryDetailCard.tsx`
**Changes Required:**
- [ ] Apply shadow-context7-md to card container (line 22)
- [ ] Update typography: `text-lg` → Context7 scale
- [ ] Update link styles to Context7 link variants

**Current vs Context7:**
```tsx
// Current (line 22):
class="shadow-sm"

// Context7:
class="shadow-context7-md"
```

#### LibrarySearchCard.tsx, ServiceStatusCard.tsx
**Similar Updates:** Shadow system, typography scale

### 3.4 Badge Components

#### StatusBadge.tsx (PRIORITY: MEDIUM)
**File:** `src/web/components/StatusBadge.tsx`
**Changes Required:**
- [ ] Update badge typography: `text-xs` → Context7 badge scale
- [ ] Update font weight: `font-medium` → `font-semibold` (Context7 badge style)
- [ ] Apply rounded (8px, already correct)

**Context7 Badge Style:**
```tsx
// Current (line 17):
class="px-1.5 py-0.5 text-xs font-medium rounded"

// Context7:
class="px-2 py-1 text-sm font-semibold rounded-lg"
```

#### VersionBadge.tsx
**Similar Updates:** Typography and weight adjustments

### 3.5 UI Utility Components

| Component | File | Changes |
|-----------|------|---------|
| Alert.tsx | `src/web/components/Alert.tsx` | Typography scale, shadow-context7-sm |
| Tooltip.tsx | `src/web/components/Tooltip.tsx` | Typography, shadow-context7-lg |
| LoadingSpinner.tsx | `src/web/components/LoadingSpinner.tsx` | Color to primary-600 |
| ProgressBar.tsx | `src/web/components/ProgressBar.tsx` | Color to primary-600 |

### 3.6 List & Item Components

| Component | File | Changes | Priority |
|-----------|------|---------|----------|
| LibraryList.tsx | `src/web/components/LibraryList.tsx` | Typography | LOW |
| LibraryItem.tsx | `src/web/components/LibraryItem.tsx` | Typography, shadows | LOW |
| JobList.tsx | `src/web/components/JobList.tsx` | Typography | LOW |
| JobItem.tsx | `src/web/components/JobItem.tsx` | Typography, badges | MEDIUM |
| SearchResultList.tsx | `src/web/components/SearchResultList.tsx` | Typography | LOW |
| SearchResultItem.tsx | `src/web/components/SearchResultItem.tsx` | Typography, link styles | MEDIUM |
| SearchResultSkeletonItem.tsx | `src/web/components/SearchResultSkeletonItem.tsx` | Update skeleton colors | LOW |

### 3.7 Table & Detail Components

| Component | File | Changes | Priority |
|-----------|------|---------|----------|
| LinksTable.tsx | `src/web/components/Pages/LinksTable.tsx` | Typography, borders | LOW |
| VersionDetailsRow.tsx | `src/web/components/VersionDetailsRow.tsx` | Typography | LOW |

### 3.8 Media Components

| Component | File | Changes | Priority |
|-----------|------|---------|----------|
| MediaGallery.tsx | `src/web/components/Pages/MediaGallery.tsx` | Typography, shadows | LOW |
| ScreenshotViewer.tsx | `src/web/components/Pages/ScreenshotViewer.tsx` | Modal shadow-context7-lg | LOW |

### 3.9 Service Status Components

| Component | File | Changes | Priority |
|-----------|------|---------|----------|
| ServiceHealthIndicator.tsx | `src/web/components/ServiceStatus/ServiceHealthIndicator.tsx` | Badge styles | LOW |
| ServiceStatusCard.tsx | `src/web/components/ServiceStatus/ServiceStatusCard.tsx` | Card shadows, typography | LOW |

---

## 4. Route/View Files

| Route File | Path | Changes | Priority |
|------------|------|---------|----------|
| index.tsx | `src/web/routes/index.tsx` | Typography for section headings | MEDIUM |
| jobs/new.tsx | `src/web/routes/jobs/new.tsx` | Form integration (uses ScrapeForm) | LOW |
| jobs/list.tsx | `src/web/routes/jobs/list.tsx` | List integration (uses JobList) | LOW |
| jobs/cancel.tsx | `src/web/routes/jobs/cancel.tsx` | Button styles | LOW |
| jobs/clear-completed.tsx | `src/web/routes/jobs/clear-completed.tsx` | Button styles | LOW |
| libraries/list.tsx | `src/web/routes/libraries/list.tsx` | Typography | LOW |
| libraries/detail.tsx | `src/web/routes/libraries/detail.tsx` | Card integration | LOW |

---

## 5. Asset Requirements

### 5.1 Fonts

**Package to Install:**
```bash
npm install @fontsource/inter @fontsource/inter/400.css @fontsource/inter/500.css @fontsource/inter/600.css @fontsource/inter/700.css
```

**Import in main.css:**
```css
/* Add at top of src/web/styles/main.css */
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
@import "@fontsource/inter/700.css";
```

**Update @theme:**
```css
@theme {
  --font-sans: Inter, "Inter Fallback", system-ui, sans-serif;
}
```

### 5.2 Logo

**Source URL:** https://context7.com/_next/static/media/context7vector.39c35f61.svg

**Download Strategy:**
```bash
# Download Context7 logo
curl -o src/web/assets/context7-logo.svg \
  https://context7.com/_next/static/media/context7vector.39c35f61.svg
```

**Create SVG Component:**
```tsx
// src/web/components/Context7Logo.tsx
export interface Context7LogoProps {
  className?: string;
}

const Context7Logo = ({ className }: Context7LogoProps) => (
  <svg
    width="42"
    height="47"
    viewBox="0 0 42 47"
    class={className}
    aria-label="Context7 Logo"
  >
    {/* SVG paths from downloaded file */}
  </svg>
);

export default Context7Logo;
```

**Alternative:** Import downloaded SVG directly (Vite will optimize)
```tsx
import Context7LogoSVG from '../assets/context7-logo.svg';
```

### 5.3 Favicons

**Source URL:** https://context7.com/favicon.ico (74x75)

**Generation Strategy:**
Use favicon generator tool (realfavicongenerator.net) with Context7 logo to create:
- favicon.ico (16x16, 32x32, 48x48)
- apple-icon-*.png (57x57 through 180x180)
- android-icon-*.png (192x192)
- favicon-16x16.png, favicon-32x32.png, favicon-96x96.png
- ms-icon-144x144.png
- manifest.json (update name to "Scrapegoat")

**Files to Replace:**
```
public/
├── favicon.ico
├── apple-icon-57x57.png
├── apple-icon-60x60.png
├── apple-icon-72x72.png
├── apple-icon-76x76.png
├── apple-icon-114x114.png
├── apple-icon-120x120.png
├── apple-icon-144x144.png
├── apple-icon-152x152.png
├── apple-icon-180x180.png
├── android-icon-192x192.png
├── favicon-16x16.png
├── favicon-32x32.png
├── favicon-96x96.png
├── ms-icon-144x144.png
└── manifest.json
```

**Download Commands:**
```bash
# Download Context7 favicon as base
curl -o public/favicon-base.ico https://context7.com/favicon.ico

# Then use favicon generator tool to create full set
# Manual step: Upload favicon-base.ico to realfavicongenerator.net
# Configure: App name "Scrapegoat", theme color #059669
# Download generated package to public/
```

### 5.4 OpenGraph/Social Images

**Source URLs:**
- OG Image: https://context7.com/opengraph-image.png?913a90853d344a57
- Twitter Image: Same as OG

**Strategy:**
- **Option A:** Download and use Context7 images as-is (quick)
- **Option B:** Generate custom OG image with "Scrapegoat" branding (recommended)

**If generating custom OG image:**
- Size: 1200x630px (standard OG size)
- Background: Emerald gradient (primary-600 to primary-700)
- Logo: Context7 logo + "Scrapegoat" text
- Tagline: "Documentation Scraping & Search"

---

## 6. Configuration Files

### 6.1 Create tailwind.config.ts

**File:** `tailwind.config.ts` (NEW FILE - Tailwind v4 uses CSS-first, but can still use TS config for extensions)

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/web/**/*.{ts,tsx,js,jsx}',
    './node_modules/flowbite/**/*.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        brand: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'xs': ['14px', { lineHeight: '20px' }],
        'sm': ['15px', { lineHeight: '15px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '28px' }],
        'display': ['24px', { lineHeight: '32px', letterSpacing: '-0.6px' }],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      boxShadow: {
        'context7-sm': 'rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px',
        'context7-md': 'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px',
        'context7-lg': 'rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px',
        'context7-none': 'rgba(0, 0, 0, 0) 0px 0px 0px 0px',
      },
      borderRadius: {
        'context7-input': '12px', // Specific for inputs
      },
    },
  },
  plugins: [
    require('flowbite/plugin'),
  ],
} satisfies Config;
```

### 6.2 Update src/web/styles/main.css

**Current File:** Already has @theme, needs font imports and shadow updates

**Changes Required:**
```css
/* Add at very top, before @import "tailwindcss" */
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
@import "@fontsource/inter/700.css";

/* Keep existing imports */
@import "tailwindcss";
@import "flowbite/src/themes/default";
@plugin "flowbite/plugin";
@plugin "flowbite-typography";
@source "../../../node_modules/flowbite";

/* Update @theme section */
@theme {
  /* Update font-sans to use Inter */
  --font-sans: Inter, "Inter Fallback", system-ui, sans-serif;

  /* Keep all existing color definitions */
  /* ... (preserve existing primary, accent, stone colors) ... */

  /* Add Context7 typography scale */
  --font-size-xs: 14px;
  --font-size-sm: 15px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-display: 24px;

  /* Add Context7 line heights */
  --line-height-xs: 20px;
  --line-height-sm: 15px;
  --line-height-base: 24px;
  --line-height-lg: 28px;
  --line-height-display: 32px;

  /* Add Context7 shadows */
  --shadow-context7-sm: rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px;
  --shadow-context7-md: rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px;
  --shadow-context7-lg: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px;
}

/* Keep existing @layer components section */
@layer components {
  /* ... preserve existing rules ... */

  /* Add Context7 button utilities */
  .btn-context7-primary {
    @apply bg-primary-600 hover:bg-primary-700 border border-transparent rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-context7-sm transition-colors duration-150;
  }

  .btn-context7-secondary {
    @apply bg-transparent hover:bg-stone-100 border border-stone-300 hover:border-stone-400 rounded-lg px-3 py-2.5 text-base font-normal text-stone-800 transition-colors duration-150;
  }

  /* Add Context7 input utility */
  .input-context7 {
    @apply border border-primary-600 rounded-xl px-4 py-2 bg-white focus:outline-stone-800 text-base transition-colors duration-150;
  }
}
```

---

## 7. Phased Rollout Strategy

### Phase 1: Foundation (2-3 hours)
**Goal:** Install dependencies, configure design tokens, no visual changes yet

**Tasks:**
1. Install @fontsource/inter package
2. Create/update tailwind.config.ts with Context7 tokens
3. Update src/web/styles/main.css with font imports
4. Download Context7 logo SVG
5. Create Context7Logo.tsx component
6. Test build: `npm run build` (ensure no errors)
7. Commit: "feat: add Context7 design tokens and Inter font"

**Success Criteria:**
- ✅ Build succeeds without errors
- ✅ Inter font loads in browser (check DevTools Network tab)
- ✅ New shadow utilities available in Tailwind

### Phase 2: Core Layout & Branding (2-3 hours)
**Goal:** Update logo, header, favicons - make it visibly Context7

**Tasks:**
1. Update Layout.tsx:
   - Replace "scrapegoat" text with Context7Logo component
   - Update header typography to display scale
   - Update favicon references to Context7 set
2. Generate favicon set from Context7 logo
3. Replace all favicon files in public/
4. Update manifest.json
5. Test visual appearance in browser
6. Commit: "feat: integrate Context7 logo and branding"

**Success Criteria:**
- ✅ Context7 logo visible in header
- ✅ Favicons show Context7 branding in browser tabs
- ✅ Typography uses Inter font
- ✅ Header looks polished with Context7 design

### Phase 3: Forms & Inputs (1-2 hours)
**Goal:** Update all form components to Context7 input styles

**Tasks:**
1. Update ScrapeFormContent.tsx:
   - Change input border radius to rounded-xl
   - Update button styles to btn-context7-primary
   - Apply shadow-context7-md to form container
2. Update FetcherSelector.tsx and Crawl4AIOptions.tsx
3. Update all input/textarea/select elements across components
4. Test form interactions in browser
5. Commit: "feat: apply Context7 styles to forms and inputs"

**Success Criteria:**
- ✅ All inputs have 12px border radius
- ✅ Buttons match Context7 button spec
- ✅ Form shadows use Context7 system
- ✅ Typography consistent across forms

### Phase 4: Cards, Badges & UI Elements (2-3 hours)
**Goal:** Update all cards, badges, and utility components

**Tasks:**
1. Update all card components (LibraryDetailCard, LibrarySearchCard, etc.)
   - Apply shadow-context7-md
   - Update typography scales
2. Update badge components (StatusBadge, VersionBadge)
   - Use Context7 badge typography
   - Adjust font weights
3. Update UI utilities (Alert, Tooltip, LoadingSpinner, ProgressBar)
4. Test all components in storybook/browser
5. Commit: "feat: apply Context7 styles to cards, badges, and UI elements"

**Success Criteria:**
- ✅ All cards use Context7 shadows
- ✅ Badges use semibold font weight
- ✅ Typography scales consistent
- ✅ No visual regressions

### Phase 5: Lists, Tables & Details (1-2 hours)
**Goal:** Update remaining list/table components

**Tasks:**
1. Update list components (LibraryList, LibraryItem, JobList, JobItem)
2. Update search result components
3. Update table components (LinksTable, VersionDetailsRow)
4. Update media components (MediaGallery, ScreenshotViewer)
5. Test all pages with real data
6. Commit: "feat: apply Context7 styles to lists, tables, and media components"

**Success Criteria:**
- ✅ All components use Context7 typography
- ✅ Links use Context7 link variants
- ✅ Tables/lists visually consistent
- ✅ No layout breakage

### Phase 6: Testing & Polish (1-2 hours)
**Goal:** Comprehensive QA and refinements

**Tasks:**
1. Visual regression testing (compare before/after screenshots)
2. Typography verification (all text uses Inter, correct scales)
3. Color contrast accessibility check (WCAG AA compliance)
4. Responsive design testing (mobile, tablet, desktop)
5. Cross-browser testing (Chrome, Firefox, Safari)
6. Performance check (bundle size, font loading)
7. Fix any issues discovered
8. Final commit: "feat: Context7 design system integration complete"

**Success Criteria:**
- ✅ No visual regressions
- ✅ WCAG AA color contrast compliance
- ✅ Responsive on all breakpoints
- ✅ Works in all major browsers
- ✅ Performance metrics acceptable

---

## 8. Testing Strategy

### 8.1 Visual Regression Testing

**Tools:** Manual screenshots + diff tool

**Test Cases:**
1. Homepage (index route)
   - Before/after screenshots
   - Compare header, forms, job queue, library list
2. Library detail page
   - Before/after card layouts
   - Typography scales
3. Modal/Popup states
   - MCP configuration modal
   - Tooltips
4. Form states
   - Default, focused, error states
   - Button hover states

**Process:**
```bash
# Before implementation
npm run dev
# Take screenshots of all pages

# After each phase
# Take new screenshots
# Compare visually for regressions
```

### 8.2 Typography Verification

**Checklist:**
- [ ] All text uses Inter font (check DevTools computed styles)
- [ ] Font weights correct (400, 500, 600, 700)
- [ ] Font sizes match Context7 scale (14, 15, 16, 18, 24px)
- [ ] Line heights correct (20, 15, 24, 28, 32px)
- [ ] Letter spacing -0.6px on headings
- [ ] No fallback fonts loading (check Network tab)

**Tools:**
- Browser DevTools > Computed > font-family
- WhatFont browser extension
- Manual inspection

### 8.3 Color Contrast Accessibility

**Tools:**
- Chrome DevTools > Lighthouse > Accessibility
- axe DevTools browser extension
- WebAIM Contrast Checker

**Requirements:** WCAG AA compliance (4.5:1 for normal text, 3:1 for large text)

**Key Combinations to Test:**
- Primary button: white text on #059669 (primary-600)
- Body text: stone-800 (#292524) on white
- Badge text: Various badge colors on light backgrounds
- Link colors: All 6 Context7 link variants

### 8.4 Responsive Design Testing

**Breakpoints (from webui_style.json):**
- 600px (mobile landscape)
- 640px (sm - small tablets)
- 768px (md - tablets)
- 1024px (lg - small desktops)
- 1280px (xl - desktops)
- 1536px (2xl - large desktops)

**Test Matrix:**

| Device | Viewport | Test Cases |
|--------|----------|------------|
| Mobile | 375x667 (iPhone SE) | Header stacking, form layout, cards |
| Mobile | 414x896 (iPhone 11) | Navigation, typography readability |
| Tablet | 768x1024 (iPad) | 2-column layouts, modal sizes |
| Desktop | 1280x720 | Full layout, all features |
| Desktop | 1920x1080 | Max width constraints, spacing |

**Tools:**
- Chrome DevTools > Device Mode
- Firefox Responsive Design Mode
- Real device testing (if available)

### 8.5 Cross-Browser Testing

**Browsers to Test:**

| Browser | Version | Priority | Test Focus |
|---------|---------|----------|------------|
| Chrome | Latest | HIGH | Primary development browser |
| Firefox | Latest | HIGH | Shadow rendering, font rendering |
| Safari | Latest (macOS/iOS) | MEDIUM | -webkit- prefixes, font smoothing |
| Edge | Latest | LOW | Chromium-based, should match Chrome |

**Known Issues to Watch:**
- Inter font rendering differences across browsers
- Shadow blur radius inconsistencies
- Focus ring styles (Safari different default)

### 8.6 Performance Testing

**Metrics to Monitor:**

| Metric | Before | Target | Tool |
|--------|--------|--------|------|
| Bundle Size (main.js) | Check current | No more than +10% | Vite build output |
| Bundle Size (main.css) | Check current | +5-10KB (font faces) | Vite build output |
| First Contentful Paint | Baseline | No regression | Lighthouse |
| Font Load Time | N/A (no custom fonts) | <200ms | DevTools Network |
| Time to Interactive | Baseline | No regression | Lighthouse |

**Font Loading Strategy:**
- Inter loaded via @fontsource (self-hosted)
- Weights: 400, 500, 600, 700 (4 font files)
- Expect ~40-60KB total font file size
- Use `font-display: swap` (check @fontsource defaults)

**Commands:**
```bash
# Build and check bundle sizes
npm run build
# Check dist/assets/ file sizes

# Run Lighthouse
npm run dev
# Open Chrome DevTools > Lighthouse > Performance
```

---

## 9. Risk Assessment

### 9.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| **Flowbite conflicts with Context7 styles** | MEDIUM | MEDIUM | Test Flowbite components early; override with Context7 utilities if needed |
| **Inter font loading delays** | LOW | LOW | Self-hosted via @fontsource; add font-display: swap |
| **Tailwind v4 @theme syntax issues** | LOW | HIGH | Already using @theme successfully; extend carefully |
| **Component prop type changes** | VERY LOW | LOW | Only CSS class changes, no prop changes |
| **Build size increase** | LOW | LOW | Monitor bundle size; Inter fonts add ~50KB (acceptable) |
| **Visual regressions** | MEDIUM | MEDIUM | Phase-by-phase testing; screenshot comparisons |
| **Accessibility violations** | LOW | HIGH | Run axe DevTools after each phase; fix immediately |
| **HTMX/AlpineJS conflicts** | VERY LOW | LOW | Only CSS changes; no JS logic affected |

### 9.2 Design Risks

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| **Context7 colors don't match scrapegoat brand** | LOW | MEDIUM | Emerald already matches; stone colors are neutral |
| **Typography too large/small** | MEDIUM | LOW | Context7 scale is standard; test with real content |
| **Shadow system too subtle** | LOW | LOW | Context7 shadows are industry-standard; visually test |
| **Logo doesn't fit header layout** | MEDIUM | LOW | Context7 logo is 42x47px; test in header; resize if needed |
| **Favicon not recognizable** | LOW | LOW | Generate from Context7 logo; ensure emerald color visible |

### 9.3 Process Risks

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| **Scope creep (adding features)** | MEDIUM | MEDIUM | Stick to design system integration only; no new features |
| **Underestimated effort** | LOW | MEDIUM | Phased approach allows early detection; adjust as needed |
| **Testing time underestimated** | MEDIUM | MEDIUM | Allocate full Phase 6 for testing; extend if needed |
| **Asset download failures** | LOW | LOW | Backup: use placeholder assets; generate if Context7 URLs fail |

### 9.4 Contingency Plans

**If Context7 assets unavailable:**
- Logo: Use text-based "scrapegoat" with Inter font, emerald color
- Favicons: Generate from letter "S" with emerald background
- Proceed with typography and color updates only

**If Inter font causes issues:**
- Fallback to system-ui fonts (already in font stack)
- Apply Context7 typography scale to system fonts
- Still achieves 80% design fidelity

**If bundle size grows too much:**
- Load only 2 font weights (400, 600) instead of 4
- Use system fonts for non-critical text
- Lazy-load heavy font weights

**If Flowbite conflicts arise:**
- Override Flowbite styles with !important (last resort)
- Disable specific Flowbite components
- Replace Flowbite components with custom Context7 components

---

## 10. Success Criteria

### 10.1 Must-Have (Launch Blockers)

- [ ] **Inter font loaded and applied** to all text elements
- [ ] **Context7 logo** visible in header
- [ ] **Primary color** (#059669 emerald) used consistently
- [ ] **Typography scale** matches Context7 (14, 15, 16, 18, 24px)
- [ ] **Shadow system** uses Context7 custom shadows
- [ ] **No visual regressions** (all existing features still work)
- [ ] **Build succeeds** without errors
- [ ] **WCAG AA accessibility** maintained (color contrast)
- [ ] **Responsive design** works on mobile, tablet, desktop

### 10.2 Should-Have (High Priority)

- [ ] **Favicons** use Context7 branding
- [ ] **Button styles** match Context7 exact specifications
- [ ] **Input border radius** updated to 12px (rounded-xl)
- [ ] **Badge typography** uses semibold weight
- [ ] **Card shadows** use shadow-context7-md
- [ ] **Link styles** use Context7 color variants
- [ ] **Font weights** correct (400, 500, 600, 700)
- [ ] **Line heights** match Context7 specifications

### 10.3 Nice-to-Have (Polish)

- [ ] **Letter spacing** -0.6px on headings
- [ ] **Custom OG image** with scrapegoat branding
- [ ] **Storybook** documentation for Context7 components
- [ ] **CSS utilities** (.btn-context7-primary, .input-context7)
- [ ] **Theme switcher** (future: Context7 dark mode)
- [ ] **Animation polish** (transitions, hover effects)

---

## 11. File Modification Checklist

### 11.1 New Files to Create

- [ ] `tailwind.config.ts` - Tailwind configuration with Context7 tokens
- [ ] `src/web/components/Context7Logo.tsx` - Logo component
- [ ] `src/web/assets/context7-logo.svg` - Downloaded logo SVG
- [ ] `public/favicon.ico` - Context7 favicon (replace)
- [ ] `public/apple-icon-*.png` - Apple touch icons (replace all)
- [ ] `public/android-icon-*.png` - Android icons (replace)
- [ ] `public/favicon-*.png` - Standard favicons (replace)
- [ ] `public/manifest.json` - Update with scrapegoat branding

### 11.2 Files to Modify

**Configuration:**
- [ ] `package.json` - Add @fontsource/inter dependency
- [ ] `src/web/styles/main.css` - Add font imports, update @theme
- [ ] `vite.config.web.ts` - Ensure SVG imports supported (already should be)

**Layout:**
- [ ] `src/web/components/Layout.tsx` - Logo, header, favicons, typography

**Forms (7 files):**
- [ ] `src/web/components/ScrapeForm.tsx`
- [ ] `src/web/components/ScrapeFormContent.tsx`
- [ ] `src/web/components/Fetcher/FetcherSelector.tsx`
- [ ] `src/web/components/Fetcher/Crawl4AIOptions.tsx`

**Cards (3 files):**
- [ ] `src/web/components/LibraryDetailCard.tsx`
- [ ] `src/web/components/LibrarySearchCard.tsx`
- [ ] `src/web/components/ServiceStatus/ServiceStatusCard.tsx`

**Badges (2 files):**
- [ ] `src/web/components/StatusBadge.tsx`
- [ ] `src/web/components/VersionBadge.tsx`

**UI Utilities (4 files):**
- [ ] `src/web/components/Alert.tsx`
- [ ] `src/web/components/Tooltip.tsx`
- [ ] `src/web/components/LoadingSpinner.tsx`
- [ ] `src/web/components/ProgressBar.tsx`

**Lists (6 files):**
- [ ] `src/web/components/LibraryList.tsx`
- [ ] `src/web/components/LibraryItem.tsx`
- [ ] `src/web/components/JobList.tsx`
- [ ] `src/web/components/JobItem.tsx`
- [ ] `src/web/components/SearchResultList.tsx`
- [ ] `src/web/components/SearchResultItem.tsx`
- [ ] `src/web/components/SearchResultSkeletonItem.tsx`

**Tables (2 files):**
- [ ] `src/web/components/Pages/LinksTable.tsx`
- [ ] `src/web/components/VersionDetailsRow.tsx`

**Media (2 files):**
- [ ] `src/web/components/Pages/MediaGallery.tsx`
- [ ] `src/web/components/Pages/ScreenshotViewer.tsx`

**Service Status (1 file):**
- [ ] `src/web/components/ServiceStatus/ServiceHealthIndicator.tsx`

**Routes (7 files):**
- [ ] `src/web/routes/index.tsx`
- [ ] `src/web/routes/jobs/new.tsx`
- [ ] `src/web/routes/jobs/list.tsx`
- [ ] `src/web/routes/jobs/cancel.tsx`
- [ ] `src/web/routes/jobs/clear-completed.tsx`
- [ ] `src/web/routes/libraries/list.tsx`
- [ ] `src/web/routes/libraries/detail.tsx`

**Total Files:** 8 new + 42 modified = **50 files**

---

## 12. Implementation Commands

### 12.1 Phase 1: Foundation Setup

```bash
# 1. Install Inter font package
npm install @fontsource/inter

# 2. Create assets directory
mkdir -p src/web/assets

# 3. Download Context7 logo
curl -o src/web/assets/context7-logo.svg \
  https://context7.com/_next/static/media/context7vector.39c35f61.svg

# 4. Create tailwind.config.ts (manual - see section 6.1)

# 5. Update src/web/styles/main.css (manual - see section 6.2)

# 6. Test build
npm run build

# 7. Commit
git add .
git commit -m "feat: add Context7 design tokens and Inter font

- Install @fontsource/inter for self-hosted typography
- Create tailwind.config.ts with Context7 design tokens
- Add Inter font imports to main.css
- Download Context7 logo SVG
- Define custom shadow utilities (shadow-context7-{sm,md,lg})
- Extend typography scale with Context7 sizes

🤖 Generated with Claude Code"
```

### 12.2 Phase 2: Logo & Branding

```bash
# 1. Create Context7Logo component (manual - see section 5.2)

# 2. Download Context7 favicon
curl -o public/favicon-base.ico https://context7.com/favicon.ico

# 3. Generate favicon set (manual process):
#    - Visit realfavicongenerator.net
#    - Upload favicon-base.ico
#    - Configure: App name "Scrapegoat", theme color #059669
#    - Download package
#    - Extract to public/

# 4. Update Layout.tsx (manual - see section 3.1)

# 5. Test in browser
npm run dev
# Open http://localhost:6281
# Verify logo, favicon, Inter font

# 6. Commit
git add .
git commit -m "feat: integrate Context7 logo and branding

- Replace text logo with Context7 SVG component
- Update header typography to Context7 display scale
- Replace all favicon files with Context7-branded set
- Update manifest.json with scrapegoat branding
- Apply Inter font to header elements

🤖 Generated with Claude Code"
```

### 12.3 Phase 3: Forms & Inputs

```bash
# 1. Update ScrapeFormContent.tsx (manual)
#    - Change rounded-lg to rounded-xl for inputs
#    - Update button classes to btn-context7-primary
#    - Apply shadow-context7-md to form container

# 2. Update other form components (manual)

# 3. Test forms
npm run dev
# Test form interactions, input focus states, button hovers

# 4. Commit
git add .
git commit -m "feat: apply Context7 styles to forms and inputs

- Update input border radius to 12px (rounded-xl)
- Apply Context7 button styles (primary and secondary)
- Use shadow-context7-md for form containers
- Ensure typography consistency across all forms

🤖 Generated with Claude Code"
```

### 12.4 Phase 4: Cards, Badges & UI

```bash
# 1. Update all card components (manual - see section 3.3)

# 2. Update badge components (manual - see section 3.4)

# 3. Update UI utilities (manual - see section 3.5)

# 4. Test components
npm run dev
# Check cards, badges, alerts, tooltips

# 5. Commit
git add .
git commit -m "feat: apply Context7 styles to cards, badges, and UI elements

- Use shadow-context7-md for all cards
- Update badge typography to semibold weight
- Apply Context7 shadows to tooltips and alerts
- Ensure consistent typography scale across components

🤖 Generated with Claude Code"
```

### 12.5 Phase 5: Lists, Tables & Details

```bash
# 1. Update list components (manual - see section 3.6)

# 2. Update table components (manual - see section 3.7)

# 3. Update media components (manual - see section 3.8)

# 4. Test all pages
npm run dev
# Navigate through all pages with real data

# 5. Commit
git add .
git commit -m "feat: apply Context7 styles to lists, tables, and media components

- Update typography across all list and table components
- Apply Context7 link color variants
- Use shadow-context7-lg for modals
- Ensure visual consistency across all page types

🤖 Generated with Claude Code"
```

### 12.6 Phase 6: Testing & Polish

```bash
# 1. Run build
npm run build

# 2. Check bundle sizes
ls -lh public/assets/

# 3. Run in production mode
npm start

# 4. Manual testing checklist:
#    - [ ] Visual regression check (screenshots)
#    - [ ] Typography verification (DevTools)
#    - [ ] Color contrast check (Lighthouse)
#    - [ ] Responsive testing (all breakpoints)
#    - [ ] Cross-browser testing (Chrome, Firefox, Safari)
#    - [ ] Performance check (Lighthouse)

# 5. Fix any issues discovered

# 6. Final commit
git add .
git commit -m "feat: Context7 design system integration complete

Complete redesign of scrapegoat webUI using Context7 design system:

✨ Design System Integration:
- Inter font family (self-hosted via @fontsource)
- Context7 typography scale (14, 15, 16, 18, 24px)
- Custom shadow system (shadow-context7-{sm,md,lg})
- Emerald primary color palette (#059669)
- Stone neutral colors for text and borders

🎨 Visual Updates:
- Context7 logo in header
- Updated favicon set with Context7 branding
- Refined button styles (primary and secondary)
- Input border radius increased to 12px
- Card shadows upgraded to Context7 system
- Badge typography uses semibold weight

♿ Accessibility & Quality:
- WCAG AA color contrast compliance maintained
- Responsive design tested across all breakpoints
- Cross-browser compatibility verified
- Performance metrics within acceptable range
- Zero visual regressions

📦 Components Updated: 26 components, 7 routes, 1 layout
📝 Files Changed: 50 files (8 new, 42 modified)
⏱️ Effort: ~10 hours of systematic implementation

🤖 Generated with Claude Code"
```

---

## 13. Post-Implementation Documentation

### 13.1 Update README.md

Add section documenting the design system:

```markdown
## Design System

Scrapegoat's web UI uses the **Context7 design system** for consistent, professional styling.

### Typography
- **Font Family:** Inter (self-hosted)
- **Font Weights:** 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- **Font Sizes:** 14px (xs), 15px (sm), 16px (base), 18px (lg), 24px (display)

### Colors
- **Primary:** Emerald #059669 (emerald-600)
- **Neutrals:** Stone palette (#78716c, #44403c, #a8a29e)

### Shadows
- `shadow-context7-sm` - Buttons, small cards
- `shadow-context7-md` - Cards, containers
- `shadow-context7-lg` - Modals, popups

### Usage
Refer to `tailwind.config.ts` for all design tokens.
```

### 13.2 Create DESIGN_SYSTEM.md

**File:** `docs/DESIGN_SYSTEM.md`

```markdown
# Scrapegoat Design System (Context7)

Complete reference for Context7 design system integration.

## Overview
Scrapegoat's web UI adopts the Context7 design system, providing:
- Consistent typography using Inter font
- Professional color palette (emerald primary, stone neutrals)
- Standardized spacing and shadows
- Accessible, responsive components

[Full documentation content - see section 2 for all design tokens]

## Component Examples
[Include examples of buttons, inputs, cards, badges]

## Development Guidelines
- Use design token utilities (e.g., `shadow-context7-md`) instead of arbitrary values
- Prefer composition of utilities over custom CSS
- Maintain WCAG AA color contrast standards
- Test responsive behavior across all breakpoints
```

### 13.3 Update CONTRIBUTING.md

Add design system guidelines for contributors:

```markdown
## Design System Guidelines

When contributing UI changes:

1. **Typography:** Use Context7 font scale classes (`text-xs`, `text-sm`, etc.)
2. **Colors:** Use primary palette (`primary-600`) and stone neutrals
3. **Shadows:** Use `shadow-context7-{sm,md,lg}` utilities
4. **Spacing:** Follow 8px scale (multiples of 2, 4, 6, 8)
5. **Border Radius:** 8px for most elements (`rounded-lg`), 12px for inputs (`rounded-xl`)

See `docs/DESIGN_SYSTEM.md` for complete reference.
```

---

## 14. Future Enhancements (Out of Scope)

**Not included in this implementation** (document for future reference):

1. **Dark Mode:** Context7 design system could support dark theme
   - Would require dark color palette definitions
   - Add theme toggle component
   - Test all components in dark mode

2. **Animation Library:** Context7 could include motion design
   - Page transitions
   - Micro-interactions
   - Loading animations

3. **Component Library:** Extract Context7 components as reusable library
   - Create npm package
   - Publish to internal registry
   - Share across projects

4. **Design Tokens Package:** Centralize design tokens
   - Create @scrapegoat/design-tokens package
   - Version control design system
   - Enable design system evolution

5. **Storybook Integration:** Visual component documentation
   - Set up Storybook
   - Document all Context7 components
   - Interactive design system playground

---

## 15. Conclusion

This implementation plan provides a **comprehensive, expert-validated roadmap** for integrating the Context7 design system into scrapegoat's web UI. With 90% of the foundation already aligned, the remaining work is systematic and low-risk.

**Key Success Factors:**
- ✅ Expert validation (Gemini-2.5-Pro, 9/10 confidence)
- ✅ Phased rollout strategy (6 phases, 8-12 hours total)
- ✅ Comprehensive testing plan (visual, accessibility, performance)
- ✅ Low technical risk (foundation already matches)
- ✅ Clear success criteria (must-have, should-have, nice-to-have)

**Ready for Implementation:** This plan can be handed to any development team for systematic execution. Each phase is self-contained with clear tasks, success criteria, and commit messages.

**Next Steps:**
1. Review and approve this plan
2. Schedule implementation (suggest 2-3 day sprint)
3. Begin Phase 1: Foundation Setup
4. Progress through phases systematically
5. Deploy to production after Phase 6 testing

---

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Author:** Claude Code (Strategic Planner)
**Expert Review:** Gemini-2.5-Pro (9/10 confidence)

**Questions or Concerns:** Review Section 9 (Risk Assessment) and Section 10 (Success Criteria)

🚀 **Ready to build!**
