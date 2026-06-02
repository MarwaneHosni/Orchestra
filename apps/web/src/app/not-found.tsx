export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center pt-8 text-center">
      <p style={{ fontSize: 36, fontWeight: 700, color: "var(--color-text-muted)" }}>404</p>
      <h1 style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>Page not found</h1>
      <p style={{ marginTop: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <a
        href="/"
        style={{
          marginTop: 20,
          borderRadius: 3,
          padding: "8px 18px",
          fontSize: 13,
          fontFamily: "inherit",
          border: "1px solid var(--color-accent-purple)",
          color: "var(--color-accent-purple)",
          background: "transparent",
          cursor: "pointer",
          textDecoration: "none",
        }}
        className="hover:bg-accent-purple-dim transition-colors duration-150"
      >
        ← go to dashboard
      </a>
    </div>
  );
}
