import { cookies } from "next/headers";

/**
 * QAShift 2.0 workspace shell rollout.
 *   QASHIFT_SHELL=on       everyone gets the new shell
 *   QASHIFT_SHELL=off      nobody (kill switch, ignores the cookie)
 *   unset (default)        on, unless this browser opted out with qs_shell=0
 *                          (/api/shell-preview?on=0)
 */
export const SHELL_COOKIE = "qs_shell";

export async function qashiftShellEnabled(): Promise<boolean> {
  const mode = process.env.QASHIFT_SHELL;
  if (mode === "on") return true;
  if (mode === "off") return false;
  // Default ON. A browser can still opt back to the classic layout (qs_shell=0) while it exists.
  return (await cookies()).get(SHELL_COOKIE)?.value !== "0";
}
