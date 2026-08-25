# Implementation Spec: Pitwall - Phase 4

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

Phase 4 ships `/pitwall:start`: the branch-and-worktree beat that no planning tool models. It is a
port of the operator's `gwt` zsh function into something callable from a tool-invoked shell, with the
three properties `gwt` lacks — idempotence, a no-op path when already inside the target worktree, and
a correct fallback when the repo has no `origin` remote.

That last property is not hypothetical: Pitwall's own repository has no remote and no commits, so a
naive port would fail on day one in the repo it was written for.

Path derivation is *not* implemented here. It moved to phase 1 (`resolveWorktreePath`) because phase
2's inference needs it, and re-deriving it would create the circular dependency a critic flagged.
This phase consumes that helper and owns only the side effects: `git worktree add`, branch creation,
and telling the operator where to go.

Runs in parallel with phase 3; both depend only on phase 2.

## Decisions Considered and Rejected

_Carried from the contract; consult before making gap decisions._

- **Pitwall owns the worktree beat and the cleanup handoff outright** — rejected: making worktree and cleanup pluggable. They are the two beats no existing tool models, and the worktree is the anchor that lets inference locate every later artifact.
- **Worktree path resolution lands in phase 1, consumed by both inference and this command** — rejected: phases 2 and 4 parallel with the derivation living here. Circular dependency declared as parallelism.
- **Workflow artifacts must be tracked in git** — rejected: leaving `openspec/` and ideation docs ignored. Untracked files do not travel to a new worktree and are destroyed when `/mar` removes it.
- **Infer stage from repository reality; ship no state file** — rejected: recording the created worktree path in state. `git worktree list` already knows.

## Feedback Strategy

**Inner-loop command**: `node --test tests/worktree.test.js`

**Playground**: Temp git repos built by phase 1's `tests/helpers/repo-fixture.js`, in four shapes:
with origin, without origin, with the worktree already present, and with zero commits.

**Why this approach**: Every behaviour here is a git side effect, so a throwaway repo per case is the
only honest playground — and it runs in milliseconds.

## File Changes

### New Files

| File Path | Purpose |
| --- | --- |
| `src/worktree.js` | `startWorktree(branch, {cwd, base})` — create branch + worktree, idempotently |
| `commands/start.md` | Claude Code slash command for the worktree beat |
| `tests/worktree.test.js` | Idempotence, no-op, remote-less fallback, slashed branch names |

### Modified Files

| File Path | Changes |
| --- | --- |
| `src/cli.js` | Add the `start` subcommand |
| `providers/` | Add a `stage: worktree` manifest supplying the beat's baton text and model (detector stays wrapper-owned) |

## Implementation Details

### startWorktree

**Pattern to follow**: `/Users/tinetti/tinetti_dev_tools/files/zsh/git.zsh:267-288` — `gwt`, the
convention being ported. Read it before writing this; the path derivation lives in phase 1's
`resolveWorktreePath`, and only the side effects belong here.

**Overview**: Creates the branch if needed, creates the worktree if needed, and reports the path.

```js
/** @param {string} branch
 *  @param {{cwd:string, base?:string}} opts
 *  @returns {{path:string, created:boolean, branchCreated:boolean, base:string}} */
export function startWorktree(branch, opts) {}
```

**Key decisions**:

- **Base selection**: `origin/<default>` when an origin remote exists, otherwise the current `HEAD`. `gwt` always uses `origin/…` and always fetches; both fail in a remote-less repo.
- **Fetch only when a remote exists.** A fetch in a remote-less repo is an error, and a fetch is a network side effect a status-adjacent command should not take unasked.
- **`--no-track`**, matching `gwt`'s rationale: without it, `git pull` in the new worktree tries to merge the default branch into the feature branch.
- **Idempotence**: if `git worktree list --porcelain` already contains the resolved path, return `{created:false}` and succeed. Re-running must never error.
- **No-op**: if `cwd` is already inside the resolved path, do nothing at all and say so — the operator ran it twice, which is not a mistake worth punishing.
- **Zero-commit repo**: `git worktree add` cannot work on an unborn HEAD. Detect it and fail with the specific remedy ("make an initial commit first"), not a raw git error.

**Implementation steps**:

1. Write `tests/worktree.test.js` red: fresh create; re-run (idempotent); run from inside the worktree (no-op); no-remote repo; branch containing `/`; zero-commit repo.
2. Implement branch existence check → `git worktree add` with the two branches of base selection.
3. Add the idempotence and no-op guards.
4. Add the unborn-HEAD guard with its specific message.

**Feedback loop**:

- **Playground**: `repo-fixture.js` variants — `{remote:true|false, commits:0|1, worktree:present|absent}`.
- **Experiment**: branches `feat/x` and `feat/x/y`; run twice; run from inside; run with no origin; run on an empty repo.
- **Check command**: `node --test tests/worktree.test.js`

### `start` subcommand and slash command

**Overview**: `pw start <branch>` → create, then print the baton for the *next* beat.

**Key decisions**:

- After creating the worktree, the command re-runs inference and prints the next baton. The operator asked to move; leaving them at a bare success message would recreate the exact gap Pitwall exists to close.
- The printed baton includes the `cd` target, because a tool-invoked shell cannot change the operator's directory. This is the one place Pitwall tells the human to run a shell command rather than a slash command.
- The slash command passes `$ARGUMENTS` through as the branch name and does no parsing of its own.

**Feedback loop**:

- **Playground**: a fixture repo; run `node src/cli.js start feat/demo`.
- **Experiment**: valid branch, existing branch, branch that already has a worktree, empty argument.
- **Check command**: `node --test tests/worktree.test.js`

## Testing Requirements

### Unit Tests

| Test File | Coverage |
| --- | --- |
| `tests/worktree.test.js` | Create; idempotent re-run; no-op from inside; remote-less base fallback; slashed branch path; unborn-HEAD guard |

**Key test cases**:

- Second invocation creates nothing and exits 0.
- In a repo with no `origin`, no fetch is attempted and the base is `HEAD`.
- `feat/a/b` produces `…/repo-feat-a-b` and the branch keeps its slashes.
- A zero-commit repo produces the specific remedy message, not a git stack trace.

### Manual Testing

- [ ] `pw start feat/demo` in a scratch clone, then `pw start feat/demo` again — second run is a clean no-op.
- [ ] Run it inside the created worktree — reports no-op, does not nest a worktree.

## Failure Modes

| Component | Failure Mode | Trigger | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| startWorktree | Nested worktree | Run from inside the target worktree | A worktree of a worktree; inference anchors wrongly | No-op guard on `cwd` inside resolved path |
| startWorktree | Hard failure on re-run | Worktree already exists | Operator thinks the tool is broken | Idempotence guard returns `created:false` |
| startWorktree | Remote-less crash | Repo has no `origin` | Fails in Pitwall's own repo on day one | Base falls back to `HEAD`, fetch skipped |
| startWorktree | Unborn HEAD | Fresh `git init`, no commits | Raw git error, no guidance | Explicit detection with a remedy message |
| startWorktree | Wrong base silently | Origin exists but `origin/HEAD` unset | Branch cut from an unexpected commit | Resolve default branch explicitly; error if it cannot be determined |
| start subcommand | Dead end | Worktree created, no next step shown | Recreates the gap the project exists to close | Re-run inference and print the next baton |

## Validation Commands

```bash
node --test tests/worktree.test.js
node --test tests/
```

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
