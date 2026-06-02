import { EmptyState } from "@/components/ui/empty-state";

export default function BlueprintsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Blueprints</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Generated architecture blueprints for your projects.
        </p>
      </div>

      <EmptyState
        title="No blueprints yet"
        description="Blueprints are generated automatically after a project completes the interview process."
      />
    </div>
  );
}
