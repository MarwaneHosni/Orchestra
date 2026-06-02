import { ThinkingLoader } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <ThinkingLoader />
    </div>
  );
}
