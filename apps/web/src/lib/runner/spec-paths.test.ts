import { test } from "node:test";
import assert from "node:assert/strict";
import { uniqueRunnerPaths } from "./spec-paths";

const VALID = /^[\w./-]+\.spec\.[cm]?[jt]s$/;

test("duplicates get numbered, first copy keeps its path", () => {
  const out = uniqueRunnerPaths([
    { name: "Login", spec_path: "tests/login.spec.ts" },
    { name: "Login", spec_path: "tests/login.spec.ts" },
    { name: "Login", spec_path: "tests/login.spec.ts" },
    { name: "Other", spec_path: "tests/login-2.spec.ts" },
  ]);
  assert.deepEqual(out.slice(0, 3).map((t) => t.spec_path), ["tests/login.spec.ts", "tests/login-2.spec.ts", "tests/login-3.spec.ts"]);
  // A real file already named login-2 must not collide with a renamed copy.
  assert.equal(new Set(out.map((t) => t.spec_path)).size, 4);
});

test("unsafe or invalid paths become safe relative spec files", () => {
  const out = uniqueRunnerPaths([
    { name: "Abs", spec_path: "/etc/passwd.spec.ts" },
    { name: "Trav", spec_path: "../../x.spec.ts" },
    { name: "No ext!", spec_path: "tests/thing.ts" },
    { name: "Empty", spec_path: "" },
  ]);
  for (const t of out) {
    assert.match(t.spec_path, VALID);
    assert.ok(!t.spec_path.startsWith("/") && !t.spec_path.split("/").includes(".."));
  }
  assert.equal(new Set(out.map((t) => t.spec_path)).size, out.length);
});

test("valid unique paths are untouched (same object)", () => {
  const a = { name: "A", spec_path: "tests/ui/a.spec.ts" };
  const b = { name: "B", spec_path: "tests/api/a.spec.ts" };
  const out = uniqueRunnerPaths([a, b]);
  assert.equal(out[0], a); assert.equal(out[1], b);
});
