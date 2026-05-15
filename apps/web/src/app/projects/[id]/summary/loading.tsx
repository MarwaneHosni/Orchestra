export default function SummaryLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="h-64 w-full animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}
