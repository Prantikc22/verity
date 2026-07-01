import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function verifySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface InstallationEvent {
  action?: string;
  installation?: {
    id: number;
    account?: { login?: string; type?: string };
    target_type?: string;
  };
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifySignature(raw, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  const payload = JSON.parse(raw) as InstallationEvent;
  const admin = createAdminClient();

  if (event === "installation" && payload.installation) {
    const inst = payload.installation;
    const action = payload.action;

    if (action === "deleted") {
      await admin.from("projects").update({ github_installation_id: null }).eq("github_installation_id", inst.id);
      await admin.from("github_installations").delete().eq("installation_id", inst.id);
    } else if (action === "suspend" || action === "unsuspend") {
      await admin
        .from("github_installations")
        .update({ suspended: action === "suspend" })
        .eq("installation_id", inst.id);
    } else {
      await admin.from("github_installations").upsert(
        {
          installation_id: inst.id,
          account_login: inst.account?.login ?? "unknown",
          account_type: inst.account?.type ?? null,
          target_type: inst.target_type ?? null,
          suspended: false,
        },
        { onConflict: "installation_id" },
      );
    }
  }

  // pull_request / push / check_run.rerequested are acknowledged. Actual test
  // runs are driven from the customer's CI (Path B), which posts to /api/ingest.
  return NextResponse.json({ ok: true });
}
