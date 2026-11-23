import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCT_COLUMN, type QsProduct } from "./qs-plans";

/** Apply (or clear) a QAShift 2.0 plan on the org after a subscription changes state. Service role only. */
export async function applyQsPlan(orgId: string, product: QsProduct, planKey: string | null) {
  const admin = createAdminClient();
  const column = PRODUCT_COLUMN[product];
  await admin.from("orgs").update({ [column]: planKey } as never).eq("id", orgId);
}
