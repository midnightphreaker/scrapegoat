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
 */
const LinksTable = ({ links, baseUrl }: LinksTableProps) => {
  if (!links || links.length === 0) return null;

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
    <div class="mt-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">
        Extracted Links
      </h3>

      {/* Internal Links */}
      {internal.length > 0 && (
        <div class="mb-6">
          <h4 class="font-medium text-gray-700 mb-2">
            Internal Links ({internal.length})
          </h4>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm border border-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="text-left p-2 font-medium text-gray-700">
                    Text
                  </th>
                  <th class="text-left p-2 font-medium text-gray-700">
                    URL
                  </th>
                </tr>
              </thead>
              <tbody>
                {internal.map((link, index) => (
                  <tr
                    key={index}
                    class="border-t border-gray-200 hover:bg-gray-50"
                  >
                    <td class="p-2 text-gray-900">{link.text}</td>
                    <td class="p-2 text-gray-600 font-mono text-xs break-all">
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
          <h4 class="font-medium text-gray-700 mb-2">
            External Links ({external.length})
          </h4>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm border border-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="text-left p-2 font-medium text-gray-700">
                    Text
                  </th>
                  <th class="text-left p-2 font-medium text-gray-700">
                    URL
                  </th>
                </tr>
              </thead>
              <tbody>
                {external.map((link, index) => (
                  <tr
                    key={index}
                    class="border-t border-gray-200 hover:bg-gray-50"
                  >
                    <td class="p-2 text-gray-900">{link.text}</td>
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
