---
description: "Pitwall — cut the branch and its worktree, then hand off the next beat"
argument-hint: <branch — the branch to start, e.g. feat/session-handoff>
allowed-tools: Bash(node:*), Bash(test:*), Bash(echo:*)
---

<!--
No `model:` or `effort:` frontmatter on purpose. The baton below names the model and effort for the
*next* session; declaring one here would silently override the manifest's choice with this session's.
-->

# Pitwall: start

<!--
The branch name is interpolated into the command rather than handed to the model to run, which is
what keeps the output below verbatim rather than paraphrased. Two things make that safe enough to
choose deliberately: the argument is quoted, and `allowed-tools` pre-approves only `node`, so
anything that broke out of the quoting would no longer match and would stop for approval. The CLI
then rejects the name outright with `git check-ref-format --branch` before a single git call
mutates anything — an empty argument lands on its usage message, not on a guess.

No `:-.` fallback on `CLAUDE_PLUGIN_ROOT`, for the same reason as `next`: falling back to the
operator's cwd points the command at `./src/cli.js` in *their* repository, where it does not exist.
-->

!`if [ -f "${CLAUDE_PLUGIN_ROOT:-}/src/cli.js" ]; then node "${CLAUDE_PLUGIN_ROOT}/src/cli.js" start "$ARGUMENTS"; else echo "pitwall: CLAUDE_PLUGIN_ROOT is unset or does not point at the Pitwall plugin directory — cannot locate src/cli.js"; fi`

## Task

Show the block above to me **verbatim** — same lines, same order, same glyphs. Do not summarise it,
re-word it, re-order it, or add commentary of your own. It is already the whole answer.

The `cd` line is the one instruction in Pitwall meant for my shell rather than for a session: do not
run it, and do not offer to. Nothing you do here can move me into the new worktree — that is why the
path is printed.

Then stop. Running the command the baton names is the next session's job, not this one's: the
handoff line says whether to `/clear` first, and acting on it here would spend the context the baton
is trying to hand over.

If the block reports `IGNORED BY GIT`, mention that those artifacts will not survive a commit, and
leave editing `.gitignore` to me.
