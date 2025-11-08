interface VersionBadgeProps {
  version: string | null;
}

const VersionBadge = ({ version }: VersionBadgeProps) => {
  if (!version) {
    return null; // Don't render if no version is provided
  }

  return (
    <span class="bg-primary-100 text-primary-800 text-xs font-medium me-2 px-1.5 py-0.5 rounded">
      <span safe>{version}</span>
    </span>
  );
};

export default VersionBadge;
