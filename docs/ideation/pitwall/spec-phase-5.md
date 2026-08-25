# Implementation Spec: Pitwall - Phase 5

**Contract**: ./contract.md
**Estimated Effort**: L

## Technical Approach

Phase 5 closes the loop and makes Pitwall installable. It ships the seventh beat's baton (cleanup),
the Full-tier surfaces (`/pitwall:status`, the `pw` alias, the superpowers manifest), the plugin
packaging, and the adoption work that fixes the third defect in the problem statement — the four
`~/.claude/commands/spec/*.md` files that encode model routing and live in no git repository.

Two things here are cross-repo and cannot be done from inside this repo alone: creating and pushing
`github.com/tinetti/pitwall` (the local repo has no `origin` and, at spec time, no commits), and
registering the plugin in `tinetti/claude-plugins`. Both are called out as explicit prerequisites
below rather than assumed, and the marketplace entry is **hand-written** — `scripts/sync-marketplace.ts`
preserves object-source entries rather than generating them.

The superpowers manifest is deliberately last. It binds a beat that already has a binding, which makes
it the first real exercise of goal 3's promise: adding it must cost one file and touch no source.

## Decisions Considered and Rejected

_Carried from the contract; consult before making gap decisions._

- **The cleanup baton ships with a manifest-configured target defaulting to `/mar`** — rejected: hardcoding `/mar`. It is a personal dotfile pair (`files/home/.claude/commands/mar.md` plus the `merge-and-reset` skill) symlinked into `$HOME`, and it needs `ExitWorktree`, `gh`/`glab`, and `jq`; installing the plugin alone would emit a baton to a command that does not exist.
- **MVP ships two built-in manifests; superpowers moves to Full** — rejected: three in MVP. superpowers is a second candidate for an already-bound beat, so deferring it makes it the proof of the one-file-edit swap.
- **`/pitwall:status` is a Full-tier surface, not an MVP command** — rejected: shipping it alongside `/pitwall:next` from the start. It traced to no goal and no criterion; promote it only if the combined output proved too dense.
- **Standalone repo `tinetti/pitwall`, registered in the marketplace as a github-sourced plugin** — rejected: `plugins/pitwall` inside the marketplace repo; `files/home/.claude` in `tinetti_dev_tools`. Cleanest boundary and independent versioning; a marketplace-sibling worktree would land inside the directory Claude Code scans.
- **Zero third-party npm runtime dependencies; no build step** — rejected: a test framework and a YAML library. Verified mechanically here, since this is the phase that could quietly add one.
- **Vendor the four unmanaged `spec/*.md` commands** — rejected: continuing to emit batons at files that exist in no git repo.

## Feedback Strategy

**Inner-loop command**: `node --test tests/commands.test.js`

**Playground**: `node --test` plus a real install check — copy the plugin into a scratch
`~/.claude/plugins` layout and confirm the commands resolve.

**Why this approach**: Packaging fails in ways unit tests cannot see (a command file that exists but
does not parse, a manifest listing a command that was renamed), so the loop pairs a parse test with a
real install.

## File Changes

### New Files

| File Path | Purpose |
| --- | --- |
| `.claude-plugin/plugin.json` | Plugin metadata. **Amended in implementation**: it declares no `commands` key — the shipped-command declaration is the `DECLARED` list in `tests/commands.test.js`. See *Packaging* |
| `bin/pw` | Executable shim so `pw` works from a shell as well as a slash command |
| `commands/status.md` | Full-tier position-without-baton surface |
| `providers/pitwall-cleanup.md` | Cleanup beat binding; `command` defaults to `/mar` |
| ~~`providers/superpowers-execute.md`~~ → `examples/superpowers-execute.md` | Alternate execute binding; the one-file-swap proof. **Amended in implementation**: shipped under `examples/` because two manifests claiming one stage is a hard error (`src/providers.js:73-76`), so shipping it beside the manifest it replaces would break every command on install. The swap stays one file and no source change — an overwrite (`cp examples/superpowers-execute.md providers/openspec-execute.md`) rather than an addition |
| `commands/spec/{explore,propose,apply,archive}.md` | Vendored copies of the unmanaged model-routing commands |
| `tests/commands.test.js` | Every declared command file exists and parses; manifest lists exactly the shipped set |
| `README.md` | Install, the 7-beat model, and external prerequisites |

### Modified Files

| File Path | Changes |
| --- | --- |
| `src/cli.js` | Add `status`; wire the cleanup baton |
| `package.json` | `bin` entry for `pw`; confirm no `dependencies` and no `build` script |

## Implementation Details

### Cleanup baton

**Overview**: The seventh beat. Emits the finish command and the review diff.

**Key decisions**:

- `command` comes from `providers/pitwall-cleanup.md`, defaulting to `/mar`. The *detector* stays wrapper-owned (branch merged into default, no worktree remaining) per the contract; only the target is declarative.
- The baton **names** the review diff — the three-dot diff between the default branch and this one — so the operator reviews before finishing, matching how the branch's work is actually judged. **Amended in implementation**: it is named in prose rather than emitted as a literal `git diff <default>...<branch>` line. Manifest bodies render verbatim (`src/baton.js:84-88`) and `Inference` (`src/inference.js:17-20`) carries `branch` but no `base` — `src/beats.js:81` computes `state.base` and then discards it — so a runnable line would cost a widened inference shape *plus* a substitution pass over manifest bodies: a source change on behalf of one manifest, which is the coupling the manifest format exists to avoid (`context-map.md:294` flagged this decision as open). A backticked placeholder was the worse third option: it looks runnable and is not.
- The README names `/mar`'s own prerequisites (`tinetti_dev_tools` dotfiles, `gh`/`glab`, `jq`) rather than Pitwall pretending to provide them.

**Feedback loop**:

- **Playground**: a fixture repo with a merged branch and a removed worktree.
- **Experiment**: branch merged + worktree gone (complete); merged but worktree present; unmerged.
- **Check command**: `node --test tests/inference.test.js`

### Packaging

**Overview**: A plugin directory Claude Code can install from GitHub.

```json
{
  "name": "pitwall",
  "version": "0.1.0",
  "description": "Workflow spine with pluggable tool holes: one command names the beat, the next command, and the model it wants.",
  "author": { "name": "John Tinetti", "email": "john@tinetti.net" },
  "keywords": ["workflow", "handoff", "session", "worktree", "model-routing", "ideation", "openspec"]
}
```

**Key decisions**:

- `plugin.json` lands here, not in phase 1 — the command set was still moving, and a second registration point would have drifted.
- `tests/commands.test.js` asserts the declared and shipped command sets agree **in both directions**: no declared command missing, no shipped command undeclared. **Amended in implementation**: the declaration is the `DECLARED` array in `tests/commands.test.js:25`, not a `commands` key in `plugin.json`, and the manifest deliberately omits that key — `tests/commands.test.js:177` asserts it stays absent. Measured against a scratch install (`claude --plugin-dir <copy>`): with no `commands` key, `commands/` is discovered by convention and every file resolves, nested ones included; with `"commands": ["./commands/top.md", "./commands/sub/nested.md"]` the nested command stops resolving entirely (`Unknown command`), which would silently unregister all four `commands/spec/*.md`; with the directory form `"commands": ["./commands"]` behaviour is identical to declaring nothing. Not one of the 79 `plugin.json` files surveyed on this machine declares the key (`context-map.md:12`).
- The `pw` shim is a thin `#!/usr/bin/env node` wrapper around `src/cli.js`; it must not duplicate argument parsing.

**Implementation steps**:

1. Write `tests/commands.test.js` red: a missing command file; an undeclared extra file; a command file whose frontmatter does not parse.
2. Write `plugin.json` and `bin/pw` until green.
3. Verify zero-dependency and no-build mechanically.

**Feedback loop**:

- **Playground**: a scratch copy of the plugin directory.
- **Experiment**: rename a command file and confirm the test fails; restore and confirm it passes.
- **Check command**: `node --test tests/commands.test.js`

### Adoption: vendoring the spec commands

**Overview**: Copy the four unmanaged `~/.claude/commands/spec/*.md` into version control, preserving
their `model:`/`effort:` frontmatter verbatim — that frontmatter is the model routing Pitwall's batons
point at.

**Key decisions**:

- Copy, do not rewrite. Their current behaviour is the baseline; changing it here would confound the acceptance run.
- **Measured in implementation (the spec's real-install check)**: a plugin command is namespaced under the plugin name, and a `commands/` subdirectory adds another segment. The vendored files install as `/pitwall:spec:{explore,propose,apply,archive}`; `/pitwall:propose` is an unknown command. Verified twice with `claude --plugin-dir <scratch copy>`: once on a two-file probe plugin (`/probe:top` → ran, `/probe:sub:nested` → ran, `/probe:nested` → `Unknown command`) and once on a scratch copy of this plugin with a marked `commands/spec/propose.md` (`/pitwall:spec:propose` → ran). Note that `claude plugin details` under-reports — it lists only the three top-level commands — so runtime resolution, not the inventory, is the check that counts.
- Consequently the bare `/spec:propose` and `/spec:apply` the OpenSpec batons name come from `~/.claude/commands/spec/*.md`, **not** from the plugin, which makes the symlink step in the README load-bearing rather than tidy-up: a plugin-only install walks into the failure table's "Phantom command" row on beats 5 and 6. The README install section says so, and names the alternative (repoint the two OpenSpec manifests' `command:` at `/pitwall:spec:*`).
- Each vendored command keeps its dependency on the `opsx:*` skill, which ships with the per-project OpenSpec install. The OpenSpec provider manifest must state which artifact it assumes — the `/spec:*` command, the `opsx:*` skill, or the `openspec` CLI directly — so a missing layer produces a clear message rather than a mystery.

### Superpowers manifest (the swap proof)

**Overview**: One file binding the execute beat to `superpowers:subagent-driven-development` instead
of `/spec:apply`.

**Key decisions**:

- Adding it must touch exactly one file. If implementing it requires any change under `src/`, goal 3 is false and that is a finding, not a workaround.

## Testing Requirements

### Unit Tests

| Test File | Coverage |
| --- | --- |
| `tests/commands.test.js` | Declared/shipped command sets agree both ways; every command file parses; `plugin.json` is valid JSON; `examples/superpowers-execute.md` loads as a swap; `bin/pw` runs |

**Key test cases**:

- A command file present on disk but absent from the declared set fails.
- A command file with malformed frontmatter fails.
- `package.json` has no `dependencies` and no `build` script.
- **Added in implementation**: `examples/superpowers-execute.md` copied over `openspec-execute.md` in a scratch `providers/` dir loads, binds `execute`, and renders a baton naming `superpowers:subagent-driven-development` with no argument appended. Nothing under `examples/` is on any load path, so this is the only thing standing between a typo there and the failure table's "silent goal violation".
- **Added in implementation**: `bin/pw --help` is *spawned* (`process.execPath bin/pw --help`) and must exit 0 with the usage banner. Reading the shim's text cannot catch a broken import path.

### Manual Testing

- [x] Install the plugin from a local path and confirm `/pitwall:next` and `/pitwall:status` appear. **Done**: `claude --plugin-dir <scratch copy>` — `/pitwall:status` resolves, and so does `/pitwall:spec:propose` (see *Adoption* for the namespacing this turned up).
- [ ] Add the superpowers manifest and confirm `git status --porcelain` shows exactly one file.
- [ ] Run the full 7-beat acceptance change and record which beats, if any, required consulting notes.

## Failure Modes

| Component | Failure Mode | Trigger | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| Cleanup baton | Points at nothing | Plugin installed without `tinetti_dev_tools` | Baton names `/mar`, which does not exist | Target is manifest-configured; README names the prerequisite |
| Cleanup detector | Premature completion | Branch merged but worktree still present | Beat reads done while the worktree lingers | Detector requires both conditions |
| Packaging | Phantom command | The declared set lists a renamed file | Command silently missing after install | Bidirectional agreement test |
| Packaging | Phantom command | Plugin-only install; batons name `/spec:*`, the plugin ships `/pitwall:spec:*` | Beats 5 and 6 hand over a command the session cannot resolve | Measured and recorded; README install section names the symlink step as the source of the `/spec:*` names, and names repointing the two manifests as the alternative |
| Vendored spec commands | Drift | The `~/.claude` originals are edited later | Two copies disagree; routing is unpredictable | README states the vendored copies are canonical; delete or symlink the originals |
| Vendored spec commands | Broken layer | `opsx:*` skill absent (per-project, gitignored install) | Baton leads to a command that errors | Manifest states which layer it assumes |
| superpowers manifest | Silent goal violation | Swap needs a source change | Goal 3 false, undetected | Manual check asserts a 1-file diff |
| Marketplace entry | Overwritten | `sync-marketplace.ts` regenerates entries | Registration lost on next sync | Entry is hand-written; script preserves object-source entries |

## Validation Commands

```bash
node --test tests/commands.test.js
node -e 'const p=require("./package.json");process.exit((Object.keys(p.dependencies||{}).length===0 && !(p.scripts||{}).build)?0:1)'
node --test tests/
```

## Rollout Considerations

- **Prerequisite (cross-repo)**: create and push `github.com/tinetti/pitwall`; the local repo has no `origin` remote.
- **Prerequisite (cross-repo)**: clone `tinetti/claude-plugins` (only a read-only cache clone exists at `~/.claude/plugins/marketplaces/tinetti`) and hand-write a github-sourced entry in `.claude-plugin/marketplace.json`, matching the shape of the existing `ideation` entry.
- **One-time**: un-ignore `openspec/` in `tinetti_dev_tools` before the acceptance run, or the change folder is destroyed when `/mar` removes the worktree.
- **Rollback**: the plugin is additive; removing the marketplace entry and uninstalling restores the prior workflow, which is entirely manual.

## Open Items

- [x] Decide whether the `~/.claude/commands/spec/*.md` originals are deleted or symlinked to the vendored copies once adoption lands. **Symlinked, and no longer optional**: the plugin's own copies answer to `/pitwall:spec:*`, so deleting the originals would break the `/spec:*` batons. The README ships the `ln -sf` loop and states why.

## Deviations from this spec, recorded during implementation

Each of these is also marked inline above, at the line the contract moved.

| Spec said | Shipped | Why |
| --- | --- | --- |
| `providers/superpowers-execute.md` | `examples/superpowers-execute.md` | Two manifests claiming one stage is a hard error (`src/providers.js:73-76`); shipping it under `providers/` would break every command on install. The one-file-swap property is preserved as an overwrite, and `tests/commands.test.js` now loads it from `examples/` to prove it still applies cleanly. |
| `plugin.json` "lists exactly the shipped commands" | No `commands` key; the declaration is `DECLARED` in `tests/commands.test.js:25` | Measured: a file-path `commands` array stops nested commands resolving at all, which would unregister `commands/spec/*.md`. The bidirectional check is unchanged. |
| Baton includes a `git diff <default>...<branch>` line | Baton names the diff in prose | Bodies render verbatim and `Inference` carries no `base`; a runnable line costs a source change on behalf of one manifest. |
| Plugin install "gives you … the four `/spec:*` routing commands" | It gives `/pitwall:spec:*`; the `/spec:*` names come from the `~/.claude/commands/spec/` symlinks | Measured against a scratch install. README install section corrected. |

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
