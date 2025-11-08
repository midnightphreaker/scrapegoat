interface MediaItem {
  type: "image" | "video" | "audio";
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

interface MediaGalleryProps {
  media: MediaItem[];
}

/**
 * Gallery component for displaying extracted media items
 *
 * Organizes media by type (images, videos, audio) and displays
 * them in a responsive grid layout.
 */
const MediaGallery = ({ media }: MediaGalleryProps) => {
  if (!media || media.length === 0) return null;

  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video");
  const audios = media.filter((m) => m.type === "audio");

  return (
    <div class="mt-6 p-4 bg-white dark:bg-[#242424] rounded-lg shadow border border-gray-300 dark:border-[#3c3c3c]">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        Extracted Media
      </h3>

      {/* Images section */}
      {images.length > 0 && (
        <div class="mb-6">
          <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-3">
            Images ({images.length})
          </h4>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img, index) => (
              <div
                key={index}
                class="border border-gray-200 dark:border-[#3c3c3c] rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                <img
                  src={img.url}
                  alt={img.alt || `Image ${index + 1}`}
                  class="w-full h-32 object-cover"
                  loading="lazy"
                />
                {img.alt && (
                  <p class="text-xs p-2 text-gray-600 dark:text-gray-400 truncate">
                    {img.alt}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Videos section */}
      {videos.length > 0 && (
        <div class="mb-6">
          <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-3">
            Videos ({videos.length})
          </h4>
          <ul class="space-y-2">
            {videos.map((video, index) => (
              <li key={index}>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-500 hover:underline break-all"
                >
                  {video.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Audio section */}
      {audios.length > 0 && (
        <div>
          <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-3">
            Audio ({audios.length})
          </h4>
          <ul class="space-y-2">
            {audios.map((audio, index) => (
              <li key={index}>
                <a
                  href={audio.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-500 hover:underline break-all"
                >
                  {audio.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MediaGallery;
