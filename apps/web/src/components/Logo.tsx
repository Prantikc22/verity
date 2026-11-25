/** The QAShift mark (a Q whose tail is a green check) and the Sora wordmark, matching qashifthq.com. */
export function Logo({ className = "", size = 24 }: { className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <path d="M 45.2 20.4 A 21 21 0 1 0 44.1 45.9" fill="none" stroke="currentColor" strokeWidth="7.5" strokeLinecap="round" />
        <path d="M 19.5 32.5 L 28.5 41.5 L 57 13" fill="none" stroke="#22C985" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[19px] font-bold leading-none tracking-[-0.045em]" style={{ fontFamily: "var(--font-brand), var(--font-geist-sans), sans-serif" }}>QAShift</span>
    </span>
  );
}
