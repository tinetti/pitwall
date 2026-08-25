---
description: "OpenSpec apply — implement tasks.md (session model, normally Opus)"
model: inherit
allowed-tools: Bash(openspec:*)
---

Invoke the `opsx:apply` skill and follow it exactly.

If this project has no `openspec/` directory, stop and tell me to run `openspec init` first.

Context hygiene: if this session still holds the planning conversation that produced the change, say so and recommend I `/clear` before implementing — the change folder is the design, and carrying the planning transcript forward only dilutes it.

Change to apply: $ARGUMENTS
