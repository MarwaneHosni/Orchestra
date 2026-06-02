import Link, { type LinkProps } from "next/link";
import { SectionDivider } from "@/components/ui/badge";

function BtnLink({ href, children }: { href: LinkProps["href"]; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ borderRadius: 3, padding: "8px 18px", fontSize: 13, fontFamily: "inherit" }}
      className="inline-flex bg-accent-purple text-white border border-accent-purple font-medium hover:opacity-88 active:scale-[0.98] transition-[color,background-color,border-color,opacity,transform] duration-150"
    >
      {children}
    </Link>
  );
}

const statRows = [
  { label: "Projects", value: "—" },
  { label: "Blueprints", value: "—" },
  { label: "Tasks", value: "—" },
  { label: "Phases", value: "12" },
];

const steps = [
  { step: "1", title: "Create a project", desc: "Give your idea a name and a short description." },
  { step: "2", title: "Refine through interview", desc: "Answer structured questions to flesh out requirements, architecture, and constraints." },
  { step: "3", title: "Get your plan", desc: "Receive a complete blueprint, roadmap, and dependency-aware task graph." },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>Dashboard</h1>
          <p style={{ marginTop: 2, fontSize: 11, color: "var(--color-text-secondary)" }}>
            Welcome to Orchestra. Start by creating your first project.
          </p>
        </div>
        <BtnLink href="/projects/new">New project</BtnLink>
      </div>

      <SectionDivider title="Overview" />

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border-default)" }}>
            <th style={{ padding: "8px 0", textAlign: "left", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", fontWeight: 400 }}>
              Metric
            </th>
            <th style={{ padding: "8px 0", textAlign: "right", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", fontWeight: 400 }}>
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {statRows.map((row) => (
            <tr key={row.label} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              <td style={{ padding: "10px 0", color: "var(--color-text-secondary)" }}>
                {row.label}
              </td>
              <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600, color: "var(--color-text-primary)" }}>
                <span style={{ fontSize: 16 }}>{row.value}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionDivider title="Getting Started" />

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border-default)" }}>
            <th style={{ padding: "8px 0", width: 32, textAlign: "left", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", fontWeight: 400 }}>
              #
            </th>
            <th style={{ padding: "8px 0", textAlign: "left", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", fontWeight: 400 }}>
              Step
            </th>
            <th style={{ padding: "8px 0", textAlign: "left", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", fontWeight: 400 }}>
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.step} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              <td style={{ padding: "10px 0", color: "var(--color-accent-purple)", fontWeight: 600 }}>
                {s.step}
              </td>
              <td style={{ padding: "10px 0", color: "var(--color-text-primary)", fontWeight: 500 }}>
                {s.title}
              </td>
              <td style={{ padding: "10px 0", color: "var(--color-text-secondary)" }}>
                {s.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
