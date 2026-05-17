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

function getBaseUrl(): string {
  // NEXT_PUBLIC_API_URL takes precedence — used for SSR, Docker, staging, production
  if (process.env.NEXT_PUBLIC_API_URL) {
    const url = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
    return url;
  }
  // Fallback: empty string → relative URLs (browser proxy mode)
  return "";
}

export const API_BASE_URL = getBaseUrl();

/**
 * Build a full API URL path.
 * If API_BASE_URL is set, prepends it. Otherwise returns a relative path.
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
