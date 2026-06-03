"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/use-theme";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/blueprints", label: "Blueprints" },
  { href: "/plans", label: "Plans" },
  { href: "/settings", label: "Settings" },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={`Theme: ${theme}. Click to cycle.`}
      aria-label="Toggle theme"
      style={{
        border: "1px solid var(--color-border-default)",
        borderRadius: 2,
        padding: "2px 6px",
        fontSize: 12,
        fontFamily: "inherit",
        color: "var(--color-text-secondary)",
        background: "transparent",
        cursor: "pointer",
        lineHeight: 1.4,
      }}
      className="hover:border-border-strong hover:text-text-primary transition-colors duration-150"
    >
      {theme === "light" ? "☀" : theme === "dark" ? "☾" : "◐"}
    </button>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (mobileOpen && firstLinkRef.current) {
      firstLinkRef.current.focus();
    }
  }, [mobileOpen]);

  const handleLinkClick = () => {
    setMobileOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <header
      className="sticky top-0 z-[100]"
      style={{ background: "var(--color-bg-base)", borderBottom: "1px solid var(--color-border-subtle)", height: 48 }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }} className="flex h-full items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-text-primary text-sm no-underline"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <span className="hidden sm:inline">orchestra</span>
        </Link>

        <nav className="hidden md:flex md:items-center md:h-full md:gap-1" aria-label="Main navigation">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                  className={cn(
                    "flex items-center h-full px-[14px] text-xs font-medium transition-colors duration-150 border-b-2",
                  )}
                style={{
                  color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  borderBottomColor: isActive ? "var(--color-accent-purple)" : "transparent",
                }}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>

        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            ref={toggleRef}
            className="inline-flex items-center justify-center p-2 text-text-secondary text-sm"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileOpen ? "✗" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          className="border-t border-border-subtle bg-bg-elevated md:hidden"
          aria-label="Mobile navigation"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }} className="space-y-0 py-2">
            {navLinks.map((link, i) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={link.href}
                  onClick={handleLinkClick}
                  className="block px-3 py-2.5 text-xs font-medium transition-colors duration-150 border-l-2"
                  style={{
                    color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    borderLeftColor: isActive ? "var(--color-accent-purple)" : "transparent",
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
