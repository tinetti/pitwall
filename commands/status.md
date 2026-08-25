---
description: "Pitwall — where this change stands, without the baton"
allowed-tools: Bash(node:*), Bash(test:*), Bash(echo:*)
---

<!--
No `model:` or `effort:` frontmatter, for the same reason as `next`: this command reports position,
and the models named anywhere in Pitwall's output belong to the manifests, not to this session.
-->

# Pitwall: status

<!--
`status` is `next` minus the NEXT block. It exists for the case where the baton is not the question
— checking where a change stands mid-session, or after handing one off — so that reading the
position does not also re-issue an instruction the operator has already acted on.

No `:-.` fallback on `CLAUDE_PLUGIN_ROOT`, for the same reason as `next` and `start`: falling back
to the operator's cwd points the command at `./src/cli.js` in *their* repository, where it does not
exist, and hands the model a raw node MODULE_NOT_FOUND dump in place of the block below.
-->

!`if [ -f "${CLAUDE_PLUGIN_ROOT:-}/src/cli.js" ]; then node "${CLAUDE_PLUGIN_ROOT}/src/cli.js" status; else echo "pitwall: CLAUDE_PLUGIN_ROOT is unset or does not point at the Pitwall plugin directory — cannot locate src/cli.js"; fi`

## Task

Show the block above to me **verbatim** — same lines, same order, same glyphs. Do not summarise it,
re-word it, re-order it, or add commentary of your own. It is already the whole answer.

Then stop. Do not infer what the next beat's command would be and do not offer to run it: `status`
answers "where am I", and `/pitwall:next` is the command that answers "what now". Guessing the
baton here would bypass the manifest that owns it.

If the block reports `IGNORED BY GIT`, mention that those artifacts will not survive a commit, and
leave editing `.gitignore` to me.
