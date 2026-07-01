import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureOrgForCurrentUser } from "@/lib/auth";
import { captureServer } from "@/lib/analytics/posthog-server";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";

/**
 * OAuth / magic-link callback. Exchanges the auth code for a session, then
 * provisions a default org on first login (firing the `signup` funnel event).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=auth`);

  const result = await ensureOrgForCurrentUser();
  if (result?.created) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await captureServer(user.id, FUNNEL_EVENTS.signup, {
        org_id: result.orgId,
        provider: user.app_metadata?.provider,
      });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
