import ScrapeFormContent from "./ScrapeFormContent";

interface ScrapeFormProps {
  defaultExcludePatterns?: string[];
}

/**
 * Wrapper component for the ScrapeFormContent.
 * Provides a container div, often used as a target for HTMX OOB swaps.
 * @param defaultExcludePatterns - Optional array of default URL exclusion patterns
 * @default defaultExcludePatterns - Empty array if not provided
 */
const ScrapeForm = ({ defaultExcludePatterns = [] }: ScrapeFormProps) => (
  <div id="scrape-form-container">
    <ScrapeFormContent defaultExcludePatterns={defaultExcludePatterns} />
  </div>
);

export default ScrapeForm;
