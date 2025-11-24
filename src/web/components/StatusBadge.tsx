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
      return `${baseClasses} bg-green-100 text-green-800`;
    case VersionStatus.RUNNING:
    case VersionStatus.UPDATING:
      return `${baseClasses} bg-primary-100 text-primary-800`;
    case VersionStatus.QUEUED:
      return `${baseClasses} bg-yellow-100 text-yellow-800`;
    case VersionStatus.FAILED:
      return `${baseClasses} bg-red-100 text-red-800`;
    case VersionStatus.CANCELLED:
      return `${baseClasses} bg-stone-100 text-stone-800`;
    case VersionStatus.NOT_INDEXED:
    default:
      return `${baseClasses} bg-stone-100 text-stone-600`;
  }
}

const StatusBadge = ({ status, showDescription = true }: StatusBadgeProps) => (
  <span class={getStatusClasses(status)}>
    {showDescription ? getStatusDescription(status) : status}
  </span>
);

export default StatusBadge;
