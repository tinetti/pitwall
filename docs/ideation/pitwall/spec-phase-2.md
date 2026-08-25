# Implementation Spec: Pitwall - Phase 2

**Contract**: ./contract.md
**Estimated Effort**: L

## Technical Approach

This is the load-bearing phase. It answers one question — *which of the seven beats is this repository
on?* — using nothing but repository reality: git state, worktree presence, and the provider detectors
loaded in phase 1. There is no state file, so this function is the entire notion of "where am I".

The beat model is a fixed ordered list. Resolution walks it in order, asking each beat's detector
whether that beat is complete, and returns the first incomplete beat as current. Walking in order
(rather than picking the last complete beat) is deliberate: it makes a skipped beat visible instead of
silently jumping ahead, which matters because the operator is allowed to do any stage by hand.

The execute beat is the one with internal progress. It reports `n of N` from the `openspec` CLI when
the CLI is on `PATH`, and by counting `- [x]` / `- [ ]` checkboxes in the change's `tasks.md` when it
is not. Both paths must produce the same shape so the baton renderer in phase 3 never branches on
which one ran.

The CLI path does **not** use `openspec status --json`: measured against openspec 1.9.0, that
subcommand exits 1 without `--change` and carries no task counts with it. The two subcommands that
do are `openspec list --json` (every active change with `completedTasks`/`totalTasks`, so it also
discovers the change id) and `openspec instructions apply --change <id> --json` (a `progress` object
spelling the finished count `complete`, not `done`). `list` is the primary; `instructions apply` is
used when the caller already has an id. Availability is judged by `openspec --version` alone.

## Decisions Considered and Rejected

_Carried from the contract; consult before making gap decisions._

- **Infer stage from repository reality; ship no state file** — rejected: `.pitwall/state.json` recording stage, providers, and history. A second source of truth drifts the moment a stage is done by hand, and inference stays correct even when the operator bypasses the wrapper entirely.
- **Each provider manifest carries its own done-detector** — rejected: Pitwall hardcodes detectors for the tools it knows about. Inference facts are provider-specific, so a hardcoded detector would make "every stage is a hole" false.
- **The openspec CLI is a declared external dependency with a tasks.md checkbox fallback** — rejected: treating `openspec status --json` as ambient. It appeared in phase notes but in no goal or prereq, and silently contradicted the zero-dependency claim.
- **Worktree path resolution lands in phase 1** — rejected: deriving it here or in phase 4. Circular dependency; consume `resolveWorktreePath` from `src/repo.js`.
- **One baton per spec/phase during execute** — rejected: one baton for the whole execute stage; one baton per task. A phase is roughly one session's context; whole-stage cannot report 3-of-9.
- **MVP ships two built-in manifests (ideation, OpenSpec); superpowers moves to Full** — rejected: three built-in manifests in MVP. superpowers is a second candidate for an already-bound beat.
- **Pitwall owns the worktree beat and the cleanup handoff outright** — rejected: making them pluggable. They are the anchor and the terminus; pluggable anchors cannot be relied on.

## Feedback Strategy

**Inner-loop command**: `node --test tests/inference.test.js`

**Playground**: Seven temp-repo fixtures, each frozen at one beat, built by phase 1's
`tests/helpers/repo-fixture.js`.

**Why this approach**: Inference is a pure function of repository state, so a fixture per beat is both
the test suite and the development playground — build the fixture, run the resolver, read the beat.

## File Changes

### New Files

| File Path | Purpose |
| --- | --- |
| `src/beats.js` | The ordered beat model and the wrapper-owned detectors (worktree, cleanup) |
| `src/inference.js` | `resolveBeat(cwd)` — current beat, completed beats, and execute progress |
| `src/progress.js` | `n of N` for the execute beat: openspec JSON path and `tasks.md` fallback |
| `providers/ideation-ideate.md` | Beat 1 binding: `/ideation:brainstorm` |
| `providers/ideation-refine.md` | Beat 3 binding: `/ideation:ideation` |
| `providers/ideation-contract.md` | Beat 4 binding: contract artifacts |
| `providers/openspec-specs.md` | Beat 5 binding: `/spec:propose` |
| `providers/openspec-execute.md` | Beat 6 binding: `/spec:apply` |
| `tests/inference.test.js` | Beat resolution across all seven fixtures |
| `tests/fixtures/*` | Seven fixture builders, one per beat (the count is asserted) |

### Modified Files

| File Path | Changes |
| --- | --- |
| `src/openspec.js` | Add `changeStatus(cwd, changeId)` returning `{done, total}`; record the real field names observed by phase 1's probe |

## Implementation Details

### Beat model

**Overview**: Seven ordered beats. Two are wrapper-owned and have built-in detectors; five bind to
provider manifests.

```js
export const BEATS = [
  { id: 'ideate',   owner: 'provider' },
  { id: 'worktree', owner: 'wrapper'  },
  { id: 'refine',   owner: 'provider' },
  { id: 'contract', owner: 'provider' },
  { id: 'specs',    owner: 'provider' },
  { id: 'execute',  owner: 'provider', progress: true },
  { id: 'cleanup',  owner: 'wrapper'  },
];
```

**Key decisions**:

- The list is fixed and exported, not configurable. Goal 1's "7/7 beats" is a standing invariant, and `tests/fixtures` is asserted to have exactly seven entries.
- Wrapper-owned beats still expose a `command`/`model` for the baton, sourced from a manifest with `stage: worktree` / `stage: cleanup`; what is *not* pluggable is the detector.

### resolveBeat

**Overview**: Walks `BEATS` in order and returns the first beat whose detector does not pass.

```js
/** @returns {{ beat:string, completed:string[], skipped:string[],
 *              progress?:{done:number,total:number}, provider:Provider }} */
export function resolveBeat(cwd, providers) {}
```

**Key decisions**:

- Return `skipped` explicitly: beats that are incomplete but sit *before* a complete beat — the holes later work has already run past. Silently advancing past hand-done work is acceptable; hiding it is not. The current beat is incomplete and sits before every complete beat after it, so it would qualify by that rule; it is excluded, because it is already reported as `beat` and naming it twice would have one baton say "do the worktree beat" and "you skipped the worktree beat" at once.
- The `ideate` beat has no artifact, so its detector is "a later beat is complete, or a branch other than the default is checked out". A rough-ideation conversation leaves no file by design.
- `worktree` is complete when `inWorktree(cwd)` is true **or** the resolved worktree path for the current branch exists.
- `cleanup` is complete when the branch is merged into the default branch and no worktree for it remains.
- Detector failures (a `doneWhenCmd` that crashes) are treated as "not done" and surfaced in a `warnings` array, never thrown — a broken third-party detector must not make `pw` unusable.

**Implementation steps**:

1. Write `tests/inference.test.js` red with all seven fixtures plus a skipped-beat case.
2. Implement the ordered walk over wrapper detectors first (worktree, cleanup) — they need no manifests.
3. Wire provider detectors via phase 1's evaluator.
4. Add `skipped` and `warnings` last, with a fixture where the contract exists but no worktree does.

**Feedback loop**:

- **Playground**: `tests/fixtures/` builders; each returns a temp repo path frozen at one beat.
- **Experiment**: each of the 7 beats; a repo with contract-but-no-worktree (skipped); a repo where a `doneWhenCmd` exits 127.
- **Check command**: `node --test tests/inference.test.js`

### Execute progress

**Overview**: One shape, two sources.

```js
/** @returns {{done:number,total:number,source:'openspec'|'tasks-md'}} */
export function executeProgress(cwd, changeId) {}
```

**Key decisions**:

- The openspec path is tried first and falls back on *any* failure — CLI absent, non-zero exit, unparseable JSON, or a shape that does not match the fields phase 1's probe recorded. Shape mismatch is a fallback trigger, not a crash, because the JSON contract is unverified.
- The `tasks.md` fallback counts `- [x]` against `- [ ]` at any indent depth, ignoring fenced code blocks so an example checkbox in a snippet is not counted.
- `total` of 0 is reported as-is, not as "done". A change with no tasks is a specs-beat problem, and reporting `0 of 0` complete would hide it.

**Feedback loop**:

- **Playground**: a fixture change directory with a handwritten `tasks.md`, plus a stub `openspec` on PATH.
- **Experiment**: 0/0, 0/3, 2/3, 3/3; a `tasks.md` with a checkbox inside a fenced block; stub emitting malformed JSON.
- **Check command**: `node --test tests/inference.test.js`

### Built-in provider manifests

**Overview**: Five manifests binding the five pluggable beats to the operator's current toolchain.

| Stage | Command | Model | Detector |
| --- | --- | --- | --- |
| `ideate` | `/ideation:brainstorm` | opus | (inherits the ideate rule above) |
| `refine` | `/ideation:ideation` | opus | `doneWhenPathExists: docs/ideation/*/contract-data.json` |
| `contract` | `/ideation:ideation` | opus | `doneWhenPathExists: docs/ideation/*/contract.md` |
| `specs` | `/spec:propose` | opus | `doneWhenPathExists: openspec/changes/*/tasks.md` |
| `execute` | `/spec:apply` | opus | `doneWhenCmd` — all tasks checked |

**Key decisions**:

- Every model/effort value lives in these files and nowhere in `src/`. Criterion 2 greps `src/` for model names and must find none.
- The `refine` and `contract` beats both bind to `/ideation:ideation` — the same command answers two beats, distinguished by detector. That is expected, not a smell: the interview and the contract are one session's work, and collapsing them would break the 7-beat model the goal is stated against.

## Testing Requirements

### Unit Tests

| Test File | Coverage |
| --- | --- |
| `tests/inference.test.js` | All 7 beats resolve correctly; skipped beats reported; execute progress from both sources; detector crash degrades to a warning |

**Key test cases**:

- Fixture count is exactly 7 (`test "$(ls tests/fixtures | wc -l)" -eq 7` is part of criterion 1).
- Contract present but no worktree → current beat is `worktree`, `completed` names the later complete beats, and `skipped` is empty because the only incomplete beat before them is the current one.
- A hole behind a later beat (contract and specs done, `refine` never run, no worktree) → current beat is `worktree` and `skipped` is `['refine']`.
- Every beat complete → `beat: null`, `index: 7`, `provider: undefined`, no `progress`.
- `openspec` stub emits malformed JSON → progress falls back to `tasks.md` with `source: 'tasks-md'`.
- A `doneWhenCmd` exiting 127 → beat is not-done, one warning, no throw.

### Manual Testing

- [ ] Run `resolveBeat` against this very repo and confirm it reports the `specs` beat.

## Failure Modes

| Component | Failure Mode | Trigger | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| resolveBeat | Silent skip | Operator does a stage by hand out of order | Baton points at work already done | Return `skipped[]` and render it |
| resolveBeat | Hard stall | A detector always returns false | `pw` repeats the same baton forever | Warnings array names the failing detector and its manifest path |
| resolveBeat | Wrong repo | Called from inside a submodule | Beats resolved against the wrong tree | Phase 1's superproject guard: `resolveBeat` anchors on `git rev-parse --show-superproject-working-tree` (walked to the outermost one) and warns that it did |
| executeProgress | Phantom completion | `tasks.md` absent and CLI absent | Reports `0 of 0`, reads as done | `total: 0` is reported literally, never as complete |
| executeProgress | Miscount | Checkbox inside a fenced code block | Progress overstated | Strip fenced blocks before counting |
| executeProgress | Shape drift | A future openspec changes its JSON keys | Progress silently wrong | Validate against probed field names; fall back on mismatch |
| Manifests | Hardcoded model leak | A model name added to `src/` for convenience | Goal 2 violated invisibly | Criterion 2's grep fails the build |

## Validation Commands

```bash
node --test tests/inference.test.js && test "$(ls tests/fixtures | wc -l)" -eq 7
node --test tests/
```

## Open Items

- [x] Record the real `openspec status --json` field names here once observed; until then the fallback is the primary path.
  Observed on openspec 1.9.0: `status --json` exits 1 without `--change`, and with `--change <id>`
  returns `changeName, schemaName, planningHome, changeRoot, artifactPaths, isPlanningComplete,
  isComplete, applyRequires, nextSteps` — **no task counts at all**, so it is not the source. The
  counts live in `instructions apply --change <id> --json` (`progress: {total, complete, remaining}`)
  and in `list --json` (`changes: [{name, completedTasks, totalTasks, lastModified, status}]`); both
  are recorded as constants in `src/openspec.js` and validated before use, with a shape mismatch
  falling back to `tasks.md`. See the Technical Approach above.

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
