import type { LibraryInfo } from "../../tools/ListLibrariesTool";
import LoadingSpinner from "./LoadingSpinner"; // Import spinner

/**
 * Props for the LibrarySearchCard component.
 */
interface LibrarySearchCardProps {
  library: LibraryInfo;
}

/**
 * Renders the search form card for a specific library.
 * Includes a version dropdown and query input.
 * @param props - Component props including the library information.
 */
const LibrarySearchCard = ({ library }: LibrarySearchCardProps) => {
  return (
    <div class="sg-panel mb-4">
      <h2 class="sg-section-title mb-3" safe>
        Search {library.name} Documentation
      </h2>
      <form
        hx-get={`/web/libraries/${encodeURIComponent(library.name)}/search`}
        hx-target="#searchResultsContainer .search-results"
        hx-swap="innerHTML"
        hx-indicator="#searchResultsContainer"
        class="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"
      >
        <select
          name="version"
          class="sg-input w-full"
        >
          <option value="">Latest</option> {/* Default to latest */}
          {library.versions.map((version) => (
            <option value={version.version || "latest"} safe>
              {version.version || "Latest"}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="query"
          placeholder="Search query..."
          required
          class="sg-input w-full"
        />
        <button
          type="submit"
          class="sg-button sg-button-primary relative"
        >
          <span class="search-text">Search</span>
          {/* Spinner for HTMX loading - shown via htmx-indicator class on parent */}
          <span class="spinner absolute inset-0 flex items-center justify-center">
            <LoadingSpinner />
          </span>
        </button>
      </form>
      {/* Add style for htmx-indicator behavior on button */}
      {/* Styles moved to Layout.tsx */}
    </div>
  );
};

export default LibrarySearchCard;
