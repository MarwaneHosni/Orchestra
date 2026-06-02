import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <Skeleton className="h-8 w-28 rounded" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      <CardSkeleton />
    </div>
  );
}
