# Pitwall

A single change moves through seven beats, three tool ecosystems, and at least four sessions. No
tool models the arc, so every session boundary costs a manual re-orientation: which stage is this,
which command comes next, which model does it want, and does the work live in the main checkout or
a worktree.

Pitwall is the spine. One command reads the repository and answers all four questions:

```
feat/session-handoff · beat 5 of 7 (specs)
  ✓ ideate  ✓ worktree  ✓ refine  ✓ contract
  ▶ specs

NEXT:
  /clear, then run:
  /spec:propose add-session-handoff
  └ opus · high effort

  Scaffold the change: proposal, spec deltas, design notes, and a tasks list. …
```

There is no state file. Position is inferred from repository reality — the branch, the worktree, the
artifacts on disk — so a stage done by hand is seen, and nothing ever drifts out of sync.

## The seven beats

| # | Beat | Detected by | Bound to |
| --- | --- | --- | --- |
| 1 | `ideate` | a non-default branch, or any later beat being complete | `providers/ideation-ideate.md` |
| 2 | `worktree` | the worktree at the naming-convention path | `providers/pitwall-worktree.md` |
| 3 | `refine` | `docs/ideation/*/contract-data.json` | `providers/ideation-refine.md` |
| 4 | `contract` | `docs/ideation/*/contract.md` | `providers/ideation-contract.md` |
| 5 | `specs` | `openspec/changes/*/tasks.md` | `providers/openspec-specs.md` |
| 6 | `execute` | every checkbox in `tasks.md` ticked | `providers/openspec-execute.md` |
| 7 | `cleanup` | branch merged into the default branch **and** no worktree left | `providers/pitwall-cleanup.md` |

Beats 2 and 7 are wrapper-owned: Pitwall detects them from git rather than from a manifest, because
the anchor and the terminus have to be relied on while everything they hand to is swappable. They
still take their command, model, and prose from a manifest like every other beat.

## Install

The two surfaces install separately, and neither one brings the other.

**Slash commands** — install the plugin:

```
/plugin marketplace add tinetti/claude-plugins
/plugin install pitwall@tinetti
```

That gives you `/pitwall:next`, `/pitwall:start`, `/pitwall:status`, and the four routing commands
as **`/pitwall:spec:{explore,propose,apply,archive}`**. Claude Code namespaces every plugin command
under the plugin name, and a `commands/` subdirectory becomes one more segment — measured against a
scratch install, `/pitwall:spec:propose` resolves and `/pitwall:propose` is an unknown command.

The batons for beats 5 and 6 name the **bare** `/spec:propose` and `/spec:apply`. Those names come
from `~/.claude/commands/spec/`, not from the plugin — the symlink step under *The vendored
`/spec:*` commands* is what supplies them. Install the plugin alone and beats 5 and 6 hand you a
command your session cannot resolve. If you would rather not touch `~/.claude`, the other way out
is a one-line `command:` edit in `providers/openspec-specs.md` and `providers/openspec-execute.md`
pointing them at the `/pitwall:spec:*` names instead.

The plugin does **not** give you `pw`: Claude Code clones the plugin into its own cache and never
runs npm.

**The `pw` shell alias** — from a clone of this repository:

```
git clone https://github.com/tinetti/pitwall
cd pitwall && npm link
```

`npm link` is what honours the `bin` entry. There are no dependencies to install; the link is the
whole step.

## Commands

| Command | Slash command | Answers |
| --- | --- | --- |
| `pw next` | `/pitwall:next` | Where this change stands, and the baton for the next session |
| `pw start <branch>` | `/pitwall:start` | Cut the branch and its worktree, then hand off the beat that follows |
| `pw status` | `/pitwall:status` | Where this change stands, without the baton |

`pw next --json` prints the raw inference result for scripts. `pw status` takes no options — the
machine-readable surface is `next --json`, and a second one would be a second thing to keep in step.

All three warn when a workflow artifact directory is git-ignored in the host repository — `next` and
`status` before their position block, and `start` in the baton it prints after cutting the worktree.
That matters more than it sounds: untracked artifacts are destroyed when the worktree is removed at
the cleanup beat.

## Prerequisites

Pitwall hands off to other tools rather than reimplementing them, so the batons name commands it
does not ship. Everything below is optional in the sense that the manifest that names it can be
swapped — see *Swapping a provider* — but a baton pointing at a command you do not have is a dead
end.

| Beat | Needs | Where it comes from |
| --- | --- | --- |
| 1, 3, 4 | the `ideation` plugin | `/plugin install ideation@tinetti` |
| 5, 6 | the `openspec` CLI, and a per-project `openspec init` | `npm i -g @fission-ai/openspec` |
| 5, 6 | the `opsx:*` commands the `/spec:*` commands invoke | written into `<project>/.claude/commands/opsx/` by `openspec init` |
| 7 | `/mar` — a personal dotfile command, not part of Pitwall | `tinetti_dev_tools` (`files/home/.claude/commands/mar.md` plus the `merge-and-reset` skill), and it needs `gh`/`glab`, `jq`, and the `ExitWorktree` tool |

Beat 7's target is the one most likely to be wrong for you. It is a single line in
`providers/pitwall-cleanup.md`.

## Swapping a provider

Every pluggable beat's command, model, effort, handoff, and completion detector live in one markdown
file under `providers/`. Rebinding a beat is one file edit and zero changes to Pitwall's source —
that property is asserted mechanically in `tests/provider-swap.test.js`.

```yaml
---
stage: execute                  # which beat this binds
command: /spec:apply            # what the baton tells the next session to run
model: opus                     # the model that beat wants
effort: high                    # optional
handoff: clear                  # clear | session | inline
argument: change-id             # change-id (default) | branch | none
doneWhenPathExists: openspec/changes/*/tasks.md   # at least one detector is required
doneWhenCmd: test -f Makefile                     # judged by exit code
---
Everything below the fence is the baton text, rendered verbatim.
```

`examples/superpowers-execute.md` is a worked alternative binding for the execute beat, pointing it
at `superpowers:subagent-driven-development` instead of `/spec:apply`. Apply it by copying it over
the manifest it replaces:

```
cp examples/superpowers-execute.md providers/openspec-execute.md
```

It lives in `examples/` rather than in `providers/` on purpose. Two manifests claiming one stage is
a hard error — Pitwall refuses to guess which binding you meant — so an alternative that shipped
beside the manifest it replaces would break every command on install. The swap is still one file
and no source change; it is an overwrite rather than an addition.

## The vendored `/spec:*` commands

`commands/spec/{explore,propose,apply,archive}.md` are byte-identical copies of four commands that
previously lived only in `~/.claude/commands/spec/` and were tracked in no git repository. Their
`model:`/`effort:` frontmatter *is* the model routing the OpenSpec batons point at, which made one
disk failure the whole backup story.

**These copies are canonical, and this step is not optional if you use the OpenSpec beats as
shipped.** Installed as part of the plugin they answer to `/pitwall:spec:propose`; the batons name
`/spec:propose`, and only `~/.claude/commands/spec/propose.md` answers to that. Symlink the
originals at the vendored copies so one file serves both names and there is one source of truth —
the same arrangement `~/.claude/commands/mar.md` already uses:

```
for f in explore propose apply archive; do
  ln -sf "$PWD/commands/spec/$f.md" "$HOME/.claude/commands/spec/$f.md"
done
```

Copying instead of symlinking leaves two files that disagree about which model runs which stage, and
nothing will tell you which one won.

## Development

```
node --test tests/          # the whole suite
node --test tests/cli.test.js   # one suite
UPDATE_GOLDEN=1 node --test tests/baton.test.js   # re-bless the rendered-output fixtures
```

Zero runtime dependencies, zero dev dependencies, no build step — `node --test` and `git` are the
entire toolchain, and `tests/commands.test.js` asserts it stays that way. Read the regenerated
golden files before committing them; that is the whole point of making regeneration explicit.
