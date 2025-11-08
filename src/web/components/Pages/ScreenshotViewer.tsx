interface ScreenshotViewerProps {
  pageId: number;
  screenshotPath?: string;
}

/**
 * Component to display page screenshots
 * 
 * Shows the screenshot image with a link to view it in a new tab.
 * Returns null if no screenshot is available.
 */
const ScreenshotViewer = ({ pageId, screenshotPath }: ScreenshotViewerProps) => {
  if (!screenshotPath) return null;

  const screenshotUrl = `/api/pages/${pageId}/screenshot`;

  return (
    <div class="mt-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">
        Page Screenshot
      </h3>
      <div class="border border-gray-200 rounded-lg overflow-hidden">
        <img
          src={screenshotUrl}
          alt="Page screenshot"
          class="w-full"
          loading="lazy"
        />
      </div>
      <a
        href={screenshotUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-block mt-3 text-sm text-primary-600 hover:text-primary-700 hover:underline transition-colors duration-150"
      >
        Open in new tab →
      </a>
    </div>
  );
};

export default ScreenshotViewer;
