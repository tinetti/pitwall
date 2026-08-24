---
stage: execute
command: /spec:apply
model: opus
effort: high
handoff: clear
doneWhenCmd: ls openspec/changes/*/tasks.md >/dev/null 2>&1 && ! grep -qE '^[[:space:]]*[-*+] \[ \]' openspec/changes/*/tasks.md
---
Work the tasks list top to bottom, test first, ticking each box as it lands. A phase is roughly one
session's context — stop and hand the baton on when the remaining tasks no longer fit, rather than
running the session dry.
