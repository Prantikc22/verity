/**
 * Fetches a URL and extracts a compact, accessibility-tree-style summary of the
 * page's interactive elements, so the LLM generates locators from what's ACTUALLY
 * on the page (roles, names, labels) instead of guessing from the URL string.
 *
 * The runner opens the page in a real browser before HTML extraction. Failed
 * browser capture is a blocking error, not permission to invent locators.
 */

export interface PageContext {
  url: string;
  title: string;
  /** Human-readable summary fed to the LLM. */
  summary: string;
  /** True when the static HTML had almost no interactive elements (likely an SPA). */
  likelyClientRendered: boolean;
}

export interface PageCredentials {
  username?: string;
  password?: string;
}

interface RenderedPage {
  context: PageContext;
  entryContext?: PageContext;
  finalUrl: string;
  authAttempted: boolean;
  authSucceeded: boolean;
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

/**
 * Render the page in a REAL browser on the Fly runner and extract from the
 * post-JS DOM — this is the only way to see client-rendered (SPA) content.
 * Returns null when the runner isn't configured or the render fails.
 */
async function fetchRenderedContext(url: string, credentials?: PageCredentials): Promise<RenderedPage | null> {
  const runnerUrl = process.env.RUNNER_SERVICE_URL;
  const runnerToken = process.env.RUNNER_SERVICE_TOKEN;
  if (!runnerUrl || !runnerToken) return null;
  try {
    const res = await fetch(`${runnerUrl.replace(/\/$/, "")}/context`, {
      method: "POST",
      signal: AbortSignal.timeout(45000),
      headers: { "content-type": "application/json", authorization: `Bearer ${runnerToken}` },
      body: JSON.stringify({ url, credentials }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      html?: string;
      entryHtml?: string;
      finalUrl?: string;
      authAttempted?: boolean;
      authSucceeded?: boolean;
    };
    if (!data?.ok || !data.html) return null;
    const finalUrl = data.finalUrl || url;
    const context = extractPageContext(data.html, finalUrl);
    if (!context) return null;
    const entryContext = data.entryHtml ? extractPageContext(data.entryHtml, url) ?? undefined : undefined;
    return {
      context,
      entryContext,
      finalUrl,
      authAttempted: Boolean(data.authAttempted),
      authSucceeded: Boolean(data.authSucceeded),
    };
  } catch {
    return null;
  }
}

/**
 * Capture the rendered target in a real browser. Fail closed if inspection or
 * supplied authentication fails; never substitute static HTML for live evidence.
 */
export async function fetchPageContext(url: string, credentials?: PageCredentials): Promise<PageContext | null> {
  const rendered = await fetchRenderedContext(url, credentials);
  if (!rendered) throw new Error("Live browser inspection failed. No tests were generated from guessed or static page content. Check the cloud runner and retry.");

  const hasCredentials = Boolean(credentials?.username || credentials?.password);
  if (!hasCredentials) return rendered.context;

  if (rendered.authSucceeded) {
    const entry = rendered.entryContext?.summary ?? `URL: ${url}`;
    return {
      ...rendered.context,
      url,
      summary:
        `ENTRY PAGE CONTEXT (before sign-in):\n${entry}\n\n` +
        `AUTHENTICATED PAGE CONTEXT (the Fly browser signed in successfully; final URL: ${rendered.finalUrl}):\n` +
        rendered.context.summary,
      likelyClientRendered: false,
    };
  }

  throw new Error("The browser could not confirm sign-in with the supplied credentials. Verify the login URL and credentials before generating protected flows.");
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
    24,
  );

  // Links (nav targets) WITH their href — so the model knows whether a nav item is
  // an in-page anchor (#section) or a real route (/path). Without this the model
  // guesses, which is the #1 cause of brittle toHaveURL assertions.
  const links = uniq(
    [...cleaned.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => {
      const text = decode(m[1].replace(/<[^>]+>/g, " "));
      if (!text || text.length >= 40) return "";
      const href = attr(m[0], "href");
      return href ? `${text} -> ${href}` : text;
    }),
    25,
  ).filter(Boolean);

  // Inputs with their best accessible name.
  const inputs = uniq(
    [...cleaned.matchAll(/<(input|textarea|select)[^>]*>/gi)].map((m) => {
      const tag = m[0];
      const type = attr(tag, "type") ?? (m[1].toLowerCase() === "input" ? "text" : m[1].toLowerCase());
      const aria = attr(tag, "aria-label");
      const placeholder = attr(tag, "placeholder");
      const name = attr(tag, "name");
      const id = attr(tag, "id");
      if (aria) return `aria-label=${JSON.stringify(aria)} (${type})`;
      if (placeholder) return `placeholder=${JSON.stringify(placeholder)} (${type})`;
      if (name) return `name=${JSON.stringify(name)} (${type}; no accessible label confirmed)`;
      if (id) return `id=${JSON.stringify(id)} (${type}; no accessible label confirmed)`;
      return "";
    }),
    20,
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
  // Keep enough product copy to capture validation/error examples and demo test
  // instructions. 1,200 chars routinely cut off the second/third negative case,
  // which invited the model to guess a sibling error message.
  ).slice(0, 5000);

  const interactiveCount = buttons.length + inputs.length + links.length;
  const likelyClientRendered = interactiveCount < 3;

  const parts: string[] = [`URL: ${url}`, `Title: ${title}`];
  if (headings.length) parts.push(`Headings: ${headings.join(" | ")}`);
  if (buttons.length) parts.push(`Buttons: ${buttons.join(" | ")}`);
  if (inputs.length) parts.push(`Inputs: ${inputs.join(" | ")}`);
  if (labels.length) parts.push(`Labels: ${labels.join(" | ")}`);
  if (links.length) parts.push(`Links (name -> href; an href starting with "#" is an IN-PAGE anchor, NOT a route — do not assert a URL change for it): ${links.join(" | ")}`);
  if (visibleText.length > 40) parts.push(`Visible text (may include test credentials/instructions): ${visibleText}`);
  if (likelyClientRendered) {
    parts.push(
      "NOTE: this capture exposed few interactive elements. Only use elements present in the evidence. " +
        "Do not infer controls or flows from the description alone.",
    );
  }

  return { url, title, summary: parts.join("\n"), likelyClientRendered };
}
