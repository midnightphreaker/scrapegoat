import type { PropsWithChildren } from "@kitajs/html";

/**
 * Props for the PrimaryButton component.
 */
interface PrimaryButtonProps extends PropsWithChildren {
  type?: "button" | "submit" | "reset";
  class?: string;
  disabled?: boolean;
  [key: string]: unknown;
}

/**
 * A reusable primary button component with consistent styling.
 * Supports additional HTML attributes via spread.
 */
const PrimaryButton = ({
  children,
  type = "button",
  class: className = "",
  disabled = false,
  ...rest
}: PrimaryButtonProps) => {
  const baseClasses = "sg-button sg-button-primary w-full";
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";
  const combinedClasses =
    `${baseClasses} ${disabledClasses} ${className}`.trim();

  return (
    <button type={type} class={combinedClasses} disabled={disabled} {...rest}>
      {children}
    </button>
  );
};

export default PrimaryButton;
