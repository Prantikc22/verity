/** Shown instantly while a dashboard page loads, so a click always gets a response. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  const bar = "animate-pulse rounded-md bg-neutral-200/70 dark:bg-neutral-800";
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-6xl">
      <span className="sr-only">Loading…</span>
      <div className={`${bar} h-7 w-56`} />
      <div className={`${bar} mt-3 h-4 w-[min(520px,80%)]`} />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bar} h-20 rounded-xl`} />)}
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-neutral-100 px-4 py-4 first:border-t-0 dark:border-neutral-800">
            <div className={`${bar} h-5 w-14`} />
            <div className={`${bar} h-4 flex-1`} style={{ maxWidth: `${60 - (i % 3) * 10}%` }} />
            <div className={`${bar} h-4 w-16`} />
          </div>
        ))}
      </div>
    </div>
  );
}
