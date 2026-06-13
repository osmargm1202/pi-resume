import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ResumeState = {
	root: string;
	branch: string;
	recentCommits: string[];
	dirtyFiles: string[];
	contextHeadings: string[];
	recentDocs: string[];
	warnings: string[];
};

async function git(root: string, args: string[]): Promise<string> {
	try {
		const { stdout } = await execFileAsync("git", args, { cwd: root });
		return stdout.trim();
	} catch {
		return "";
	}
}

async function headings(filePath: string): Promise<string[]> {
	if (!existsSync(filePath)) return [];
	const text = await readFile(filePath, "utf8");
	return Array.from(text.matchAll(/^#+\s+(.+)$/gm), (match) => match[1].trim()).slice(0, 40);
}

async function listRecentDocs(root: string): Promise<string[]> {
	const docsDir = join(root, "docs");
	if (!existsSync(docsDir)) return [];
	const out: string[] = [];
	async function walk(dir: string): Promise<void> {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.name.endsWith(".md")) out.push(full.replace(`${root}/`, ""));
		}
	}
	await walk(docsDir);
	return out.sort().slice(-20);
}

export async function scanResumeState(root: string): Promise<ResumeState> {
	const warnings: string[] = [];
	const branch = await git(root, ["branch", "--show-current"]);
	const commits = await git(root, ["log", "--oneline", "-8"]);
	const status = await git(root, ["status", "--short"]);
	if (!branch) warnings.push("git branch unavailable");
	return {
		root,
		branch: branch || "not-a-git-repo",
		recentCommits: commits ? commits.split("\n") : [],
		dirtyFiles: status ? status.split("\n") : [],
		contextHeadings: [
			...(await headings(join(root, "CONTEXT.md"))),
			...(await headings(join(root, "AGENTS.md"))),
		],
		recentDocs: await listRecentDocs(root),
		warnings,
	};
}
