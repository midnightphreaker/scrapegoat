interface LinkItem {
  url: string;
  text: string;
  rel?: string;
}

interface LinksTableProps {
  links: LinkItem[];
  baseUrl: string;
}

/**
 * Table component for displaying extracted links
 *
 * Categorizes links as internal or external based on the baseUrl
 * and displays them in separate tables.
 * @param links - Array of link items to display
 * @default links - Empty array if not provided
 * @param baseUrl - Base URL for categorizing internal vs external links
 */
const LinksTable = ({ links = [], baseUrl }: LinksTableProps) => {
  if (links.length === 0) return null;

  // Categorize links as internal or external
  const internal: LinkItem[] = [];
  const external: LinkItem[] = [];

  for (const link of links) {
    const isInternal = link.url.startsWith(baseUrl) || link.url.startsWith("/");
    if (isInternal) {
      internal.push(link);
    } else {
      external.push(link);
    }
  }

  return (
    <div class="mt-6 p-4 bg-white rounded-lg shadow-context7-md border border-stone-200">
      <h3 class="text-lg font-bold text-stone-800 mb-3">
        Extracted Links
      </h3>

      {/* Internal Links */}
      {internal.length > 0 && (
        <div class="mb-6">
          <h4 class="font-semibold text-stone-700 mb-2">
            Internal Links ({internal.length})
          </h4>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm border border-stone-200">
              <thead class="bg-stone-50">
                <tr>
                  <th class="text-left p-2 font-bold text-stone-800">
                    Text
                  </th>
                  <th class="text-left p-2 font-medium text-stone-700">
                    URL
                  </th>
                </tr>
              </thead>
              <tbody>
                {internal.map((link) => (
                  <tr
                    class="border-t border-stone-200 hover:bg-stone-50 transition-colors duration-150"
                  >
                    <td class="p-2 text-stone-800">{link.text}</td>
                    <td class="p-2 text-stone-600 font-mono text-xs break-all">
                      {link.url}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* External Links */}
      {external.length > 0 && (
        <div>
          <h4 class="font-semibold text-stone-700 mb-2">
            External Links ({external.length})
          </h4>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm border border-stone-200">
              <thead class="bg-stone-50">
                <tr>
                  <th class="text-left p-2 font-bold text-stone-800">
                    Text
                  </th>
                  <th class="text-left p-2 font-medium text-stone-700">
                    URL
                  </th>
                </tr>
              </thead>
              <tbody>
                {external.map((link) => (
                  <tr
                    class="border-t border-stone-200 hover:bg-stone-50 transition-colors duration-150"
                  >
                    <td class="p-2 text-stone-800">{link.text}</td>
                    <td class="p-2 font-mono text-xs">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 hover:text-primary-700 hover:underline break-all transition-colors duration-150"
                      >
                        {link.url}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinksTable;
