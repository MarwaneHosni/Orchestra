import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-gray-200", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-6" aria-hidden="true">
      <Skeleton className="mb-4 h-5 w-48" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
