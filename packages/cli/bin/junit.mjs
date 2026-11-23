/** Minimal, dependency-free JUnit XML parser for `verity upload`. */
const unescapeXml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`));
  return m ? unescapeXml(m[2] ?? m[3] ?? "") : undefined;
}
/** Parse JUnit XML (Playwright, Jest, pytest, JUnit, Cypress, Go…) into ingest results. */
export function parseJUnit(xml) {
  const out = new Map();
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const tag = m[1];
    const body = m[3] ?? "";
    if (/<skipped\b/.test(body)) continue;
    const name = attr(tag, "name") ?? "unnamed";
    const file = attr(tag, "file") ?? attr(tag, "classname") ?? "junit";
    const failed = /<(failure|error)\b/.test(body);
    const fm = body.match(/<(failure|error)\b([^>]*)>?([\s\S]*?)(<\/(failure|error)>|$)/);
    const message = failed ? (attr(fm?.[2] ?? "", "message") || unescapeXml((fm?.[3] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "")).trim().split("\n")[0] || "failed") : null;
    const time = Number(attr(tag, "time"));
    const key = `${file}::${name}`;
    // Retries show up as repeated testcases: collect them as attempts of one test.
    const prev = out.get(key);
    if (prev) { prev.attempts.push(!failed); if (failed) prev.error_message = message; continue; }
    out.set(key, {
      spec_path: file,
      name,
      attempts: [!failed],
      duration_ms: Number.isFinite(time) ? Math.round(time * 1000) : undefined,
      error_message: message,
    });
  }
  return [...out.values()];
}
