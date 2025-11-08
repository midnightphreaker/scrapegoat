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
    <div class="mt-6 p-4 bg-white dark:bg-[#242424] rounded-lg shadow border border-gray-300 dark:border-[#3c3c3c]">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        Extracted Links
      </h3>

      {/* Internal Links */}
      {internal.length > 0 && (
        <div class="mb-6">
          <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">
            Internal Links ({internal.length})
          </h4>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm border border-gray-200 dark:border-[#3c3c3c]">
              <thead class="bg-gray-50 dark:bg-[#181818]">
                <tr>
                  <th class="text-left p-2 font-medium text-gray-700 dark:text-gray-300">
                    Text
                  </th>
                  <th class="text-left p-2 font-medium text-gray-700 dark:text-gray-300">
                    URL
                  </th>
                </tr>
              </thead>
              <tbody>
                {internal.map((link, index) => (
                  <tr
                    key={index}
                    class="border-t border-gray-200 dark:border-[#3c3c3c] hover:bg-gray-50 dark:hover:bg-[#181818]"
                  >
                    <td class="p-2 text-gray-900 dark:text-white">{link.text}</td>
                    <td class="p-2 text-gray-600 dark:text-gray-400 font-mono text-xs break-all">
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
          <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">
            External Links ({external.length})
          </h4>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm border border-gray-200 dark:border-[#3c3c3c]">
              <thead class="bg-gray-50 dark:bg-[#181818]">
                <tr>
                  <th class="text-left p-2 font-medium text-gray-700 dark:text-gray-300">
                    Text
                  </th>
                  <th class="text-left p-2 font-medium text-gray-700 dark:text-gray-300">
                    URL
                  </th>
                </tr>
              </thead>
              <tbody>
                {external.map((link, index) => (
                  <tr
                    key={index}
                    class="border-t border-gray-200 dark:border-[#3c3c3c] hover:bg-gray-50 dark:hover:bg-[#181818]"
                  >
                    <td class="p-2 text-gray-900 dark:text-white">{link.text}</td>
                    <td class="p-2 font-mono text-xs">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-500 hover:underline break-all"
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
