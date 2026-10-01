export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mt-6 space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton min-h-[72px] rounded-[var(--radius-card)]" />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-4 rounded-[var(--radius-card)] bg-card px-5 py-5 ring-1 ring-line" role="alert">
      <p className="text-base font-semibold text-ink">Something went wrong.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex min-h-11 items-center text-base font-semibold text-forest"
      >
        Try again
      </button>
    </div>
  );
}
