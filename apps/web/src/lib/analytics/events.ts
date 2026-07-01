/**
 * Canonical PLG funnel events. Wire these as each surface is built, not at the end.
 * Drop-off between consecutive steps is the core growth metric for Verity.
 *
 *   test_generated → signup → github_connected → project_created
 *     → first_ci_run → upgrade_initiated → subscription_active
 */
export const FUNNEL_EVENTS = {
  testGenerated: "test_generated",
  signup: "signup",
  githubConnected: "github_connected",
  projectCreated: "project_created",
  firstCiRun: "first_ci_run",
  healingSuggested: "healing_suggested",
  upgradeInitiated: "upgrade_initiated",
  subscriptionActive: "subscription_active",
} as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];
