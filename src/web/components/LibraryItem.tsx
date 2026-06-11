import type { LibraryInfo } from "../../tools/ListLibrariesTool";
import type { VersionSummary } from "../../store/types";
import VersionDetailsRow from "./VersionDetailsRow";

/**
 * Props for the LibraryItem component.
 */
interface LibraryItemProps {
  library: LibraryInfo;
}

/**
 * Renders a card for a single library, listing its versions with details.
 * Uses VersionDetailsRow to display each version.
 * @param props - Component props including the library information.
 */
const LibraryItem = ({ library }: LibraryItemProps) => {
  // Versions are already sorted descending (latest first) from the API
  const versions = library.versions || [];
  const latestVersion = versions[0];
  return (
    <div id={`library-item-${library.name}`} class="sg-card">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h3 class="min-w-0 text-lg font-semibold text-white">
            <a
              href={`/libraries/${encodeURIComponent(library.name)}`}
              class="hover:text-cyan-200"
            >
              <span safe>{library.name}</span>
            </a>
          </h3>
          {latestVersion?.sourceUrl ? (
            <div class="mt-1 h-5 overflow-hidden text-sm sg-muted @container">
              <a
                href={latestVersion.sourceUrl}
                target="_blank"
                class="inline-block whitespace-nowrap hover:text-cyan-200 hover:underline hover:animate-[scrollText_2s_ease-in-out_forwards]"
                title={latestVersion.sourceUrl}
                safe
              >
                {latestVersion.sourceUrl}
              </a>
            </div>
          ) : null}
        </div>
        {latestVersion ? (
          <span class="sg-badge shrink-0" safe>
            {versions.length} {versions.length === 1 ? "version" : "versions"}
          </span>
        ) : null}
      </div>
      {/* Container for version rows */}
      <div class="mt-2">
        {versions.length > 0 ? (
          versions.map((v) => {
            // Adapt simplified tool version shape to VersionSummary expected by VersionDetailsRow
            const adapted: VersionSummary = {
              id: -1,
              ref: { library: library.name, version: v.version },
              status: v.status,
              progress: v.progress,
              counts: {
                documents: v.documentCount,
                uniqueUrls: v.uniqueUrlCount,
              },
              indexedAt: v.indexedAt,
              sourceUrl: v.sourceUrl ?? undefined,
            };
            return (
              <VersionDetailsRow libraryName={library.name} version={adapted} />
            );
          })
        ) : (
          // Display message if no versions are indexed
          <p class="text-sm text-gray-500 dark:text-gray-400 italic">
            No versions indexed.
          </p>
        )}
      </div>
    </div>
  );
};

export default LibraryItem;
