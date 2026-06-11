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
  switch (status) {
    case VersionStatus.COMPLETED:
      return "sg-badge sg-badge-success";
    case VersionStatus.RUNNING:
    case VersionStatus.UPDATING:
      return "sg-badge sg-badge-cyan";
    case VersionStatus.QUEUED:
      return "sg-badge sg-badge-warning";
    case VersionStatus.FAILED:
      return "sg-badge sg-badge-danger";
    case VersionStatus.CANCELLED:
    case VersionStatus.NOT_INDEXED:
    default:
      return "sg-badge";
  }
}

const StatusBadge = ({ status, showDescription = true }: StatusBadgeProps) => (
  <span class={getStatusClasses(status)}>
    {showDescription ? getStatusDescription(status) : status}
  </span>
);

export default StatusBadge;
