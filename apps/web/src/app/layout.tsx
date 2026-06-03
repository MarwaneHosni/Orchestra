import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orchestra — AI Software Development Orchestrator",
  description: "Transform a raw software idea into a structured, execution-ready development plan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem("theme");if(!t||t==="system"){t=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`
        }} />
      </head>
      <body className="min-h-screen bg-bg-base text-text-primary">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-accent-purple focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>
        <Navbar />
        <main id="main-content" style={{ maxWidth: 960, margin: "0 auto", padding: "56px 20px 40px" }} className="" role="main">
          {children}
        </main>
      </body>
    </html>
  );
}
