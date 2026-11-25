"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useLinkStatus } from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Instant feedback for every in-app navigation: a violet bar at the top starts
 * the moment an internal link is clicked and finishes when the new page renders.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new URL rendered: finish the bar.
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 350);
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / hash
      if (timer.current) clearTimeout(timer.current);
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2.5px]">
      <div
        className={`h-full origin-left bg-gradient-to-r from-violet-500 via-violet-600 to-fuchsia-500 shadow-[0_0_8px_rgba(124,58,237,.6)] ${
          state === "loading" ? "animate-[qnav_8s_cubic-bezier(.08,.8,.2,1)_forwards] opacity-100"
          : state === "done" ? "scale-x-100 opacity-0 transition-[transform,opacity] duration-300"
          : "scale-x-0 opacity-0"}`}
      />
      <style>{`@keyframes qnav { 0% { transform: scaleX(0) } 10% { transform: scaleX(.35) } 100% { transform: scaleX(.92) } }`}</style>
    </div>
  );
}

/** Spinner shown inside a <Link> while its page is loading (Next's useLinkStatus). */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden="true" className={`ml-auto h-3.5 w-3.5 shrink-0 rounded-full border-2 border-violet-200 border-t-violet-600 transition-opacity ${pending ? "animate-spin opacity-100" : "opacity-0"} ${className}`} />
  );
}
