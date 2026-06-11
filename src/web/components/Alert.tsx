import type { PropsWithChildren } from "@kitajs/html";

/**
 * Defines the possible types for the Alert component.
 */
type AlertType = "success" | "error" | "warning" | "info";

/**
 * Props for the Alert component.
 */
interface AlertProps extends PropsWithChildren {
  type: AlertType;
  title?: string;
  message: string | JSX.Element; // Allow JSX for messages
}

/**
 * Reusable Alert component using dashboard theme primitives.
 * Displays messages with appropriate badge styling based on the type.
 * @param props - Component props including type, title (optional), and message.
 */
const Alert = ({ type, title, message }: AlertProps) => {
  let badgeClasses: string;
  let defaultTitle: string;

  switch (type) {
    case "success":
      defaultTitle = "Success:";
      badgeClasses = "sg-badge sg-badge-success";
      break;
    case "error":
      defaultTitle = "Error:";
      badgeClasses = "sg-badge sg-badge-danger";
      break;
    case "warning":
      defaultTitle = "Warning:";
      badgeClasses = "sg-badge sg-badge-warning";
      break;
    case "info":
    default: // Default to info style
      defaultTitle = "Info:";
      badgeClasses = "sg-badge sg-badge-cyan";
      break;
  }

  const displayTitle = title ?? defaultTitle;

  return (
    <div class="sg-panel mb-4 text-sm" role="alert">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
        {displayTitle ? (
          <span class={badgeClasses} safe>
            {displayTitle}
          </span>
        ) : null}
        <div class="min-w-0 flex-1 text-white">{message}</div>
      </div>
    </div>
  );
};

export default Alert;
