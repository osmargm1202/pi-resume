import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import resumeExtension from "../extensions/resume.ts";

const execFileAsync = promisify(execFile);

test("/orgm-resume writes RESUME.md handoff", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-resume-command-"));
  try {
    await execFileAsync("git", ["init"], { cwd: dir });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: dir });
    await writeFile(join(dir, "README.md"), "# Fixture\n");
    await execFileAsync("git", ["add", "README.md"], { cwd: dir });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: dir });
    await writeFile(join(dir, "dirty.txt"), "work\n");

    const commands = new Map();
    resumeExtension({ registerCommand(name, definition) { commands.set(name, definition); } });
    await commands.get("orgm-resume").handler("", {
      cwd: dir,
      ui: { notify() {} },
      waitForIdle: async () => {},
      sessionManager: { getSessionFile: () => null },
      switchSession: async () => ({ cancelled: false })
    });
    const text = await readFile(join(dir, "RESUME.md"), "utf8");
    assert.match(text, /# Resume Context/);
    assert.match(text, /## Current Branch and Commits/);
    assert.match(text, /initial/);
    assert.match(text, /dirty.txt/);
    assert.match(text, /## Suggested First Prompt/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
