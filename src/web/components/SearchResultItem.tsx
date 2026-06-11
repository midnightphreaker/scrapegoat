import { unified } from "unified"; // Import unified
import remarkParse from "remark-parse"; // Import unified plugins
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import DOMPurify from "dompurify"; // Import DOMPurify
import type { StoreSearchResult } from "../../store/types";
import { createJSDOM } from "../../utils/dom"; // Import JSDOM helper
import { MimeTypeUtils } from "../../utils/mimeTypeUtils";
import { escapeHtml } from "@kitajs/html";

/**
 * Props for the SearchResultItem component.
 */
interface SearchResultItemProps {
  result: StoreSearchResult;
}

/**
 * Renders a single search result item.
 * Converts markdown content to HTML using unified for markdown MIME types.
 * For other content types, renders as preformatted text.
 * @param props - Component props including the search result data.
 */
const SearchResultItem = async ({ result }: SearchResultItemProps) => {
  const isMarkdown = result.mimeType
    ? MimeTypeUtils.isMarkdown(result.mimeType) ||
      MimeTypeUtils.isSupportedDocument(result.mimeType)
    : true; // Default to true if mimeType is undefined (backward compatibility)

  // Create JSDOM instance and initialize DOMPurify (used for both markdown and non-markdown content)
  const jsdom = createJSDOM("");
  const purifier = DOMPurify(jsdom.window);

  let contentElement: JSX.Element;

  if (isMarkdown) {
    // Use unified pipeline to convert markdown to HTML
    const processor = unified().use(remarkParse).use(remarkGfm).use(remarkHtml);
    const file = await processor.process(result.content);
    const rawHtml = String(file);

    // Sanitize the HTML content
    const safeHtml = purifier.sanitize(rawHtml);
    contentElement = (
      <div class="format format-invert max-w-none text-slate-100">
        {safeHtml}
      </div>
    );
  } else {
    // For non-markdown content, sanitize and render as preformatted text
    const safeContent = escapeHtml(result.content);
    contentElement = (
      <div class="format format-invert max-w-none text-slate-100">
        <pre>
          <code>{safeContent}</code>
        </pre>
      </div>
    );
  }

  return (
    <div class="sg-search-result mb-3">
      <div class="mb-2 flex min-w-0 items-center gap-2 text-sm sg-muted">
        {result.url.startsWith("file://") ? (
          <span
            class="flex-1 truncate underline decoration-white/30 underline-offset-4 cursor-default"
            title="Local file path (not navigable in browser)"
            safe
          >
            {result.url}
          </span>
        ) : (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 truncate underline decoration-cyan-300/40 underline-offset-4 hover:text-cyan-200"
            title={result.url}
            safe
          >
            {result.url}
          </a>
        )}
        {result.sourceMimeType || result.mimeType ? (
          <span class="sg-badge font-mono" safe>
            {result.sourceMimeType || result.mimeType}
          </span>
        ) : null}
      </div>
      {/* Render the content based on MIME type */}
      {contentElement}
    </div>
  );
};

export default SearchResultItem;
