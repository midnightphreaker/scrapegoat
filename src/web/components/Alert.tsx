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
 * Reusable Alert component using Flowbite styling.
 * Displays messages with appropriate colors and icons based on the type.
 * @param props - Component props including type, title (optional), and message.
 * @default title - Uses default title based on alert type if not provided
 */
const Alert = ({ type, title, message }: AlertProps) => {
  let iconSvg: JSX.Element;
  let colorClasses: string;
  let defaultTitle: string;

  switch (type) {
    case "success":
      defaultTitle = "Success:";
      colorClasses =
        "text-green-800 dark:text-green-200 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30";
      iconSvg = (
        <svg
          class="flex-shrink-0 inline w-4 h-4 me-3"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm9.5 9.5A9.5 9.5 0 0 1 10 19a9.46 9.46 0 0 1-1.671-.14c-.165-.05-.3-.19-.42-.335l-.165-.165c-.19-.2-.3-.425-.3-.655A4.2 4.2 0 0 1 4.5 10a4.25 4.25 0 0 1 7.462-2.882l1.217 1.217a3.175 3.175 0 0 0 4.5.01l.106-.106a.934.934 0 0 0 .1-.36ZM10 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
        </svg>
      );
      break;
    case "error":
      defaultTitle = "Error:";
      colorClasses =
        "text-red-800 dark:text-red-200 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30";
      iconSvg = (
        <svg
          class="flex-shrink-0 inline w-4 h-4 me-3"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3h-1a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
        </svg>
      );
      break;
    case "warning":
      defaultTitle = "Warning:";
      colorClasses =
        "text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30";
      iconSvg = (
        <svg
          class="flex-shrink-0 inline w-4 h-4 me-3"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3h-1a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
        </svg>
      );
      break;
    case "info":
    default: // Default to info style
      defaultTitle = "Info:";
      colorClasses =
        "text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30";
      iconSvg = (
        <svg
          class="flex-shrink-0 inline w-4 h-4 me-3"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
        </svg>
      );
      break;
  }

  const displayTitle = title ?? defaultTitle;

  return (
    <div
      class={`flex items-center p-4 mb-4 text-sm border rounded-lg shadow-context7-sm ${colorClasses}`}
      role="alert"
    >
      {iconSvg}
      <span class="sr-only">Info</span>
      <div>
        {displayTitle ? (
          <span class="font-semibold" safe>
            {displayTitle}
          </span>
        ) : null}{" "}
        {message}
      </div>
    </div>
  );
};

export default Alert;
