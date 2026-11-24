/** A readable test name from free text: first sentence, cut at a word boundary, max 60 chars. */
export function testName(text: string, max = 60): string {
  const s = text.trim().replace(/\s+/g, " ").split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > 30 ? cut.slice(0, at) : cut).replace(/[,;:\-–]+$/, "")}…`;
}
