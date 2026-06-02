import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link, { type LinkProps } from "next/link";

function BtnLink({ href, children }: { href: LinkProps["href"]; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors"
    >
      {children}
    </Link>
  );
}

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
          <h1 className="text-lg font-semibold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Welcome to Orchestra. Start by creating your first project.
          </p>
        </div>
        <BtnLink href="/projects/new">New project</BtnLink>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded border border-border-default bg-bg-elevated p-4">
            <dt className="text-xs text-text-secondary">{stat.label}</dt>
            <dd className="mt-1 text-xl font-semibold text-text-primary">{stat.value}</dd>
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
          <li className="flex items-start gap-4 rounded bg-bg-surface p-4">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent-purple-dim text-sm font-semibold text-accent-purple"
              aria-hidden="true"
            >
              1
            </span>
            <div>
              <p className="font-medium text-text-primary text-sm">Create a project</p>
              <p className="mt-1 text-xs text-text-secondary">
                Give your idea a name and a short description.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4 rounded bg-bg-surface p-4">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent-purple-dim text-sm font-semibold text-accent-purple"
              aria-hidden="true"
            >
              2
            </span>
            <div>
              <p className="font-medium text-text-primary text-sm">Refine through interview</p>
              <p className="mt-1 text-xs text-text-secondary">
                Answer structured questions to flesh out requirements, architecture, and constraints.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4 rounded bg-bg-surface p-4">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent-purple-dim text-sm font-semibold text-accent-purple"
              aria-hidden="true"
            >
              3
            </span>
            <div>
              <p className="font-medium text-text-primary text-sm">Get your plan</p>
              <p className="mt-1 text-xs text-text-secondary">
                Receive a complete blueprint, roadmap, and dependency-aware task graph.
              </p>
            </div>
          </li>
        </ol>
      </Card>
    </div>
  );
}
