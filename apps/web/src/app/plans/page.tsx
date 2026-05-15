import { EmptyState } from "@/components/ui/empty-state";

export default function PlansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Plans</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Execution roadmaps and dependency-aware task graphs.
        </p>
      </div>

      <EmptyState
        title="No plans yet"
        description="Execution plans are generated alongside blueprints after the interview phase."
      />
    </div>
  );
}
