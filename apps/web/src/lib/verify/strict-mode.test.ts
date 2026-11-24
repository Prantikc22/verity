import { test } from "node:test";
import assert from "node:assert/strict";
import { fixStrictModeLocator } from "./strict-mode";

const ERR = `Error: locator.click: Error: strict mode violation: getByRole('link', { name: 'Pricing' }) resolved to 2 elements:
    1) <a href="/pricing">Pricing</a> aka getByRole('navigation').getByRole('link', { name: 'Pricing' })
    2) <a href="/pricing">Pricing</a> aka getByRole('contentinfo').getByRole('link', { name: 'Pricing' })`;

test("scopes an ambiguous locator to Playwright's first unambiguous suggestion", () => {
  const spec = `await page.getByRole('link', { name: 'Pricing' }).click();`;
  assert.equal(fixStrictModeLocator(spec, ERR), `await page.getByRole('navigation').getByRole('link', { name: 'Pricing' }).click();`);
});

test("handles double quotes in the spec", () => {
  const spec = `await page.getByRole("link", { name: "Pricing" }).click();`;
  assert.match(fixStrictModeLocator(spec, ERR) ?? "", /getByRole\('navigation'\)/);
});

test("returns null for other errors or when the locator isn't in the spec", () => {
  assert.equal(fixStrictModeLocator("x", "Timeout 5000ms exceeded"), null);
  assert.equal(fixStrictModeLocator(`await page.getByText('Other').click();`, ERR), null);
});
