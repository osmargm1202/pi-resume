import type { ResumeState } from "./resume-scan.ts";

function list(items: string[]): string {
	return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None";
}

export function renderResumeMarkdown(state: ResumeState, now = new Date()): string {
	return `# Resume Context

## Timestamp

${now.toISOString()}

## Current Branch and Commits

- Branch: \`${state.branch}\`

${list(state.recentCommits)}

## Dirty Files

${list(state.dirtyFiles)}

## Recent Decisions

${state.contextHeadings.length ? `Known context headings: ${state.contextHeadings.map((heading) => `\`${heading}\``).join(", ")}` : "- No CONTEXT.md or AGENTS.md headings detected."}

## Completed Work

- Review recent commits above.

## In Progress

${state.dirtyFiles.length ? "- Dirty files indicate active work. Review them before editing." : "- No dirty files detected."}

## Blockers

${state.warnings.length ? list(state.warnings) : "- None detected."}

## Next Steps

- Read \`CONTEXT.md\` and \`AGENTS.md\` if present.
- Review dirty files and latest commits.
- Run targeted verification before claiming completion.

## Verification Status

- Verification not run by \`/orgm-resume\`; run project-specific tests before completion.

## Suggested First Prompt

Continue from \`RESUME.md\`: inspect dirty files, review latest commits, and proceed with the next unchecked task.

## Recent Docs

${list(state.recentDocs)}
`;
}
