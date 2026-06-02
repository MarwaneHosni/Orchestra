export default function SummaryLoading() {
  return (
    <div className="space-y-6 py-4">
      <div className="h-6 w-36 animate-pulse rounded bg-border-subtle" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded bg-bg-hover" />
        ))}
      </div>
      <div className="h-64 w-full animate-pulse rounded bg-bg-hover" />
    </div>
  );
}
