export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect width="32" height="32" className="fill-indigo-600" />
        {/* A "V" that doubles as a verification checkmark — sharp, mitered. */}
        <path
          d="M6 9 L16 24 L26 9"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.4"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <path d="M12 14.5 L15 18 L21.5 10" fill="none" stroke="#c7d2fe" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">Verity</span>
    </span>
  );
}
