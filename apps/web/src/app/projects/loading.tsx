export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-28 animate-pulse rounded bg-border-subtle" />
          <div className="mt-1 h-3 w-44 animate-pulse rounded bg-border-subtle" />
        </div>
        <div className="h-8 w-28 animate-pulse rounded bg-border-subtle" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded bg-bg-hover" />
        ))}
      </div>
    </div>
  );
}
