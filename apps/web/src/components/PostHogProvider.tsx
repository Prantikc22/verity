"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Initializes PostHog on the client for autocapture + pageviews. Funnel events
 * are captured explicitly at each surface (see lib/analytics/events.ts).
 * No-op when the key is absent so local/dev builds don't error.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || typeof window === "undefined") return;
    try {
      if (localStorage.getItem("verity-cookie-consent") === "essential") return;
    } catch {
      /* ignore */
    }
    if (posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      person_profiles: "identified_only",
    });
  }, []);

  return <>{children}</>;
}
