import { Skeleton } from "@/components/ui/skeleton";

export default function PlansLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-20" />
        <Skeleton className="mt-1 h-3 w-48" />
      </div>
      <Skeleton className="h-48 w-full rounded" />
    </div>
  );
}
