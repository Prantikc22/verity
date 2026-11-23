import { createAdminClient } from "@/lib/supabase/admin";
import { preferReportsMode, setWorkspaceMode } from "@/lib/workspace";
import { PRODUCT_COLUMN, type QsProduct } from "./qs-plans";

/** Apply (or clear) a QAShift 2.0 plan on the org after a subscription changes state. Service role only. */
export async function applyQsPlan(orgId: string, product: QsProduct, planKey: string | null) {
  const admin = createAdminClient();
  const column = PRODUCT_COLUMN[product];
  await admin.from("orgs").update({ [column]: planKey } as never).eq("id", orgId);

  // Keep the navigation matching what they bought: a Reports-only purchase gets
  // the focused Reports workspace (unless they already use the agents); buying
  // agents or managed QA always shows the full workspace.
  if (!planKey) return;
  if (product === "reports") await preferReportsMode(orgId);
  else await setWorkspaceMode(orgId, "full");
}
