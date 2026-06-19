import { basename, extname } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { SessionManager, type SessionInfo } from "@earendil-works/pi-coding-agent";
import { type SelectItem } from "@earendil-works/pi-tui";
import { isOrgmExtensionEnabled } from "./lib/orgm-extension-config.ts";
import { createSelectPanel } from "./lib/tui-select-panel.ts";

const MAX_SELECTOR_HEIGHT = 12;

export type ResumeMode = "compact" | "plain";

export function buildResumeModeItems(): SelectItem[] {
	return [
		{
			value: "compact",
			label: "Continue compacted",
			description: "Switch session, then compact context before continuing",
		},
		{
			value: "plain",
			label: "Continue without compacting",
			description: "Switch session without changing its context",
		},
	];
}

export function getDefaultResumeMode(): ResumeMode {
	return "compact";
}

export function shouldCompactResume(mode: ResumeMode | null): boolean {
	return mode === "compact";
}

function formatTimestamp(date: Date): string {
	try {
		return new Intl.DateTimeFormat(undefined, {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		}).format(date);
	} catch {
		return date.toISOString().replace("T", " ").slice(0, 16);
	}
}

function truncate(text: string, max = 88): string {
	const clean = text.replace(/\s+/g, " ").trim();
	if (!clean) return "Untitled session";
	if (clean.length <= max) return clean;
	return `${clean.slice(0, Math.max(0, max - 1))}…`;
}

function buildSessionLabel(session: SessionInfo, isCurrent: boolean): string {
	const primary = session.name?.trim() || truncate(session.firstMessage || "Untitled session", 72);
	return isCurrent ? `${primary}  ✓ current` : primary;
}

function buildSessionDescription(session: SessionInfo, isCurrent: boolean): string {
	const parts = [
		formatTimestamp(session.modified),
		`${session.messageCount} msgs`,
		basename(session.path),
	];
	if (session.parentSessionPath) parts.push("fork/new-from-parent");
	if (isCurrent) parts.unshift("current");
	return parts.join(" · ");
}

function sortSessionsNewestFirst(sessions: SessionInfo[]): SessionInfo[] {
	return [...sessions].sort((a, b) => b.modified.getTime() - a.modified.getTime());
}

export function parseResumeArgs(args: string): string {
	const trimmed = args.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function sessionIdFromPath(path: string): string {
	const base = basename(path);
	const extension = extname(base);
	return extension ? base.slice(0, -extension.length) : base;
}

export function findRequestedSessionPath(sessions: Pick<SessionInfo, "path" | "name">[], args: string): string | null {
	const requested = parseResumeArgs(args);
	if (!requested) return null;
	const requestedLower = requested.toLowerCase();
	for (const session of sessions) {
		const base = basename(session.path);
		const id = sessionIdFromPath(session.path);
		const candidates = [session.path, base, id, session.name || ""].map((value) => value.toLowerCase());
		if (candidates.includes(requestedLower)) return session.path;
	}
	return null;
}

async function openSessionSelector(ctx: ExtensionCommandContext, sessions: SessionInfo[]): Promise<string | null> {
	const currentSessionFile = ctx.sessionManager.getSessionFile();

	if (sessions.length === 0) {
		ctx.ui.notify("No saved sessions found for this project", "warning");
		return null;
	}

	const items: SelectItem[] = sessions.map((session) => ({
		value: session.path,
		label: buildSessionLabel(session, session.path === currentSessionFile),
		description: buildSessionDescription(session, session.path === currentSessionFile),
	}));

	return await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
		const { container, selectList } = createSelectPanel({
			theme,
			title: "Resume Session",
			subtitle: `Newest first · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`,
			help: "↑↓ navigate • enter resume • esc cancel",
			items,
			maxHeight: MAX_SELECTOR_HEIGHT,
		});
		selectList.onSelect = (item) => done(item.value);
		selectList.onCancel = () => done(null);

		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				selectList.handleInput(data);
				tui.requestRender();
			},
		};
	}, { overlay: true });
}

async function openResumeModeSelector(ctx: ExtensionCommandContext): Promise<ResumeMode | null> {
	const items = buildResumeModeItems();

	return await ctx.ui.custom<ResumeMode | null>((tui, theme, _kb, done) => {
		const { container, selectList } = createSelectPanel({
			theme,
			title: "Resume Session",
			subtitle: "Choose how to continue",
			help: "↑↓ navigate • enter continue • esc cancel",
			items,
			maxHeight: items.length,
		});
		selectList.onSelect = (item) => done(item.value as ResumeMode);
		selectList.onCancel = () => done(null);

		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				selectList.handleInput(data);
				tui.requestRender();
			},
		};
	}, { overlay: true });
}

async function resolveRequestedSession(ctx: ExtensionCommandContext, args: string): Promise<string | null> {
	const sessions = sortSessionsNewestFirst(await SessionManager.list(ctx.cwd));
	const requested = parseResumeArgs(args);
	if (!requested) return await openSessionSelector(ctx, sessions);

	const matched = findRequestedSessionPath(sessions, requested);
	if (!matched) {
		ctx.ui.notify(`No saved session matches: ${requested}`, "warning");
		return null;
	}
	return matched;
}

export default function (pi: ExtensionAPI) {
	if (!isOrgmExtensionEnabled("resume")) return;

	pi.registerCommand("resume", {
		description: "Resume a saved session by selector, id, or name",
		handler: async (args, ctx) => {
			await ctx.waitForIdle();

			const selectedSession = await resolveRequestedSession(ctx, args);
			if (!selectedSession) return;

			const currentSessionFile = ctx.sessionManager.getSessionFile();
			if (selectedSession === currentSessionFile) {
				ctx.ui.notify("That session is already active", "info");
				return;
			}

			const resumeMode = await openResumeModeSelector(ctx);
			if (!resumeMode) return;
			const compactAfterSwitch = shouldCompactResume(resumeMode);

			const recoveredMessage = `Recovered session: ${basename(selectedSession)}`;
			const result = await ctx.switchSession(selectedSession, {
				withSession: async (replacementCtx) => {
					replacementCtx.ui.notify(recoveredMessage, "success");
					if (compactAfterSwitch) {
						replacementCtx.ui.notify("Compaction started", "info");
						replacementCtx.compact({
							onComplete: () => replacementCtx.ui.notify("Compaction completed", "success"),
							onError: (error) => replacementCtx.ui.notify(`Compaction failed: ${error.message}`, "error"),
						});
					}
				},
			});
			if (result.cancelled) {
				ctx.ui.notify("Session switch cancelled", "info");
			}
		},
	});
}
