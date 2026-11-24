/** Plain-English one-liner for a browser test failure, for people who don't read stack traces. */
export function explainFailure(error: string | null | undefined): string {
  const e = error ?? "";
  if (/strict mode violation/i.test(e)) return "A step matched more than one element on the page, and the automatic fix didn't make the test pass.";
  if (/net::ERR_|ECONNREFUSED|ENOTFOUND|getaddrinfo/i.test(e)) return "The site couldn't be reached from our browser.";
  if (/toHaveURL/i.test(e)) return "The page ended up at a different address than the test expected.";
  if (/toHaveText|toContainText|toHaveValue/i.test(e)) return "The text on the page was different from what the test expected.";
  if (/toBeVisible|toBeAttached|to be visible/i.test(e)) return "Something the test checks for wasn't visible on the page.";
  if (/Timeout|exceeded/i.test(e)) return "An element the test waits for never appeared in time.";
  if (/SyntaxError|ReferenceError|TypeError/.test(e)) return "The generated test code has an error.";
  return "The test failed when we ran it in a real browser.";
}
