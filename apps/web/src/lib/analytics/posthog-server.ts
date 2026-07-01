import { PostHog } from "posthog-node";
import type { FunnelEvent } from "./events";

let client: PostHog | null = null;

/** Server-side PostHog singleton. No-op if the key is not configured. */
function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/** Capture a funnel event from server code (route handlers, server actions). */
export async function captureServer(
  distinctId: string,
  event: FunnelEvent,
  properties?: Record<string, unknown>,
): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  ph.capture({ distinctId, event, properties });
  await ph.flush();
}
