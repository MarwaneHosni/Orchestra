"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/blueprints", label: "Blueprints" },
  { href: "/plans", label: "Plans" },
  { href: "/settings", label: "Settings" },
];

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
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-bg-base/95 backdrop-blur supports-[backdrop-filter]:bg-bg-base/80">
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }} className="flex h-12 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-text-primary text-sm">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-accent-purple text-[10px] font-bold text-white">
            O
          </span>
          <span className="hidden sm:inline">Orchestra</span>
        </Link>

        <nav className="hidden md:flex md:items-center md:gap-1" aria-label="Main navigation">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-accent-purple-dim text-accent-purple"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <button
          ref={toggleRef}
          className="inline-flex md:hidden items-center justify-center rounded p-2 text-text-secondary hover:bg-bg-hover text-sm"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {mobileOpen ? "✗" : "☰"}
        </button>
      </div>

      {mobileOpen && (
        <nav id="mobile-nav" className="border-t border-border-subtle bg-bg-elevated md:hidden" aria-label="Mobile navigation">
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }} className="space-y-1 py-3">
            {navLinks.map((link, i) => {
              const isActive =
                pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={link.href}
                  onClick={handleLinkClick}
                  className={cn(
                    "block rounded px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-accent-purple-dim text-accent-purple"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                  )}
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
