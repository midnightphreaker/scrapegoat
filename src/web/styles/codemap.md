# src/web/styles/

## Responsibility
Single CSS entry point that imports Tailwind CSS, Flowbite theme/plugin, and defines project-wide custom theme tokens and animations.

## Design
- **Imports**: `tailwindcss` base, Flowbite default theme, Flowbite plugin, and Flowbite Typography plugin.
- **Source config**: `@source "../../../node_modules/flowbite"` ensures Flowbite classes are included in the Tailwind build.
- **Theme tokens** (`@theme`):
  - `--color-primary-*` (50–950): Blue palette for primary UI elements.
  - `--color-accent-*` (50–950): Amber/gold palette for accent elements.
  - `--font-brand`: JetBrains Mono monospace stack for branded text.
- **Component layer**: Global `a` underline-offset, `button` cursor, and Alpine.js `[x-cloak]` hide rule.
- **Custom animations**:
  - `fadeSlideIn`: Opacity + translateY entrance animation for page elements.
  - `scrollText`: Container-query-based horizontal scroll for long URLs (scrolls left only when text overflows container).

## Integration
- Consumed by: `src/web/main.client.ts` (imports `./styles/main.css`)
- Depends on: `tailwindcss`, `flowbite`, `flowbite-typography` (npm packages)
- Output: Bundled to `public/assets/main.css` via Vite build
