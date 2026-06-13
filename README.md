# pi-resume

ORGM Pi session resume command package.

## Install

```bash
pi install git:github.com/osmargm1202/pi-resume
```

## Owns

- `/orgm-resume`: resume a saved session for the current project.
  - No args: opens a newest-first session selector.
  - With arg: resumes by session id/basename or saved session name.
- This package does not generate `RESUME.md`; resume means session recovery, matching Claude Code `/resume` semantics.

## Development

```bash
npm install
npm test
npm run pack:check
```
