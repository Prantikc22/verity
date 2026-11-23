import { cookies } from "next/headers";

/**
 * QAShift 2.0 workspace shell rollout.
 *   QASHIFT_SHELL=on       everyone gets the new shell
 *   QASHIFT_SHELL=off      nobody (kill switch, ignores the cookie)
 *   unset (default)        opt-in per browser via the `qs_shell=1` cookie,
 *                          set by /api/shell-preview?on=1
 */
export const SHELL_COOKIE = "qs_shell";

export async function qashiftShellEnabled(): Promise<boolean> {
  const mode = process.env.QASHIFT_SHELL;
  if (mode === "on") return true;
  if (mode === "off") return false;
  return (await cookies()).get(SHELL_COOKIE)?.value === "1";
}
