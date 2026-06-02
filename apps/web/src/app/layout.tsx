import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orchestra — AI Software Development Orchestrator",
  description: "Transform a raw software idea into a structured, execution-ready development plan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-base text-text-primary">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-accent-purple focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>
        <Navbar />
        <main id="main-content" style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px" }} className="pt-14 pb-10" role="main">
          {children}
        </main>
      </body>
    </html>
  );
}
