/** The QAShift mark (a folded-ribbon Q) and the Sora wordmark, matching qashifthq.com.
 *  The top-left fold follows currentColor; pass a distinct `id` when several marks share a page. */
export const QMARK = {
  violet: 'M30 18 L42 6 L42.6 6 Q43.8 6 44.7 6.9 L53.1 15.3 Q54 16.2 54 17.4 L54 40 Q54 42.5 52.2 44.3 L48 48.5 L42 42 L42 18 Z',
  lavender: 'M6 30 L18 18 L18 42 L42 42 L48 48.5 L44.3 52.2 Q42.5 54 40 54 L16 54 Q13.5 54 11.7 52.2 L7.8 48.3 Q6 46.5 6 44 Z',
  shadow: 'M29 42 L41 42 L47 54 L35 54 Z',
  tail: 'M29.5 36 L39.5 36 Q41.2 36 42.4 37.2 L59 53.8 Q60.6 55.4 58.4 56.4 Q57.6 56.8 56.6 56.8 L47.4 56.8 Q45.7 56.8 44.5 55.6 L28.4 39.5 Q26.8 37.9 27.6 36.8 Q28.2 36 29.5 36 Z',
  fold: 'M7.8 15.7 L15.7 7.8 Q17.5 6 20 6 L42 6 L30 18 L18 18 L6 30 L6 20 Q6 17.5 7.8 15.7 Z',
}

export function LogoMark({ size = 26, id = 'qs' }: { size?: number; id?: string }) {
  const g = (n: string) => `${id}-${n}`
  return (
    <svg width={size} height={size * 55 / 58} viewBox="4 4 58 55" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id={g('v')} x1="40" y1="6" x2="50" y2="48" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#9D80FF" /><stop offset="1" stopColor="#5B35F0" /></linearGradient>
        <linearGradient id={g('l')} x1="6" y1="40" x2="50" y2="50" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#C9BBFF" /><stop offset=".65" stopColor="#8F72FF" /><stop offset="1" stopColor="#6A4BFF" /></linearGradient>
        <linearGradient id={g('t')} x1="30" y1="37" x2="58" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#8A6BFF" /><stop offset="1" stopColor="#5230EE" /></linearGradient>
        <linearGradient id={g('s')} x1="30" y1="44" x2="46" y2="56" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#1B1040" stopOpacity=".55" /><stop offset="1" stopColor="#1B1040" stopOpacity="0" /></linearGradient>
      </defs>
      <path className="qs-f qs-f1" d={QMARK.violet} fill={`url(#${g('v')})`} />
      <path className="qs-f qs-f2" d={QMARK.lavender} fill={`url(#${g('l')})`} />
      <path className="qs-f qs-f3" d={QMARK.shadow} fill={`url(#${g('s')})`} />
      <path className="qs-f qs-f3" d={QMARK.tail} fill={`url(#${g('t')})`} />
      <path className="qs-f qs-f4" d={QMARK.fold} fill="currentColor" />
    </svg>
  )
}

export function Logo({ className = "", size = 24, id = "qs-app" }: { className?: string; size?: number; id?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} id={id} />
      <span className="text-[19px] font-bold leading-none tracking-[-0.045em]" style={{ fontFamily: "var(--font-brand), var(--font-geist-sans), sans-serif" }}>QAShift</span>
    </span>
  );
}
