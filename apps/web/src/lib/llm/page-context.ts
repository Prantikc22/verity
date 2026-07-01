/**
 * Fetches a URL and extracts a compact, accessibility-tree-style summary of the
 * page's interactive elements, so the LLM generates locators from what's ACTUALLY
 * on the page (roles, names, labels) instead of guessing from the URL string.
 *
 * This is a server-side HTTP fetch + HTML parse — fast and cheap, and good for
 * server-rendered pages. For heavily client-rendered SPAs the static HTML can be
 * sparse; we detect that and tell the model so it falls back to robust, generic
 * role-based locators rather than inventing brittle ones.
 */

export interface PageContext {
  url: string;
  title: string;
  /** Human-readable summary fed to the LLM. */
  summary: string;
  /** True when the static HTML had almost no interactive elements (likely an SPA). */
  likelyClientRendered: boolean;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? decode(m[1]) : null;
}

function uniq(arr: string[], cap: number): string[] {
  return [...new Set(arr.filter(Boolean))].slice(0, cap);
}

/** Fetch + extract. Never throws — returns null on failure so generation degrades. */
export async function fetchPageContext(url: string): Promise<PageContext | null> {
  let html: string;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "VerityBot/1.0 (+https://verity.qashift.com)", accept: "text/html" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    html = (await res.text()).slice(0, 600_000);
  } catch {
    return null;
  }
  return extractPageContext(html, url);
}

/**
 * Extract page context from ALREADY-FETCHED HTML. Used when the fetch must happen
 * somewhere our server can't reach — notably the MCP server running on the user's
 * machine, which fetches their localhost and sends us the HTML. Never throws.
 */
export function extractPageContext(rawHtml: string, url: string): PageContext | null {
  const html = (rawHtml ?? "").slice(0, 600_000);
  if (!html) return null;

  // Strip scripts/styles so their contents don't pollute text extraction.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const title = decode((cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")) || url;

  const headings = uniq(
    [...cleaned.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, " "))),
    10,
  );

  // Buttons: <button>text</button>, role="button", and submit/button inputs.
  const buttons = uniq(
    [
      ...[...cleaned.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map((m) => {
        const aria = attr(m[0], "aria-label");
        return aria || decode(m[1].replace(/<[^>]+>/g, " "));
      }),
      ...[...cleaned.matchAll(/<input[^>]*type=["'](?:submit|button)["'][^>]*>/gi)].map(
        (m) => attr(m[0], "value") || attr(m[0], "aria-label") || "",
      ),
      ...[...cleaned.matchAll(/<[^>]*role=["']button["'][^>]*>([\s\S]*?)<\//gi)].map(
        (m) => attr(m[0], "aria-label") || decode(m[1].replace(/<[^>]+>/g, " ")),
      ),
    ],
    15,
  );

  // Links (nav targets).
  const links = uniq(
    [...cleaned.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, " "))),
    15,
  ).filter((t) => t.length > 0 && t.length < 40);

  // Inputs with their best accessible name.
  const inputs = uniq(
    [...cleaned.matchAll(/<(input|textarea|select)[^>]*>/gi)].map((m) => {
      const tag = m[0];
      const type = attr(tag, "type") ?? (m[1].toLowerCase() === "input" ? "text" : m[1].toLowerCase());
      const name = attr(tag, "aria-label") || attr(tag, "placeholder") || attr(tag, "name") || attr(tag, "id");
      return name ? `${name} (${type})` : "";
    }),
    15,
  );

  // Labels (often the accessible name for inputs).
  const labels = uniq(
    [...cleaned.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, " "))),
    12,
  );

  // Visible body text excerpt — captures on-page instructions and DISPLAYED test
  // credentials (e.g. "Username: student  Password: Password123" on demo sites)
  // so the model can use real values instead of env-var placeholders.
  const visibleText = decode(
    cleaned
      .replace(/<(nav|header|footer|svg|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).slice(0, 1200);

  const interactiveCount = buttons.length + inputs.length + links.length;
  const likelyClientRendered = interactiveCount < 3;

  const parts: string[] = [`URL: ${url}`, `Title: ${title}`];
  if (headings.length) parts.push(`Headings: ${headings.join(" | ")}`);
  if (buttons.length) parts.push(`Buttons: ${buttons.join(" | ")}`);
  if (inputs.length) parts.push(`Inputs: ${inputs.join(" | ")}`);
  if (labels.length) parts.push(`Labels: ${labels.join(" | ")}`);
  if (links.length) parts.push(`Links: ${links.join(" | ")}`);
  if (visibleText.length > 40) parts.push(`Visible text (may include test credentials/instructions): ${visibleText}`);
  if (likelyClientRendered) {
    parts.push(
      "NOTE: the static HTML exposed few interactive elements — this page is likely client-rendered (SPA). " +
        "Use robust role/text locators based on the described flow; do not invent selectors you cannot justify.",
    );
  }

  return { url, title, summary: parts.join("\n"), likelyClientRendered };
}
