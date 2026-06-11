interface VersionBadgeProps {
  version: string | null;
}

const VersionBadge = ({ version }: VersionBadgeProps) => {
  if (!version) {
    return null; // Don't render if no version is provided
  }

  return (
    <span class="sg-badge sg-badge-cyan me-2">
      <span safe>{version}</span>
    </span>
  );
};

export default VersionBadge;
