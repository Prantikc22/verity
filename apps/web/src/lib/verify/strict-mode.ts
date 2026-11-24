/**
 * Deterministic fix for Playwright "strict mode violation" failures: a locator
 * matched several elements (e.g. the same "Pricing" link in the header and the
 * footer). Playwright's own error lists an unambiguous locator for each match
 * ("aka …"); we swap the ambiguous one for the first suggestion. The caller must
 * re-run the test and keep the change only if it then passes.
 */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function fixStrictModeLocator(spec: string, error: string | null | undefined): string | null {
  if (!error) return null;
  const amb = error.match(/strict mode violation: (.+?) resolved to \d+ elements/)?.[1]?.trim();
  const aka = error.match(/^\s*1\) .*? aka (.+)$/m)?.[1]?.trim();
  if (!amb || !aka || amb === aka) return null;
  // Playwright prints single quotes; the spec may use either. Tolerate spacing too.
  const pattern = esc(amb).replace(/'/g, `["'\`]`).replace(/\s+/g, "\\s*");
  const re = new RegExp(`page\\.${pattern}`, "g");
  if (!re.test(spec)) return null;
  return spec.replace(re, `page.${aka}`);
}
