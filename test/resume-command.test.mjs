import assert from "node:assert/strict";
import test from "node:test";
import { findRequestedSessionPath, parseResumeArgs } from "../extensions/resume.ts";

const sessions = [
  {
    path: "/sessions/abc123.json",
    name: "planning-session",
    firstMessage: "Plan work",
    modified: new Date("2026-06-13T00:00:00.000Z"),
    messageCount: 4,
  },
  {
    path: "/sessions/def456.json",
    name: "",
    firstMessage: "Fix bug",
    modified: new Date("2026-06-14T00:00:00.000Z"),
    messageCount: 8,
  },
];

test("parseResumeArgs trims optional quotes", () => {
  assert.equal(parseResumeArgs(""), "");
  assert.equal(parseResumeArgs("abc123"), "abc123");
  assert.equal(parseResumeArgs('"planning-session"'), "planning-session");
  assert.equal(parseResumeArgs("'planning-session'"), "planning-session");
});

test("findRequestedSessionPath resolves by id basename or name", () => {
  assert.equal(findRequestedSessionPath(sessions, "abc123"), "/sessions/abc123.json");
  assert.equal(findRequestedSessionPath(sessions, "abc123.json"), "/sessions/abc123.json");
  assert.equal(findRequestedSessionPath(sessions, "planning-session"), "/sessions/abc123.json");
  assert.equal(findRequestedSessionPath(sessions, "missing"), null);
});
