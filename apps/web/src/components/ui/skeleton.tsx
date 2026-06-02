export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-border-subtle ${className ?? ""}`} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded border border-border-default bg-bg-elevated p-5" aria-hidden="true">
      <Skeleton className="mb-4 h-4 w-36" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
