export default function VersionsLoading() {
  return (
    <div className="space-y-6 py-4">
      <div className="h-4 w-36 animate-pulse rounded bg-border-subtle" />
      <div className="h-5 w-28 animate-pulse rounded bg-border-subtle" />
      <div className="h-3 w-44 animate-pulse rounded bg-border-subtle" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-bg-hover" />
        ))}
      </div>
    </div>
  );
}
