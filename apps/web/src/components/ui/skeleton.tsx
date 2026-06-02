export function ThinkingLoader() {
  return (
    <span role="status" aria-label="Loading" className="inline-flex items-center gap-1 text-text-muted text-sm">
      <span>thinking</span>
      <span className="animate-ellipsis" aria-hidden="true" />
    </span>
  );
}

export function BlinkCursor() {
  return <span className="animate-blink text-accent-purple" aria-hidden="true">▋</span>;
}

export function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col items-center justify-center py-12 gap-3">
      <ThinkingLoader />
      <BlinkCursor />
    </div>
  );
}
