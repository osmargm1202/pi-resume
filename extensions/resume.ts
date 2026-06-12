import { basename } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { SessionManager, type SessionInfo } from "@earendil-works/pi-coding-agent";
import { type SelectItem } from "@earendil-works/pi-tui";
import { createSelectPanel } from "./lib/tui-select-panel.ts";
import { isOrgmExtensionEnabled } from "./lib/orgm-extension-config.ts";

const MAX_SELECTOR_HEIGHT = 12;

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

async function openSessionSelector(ctx: ExtensionCommandContext): Promise<string | null> {
	const currentSessionFile = ctx.sessionManager.getSessionFile();
	const sessions = sortSessionsNewestFirst(await SessionManager.list(ctx.cwd));

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

export default function (pi: ExtensionAPI) {
	if (!isOrgmExtensionEnabled("resume")) return;

	pi.registerCommand("orgm-resume", {
		description: "Resume a saved session for the current project",
		handler: async (_args, ctx) => {
			await ctx.waitForIdle();

			const selectedSession = await openSessionSelector(ctx);
			if (!selectedSession) return;

			const currentSessionFile = ctx.sessionManager.getSessionFile();
			if (selectedSession === currentSessionFile) {
				ctx.ui.notify("That session is already active", "info");
				return;
			}

			const recoveredMessage = `Recovered session: ${basename(selectedSession)}`;
			const result = await ctx.switchSession(selectedSession, {
				withSession: async (replacementCtx) => {
					replacementCtx.ui.notify(recoveredMessage, "success");
				},
			});
			if (result.cancelled) {
				ctx.ui.notify("Session switch cancelled", "info");
			}
		},
	});
}
