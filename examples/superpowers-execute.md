---
leg: execute
command: superpowers:subagent-driven-development
model: opus
effort: high
handover: transfer
argument: none
stampCmd: ls openspec/changes/*/tasks.md >/dev/null 2>&1 && ! grep -qE '^[[:space:]]*[-*+] \[ \]' openspec/changes/*/tasks.md
---
Hand the tasks list to subagent-driven development: one subagent per task, each briefed on that task
alone and returning a diff and a verdict rather than a transcript. Name the change folder in the
brief — this is a skill invoked by name rather than a slash command, so nothing is interpolated into
it for you, which is why this manifest declares `argument: none`.

The detector is unchanged from `providers/openspec-execute.md`: what counts as a finished execute
beat is the state of `tasks.md`, and it does not depend on who worked the list.
