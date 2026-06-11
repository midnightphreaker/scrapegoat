import type { LibraryInfo } from "../../tools/ListLibrariesTool";
import type { VersionSummary } from "../../store/types";

import VersionDetailsRow from "./VersionDetailsRow";

/**
 * Props for the LibraryDetailCard component.
 */
interface LibraryDetailCardProps {
  library: LibraryInfo;
}

/**
 * Renders a card displaying library details and its versions.
 * Includes Delete and Refresh buttons for each version.
 * @param props - Component props including the library information.
 */
const LibraryDetailCard = ({ library }: LibraryDetailCardProps) => {
  // Versions are already sorted descending (latest first) from the API
  const versions = library.versions || [];
  const latestVersion = versions[0];
  return (
    <div class="sg-panel mb-4">
      <div class="mb-1">
        <div class="min-w-0">
          <div class="sg-label">Library</div>
          <h1 class="text-2xl font-semibold text-white">
            <span safe>{library.name}</span>
          </h1>
          {latestVersion?.sourceUrl ? (
            <div class="mt-1 truncate text-sm sg-muted">
              <a
                href={latestVersion.sourceUrl}
                target="_blank"
                class="hover:text-cyan-200 hover:underline"
                title={latestVersion.sourceUrl}
                safe
              >
                {latestVersion.sourceUrl}
              </a>
            </div>
          ) : null}
        </div>
      </div>
      {/* Container for version rows - auto-refreshes on library-change */}
      <div
        class="mt-2"
        id="version-list"
        hx-get={`/web/libraries/${encodeURIComponent(library.name)}/versions-list`}
        hx-trigger="library-change from:body"
        hx-swap="morph:innerHTML"
      >
        {versions.length > 0 ? (
          versions.map((v) => {
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
              <VersionDetailsRow
                libraryName={library.name}
                version={adapted}
                showDelete={true}
                showRefresh={true}
              />
            );
          })
        ) : (
          <p class="text-sm text-gray-500 dark:text-gray-400 italic">
            No versions indexed.
          </p>
        )}
      </div>

    </div>
  );
};

export default LibraryDetailCard;
