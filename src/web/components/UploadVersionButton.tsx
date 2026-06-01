import PrimaryButton from "./PrimaryButton";

/**
 * Props for the UploadVersionButton component.
 */
interface UploadVersionButtonProps {
  libraryName: string;
}

/**
 * A button component for uploading a new version of a library from local files.
 * Uses HTMX to load the upload panel into the add-version-form-container.
 */
const UploadVersionButton = ({ libraryName }: UploadVersionButtonProps) => {
  return (
    <PrimaryButton
      hx-get={`/web/upload?library=${encodeURIComponent(libraryName)}`}
      hx-target="#add-version-form-container"
      hx-swap="innerHTML"
    >
      Upload Version
    </PrimaryButton>
  );
};

export default UploadVersionButton;
