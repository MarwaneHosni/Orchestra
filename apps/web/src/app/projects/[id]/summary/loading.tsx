import { ThinkingLoader } from "@/components/ui/skeleton";

export default function SummaryLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <ThinkingLoader />
    </div>
  );
}
