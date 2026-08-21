/**
 * Centralized API configuration for the Orchestra frontend.
 *
 * Strategy:
 * - In browser contexts, use relative URLs (`/api/v1/...`) through Next.js rewrites
 *   or direct requests to the same origin (works in dev via proxy, prod via same-domain deployment).
 * - When an absolute URL is required (SSR, server components, or cross-origin deployments),
 *   set `NEXT_PUBLIC_API_URL` to the full base URL (e.g. `https://api.orchestra.example.com`).
 * - Default behavior: empty string → relative URLs work automatically in the browser.
 *
 * Usage:
 *   import { apiUrl } from "@/lib/api-config";
 *   const res = await fetch(`${apiUrl}/api/v1/projects`);
 */

let _baseUrl: string | null = null;

export function getApiBaseUrl(): string {
  if (_baseUrl !== null) return _baseUrl;

  let url = "";

  // NEXT_PUBLIC_API_URL takes precedence — used for SSR, Docker, staging, production
  if (process.env.NEXT_PUBLIC_API_URL) {
    url = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
  }
  // Browser-side dev detection: if we're on Next.js dev port 3001,
  // the API is on port 3000. This avoids the Next.js proxy timeout issue.
  else if (typeof window !== "undefined" && window.location.port === "3001") {
    url = "http://localhost:3000";
  }

  _baseUrl = url;
  return url;
}

/**
 * Build a full API URL path.
 * If a base URL is configured, prepends it. Otherwise returns a relative path.
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${cleanPath}`;
}

/**
 * Full URL to the Orchestra docs site.
 * The docs live in the separate landing app, so an absolute URL is used.
 * Set `NEXT_PUBLIC_DOCS_URL` to the deployed docs base. Defaults to the
 * public docs site (`https://orchestra.dev`).
 */
export function getDocsUrl(): string {
  const configured = process.env.NEXT_PUBLIC_DOCS_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return "https://orchestra.dev";
}
