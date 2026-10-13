/** Canonical public origin of the marketing site (prod sets NEXT_PUBLIC_APP_URL). */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://verity.qashifthq.com").replace(/\/$/, "");
