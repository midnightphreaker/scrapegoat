/**
 * StatusBadge component displays version status with appropriate styling.
 * Uses database VersionStatus and helper functions for proper display.
 */

import { VersionStatus, getStatusDescription } from "../../store/types";

interface StatusBadgeProps {
  status: VersionStatus;
  showDescription?: boolean;
}

/**
 * Get CSS classes for status badge based on status type.
 */
function getStatusClasses(status: VersionStatus): string {
  const baseClasses = "px-2 py-1 text-sm font-semibold rounded-lg";

  switch (status) {
    case VersionStatus.COMPLETED:
      return `${baseClasses} bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200`;
    case VersionStatus.RUNNING:
    case VersionStatus.UPDATING:
      return `${baseClasses} bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200`;
    case VersionStatus.QUEUED:
      return `${baseClasses} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200`;
    case VersionStatus.FAILED:
      return `${baseClasses} bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200`;
    case VersionStatus.CANCELLED:
      return `${baseClasses} bg-stone-100 dark:bg-stone-700 text-stone-800 dark:text-stone-200`;
    case VersionStatus.NOT_INDEXED:
    default:
      return `${baseClasses} bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300`;
  }
}

const StatusBadge = ({ status, showDescription = true }: StatusBadgeProps) => (
  <span class={getStatusClasses(status)}>
    {showDescription ? getStatusDescription(status) : status}
  </span>
);

export default StatusBadge;
