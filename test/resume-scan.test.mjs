import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { scanResumeState } from "../extensions/lib/resume-scan.ts";

const execFileAsync = promisify(execFile);

test("scanResumeState captures branch commits and dirty files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-resume-scan-"));
  try {
    await execFileAsync("git", ["init"], { cwd: dir });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: dir });
    await writeFile(join(dir, "README.md"), "# Resume Fixture\n");
    await execFileAsync("git", ["add", "README.md"], { cwd: dir });
    await execFileAsync("git", ["commit", "-m", "initial commit"], { cwd: dir });
    await mkdir(join(dir, "docs"));
    await writeFile(join(dir, "dirty.txt"), "changed\n");
    await writeFile(join(dir, "CONTEXT.md"), "# Project Context\n\n## Overview\n\nText\n");

    const state = await scanResumeState(dir);
    assert(state.branch.length > 0);
    assert(state.recentCommits.some((commit) => commit.includes("initial commit")));
    assert(state.dirtyFiles.some((file) => file.includes("dirty.txt")));
    assert(state.contextHeadings.includes("Project Context"));
    assert(state.contextHeadings.includes("Overview"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
