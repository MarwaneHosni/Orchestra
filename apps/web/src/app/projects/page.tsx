import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Projects</h1>
          <p className="mt-1 text-sm text-text-secondary">
            All your software ideas, organised as projects.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">New project</Link>
        </Button>
      </div>

      <EmptyState
        title="No projects yet"
        description="Create your first project to start transforming an idea into a structured development plan."
        action={{ label: "Create project", href: "/projects/new" }}
      />
    </div>
  );
}
