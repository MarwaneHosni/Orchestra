import { TerminalTitle } from "@/components/ui/terminal-title";
import { EmptyState } from "@/components/ui/empty-state";

export default function BlueprintsPage() {
  return (
    <div className="space-y-8">
      <div>
        <TerminalTitle className="text-lg font-semibold text-text-primary">Blueprints</TerminalTitle>
        <p className="mt-2 text-xs text-text-secondary">
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
