import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const stats = [
  { label: "Projects", value: "—" },
  { label: "Blueprints", value: "—" },
  { label: "Tasks", value: "—" },
  { label: "Phases", value: "12" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Welcome to Orchestra. Start by creating your first project.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">New project</Link>
        </Button>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
            <dt className="text-sm text-text-secondary">{stat.label}</dt>
            <dd className="mt-1 text-3xl font-semibold text-text-primary">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>
            Describe your software idea and let Orchestra build a complete development plan.
          </CardDescription>
        </CardHeader>
        <ol className="space-y-4">
          <li className="flex items-start gap-4 rounded-lg bg-surface-secondary p-4">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orchestra-100 text-sm font-semibold text-orchestra-700"
              aria-hidden="true"
            >
              1
            </span>
            <div>
              <p className="font-medium text-text-primary">Create a project</p>
              <p className="mt-1 text-sm text-text-secondary">
                Give your idea a name and a short description.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4 rounded-lg bg-surface-secondary p-4">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orchestra-100 text-sm font-semibold text-orchestra-700"
              aria-hidden="true"
            >
              2
            </span>
            <div>
              <p className="font-medium text-text-primary">Refine through interview</p>
              <p className="mt-1 text-sm text-text-secondary">
                Answer structured questions to flesh out requirements, architecture, and constraints.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4 rounded-lg bg-surface-secondary p-4">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orchestra-100 text-sm font-semibold text-orchestra-700"
              aria-hidden="true"
            >
              3
            </span>
            <div>
              <p className="font-medium text-text-primary">Get your plan</p>
              <p className="mt-1 text-sm text-text-secondary">
                Receive a complete blueprint, roadmap, and dependency-aware task graph.
              </p>
            </div>
          </li>
        </ol>
      </Card>
    </div>
  );
}
