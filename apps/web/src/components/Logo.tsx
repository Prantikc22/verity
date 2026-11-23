/** The QAShift mark: a Q whose tail is a green check. Ring follows currentColor. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden>
        <path d="M 45.2 20.4 A 21 21 0 1 0 44.1 45.9" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
        <path d="M 19.5 32.5 L 28.5 41.5 L 57 13" fill="none" stroke="#22C55E" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">QAShift</span>
    </span>
  );
}
