"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-neutral-500 transition hover:bg-neutral-900/[0.05] hover:text-neutral-900 dark:hover:bg-white/10 dark:hover:text-white">
      Sign out
    </button>
  );
}
