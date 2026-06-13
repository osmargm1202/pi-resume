import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import resumeExtension from "../extensions/resume.ts";
import { renderResumeMarkdown } from "../extensions/lib/resume-renderer.ts";

const execFileAsync = promisify(execFile);

test("renderResumeMarkdown sanitizes inline state values", () => {
  const text = renderResumeMarkdown({
    root: "/tmp/project",
    branch: "feature/`tick`\nbranch",
    recentCommits: ["abc123 commit with `tick`\n- injected commit"],
    dirtyFiles: [" M file`name`.ts\n?? injected.ts"],
    contextHeadings: ["Heading `tick`\n- injected heading"],
    recentDocs: ["docs/guide`tick`.md\n- injected doc"],
    warnings: ["warning with `tick`\n- injected warning"],
  }, new Date("2026-06-13T00:00:00.000Z"));

  assert.match(text, /- Branch: `feature\/\'tick\' branch`/);
  assert.match(text, /- abc123 commit with 'tick' - injected commit/);
  assert.match(text, /- M file'name'.ts \?\? injected.ts/);
  assert.match(text, /Known context headings: `Heading 'tick' - injected heading`/);
  assert.match(text, /- docs\/guide'tick'\.md - injected doc/);
  assert.match(text, /- warning with 'tick' - injected warning/);
  assert.doesNotMatch(text, /^- injected/m);
  assert.doesNotMatch(text, /`tick`/);
});

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
