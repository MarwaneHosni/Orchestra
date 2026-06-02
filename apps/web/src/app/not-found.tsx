import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl font-bold text-text-muted">404</p>
      <h1 className="mt-4 text-base font-semibold text-text-primary">Page not found</h1>
      <p className="mt-2 text-xs text-text-secondary">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
