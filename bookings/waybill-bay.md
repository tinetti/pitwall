---
leg: worktree
command: /pitwall:start
model: haiku
effort: low
handover: through
stampCmd: false
---
Cut the feature branch and its isolated worktree, then move into it — every beat after this one
happens in the new tree. Pass the branch name as the argument (`feat/<short-name>`) and read the
`cd` line the command prints: a tool-invoked shell cannot change your directory for you.

This beat's `doneWhenCmd` never succeeds on purpose, exactly as the ideate beat's does not: Pitwall
detects the worktree from repository state — `git worktree list` and the naming convention — never
from a manifest. This one exists to supply the baton: the command, the model, and this text.
