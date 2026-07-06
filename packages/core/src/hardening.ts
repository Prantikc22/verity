/**
 * Deterministic safety net for generated Playwright specs. These are pure string
 * transforms (no LLM) that fix the brittle patterns we see most often, so a spec
 * is hardened the moment it's generated AND again right before it runs. The AI
 * heal pass handles the cases these can't.
 */

/** Escape a string for use inside a RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turn a hardcoded `toHaveURL('http://host/path')` into a protocol- and
 * trailing-slash-agnostic regex on a stable path/host substring. This kills the
 * classic "expected http:// but got https://" false failure.
 */
function relaxUrlAssertions(code: string): string {
  // toHaveURL('...') or toHaveURL("...") with a string literal that looks like a URL.
  return code.replace(
    /toHaveURL\(\s*(['"`])(https?:\/\/[^'"`]+)\1\s*\)/g,
    (_m, _q, url: string) => {
      try {
        const u = new URL(url);
        // Prefer a distinctive path segment; fall back to host.
        const seg = u.pathname.split("/").filter(Boolean).pop();
        const needle = seg && seg.length >= 3 ? seg : u.hostname;
        return `toHaveURL(/${escapeRe(needle)}/i)`;
      } catch {
        return `toHaveURL(/${escapeRe(url.replace(/^https?:\/\//, ""))}/i)`;
      }
    },
  );
}

/** Rewrite bare `locator('text=Foo')` / `locator("text=Foo")` to `getByText('Foo')`. */
function killBareTextLocators(code: string): string {
  return code.replace(
    /\.locator\(\s*(['"`])text=([^'"`]+)\1\s*\)/g,
    (_m, _q, txt: string) => `.getByText(${JSON.stringify(txt)})`,
  );
}

/**
 * Container roles like `listitem`/`list` do NOT derive an accessible name from
 * their child text, so `getByRole('listitem', { name: 'Buy milk' })` matches
 * nothing — a very common AI mistake for list/todo UIs. Rewrite it to filter by
 * visible text instead, which is what the author actually meant.
 */
function relaxContainerRoleNames(code: string): string {
  return code.replace(
    /getByRole\(\s*(['"`])(listitem|list)\1\s*,\s*\{\s*name:\s*([^}]+?)\s*\}\s*\)/g,
    (_m, _q, role: string, name: string) => `getByRole(${JSON.stringify(role)}).filter({ hasText: ${name.trim()} })`,
  );
}

/**
 * Append `.first()` to every getByText/getByRole locator that isn't already
 * disambiguated — the fix for strict-mode "resolved to N elements" violations.
 * Works whether the locator is the whole argument to expect(...) (followed by
 * `)`) or chained into an action (followed by `.click()` etc.). Idempotent: once
 * a call ends in .first()/.nth()/… it's skipped. The args group tolerates one
 * level of nested parens (enough for our generated option objects).
 */
function disambiguate(code: string): string {
  const re = /\b(getByText|getByRole)\(((?:[^()]|\([^()]*\))*)\)(?!\s*\.(?:first|nth|last|filter|or|and|count)\b)/g;
  return code
    .split("\n")
    .map((line) => {
      // Skip locators STORED in a variable — they're often reused for counting
      // (.toHaveCount), iteration, or .nth(), where a forced .first() breaks the
      // assertion. Only inline locators (inside expect(...) / chained to an
      // action) get auto-disambiguated.
      const isAssignment = /(?:\b(?:const|let|var)\b[^=]*|^\s*[A-Za-z_$][\w$.]*\s*)=\s*(?:await\s+)?[\w$.]*\bgetBy(?:Text|Role)\(/.test(line);
      return isAssignment ? line : line.replace(re, (_m, fn: string, args: string) => `${fn}(${args}).first()`);
    })
    .join("\n");
}

/** Apply all deterministic hardening transforms to a generated/stored spec. */
export function hardenSpec(code: string): string {
  if (!code) return code;
  let out = code;
  out = killBareTextLocators(out);
  out = relaxContainerRoleNames(out);
  out = relaxUrlAssertions(out);
  out = disambiguate(out);
  return out;
}

/**
 * Translate a raw Playwright error into ONE plain-English sentence a non-engineer
 * can act on. Falls back to a trimmed version of the original.
 */
export function explainPlaywrightError(raw: string | null | undefined): string {
  if (!raw) return "The test failed for an unknown reason.";
  const e = raw.replace(/\[[0-9;]*m/g, ""); // strip ANSI

  if (/strict mode violation/i.test(e)) {
    const m = e.match(/resolved to (\d+) elements/i);
    const what = e.match(/locator\(([^)]+)\)/);
    return `The page has ${m ? m[1] : "multiple"} elements matching ${what ? what[1].replace(/['"]/g, "") : "that locator"}, so the test couldn't tell which one to use. Fix: target a single one (e.g. .first() or a unique container).`;
  }
  if (/toHaveURL/i.test(e)) {
    const exp = e.match(/Expected string:\s*"([^"]+)"/);
    const got = e.match(/Received string:\s*"([^"]+)"/);
    if (exp && got) return `The page's address was "${got[1]}" but the test expected "${exp[1]}" (often just http vs https or a trailing slash).`;
    return "The page ended up at a different URL than the test expected.";
  }
  if (/toBeVisible/i.test(e) && /not found|<element\(s\) not found>/i.test(e)) {
    const loc = e.match(/Locator:\s*(.+)/);
    return `The test expected an element to be visible but it was never found${loc ? ` (${loc[1].trim()})` : ""}. The page may use a different label or element type.`;
  }
  if (/toBeVisible/i.test(e) && /Timed out/i.test(e)) {
    return "An element the test waited for didn't appear in time — it may be slow to load or named differently.";
  }
  if (/Timed out.*waiting for|exceeded.*timeout/i.test(e)) {
    return "The test timed out waiting for something on the page (slow load or a missing element).";
  }
  if (/net::ERR|ERR_CONNECTION|NS_ERROR|getaddrinfo|ECONNREFUSED/i.test(e)) {
    return "The browser couldn't reach the page — the URL may be down, blocked, or wrong.";
  }
  if (/toHaveText|toContainText/i.test(e)) {
    const exp = e.match(/Expected (?:string|pattern):\s*(.+)/);
    return `The text on the page didn't match what the test expected${exp ? `: ${exp[1].trim()}` : "."}`;
  }
  // Fallback: first meaningful line.
  const firstLine = e.split("\n").map((l) => l.trim()).find(Boolean) ?? e;
  return firstLine.slice(0, 240);
}
