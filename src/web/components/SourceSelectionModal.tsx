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
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md transition-opacity duration-200"
    >
      {/* Modal card */}
      <div
        class="sg-panel relative w-full max-w-2xl animate-[fadeSlideIn_0.2s_ease-out]"
        tabindex="0"
      >
        {/* Close button */}
        <button
          type="button"
          x-on:click={closeModal}
          class="sg-button sg-button-ghost absolute top-3 right-3 min-h-0 h-8 w-8 p-1.5"
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
          class="mb-1 pr-8 text-xl font-semibold text-white"
        >
          Documentation Source Selection
        </h3>
        <p class="mb-5 text-sm sg-muted">
          Choose where your documentation source is located.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Remote URL Card */}
          <button
            type="button"
            x-on:click="selectedSource = 'remote'"
            x-bind:aria-pressed="selectedSource === 'remote'"
            x-bind:class="selectedSource === 'remote' ? 'border-cyan-300/80 bg-cyan-400/10 shadow-[0_0_28px_rgba(34,211,238,0.18)]' : 'border-white/10 bg-slate-950/40'"
            class="sg-card group cursor-pointer text-left transition-all duration-200 hover:border-cyan-300/70 hover:bg-cyan-400/5 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
          >
            <div class="flex items-center mb-2">
              <svg
                x-bind:class="selectedSource === 'remote' ? 'text-cyan-200' : 'sg-muted'"
                class="w-6 h-6 group-hover:text-cyan-200 transition-colors"
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
                x-bind:class="selectedSource === 'remote' ? 'text-cyan-100' : 'text-white'"
                class="ml-2 text-base font-semibold group-hover:text-cyan-100 transition-colors"
              >
                Remote URL
              </span>
            </div>
            <p class="text-sm sg-muted">
              Use this for websites and remote documents accessible via HTTP/HTTPS.
            </p>
          </button>

          {/* Local Documentation Card */}
          <button
            type="button"
            x-on:click="selectedSource = 'local'"
            x-bind:aria-pressed="selectedSource === 'local'"
            x-bind:class="selectedSource === 'local' ? 'border-cyan-300/80 bg-cyan-400/10 shadow-[0_0_28px_rgba(34,211,238,0.18)]' : 'border-white/10 bg-slate-950/40'"
            class="sg-card group cursor-pointer text-left transition-all duration-200 hover:border-cyan-300/70 hover:bg-cyan-400/5 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
          >
            <div class="flex items-center mb-2">
              <svg
                x-bind:class="selectedSource === 'local' ? 'text-cyan-200' : 'sg-muted'"
                class="w-6 h-6 group-hover:text-cyan-200 transition-colors"
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
                x-bind:class="selectedSource === 'local' ? 'text-cyan-100' : 'text-white'"
                class="ml-2 text-base font-semibold group-hover:text-cyan-100 transition-colors"
              >
                Local Documentation
              </span>
            </div>
            <p class="text-sm sg-muted">
              Upload documents, folders, or archives from your current device.
            </p>
          </button>
        </div>

        {/* Proceed button */}
        <button
          type="button"
          x-on:click={proceed}
          x-bind:disabled="selectedSource === null"
          class="sg-button sg-button-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-45"
        >
          Proceed
        </button>
      </div>
    </div>
  );
};

export default SourceSelectionModal;
