---
description: "Waybill — where this docket stands, and the waybill for the next leg"
allowed-tools: Bash(node:*), Bash(test:*), Bash(echo:*)
---

<!--
No `model:` or `effort:` frontmatter on purpose. The waybill below names the model and effort for the
*next* session; declaring one here would silently override the booking's choice with this session's.
-->

# Waybill: next

<!--
No `:-.` fallback on `CLAUDE_PLUGIN_ROOT`: falling back to the operator's cwd points the command at
`./src/cli.js` in *their* repository, where it does not exist, and hands the model a raw node
MODULE_NOT_FOUND dump in place of the block below. One line of guidance is the honest failure.
-->

!`if [ -f "${CLAUDE_PLUGIN_ROOT:-}/src/cli.js" ]; then node "${CLAUDE_PLUGIN_ROOT}/src/cli.js" next; else echo "waybill: CLAUDE_PLUGIN_ROOT is unset or does not point at the Waybill plugin directory — cannot locate src/cli.js"; fi`

## Task

Show the block above to me **verbatim** — same lines, same order, same glyphs. Do not summarise it,
re-word it, re-order it, or add commentary of your own. It is already the whole answer.

Then stop. Running the command the waybill names is the next session's job, not this one's: the
handover line says whether to `/clear` first, and acting on it here would spend the context the
waybill is trying to hand over.

If the block reports `IGNORED BY GIT`, mention that those papers will not survive a commit, and
leave editing `.gitignore` to me.
