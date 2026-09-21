export function StaleBadge({ stale }: { stale: boolean }) {
  if (!stale) return null;
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full bg-warning-600/10 px-2.5 py-1 text-xs font-medium text-warning-600"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning-600" />
      Reconnecting — showing last known results
    </span>
  );
}
