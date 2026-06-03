/**
 * A true centered modal component for selecting the documentation source type.
 * Renders a fixed full-screen backdrop with a centered card.
 * Clicking outside or pressing Escape closes the modal.
 * Swapped into #modal-container via HTMX.
 */
const SourceSelectionModal = () => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabindex="-1"
      x-data="{ open: true, selected: null }"
      x-init="$el.focus()"
      {...{
        "x-on:keydown.escape": "htmx.ajax('GET', '/web/jobs/new-button', { target: '#modal-container', swap: 'innerHTML' })",
        "x-on:click.self": "htmx.ajax('GET', '/web/jobs/new-button', { target: '#modal-container', swap: 'innerHTML' })",
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
          hx-get="/web/jobs/new-button"
          hx-target="#modal-container"
          hx-swap="innerHTML"
          class="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
          title="Close"
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
            x-on:click="selected = 'remote'"
            {...{
              "x-bind:class": "selected === 'remote' ? 'ring-2 ring-primary-500 border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''",
            }}
            class="group p-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 hover:shadow-md transition-all duration-200 text-left cursor-pointer"
          >
            <div class="flex items-center mb-2">
              <svg
                class="w-6 h-6 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
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
              <span class="ml-2 text-base font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
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
            x-on:click="selected = 'local'"
            {...{
              "x-bind:class": "selected === 'local' ? 'ring-2 ring-primary-500 border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''",
            }}
            class="group p-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 hover:shadow-md transition-all duration-200 text-left cursor-pointer"
          >
            <div class="flex items-center mb-2">
              <svg
                class="w-6 h-6 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
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
              <span class="ml-2 text-base font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                Local Documentation
              </span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300">
              Upload documents, folders, or archives from your current device.
            </p>
          </button>
        </div>

        {/* Proceed button: disabled state — no selection yet */}
        <button
          type="button"
          x-show="selected === null"
          disabled
          class="mt-5 w-full flex justify-center py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
        >
          Select a source to continue
        </button>

        {/* Proceed button: enabled state — load selected panel */}
        <button
          type="button"
          x-show="selected !== null"
          x-on:click="selected === 'remote' ? htmx.ajax('GET', '/web/jobs/new', { target: '#addJobForm', swap: 'innerHTML' }) : htmx.ajax('GET', '/web/upload', { target: '#addJobForm', swap: 'innerHTML' }); document.getElementById('modal-container').innerHTML = '';"
          class="mt-5 w-full flex justify-center py-2 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-150"
        >
          Proceed with Selection
        </button>
      </div>
    </div>
  );
};

export default SourceSelectionModal;
