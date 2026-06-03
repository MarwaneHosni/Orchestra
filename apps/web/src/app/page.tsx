import { TerminalTitle } from "@/components/ui/terminal-title";
import { SectionDivider } from "@/components/ui/badge";
import Link from "next/link";

function BtnLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ borderRadius: 3, padding: "8px 18px", fontSize: 13, fontFamily: "inherit", color: "#fff" }}
      className="inline-flex bg-accent-purple text-white border border-accent-purple font-medium hover:opacity-88 active:scale-[0.98] transition-[color,background-color,border-color,opacity,transform] duration-150"
    >
      {children}
    </Link>
  );
}

const statCards = [
  { label: "Projects", value: "—", color: "var(--color-accent-purple)", glyph: "◆" },
  { label: "Blueprints", value: "—", color: "#4a9eff", glyph: "◈" },
  { label: "Tasks", value: "—", color: "var(--color-accent-green)", glyph: "⚙" },
  { label: "Phases", value: "12", color: "var(--color-accent-amber)", glyph: "◉" },
];

const steps = [
  { step: "1", title: "Create a project", desc: "Give your idea a name and a short description." },
  { step: "2", title: "Refine through interview", desc: "Answer structured questions to flesh out requirements, architecture, and constraints." },
  { step: "3", title: "Get your plan", desc: "Receive a complete blueprint, roadmap, and dependency-aware task graph." },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <div className="flex items-center justify-between">
        <div>
          <TerminalTitle className="text-lg font-semibold text-text-primary">Dashboard</TerminalTitle>
          <p className="mt-2 text-xs text-text-secondary">
            Welcome to Orchestra. Start by creating your first project.
          </p>
        </div>
        <BtnLink href="/projects/new">New project</BtnLink>
      </div>

      <SectionDivider title="Overview" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {statCards.map((card) => (
          <div
            key={card.label}
            style={{
              border: "1px solid var(--color-border-subtle)",
              borderLeft: `3px solid ${card.color}`,
              borderRadius: 3,
              background: "var(--color-bg-surface)",
              padding: "16px 18px",
              transition: "background 150ms, border-color 150ms",
            }}
            className="hover:bg-bg-hover hover:border-border-default"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <span style={{ color: card.color, fontSize: 10 }}>{card.glyph}</span>
              <span>{card.label}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1 }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <SectionDivider title="Getting Started" />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s) => (
          <div
            key={s.step}
            style={{
              display: "flex",
              gap: 14,
              border: "1px solid var(--color-border-subtle)",
              borderLeft: "3px solid var(--color-accent-purple)",
              borderRadius: 3,
              background: "var(--color-bg-surface)",
              padding: "14px 16px",
              transition: "background 150ms, border-color 150ms",
            }}
            className="hover:bg-bg-hover hover:border-border-default"
          >
            <div style={{
              width: 28, height: 28, flexShrink: 0,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              borderRadius: "50%",
              background: "var(--color-accent-purple-dim)",
              color: "var(--color-accent-purple)",
              fontSize: 13, fontWeight: 600, lineHeight: 1,
            }}>
              {s.step}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                {s.title}
              </p>
              <p style={{ marginTop: 2, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                {s.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
