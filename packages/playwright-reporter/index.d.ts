import type { Reporter } from "@playwright/test/reporter";
export interface QAShiftReporterOptions {
  /** Project token. Defaults to the QASHIFT_TOKEN environment variable. */
  token?: string;
  /** Defaults to https://verity.qashifthq.com (or QASHIFT_API_URL). */
  apiUrl?: string;
  /** "full" (default) or "fast". */
  tier?: "full" | "fast";
  /** Suppress the summary line. */
  silent?: boolean;
}
export default class QAShiftReporter implements Reporter {
  constructor(options?: QAShiftReporterOptions);
}
