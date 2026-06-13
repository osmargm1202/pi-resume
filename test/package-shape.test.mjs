import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("package ships orgm resume commands", () => {
  assert.equal(pkg.name, "pi-resume");
  assert.deepEqual(pkg.pi.extensions, ["./extensions/resume.ts"]);
  assert.ok(pkg.peerDependencies["@earendil-works/pi-coding-agent"]);
  assert.ok(pkg.peerDependencies["@earendil-works/pi-tui"]);
  assert.ok(existsSync("extensions/resume.ts"));
  const source = readFileSync("extensions/resume.ts", "utf8");
  assert.match(source, /registerCommand\("orgm-resume"/);
  assert.match(source, /RESUME\.md/);
  assert.match(source, /registerCommand\("orgm-session-resume"/);
  assert.doesNotMatch(source, /registerCommand\("(?!orgm-)/);
});
