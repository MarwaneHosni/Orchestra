import { ThinkingLoader } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <div className="flex flex-col items-center justify-center pt-12 gap-3">
      <ThinkingLoader />
    </div>
  );
}
