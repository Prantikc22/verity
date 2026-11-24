/**
 * Small inline line icons for the workspace (Lucide-style strokes, no dependency).
 * Use instead of emoji: consistent size, colour and alignment in both themes.
 */
const PATHS = {
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 010 18M12 3a14 14 0 000 18",
  laptop: "M4 5h16v10H4zM2 19h20",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 018 0v4",
  zap: "M13 2L4 14h7l-1 8 9-12h-7z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9.5a1 1 0 100-.01",
  bot: "M12 3v3M6 7h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2zM9 12h.01M15 12h.01M9 16h6",
  repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3",
  alert: "M12 3l10 18H2zM12 10v4M12 17h.01",
  check: "M5 12l5 5L20 7",
} as const;

export type IconName = keyof typeof PATHS;

export function Ico({ name, size = 16, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={PATHS[name]} />
    </svg>
  );
}
