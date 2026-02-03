/**
 * Mobile Navigation Component
 *
 * Responsive navigation menu for mobile devices with hamburger toggle.
 * Provides accessible navigation with proper ARIA labels and keyboard support.
 */

export interface MobileNavProps {
  /** Current path for highlighting active links */
  currentPath?: string;
}

/**
 * Navigation link definition
 */
interface NavLink {
  href: string;
  label: string;
  icon: string;
  description?: string;
}

const navLinks: NavLink[] = [
  { href: "/", label: "Home", icon: "🏠", description: "Go to home page" },
  { href: "/libraries", label: "Libraries", icon: "📚", description: "Browse indexed libraries" },
  { href: "/jobs", label: "Jobs", icon: "⚙️", description: "View indexing jobs" },
  { href: "/jobs/new", label: "New Scrape", icon: "🆕", description: "Start new indexing job" },
];

/**
 * Mobile navigation component with hamburger menu
 */
export function MobileNav({ currentPath = "" }: MobileNavProps = {}): string {
  return `
    <div x-data="{ mobileMenuOpen: false }" class="sm:hidden">
      <!-- Mobile Menu Button -->
      <button
        type="button"
        x-on:click="mobileMenuOpen = !mobileMenuOpen"
        x-bind:aria-expanded="mobileMenuOpen"
        aria-controls="mobile-menu"
        aria-label="Toggle navigation menu"
        class="inline-flex items-center justify-center p-2 rounded-md text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-colors"
      >
        <span class="sr-only">Toggle navigation menu</span>
        <!-- Menu Icon -->
        <svg x-show="!mobileMenuOpen" class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
        <!-- Close Icon -->
        <svg x-show="mobileMenuOpen" x-cloak class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Mobile Menu Panel -->
      <div
        id="mobile-menu"
        x-show="mobileMenuOpen"
        x-transition:enter="transition ease-out duration-200"
        x-transition:enter-start="opacity-0 translate-y-[-10px]"
        x-transition:enter-end="opacity-100 translate-y-0"
        x-transition:leave="transition ease-in duration-150"
        x-transition:leave-start="opacity-100 translate-y-0"
        x-transition:leave-end="opacity-0 translate-y-[-10px]"
        x-cloak
        class="absolute top-full left-0 right-0 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 shadow-lg z-50"
        role="navigation"
        aria-label="Main navigation"
      >
        <nav class="container mx-auto px-4 py-3" aria-label="Mobile navigation">
          <ul class="space-y-1" role="list">
            ${navLinks.map((link) => `
              <li role="listitem">
                <a
                  href="${link.href}"
                  class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    currentPath === link.href
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
                  }"
                  aria-current="${currentPath === link.href ? 'page' : undefined}"
                  title="${link.description}"
                >
                  <span class="text-xl" aria-hidden="true">${link.icon}</span>
                  <span class="flex-1 text-left">${link.label}</span>
                  ${currentPath === link.href ? `
                    <span class="sr-only">(current page)</span>
                    <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ` : ''}
                </a>
              </li>
            `).join('')}
          </ul>

          <!-- Quick Actions Section -->
          <div class="mt-4 pt-4 border-t border-stone-200 dark:border-stone-700">
            <h3 class="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider px-4 mb-2">
              Quick Actions
            </h3>
            <ul class="space-y-1" role="list">
              <li role="listitem">
                <a
                  href="/jobs/new"
                  class="flex items-center gap-3 px-4 py-3 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <span class="text-xl" aria-hidden="true">🆕</span>
                  <span class="flex-1 text-left font-medium">Start New Scrape</span>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </li>
              <li role="listitem">
                <a
                  href="/libraries"
                  class="flex items-center gap-3 px-4 py-3 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                >
                  <span class="text-xl" aria-hidden="true">🔍</span>
                  <span class="flex-1 text-left">Browse Libraries</span>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </div>
  `;
}

export default MobileNav;
