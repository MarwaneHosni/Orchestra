export default function InterviewLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
      <div className="h-2 w-full animate-pulse rounded-full bg-gray-200" />
      <div className="h-40 w-full animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}
