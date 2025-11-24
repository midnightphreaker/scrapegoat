interface VersionBadgeProps {
  version: string | null;
}

const VersionBadge = ({ version }: VersionBadgeProps) => {
  if (!version) {
    return null; // Don't render if no version is provided
  }

  return (
    <span class="bg-primary-100 text-primary-800 text-sm font-semibold me-2 px-2 py-1 rounded-lg">
      <span safe>{version}</span>
    </span>
  );
};

export default VersionBadge;
