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
    <div class="block p-4 bg-white rounded-lg shadow-context7-md border border-stone-200 mb-4">
      <h2 class="text-xl font-semibold mb-2 text-stone-800" safe>
        Search {library.name} Documentation
      </h2>
      <form
        hx-get={`/web/libraries/${encodeURIComponent(library.name)}/search`}
        hx-target="#searchResultsContainer .search-results"
        hx-swap="innerHTML"
        hx-indicator="#searchResultsContainer"
        class="flex space-x-2"
      >
        <select
          name="version"
          class="w-40 bg-white border border-stone-300 text-stone-800 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block p-2.5 transition-colors duration-150"
        >
          <option value="">Latest</option> {/* Default to latest */}
          {library.versions.map((version) => (
            <option value={version.version || "unversioned"} safe>
              {version.version || "Unversioned"}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="query"
          placeholder="Search query..."
          required
          class="flex-grow bg-white border border-stone-300 text-stone-800 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block p-2.5 transition-colors duration-150"
        />
        <button
          type="submit"
          class="text-white bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-600 font-medium rounded-lg text-sm px-5 py-2.5 text-center relative transition-colors duration-150"
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
