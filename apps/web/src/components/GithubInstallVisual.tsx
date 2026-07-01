/**
 * A self-contained, theme-aware SVG showing the 3-step GitHub App install flow:
 * Install → Pick repos → Runs on every PR. Pure SVG (no client JS); colors use
 * indigo/violet/emerald that read well on light and dark, with currentColor for
 * frames so it inherits the surrounding text color.
 */
export function GithubInstallVisual({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 760 240" className={className} role="img" aria-label="How to install the Verity GitHub App: install it, pick your repositories, and it runs your tests on every pull request." xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* connectors */}
      <path d="M236 120 H262" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" markerEnd="url(#a)" />
      <path d="M498 120 H524" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" markerEnd="url(#a)" />
      <marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0l6 3-6 3z" fill="currentColor" fillOpacity="0.4" /></marker>

      {/* ---- Step 1: Install ---- */}
      <g>
        <rect x="16" y="40" width="220" height="160" rx="8" fill="none" stroke="currentColor" strokeOpacity="0.18" />
        <circle cx="34" cy="58" r="3" fill="currentColor" fillOpacity="0.25" />
        <circle cx="46" cy="58" r="3" fill="currentColor" fillOpacity="0.25" />
        <circle cx="58" cy="58" r="3" fill="currentColor" fillOpacity="0.25" />
        {/* octocat */}
        <g transform="translate(110 84)">
          <path transform="scale(1.6)" fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
        </g>
        <rect x="56" y="138" width="140" height="34" rx="6" fill="url(#vg)" />
        <text x="126" y="160" textAnchor="middle" fontFamily="system-ui" fontSize="13" fontWeight="600" fill="#fff">Install on GitHub</text>
        <text x="126" y="26" textAnchor="middle" fontFamily="system-ui" fontSize="12" fontWeight="700" fill="currentColor">1 · Install the app</text>
      </g>

      {/* ---- Step 2: Pick repos ---- */}
      <g>
        <rect x="278" y="40" width="220" height="160" rx="8" fill="none" stroke="currentColor" strokeOpacity="0.18" />
        <text x="388" y="26" textAnchor="middle" fontFamily="system-ui" fontSize="12" fontWeight="700" fill="currentColor">2 · Pick your repos</text>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(300 ${64 + i * 44})`}>
            <rect x="0" y="0" width="16" height="16" rx="3" fill={i < 2 ? "#10b981" : "none"} stroke="currentColor" strokeOpacity="0.4" />
            {i < 2 && <path d="M3.5 8l3 3 6-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            <rect x="28" y="3" width={i === 0 ? 150 : i === 1 ? 120 : 100} height="10" rx="3" fill="currentColor" fillOpacity="0.18" />
          </g>
        ))}
      </g>

      {/* ---- Step 3: PR checks ---- */}
      <g>
        <rect x="540" y="40" width="220" height="160" rx="8" fill="none" stroke="currentColor" strokeOpacity="0.18" />
        <text x="650" y="26" textAnchor="middle" fontFamily="system-ui" fontSize="12" fontWeight="700" fill="currentColor">3 · Runs on every PR</text>
        {/* PR row */}
        <g transform="translate(560 62)">
          <circle cx="8" cy="8" r="7" fill="none" stroke="#8b5cf6" strokeWidth="2" />
          <path d="M8 4v4l3 2" stroke="#8b5cf6" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <rect x="24" y="3" width="120" height="10" rx="3" fill="currentColor" fillOpacity="0.18" />
        </g>
        {/* check rows */}
        {[0, 1].map((i) => (
          <g key={i} transform={`translate(560 ${96 + i * 30})`}>
            <circle cx="8" cy="8" r="8" fill="#10b981" />
            <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="26" y="3" width={i === 0 ? 110 : 90} height="10" rx="3" fill="currentColor" fillOpacity="0.18" />
          </g>
        ))}
        {/* comment bubble */}
        <g transform="translate(560 156)">
          <rect x="0" y="0" width="180" height="30" rx="6" fill="#10b981" fillOpacity="0.12" stroke="#10b981" strokeOpacity="0.5" />
          <text x="12" y="20" fontFamily="system-ui" fontSize="12" fontWeight="600" fill="#059669">✓ 18 passed · ready to merge</text>
        </g>
      </g>
    </svg>
  );
}
