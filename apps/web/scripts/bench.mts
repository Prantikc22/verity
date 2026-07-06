/** Temp reliability benchmark: generate via LLM (no browser), execute on Fly. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const S = "/private/tmp/claude-502/-Users-prantik-Desktop-Verity/8d959394-4823-4374-bd7d-4c98c184950b/scratchpad";
for (const f of [new URL("../.env.local", import.meta.url).pathname, `${S}/runner.env`]) {
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const { generateTest } = await import("../src/lib/llm/generate.ts");

interface Case { base: string; file: string; flow: string }
const CASES: Case[] = [
  { base: "https://the-internet.herokuapp.com/login", file: "login-success", flow: "Log in with username 'tomsmith' and password 'SuperSecretPassword!' and verify the success confirmation appears." },
  { base: "https://the-internet.herokuapp.com/login", file: "login-fail", flow: "Try to log in with username 'wrong' and password 'wrong' and verify an error message is shown and you are not logged in." },
  { base: "https://www.saucedemo.com/", file: "saucedemo-login", flow: "Log in with username 'standard_user' and password 'secret_sauce' and verify the products/inventory page is shown." },
  { base: "https://www.saucedemo.com/", file: "saucedemo-cart", flow: "Log in with username 'standard_user' and password 'secret_sauce', add 'Sauce Labs Backpack' to the cart, and verify the cart badge shows 1." },
  { base: "https://demo.playwright.dev/todomvc", file: "todo-add", flow: "Add three todo items 'Buy milk', 'Walk dog', 'Write report' and verify all three appear in the list." },
  { base: "https://demo.playwright.dev/todomvc", file: "todo-complete", flow: "Add a todo 'Buy milk', mark it completed via its checkbox, and verify it is shown as completed." },
  { base: "https://the-internet.herokuapp.com/add_remove_elements/", file: "add-elements", flow: "Click the 'Add Element' button twice and verify two 'Delete' buttons appear." },
  { base: "https://the-internet.herokuapp.com/add_remove_elements/", file: "add-delete", flow: "Click 'Add Element' three times, then click one 'Delete' button, and verify two 'Delete' buttons remain." },
];

mkdirSync(`${S}/specs`, { recursive: true });
const gen: { c: Case; spec: string }[] = [];
for (const c of CASES) {
  process.stdout.write(`gen ${c.file}… `);
  const res = await generateTest({ input: c.flow, isUrl: false, baseUrl: c.base });
  writeFileSync(`${S}/specs/${c.file}.spec.ts`, res.specContent);
  gen.push({ c, spec: res.specContent });
  console.log(`ok (${res.assertionCount} assertions)`);
}

const RUNNER = process.env.RUNNER_SERVICE_URL, RTOKEN = process.env.RUNNER_SERVICE_TOKEN;
if (!RUNNER || !RTOKEN) { console.log("no runner creds"); process.exit(1); }
console.log(`\nExecuting on Fly runner…`);
const bySite = new Map<string, typeof gen>();
for (const g of gen) (bySite.get(g.c.base) ?? bySite.set(g.c.base, []).get(g.c.base)!).push(g);
let pass = 0, total = 0;
const rows: string[] = [];
for (const [base, group] of bySite) {
  const tests = group.map((g) => ({ spec_path: `tests/${g.c.file}.spec.ts`, spec_content: g.spec }));
  const r = await fetch(`${RUNNER.replace(/\/$/, "")}/run`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${RTOKEN}` },
    body: JSON.stringify({ tests, baseURL: base, reruns: 2 }),
  });
  const data = await r.json() as { ok?: boolean; results?: { name: string; status: string; error?: string }[]; error?: string };
  if (!data.ok) { rows.push(`  [ERR] ${base} → ${data.error}`); continue; }
  for (const res of data.results ?? []) {
    total++; const ok = res.status === "passed" || res.status === "expected"; if (ok) pass++;
    rows.push(`  [${ok ? "PASS" : "FAIL"}] ${res.name}${ok ? "" : ` — ${(res.error ?? "").replace(/\x1b\[[0-9;]*m/g, "").split("\n").find((l) => /Error|expect|Timed/.test(l))?.trim().slice(0, 130) ?? ""}`}`);
  }
}
console.log(rows.join("\n"));
console.log(`\n=== EXECUTED PASS RATE (first-shot on Fly, flake-retry ×2, NO LLM heal): ${pass}/${total} = ${total ? Math.round((pass / total) * 100) : 0}% ===`);
