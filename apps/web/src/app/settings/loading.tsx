import { ThinkingLoader } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <ThinkingLoader />
    </div>
  );
}
