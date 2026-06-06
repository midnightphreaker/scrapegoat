/**
 * A true centered modal component for selecting the documentation source type.
 * Renders a fixed full-screen backdrop with a centered card.
 * Clicking outside or pressing Escape closes the modal.
 * Swapped into #modal-container via HTMX.
 */
const SourceSelectionModal = () => {
  const closeModal = "document.getElementById('modal-container').innerHTML = ''";
  const proceed =
    "if (selectedSource === null) return; const url = selectedSource === 'remote' ? '/web/jobs/new' : '/web/upload'; htmx.ajax('GET', url, { target: '#addJobForm', swap: 'innerHTML' }); selectedSource = null; document.getElementById('modal-container').innerHTML = ''";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabindex="-1"
      x-data="{ selectedSource: null }"
      x-init="$el.focus()"
      {...{
        "x-on:keydown.escape": closeModal,
        "x-on:click.self": closeModal,
      }}
      class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm transition-opacity duration-200"
    >
      {/* Modal card */}
      <div
        class="relative w-full max-w-lg mx-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-[fadeSlideIn_0.2s_ease-out]"
        tabindex="0"
      >
        {/* Close button */}
        <button
          type="button"
          x-on:click={closeModal}
          class="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
          title="Close"
          aria-label="Close"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h3
          id="modal-title"
          class="text-xl font-semibold text-gray-900 dark:text-white mb-1 pr-8"
        >
          Documentation Source Selection
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Choose where your documentation source is located.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Remote URL Card */}
          <button
            type="button"
            x-on:click="selectedSource = 'remote'"
            x-bind:aria-pressed="selectedSource === 'remote'"
            x-bind:class="selectedSource === 'remote' ? 'border-primary-500 dark:border-primary-400 shadow-md bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'"
            class="group p-4 border-2 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 text-left cursor-pointer"
          >
            <div class="flex items-center mb-2">
              <svg
                x-bind:class="selectedSource === 'remote' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'"
                class="w-6 h-6 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              <span
                x-bind:class="selectedSource === 'remote' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'"
                class="ml-2 text-base font-semibold group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
              >
                Remote URL
              </span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300">
              Use this for websites and remote documents accessible via HTTP/HTTPS.
            </p>
          </button>

          {/* Local Documentation Card */}
          <button
            type="button"
            x-on:click="selectedSource = 'local'"
            x-bind:aria-pressed="selectedSource === 'local'"
            x-bind:class="selectedSource === 'local' ? 'border-primary-500 dark:border-primary-400 shadow-md bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'"
            class="group p-4 border-2 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 text-left cursor-pointer"
          >
            <div class="flex items-center mb-2">
              <svg
                x-bind:class="selectedSource === 'local' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'"
                class="w-6 h-6 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <span
                x-bind:class="selectedSource === 'local' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'"
                class="ml-2 text-base font-semibold group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
              >
                Local Documentation
              </span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300">
              Upload documents, folders, or archives from your current device.
            </p>
          </button>
        </div>

        {/* Proceed button */}
        <button
          type="button"
          x-on:click={proceed}
          x-bind:disabled="selectedSource === null"
          class="mt-5 w-full flex justify-center py-2 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-150"
        >
          Proceed
        </button>
      </div>
    </div>
  );
};

export default SourceSelectionModal;
