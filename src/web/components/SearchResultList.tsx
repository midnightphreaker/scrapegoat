import type { StoreSearchResult } from "../../store/types";
import SearchResultItem from "./SearchResultItem";

/**
 * Props for the SearchResultList component.
 */
interface SearchResultListProps {
  results: StoreSearchResult[];
}

/**
 * Renders the list of search results using SearchResultItem.
 * Displays a message if no results are found.
 * @param props - Component props including the array of search results.
 */
const SearchResultList = ({ results }: SearchResultListProps) => {
  if (results.length === 0) {
    return (
      <p class="rounded-lg border border-dashed border-slate-700/70 bg-slate-950/40 px-4 py-6 text-center text-sm sg-muted">
        No results found.
      </p>
    );
  }
  return (
    <div class="space-y-3">
      {results.map((result) => (
        <SearchResultItem result={result} />
      ))}
    </div>
  );
};

export default SearchResultList;
