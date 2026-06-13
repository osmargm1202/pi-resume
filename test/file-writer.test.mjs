import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeManagedMarkdown } from "../extensions/lib/file-writer.ts";

test("writeManagedMarkdown preserves dangling begin marker content before appended managed section", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-resume-writer-"));
  const file = join(dir, "AGENTS.md");
  try {
    await writeFile(file, "<!-- ORGM:BEGIN generated -->\nManual note that is not managed\n");

    await writeManagedMarkdown(file, "first generated\n");
    await writeManagedMarkdown(file, "second generated\n");

    const text = await readFile(file, "utf8");
    assert.match(text, /Manual note that is not managed/);
    assert.match(text, /second generated/);
    assert.doesNotMatch(text, /first generated/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
