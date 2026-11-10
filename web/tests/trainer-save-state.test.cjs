const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  path = require("path"),
  Module = require("module"),
  ts = require("typescript");
const file = path.resolve(__dirname, "../lib/trainer-save-state.ts"),
  mod = new Module(file, module);
mod._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  file,
);
const { planningSaveState: state } = mod.exports;
test("saved draft communicates saved state without claiming publication", () =>
  assert.equal(state({ dirty: false, published: false }).phase, "saved"));
test("new draft is unsaved until persistence succeeds", () =>
  assert.equal(state({ dirty: true, published: false }).phase, "unsaved"));
test("clean published source is distinct from an unpublished draft", () =>
  assert.equal(state({ dirty: false, published: true }).phase, "published"));
test("edits to a published source explicitly require updated publication", () =>
  assert.equal(state({ dirty: true, published: true }).phase, "unpublished"));
test("pending save takes precedence over old failure; only response clears saving", () =>
  assert.equal(
    state({
      dirty: true,
      published: true,
      operation: "publish",
      failure: { operation: "publish", message: "offline" },
    }).phase,
    "saving",
  ));
test("failed save remains failed with dirty data and identifies the retry operation", () => {
  const input = {
    dirty: true,
    published: true,
    failure: { operation: "publish", message: "offline" },
  };
  assert.equal(state(input).phase, "failed");
  assert.equal(input.failure.operation, "publish");
  assert(input.dirty);
});
