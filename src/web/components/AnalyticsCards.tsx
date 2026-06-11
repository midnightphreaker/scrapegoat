interface AnalyticsCardsProps {
  totalChunks: number;
  activeLibraries: number;
  activeVersions: number;
  indexedPages: number;
}

/**
 * Formats a number for display, using K, M, B suffixes for large numbers.
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Displays three analytics cards: Total Chunks, Active Libraries, and Indexed Pages.
 */
const AnalyticsCards = ({
  totalChunks,
  activeLibraries,
  activeVersions,
  indexedPages,
}: AnalyticsCardsProps) => (
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 animate-[fadeSlideIn_0.2s_ease-out]">
    {/* Knowledge Base Card */}
    <div class="sg-card">
      <div class="space-y-2">
        <p class="sg-label">Total Knowledge Base</p>
        <p class="text-xl font-semibold text-white" safe>
          {formatNumber(totalChunks)} Chunks
        </p>
      </div>
    </div>

    {/* Active Libraries Card */}
    <div class="sg-card">
      <div class="space-y-2">
        <p class="sg-label">Libraries / Versions</p>
        <p class="text-xl font-semibold text-white">
          {activeLibraries}
          {" / "}
          {activeVersions}
        </p>
      </div>
    </div>

    {/* Indexed Pages Card */}
    <div class="sg-card">
      <div class="space-y-2">
        <p class="sg-label">Indexed Pages</p>
        <p class="text-xl font-semibold text-white" safe>
          {formatNumber(indexedPages)}
        </p>
      </div>
    </div>
  </div>
);

export default AnalyticsCards;
