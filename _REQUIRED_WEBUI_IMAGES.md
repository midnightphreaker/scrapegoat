# Required WebUI Images & Assets

**Project:** Scrapegoat WebUI Redesign
**Date:** 2025-11-25
**Status:** Context7 logo integrated and fixed - favicons still need creation
**Last Updated:** 2025-11-25 (Polish & Assets phase complete)

---

## Current Status Summary

### Completed Assets
- Context7 Logo SVG: Downloaded and integrated at `/Workspace/scrapegoat/src/web/assets/context7-logo.svg`
  - Fixed: Removed all `fill="white"` attributes to enable dynamic `currentColor` theming
  - Status: Production-ready
  - Usage: Currently used in header navigation and branding

### Pending Assets
- Primary Scrapegoat logo (needs custom design)
- Favicon package (all sizes and formats)
- Open Graph social media image
- Optional: Empty state and error illustrations

### Code Quality Fixes Applied (2025-11-25)
1. Logo SVG: Removed hard-coded white fills for proper theming support
2. VersionBadge: Changed from `font-medium` to `font-semibold` for consistency with Context7 spec
3. SearchResultSkeletonItem: Replaced arbitrary `h-[0.8em]` with standard Tailwind `h-3`

---

## Asset Inventory

### Critical Assets (Required for Launch)

#### 1. Primary Logo
- **File Path:** `/public/logo.svg`
- **Purpose:** Main branding, header navigation, favicon source
- **Format:** SVG (vector, scalable)
- **Display Dimensions:** 48x48px (but SVG scales infinitely)
- **Artboard Size:** 512x512px (for export variations)
- **Color Variants:**
  - Full-color: `#059669` (emerald-600)
  - White: `#ffffff` (for dark backgrounds)
  - Black: `#292524` (stone-800, for light backgrounds)
- **Design Requirements:**
  - Simple, recognizable shape
  - Works at 16x16px (favicon size)
  - Monochrome-friendly (single-color versions)
  - Represents "scraping" or "indexing" concept
  - Tech-forward aesthetic
- **Original Source URL:** None - needs custom design
- **Downloadable:** No - requires creation
- **Generation Method:**
  - Option 1: Hire designer on Fiverr/99designs
  - Option 2: Use AI generation (Midjourney, DALL-E) with refinement
  - Option 3: Adapt open-source icon from Heroicons/Feather Icons
- **Suggested Concepts:**
  - Magnifying glass over document (search theme)
  - Goat silhouette with tech elements
  - Abstract "S" lettermark with indexing grid
  - Document with checkmark/index symbol

---

#### 2. Wordmark Logo
- **File Path:** `/public/wordmark.svg`
- **Purpose:** Standalone text branding without icon
- **Format:** SVG text with embedded font
- **Font:** JetBrains Mono (already in design system)
- **Text:** "scrapegoat" (lowercase, consistent with current branding)
- **Color:** `#059669` (primary-600) or `#292524` (stone-800)
- **Original Source URL:** None - needs creation
- **Downloadable:** No - requires SVG text export
- **Generation Method:**
  - Create in Figma/Illustrator with JetBrains Mono font
  - Convert text to outlines (for portability)
  - Export as optimized SVG

---

#### 3. Favicon Package

##### 3.1 Multi-Resolution ICO
- **File Path:** `/public/favicon.ico`
- **Purpose:** Legacy browser favicon support
- **Format:** ICO (multi-resolution container)
- **Embedded Sizes:** 16x16, 32x32, 48x48
- **Source:** Generated from 512x512px logo PNG
- **Original Source URL:** None - generated from primary logo
- **Downloadable:** No - requires generation
- **Generation Method:**
  1. Export logo as 512x512px PNG with transparent background
  2. Use [RealFaviconGenerator.net](https://realfavicongenerator.net/)
  3. Upload PNG, configure settings:
     - Background color: `#059669` or `#ffffff`
     - Icon design: Lettermark or simplified logo
  4. Download package with all sizes

##### 3.2 PNG Favicons
| File Path | Dimensions | Purpose | Source |
|-----------|------------|---------|--------|
| `/public/favicon-16x16.png` | 16x16 | Browser tabs (standard) | Generated from logo |
| `/public/favicon-32x32.png` | 32x32 | Browser tabs (Retina) | Generated from logo |
| `/public/favicon-96x96.png` | 96x96 | Browser tabs (high-DPI) | Generated from logo |

**All PNG favicons:**
- **Original Source URL:** RealFaviconGenerator.net (after uploading logo)
- **Downloadable:** Yes (after generation)
- **Format:** PNG with transparency or solid background

##### 3.3 Apple Touch Icons
| File Path | Dimensions | Purpose | Source |
|-----------|------------|---------|--------|
| `/public/apple-icon-57x57.png` | 57x57 | iPhone (non-Retina) | Generated |
| `/public/apple-icon-60x60.png` | 60x60 | iPhone (iOS 7+) | Generated |
| `/public/apple-icon-72x72.png` | 72x72 | iPad (non-Retina) | Generated |
| `/public/apple-icon-76x76.png` | 76x76 | iPad (iOS 7+) | Generated |
| `/public/apple-icon-114x114.png` | 114x114 | iPhone Retina (iOS 6) | Generated |
| `/public/apple-icon-120x120.png` | 120x120 | iPhone Retina (iOS 7+) | Generated |
| `/public/apple-icon-144x144.png` | 144x144 | iPad Retina (iOS 6) | Generated |
| `/public/apple-icon-152x152.png` | 152x152 | iPad Retina (iOS 7+) | Generated |
| `/public/apple-icon-180x180.png` | 180x180 | iPhone X/XS/XR/11/12 | Generated |

**All Apple Touch Icons:**
- **Original Source URL:** RealFaviconGenerator.net
- **Downloadable:** Yes
- **Background:** Usually solid color (emerald or white)
- **Rounded corners:** Not needed (iOS applies automatically)

##### 3.4 Android Icons
| File Path | Dimensions | Purpose | Source |
|-----------|------------|---------|--------|
| `/public/android-icon-192x192.png` | 192x192 | Android home screen | Generated |

**Android Icons:**
- **Original Source URL:** RealFaviconGenerator.net
- **Downloadable:** Yes
- **Background:** Can be transparent or solid

##### 3.5 Windows Tile Icons
| File Path | Dimensions | Purpose | Source |
|-----------|------------|---------|--------|
| `/public/ms-icon-144x144.png` | 144x144 | Windows tile (Metro UI) | Generated |

**Windows Icons:**
- **Original Source URL:** RealFaviconGenerator.net
- **Downloadable:** Yes
- **Background:** Solid color recommended

---

#### 4. PWA Manifest Icon
- **File Path:** `/public/android-icon-192x192.png` (reused)
- **Purpose:** Progressive Web App icon in `manifest.json`
- **Dimensions:** 192x192 (minimum), 512x512 (recommended)
- **Format:** PNG
- **Background:** Solid color or transparent
- **Original Source URL:** Same as Android icon generation
- **Downloadable:** Yes

**Additional Recommended:**
- **File Path:** `/public/android-icon-512x512.png`
- **Dimensions:** 512x512
- **Purpose:** High-resolution PWA icon
- **Source:** Export from primary logo artboard

---

#### 5. Open Graph / Social Media Image
- **File Path:** `/public/og-image.png`
- **Purpose:** Social media preview when sharing URL
- **Dimensions:** 1200x630px (Facebook/LinkedIn standard)
- **Format:** PNG or JPG
- **File Size:** < 1MB
- **Design Layout:**
  ```
  ┌─────────────────────────────────────────────┐
  │                                             │
  │  [Logo]        scrapegoat                  │
  │                                             │
  │  Documentation Indexer for LLMs            │
  │                                             │
  │  [Subtle emerald gradient background]      │
  │                                             │
  └─────────────────────────────────────────────┘
  ```
- **Typography:**
  - Title: JetBrains Mono, 72px, bold
  - Subtitle: Inter, 36px, regular
- **Colors:**
  - Background: White with subtle emerald-50 gradient
  - Text: stone-800
  - Logo: primary-600
- **Original Source URL:** None - needs custom design
- **Downloadable:** No - requires creation in Figma/Photoshop
- **Generation Method:**
  1. Create 1200x630px canvas in Figma
  2. Add white background with subtle gradient overlay
  3. Place logo (left-aligned, 120px from edge)
  4. Add "scrapegoat" text (JetBrains Mono, 72px)
  5. Add tagline below (Inter, 36px, stone-600)
  6. Export as PNG

**Twitter Card Variant (Optional):**
- **File Path:** `/public/twitter-card.png`
- **Dimensions:** 1200x600px (Twitter summary_large_image)
- **Same design as OG image, adjusted aspect ratio**

---

### Icon System (In-Code SVG)

#### Heroicons v2 (Outline Style)
**All icons are inline SVG, not separate files.**
**Source:** https://heroicons.com/
**License:** MIT (free to use)

Common icons used in scrapegoat:

| Icon Name | Usage | Downloadable | Method |
|-----------|-------|--------------|--------|
| `magnifying-glass` | Search button, search input | Yes | Copy from Heroicons.com |
| `x-mark` | Close modal, dismiss alerts | Yes | Copy from Heroicons.com |
| `check` | Success states, completed jobs | Yes | Copy from Heroicons.com |
| `exclamation-triangle` | Warning alerts, errors | Yes | Copy from Heroicons.com |
| `information-circle` | Info tooltips, help text | Yes | Copy from Heroicons.com |
| `chevron-down` | Dropdown indicators | Yes | Copy from Heroicons.com |
| `chevron-right` | Navigation arrows, expand | Yes | Copy from Heroicons.com |
| `cog-6-tooth` | Settings icon | Yes | Copy from Heroicons.com |
| `document-text` | Documentation pages | Yes | Copy from Heroicons.com |
| `folder` | Library collections | Yes | Copy from Heroicons.com |
| `arrow-path` | Refresh/reload | Yes | Copy from Heroicons.com |
| `play` | Start job | Yes | Copy from Heroicons.com |
| `pause` | Pause job | Yes | Copy from Heroicons.com |
| `stop` | Cancel job | Yes | Copy from Heroicons.com |

**Example Usage:**
```html
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
</svg>
```

**No separate files needed** - icons are copied directly into component code.

---

### Illustration Assets (Optional - Nice to Have)

#### Empty State Illustrations
These enhance UX but are not critical for launch.

##### 6.1 Empty Search Results
- **File Path:** `/public/illustrations/empty-search.svg`
- **Purpose:** Shown when search returns no results
- **Dimensions:** 240x240px (display size)
- **Style:** Simple, outlined, 2px stroke, emerald accent
- **Concept:** Magnifying glass over empty document
- **Original Source URL:**
  - Option 1: [unDraw.co](https://undraw.co/search) - free customizable illustrations
  - Option 2: [Storyset.com](https://storyset.com/) - free animated SVGs
  - Option 3: Custom design in Figma
- **Downloadable:** Yes (if using unDraw/Storyset)
- **Generation Method:**
  1. Search unDraw for "search" or "empty" illustrations
  2. Customize primary color to `#059669`
  3. Download SVG
  4. Optimize with SVGO

##### 6.2 No Indexed Libraries
- **File Path:** `/public/illustrations/empty-libraries.svg`
- **Purpose:** Shown when no libraries have been indexed yet
- **Dimensions:** 240x240px
- **Concept:** Empty bookshelf or folder
- **Source:** unDraw.co or Storyset.com
- **Downloadable:** Yes
- **Search Terms:** "empty", "folder", "library", "bookshelf"

##### 6.3 No Active Jobs
- **File Path:** `/public/illustrations/empty-jobs.svg`
- **Purpose:** Shown when job queue is empty
- **Dimensions:** 240x240px
- **Concept:** Clipboard with checkmarks or empty task list
- **Source:** unDraw.co or Storyset.com
- **Downloadable:** Yes
- **Search Terms:** "tasks", "checklist", "completed", "empty"

---

#### Error State Illustrations

##### 6.4 404 - Page Not Found
- **File Path:** `/public/illustrations/error-404.svg`
- **Purpose:** 404 error page
- **Dimensions:** 320x240px
- **Concept:** Lost/confused character or broken link
- **Source:** unDraw.co
- **Downloadable:** Yes
- **Search Terms:** "404", "lost", "not found"

##### 6.5 500 - Server Error
- **File Path:** `/public/illustrations/error-500.svg`
- **Purpose:** 500 internal server error page
- **Dimensions:** 320x240px
- **Concept:** Server with wrench or broken gear
- **Source:** unDraw.co
- **Downloadable:** Yes
- **Search Terms:** "error", "server", "maintenance"

##### 6.6 Network Error
- **File Path:** `/public/illustrations/error-network.svg`
- **Purpose:** Connection failed states
- **Dimensions:** 240x240px
- **Concept:** Disconnected cable or broken signal
- **Source:** unDraw.co
- **Downloadable:** Yes
- **Search Terms:** "connection", "offline", "network"

---

## Asset Generation Workflow

### Phase 1: Critical Assets (Required for MVP)
1. **Primary Logo** - 2-4 hours (design + iterations)
2. **Favicon Package** - 30 minutes (generation from logo)
3. **OG Image** - 1 hour (layout in Figma)

**Total Time:** 4-5 hours
**Dependencies:** Logo design must be completed first

---

### Phase 2: Optional Enhancements
1. **Empty State Illustrations** - 2 hours (find + customize from unDraw)
2. **Error State Illustrations** - 2 hours (find + customize)

**Total Time:** 4 hours
**Dependencies:** None (can be done in parallel)

---

## Asset Hosting & Delivery

### Current Setup
All assets should be placed in `/public/` directory:
```
/public/
├── logo.svg
├── wordmark.svg
├── favicon.ico
├── favicon-*.png
├── apple-icon-*.png
├── android-icon-*.png
├── ms-icon-*.png
├── og-image.png
├── manifest.json
└── illustrations/
    ├── empty-search.svg
    ├── empty-libraries.svg
    ├── empty-jobs.svg
    ├── error-404.svg
    ├── error-500.svg
    └── error-network.svg
```

### File Size Targets
| Asset Type | Target Size | Max Size |
|------------|-------------|----------|
| SVG logo | < 5KB | 10KB |
| PNG favicons | < 10KB each | 20KB |
| OG image | < 200KB | 500KB |
| Illustrations | < 15KB each | 30KB |

### Optimization Tools
- **SVG:** [SVGO](https://jakearchibald.github.io/svgomg/)
- **PNG:** [TinyPNG](https://tinypng.com/) or pngquant
- **JPG:** [JPEGmini](https://www.jpegmini.com/) or ImageOptim

---

## External Resources Referenced

### Context7.com Assets (Inspiration Only)
These assets are from Context7.com and cannot be directly used, but serve as design inspiration:

1. **Context7 Logo:**
   - URL: https://context7.com/_next/static/media/context7vector.39c35f61.svg
   - Dimensions: 42x47px
   - Color: Likely emerald-600
   - Purpose: Visual reference for logo style
   - **DO NOT COPY** - for inspiration only

2. **Context7 Favicon:**
   - URL: https://context7.com/favicon.ico
   - Dimensions: 74x75px (unusual size)
   - Purpose: Reference for favicon design approach
   - **DO NOT COPY** - for inspiration only

3. **Context7 OG Image:**
   - URL: https://context7.com/opengraph-image.png?913a90853d344a57
   - Purpose: Layout inspiration for social previews
   - **DO NOT COPY** - for inspiration only

**Usage:** Analyze design patterns, color usage, and style, but create original assets for scrapegoat.

---

## Recommended Asset Creation Services

### Logo Design
1. **Fiverr** - $50-200 for custom logo with variations
2. **99designs** - Contest-based, $299+ for logo package
3. **Looka.com** - AI-powered logo generator, $20
4. **Hatchful (Shopify)** - Free AI logo maker (limited customization)

### Favicon Generation
1. **RealFaviconGenerator.net** - Free, comprehensive, generates all sizes
2. **Favicon.io** - Free, text-to-favicon converter
3. **Favicon Generator** - Free, simple uploader

### Illustration Resources
1. **unDraw.co** - Free, customizable, MIT license
2. **Storyset.com** - Free animated SVGs, attribution required
3. **DrawKit** - Free and premium illustrations
4. **Humaaans** - Free customizable people illustrations

---

## Asset Checklist

### Critical (Must Have for Launch)
- [ ] Primary logo SVG (color variant)
- [ ] Primary logo SVG (white variant)
- [ ] Primary logo SVG (black variant)
- [ ] favicon.ico (multi-resolution)
- [ ] favicon-16x16.png
- [ ] favicon-32x32.png
- [ ] favicon-96x96.png
- [ ] apple-icon-180x180.png (most important Apple size)
- [ ] android-icon-192x192.png
- [ ] og-image.png (1200x630)
- [ ] manifest.json (PWA manifest)

### Nice to Have (Phase 2)
- [ ] Wordmark logo SVG
- [ ] All Apple touch icon sizes (57-180px)
- [ ] ms-icon-144x144.png
- [ ] android-icon-512x512.png
- [ ] empty-search.svg
- [ ] empty-libraries.svg
- [ ] empty-jobs.svg
- [ ] error-404.svg
- [ ] error-500.svg
- [ ] error-network.svg

---

## Notes & Recommendations

### Logo Design Brief
When commissioning logo design, provide this brief:

**Project:** Scrapegoat - Documentation Indexer for LLMs
**Style:** Modern, technical, minimalist
**Color:** Primary emerald green (#059669), neutral stone grays
**Concepts to explore:**
- Magnifying glass + document (search/indexing)
- Goat silhouette with tech elements (brand name)
- Abstract lettermark "S" with grid/index pattern
- Document with index/TOC symbol

**Requirements:**
- Must work at 16x16px (favicon size)
- Must work in monochrome (white on color, color on white)
- Scalable vector format (SVG)
- Simple, memorable shape
- No gradients or complex details (for small-size legibility)

**Deliverables:**
- Primary logo (full color SVG, 512x512 artboard)
- White variant (for dark backgrounds)
- Black variant (for light backgrounds)
- Simplified icon version (if different from primary)

---

**End of Asset Requirements**
