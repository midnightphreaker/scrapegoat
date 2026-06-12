/**
 * Toast notification component using ScrapeGoat dark glass styling and Alpine.js for state management.
 * Displays floating notifications for success, error, warning, and info messages.
 */
const Toast = () => {
  return (
    <div
      x-data
      x-show="$store.toast.visible"
      x-transition:enter="transition ease-out duration-300"
      x-transition:enter-start="opacity-0 transform translate-y-2"
      x-transition:enter-end="opacity-100 transform translate-y-0"
      x-transition:leave="transition ease-in duration-200"
      x-transition:leave-start="opacity-100"
      x-transition:leave-end="opacity-0"
      class="fixed top-5 right-5 z-50"
      style="display: none;"
    >
      <div
        class="sg-panel flex w-full max-w-xs items-center p-4"
        role="alert"
      >
        {/* Icon based on type */}
        <div
          class="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-lg"
          x-bind:class="{
            'bg-emerald-400/12 text-emerald-200': $store.toast.type === 'success',
            'bg-rose-500/14 text-rose-200': $store.toast.type === 'error',
            'bg-yellow-300/14 text-yellow-100': $store.toast.type === 'warning',
            'bg-cyan-400/12 text-cyan-100': $store.toast.type === 'info'
          }"
        >
          {/* Success icon */}
          <svg
            x-show="$store.toast.type === 'success'"
            class="w-5 h-5"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z" />
          </svg>
          {/* Error icon */}
          <svg
            x-show="$store.toast.type === 'error'"
            class="w-5 h-5"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z" />
          </svg>
          {/* Warning icon */}
          <svg
            x-show="$store.toast.type === 'warning'"
            class="w-5 h-5"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5Z" />
          </svg>
          {/* Info icon */}
          <svg
            x-show="$store.toast.type === 'info'"
            class="w-5 h-5"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
          </svg>
        </div>
        {/* Message */}
        <div
          class="ml-3 min-w-0 flex-1 text-sm font-normal text-white"
          x-text="$store.toast.message"
        ></div>
        {/* Close button */}
        <button
          type="button"
          class="sg-button sg-button-ghost ml-auto min-h-0 h-8 w-8 p-1.5"
          x-on:click="$store.toast.hide()"
          aria-label="Close"
        >
          <span class="sr-only">Close</span>
          <svg
            class="w-3 h-3"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 14 14"
          >
            <path
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toast;
