/** The QAShift mark: a Q whose tail is a green check. Ring follows currentColor. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden>
        <path d="M 43.56 21.1 A 19 19 0 1 0 42.56 44.21" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        <path d="M 19 33 L 27 41 L 55 13" fill="none" stroke="#22C55E" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">QAShift</span>
    </span>
  );
}
