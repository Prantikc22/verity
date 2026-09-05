"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Lightweight top progress bar for App Router navigations. Starts on internal
 * link clicks and completes when the pathname changes.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (visible) return;
    setVisible(true);
    setWidth(8);
    if (tick.current) clearInterval(tick.current);
    tick.current = setInterval(() => setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w)), 180);
  }, [visible]);

  const finish = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    setWidth(100);
    window.setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 280);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      const target = a.getAttribute("target");
      if (!href || href.startsWith("#") || target === "_blank" || /^https?:\/\//i.test(href) || href.startsWith("mailto:")) return;
      try {
        if (new URL(href, location.href).pathname === location.pathname) return;
      } catch {
        return;
      }
      start();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- completes the progress bar on route change
    if (visible) finish();
  }, [pathname, visible, finish]);

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div
        className="h-full bg-indigo-500 shadow-[0_0_10px_#6366f1,0_0_5px_#6366f1] transition-[width] duration-200 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
