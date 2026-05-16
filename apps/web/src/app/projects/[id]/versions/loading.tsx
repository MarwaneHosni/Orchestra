export default function VersionsLoading() {
  return (
    <div className="space-y-6 py-4">
      <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
      <div className="h-6 w-36 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-56 animate-pulse rounded bg-gray-200" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
