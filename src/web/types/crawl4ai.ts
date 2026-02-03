/**
 * Crawl4AI Shared Type Definitions
 *
 * This module contains shared TypeScript interfaces for Crawl4AI-related features.
 * These types are used across multiple components to ensure consistency.
 */

/**
 * Configuration for URL pattern-based crawl settings
 *
 * Allows users to configure different crawl settings based on URL patterns.
 * For example, docs/* might use different settings than blog/*.
 *
 * The pattern field supports wildcards using fnmatch pattern matching:
 * - * matches any sequence of characters
 * - ? matches any single character
 * - [seq] matches any character in seq
 * - [!seq] matches any character not in seq
 *
 * Examples:
 * - "https://example.com/docs/*" - matches all URLs under docs/
 * - "https://*.example.com/*" - matches any subdomain
 * - "https://example.com/blog/202?" - matches blog posts from 2020-2029
 */
export interface UrlPatternConfig {
  /** URL pattern to match (supports wildcards) */
  pattern?: string;

  /** Priority for pattern matching (0-100, higher checked first) */
  priority?: number;

  /** Whether this pattern is active */
  enabled?: boolean;

  /** Crawl configuration for this pattern */
  config?: {
    /** Capture screenshot of the page */
    screenshot?: boolean;

    /** Extract media (images, videos, audio) */
    extractMedia?: boolean;

    /** Browser type to use for this pattern */
    browserType?: "chromium" | "firefox" | "webkit";

    /** CSS selector to wait for before capturing content */
    waitFor?: string;

    /** Enable virtual scrolling for dynamic content */
    virtualScroll?: boolean;

    /** Container selector for virtual scrolling */
    virtualScrollContainerSelector?: string;
  };
}

/**
 * Complete URL pattern with required fields
 *
 * Extends UrlPatternConfig with a required id field for pattern management.
 */
export interface UrlPattern extends Required<UrlPatternConfig> {
  /** Unique identifier for this pattern */
  id: string;
}
