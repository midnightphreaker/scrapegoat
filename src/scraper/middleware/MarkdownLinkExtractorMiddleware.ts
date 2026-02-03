import { logger } from "../../utils/logger";
import type { ContentProcessorMiddleware, MiddlewareContext } from "./types";

/**
 * Middleware for extracting links from Markdown content.
 * Supports inline links [text](url), reference-style links [text][ref],
 * and autolinks <url>.
 */
export class MarkdownLinkExtractorMiddleware implements ContentProcessorMiddleware {
  /**
   * Processes the context to extract links from Markdown content.
   * @param context The current processing context.
   * @param next Function to call the next middleware.
   */
  async process(context: MiddlewareContext, next: () => Promise<void>): Promise<void> {
    // Ensure context.links exists, defaulting to empty array if not set.
    if (!Array.isArray(context.links)) {
      context.links = [];
    }

    try {
      const extractedLinks: string[] = [];

      // Extract inline links: [text](url)
      const inlineLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match: RegExpExecArray | null = inlineLinkRegex.exec(context.content);
      while (match !== null) {
        const url = match[2]?.trim();
        if (url) {
          extractedLinks.push(url);
        }
        match = inlineLinkRegex.exec(context.content);
      }

      // Extract reference-style link definitions: [ref]: url
      const refLinkDefRegex = /^\s*\[([^\]]+)\]:\s*(.+?)(?:\s|$)/gm;
      match = refLinkDefRegex.exec(context.content);
      while (match !== null) {
        const url = match[2]?.trim();
        if (url) {
          extractedLinks.push(url);
        }
        match = refLinkDefRegex.exec(context.content);
      }

      // Extract autolinks: <url>
      const autolinkRegex = /<(https?:\/\/[^>]+)>/g;
      match = autolinkRegex.exec(context.content);
      while (match !== null) {
        const url = match[1]?.trim();
        if (url) {
          extractedLinks.push(url);
        }
        match = autolinkRegex.exec(context.content);
      }

      // Resolve relative URLs and validate
      const validLinks: string[] = [];
      for (const link of extractedLinks) {
        try {
          const urlObj = new URL(link, context.source);
          // Only accept http, https, and file protocols
          if (["http:", "https:", "file:"].includes(urlObj.protocol)) {
            validLinks.push(urlObj.href);
          } else {
            logger.debug(`Ignoring link with invalid protocol: ${link}`);
          }
        } catch (_e) {
          logger.debug(`Ignoring invalid URL syntax: ${link}`);
        }
      }

      // Deduplicate and assign to context
      context.links = [...new Set(validLinks)];
      logger.debug(
        `Extracted ${context.links.length} unique, valid links from Markdown at ${context.source}`,
      );
    } catch (error) {
      logger.error(`❌ Error extracting links from Markdown: ${error}`);
      context.errors.push(
        new Error(
          `Failed to extract links from Markdown: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }

    await next();
  }
}
