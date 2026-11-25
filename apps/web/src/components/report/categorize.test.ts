import { test } from "node:test";
import assert from "node:assert/strict";
import { categorize } from "./RunInsights";

test("failure categories match real Playwright errors", () => {
  assert.equal(categorize("Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/"), "network");
  assert.equal(categorize("Error: expect.toBeVisible: Error: strict mode violation: getByText('x') resolved to 2 elements"), "locator");
  assert.equal(categorize("Test timeout of 30000ms exceeded."), "timeout");
  assert.equal(categorize("Error: expect(received).toHaveText(expected)\nExpected: \"Total: $40\""), "assertion");
  assert.equal(categorize("TypeError: Cannot read properties of undefined (reading 'id')"), "crash");
  assert.equal(categorize(null), "other");
  assert.equal(categorize("something odd"), "other");
});
