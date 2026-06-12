/**
 * A reusable button component for adding a new documentation job.
 * Encapsulates both styling and HTMX behavior.
 */
const AddJobButton = () => {
  return (
    <button
      type="button"
      class="sg-button sg-button-secondary sg-button-add-document w-full"
      hx-get="/web/jobs/source-selection"
      hx-target="#modal-container"
      hx-swap="innerHTML"
    >
      Add New Documentation
    </button>
  );
};

export default AddJobButton;
