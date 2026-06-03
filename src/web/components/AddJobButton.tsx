import PrimaryButton from "./PrimaryButton";

/**
 * A reusable button component for adding a new documentation job.
 * Encapsulates both styling and HTMX behavior.
 */
const AddJobButton = () => {
  return (
    <PrimaryButton
      hx-get="/web/jobs/source-selection"
      hx-target="#modal-container"
      hx-swap="innerHTML"
    >
      Add New Documentation
    </PrimaryButton>
  );
};

export default AddJobButton;
