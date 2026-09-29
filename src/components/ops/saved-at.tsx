export function SavedAt({ at }: { at: Date | null | undefined }) {
  if (!at) return null;
  const label = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
  return (
    <span className="text-sm text-muted">
      Saved <time dateTime={at.toISOString()}>{label}</time>
    </span>
  );
}
