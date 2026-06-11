/**
 * Renders a skeleton placeholder for a search result item.
 * Used to indicate loading state while search results are being fetched.
 */
const SearchResultSkeletonItem = () => (
  <div class="sg-card mb-3 animate-pulse">
    <div class="h-[0.8em] rounded bg-white/10 w-3/4 mb-2"></div>
    <div class="h-[0.8em] rounded bg-white/10 w-full mb-2"></div>
    <div class="h-[0.8em] rounded bg-white/10 w-5/6"></div>
  </div>
);

export default SearchResultSkeletonItem;
