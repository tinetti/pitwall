# Implementation Spec: Pitwall - Phase 3

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

Phase 3 turns the inference result into the thing the operator actually reads: one baton. It ships
`/pitwall:next` — a single surface printing the current beat, the completed beats, `n of N` execute
progress, and the handoff itself (command, model, effort, and whether to `/clear`). Two critics
independently killed a separate `status` command in MVP, so there is exactly one renderer here.

It also ships the gitignore preflight. The contract's blocker was that "artifacts are tracked" was
asserted as a test over Pitwall's own fixtures, where a fresh `git init` passes for free while the
real host repo still loses the change folder at cleanup. The fix is to make it a *product feature*:
`pw next` runs `git check-ignore` over the artifact paths its providers declare and reports every hit.

Runs in parallel with phase 4; both depend only on phase 2.

## Decisions Considered and Rejected

_Carried from the contract; consult before making gap decisions._

- **One command surface: `/pitwall:next` prints position and baton together** — rejected: shipping `/pitwall:status` as a separate MVP command. Two lenses independently found `status` traced to no goal and covered by no criterion, while duplicating rendering, alias, manifest, and README surface.
- **The gitignore hazard becomes a shipped preflight, not an acceptance assertion** — rejected: `tests/artifacts-tracked.test.js`. It asserted a host-repo property Pitwall's own fixtures cannot observe.
- **Hybrid authority — direct (baton) by default, drive (`--auto`) deferred** — rejected: a pure orchestrator launching every session. Baton mode is the half used daily and needs no new infrastructure.
- **Provider manifests carry model and effort; nothing in `src/`** — rejected: sensible defaults in code. Goal 2 requires 100% of stages to route from a manifest.
- **The cleanup baton ships in MVP with a manifest-configured target defaulting to `/mar`** — rejected: cleanup in Full with `/mar` hardcoded. `/mar` is a personal dotfile plus `gh`/`jq`; installing the plugin alone would emit a baton to a command that does not exist.

## Feedback Strategy

**Inner-loop command**: `node --test tests/baton.test.js`

**Playground**: The phase-2 fixtures, plus a golden-output comparison so rendering changes are visible
as a diff rather than as prose.

**Why this approach**: The output *is* the product here, so a golden file is the fastest way to see
what changed; every other check is a pure function over the inference result.

## File Changes

### New Files

| File Path | Purpose |
| --- | --- |
| `src/baton.js` | Render the beat + baton block from an inference result and its provider |
| `src/preflight.js` | `checkIgnored(cwd, paths)` via `git check-ignore --stdin` |
| `src/cli.js` | Entry point; `next` subcommand wired to inference → preflight → baton |
| `commands/next.md` | Claude Code slash command shelling out to the CLI |
| `tests/baton.test.js` | Golden output per beat; model/effort sourced from manifest |
| `tests/preflight-gitignore.test.js` | Fixture pair: ignored artifact reported, clean repo silent |
| `tests/provider-swap.test.js` | Swapping one manifest changes command *and* detector, 1-file diff |
| `tests/cli.test.js` | `run(argv, {cwd, out, err})` end to end: exit codes, `--json`, no-git guidance, root-anchored preflight |
| `tests/golden/*.txt` | Expected `pw next` output per beat |

### Modified Files

| File Path | Change |
| --- | --- |
| `src/inference.js` | Export `BUILTIN_PROVIDERS` so the CLI loads the map it hands to `resolveBeat` and derives the preflight's artifact paths from it, instead of keeping a second copy of the providers path |
| `tests/index.js` | Register the phase-3 suites so `node --test tests/` runs them on every supported Node |

## Implementation Details

### Baton renderer

**Overview**: Pure function from inference result to a string. No I/O, so it is trivially golden-testable.

```js
/** @param {ReturnType<typeof resolveBeat>} state
 *  @param {{ignored:string[]}} preflight
 *  @returns {string} */
export function renderBaton(state, preflight) {}
```

Target output:

```
feat/session-handoff · beat 5 of 7 (specs)
  ✓ ideate  ✓ worktree  ✓ refine  ✓ contract
  ▶ specs

NEXT:
  /clear, then run:
  /spec:propose add-session-handoff
  └ opus · high effort
```

**Key decisions**:

- `model` and `effort` are interpolated from the provider manifest. No default string exists in `src/`; a manifest missing `model` was already rejected at load in phase 1.
- The `handoff` key drives the middle line: `clear` → "/clear, then run:", `session` → "in a new session, run:", `inline` → "run:". Anything else is rendered verbatim, so a provider can say something Pitwall never anticipated.
- Skipped beats render as `⚠ {beat} (skipped)` rather than being hidden.
- Warnings from failing detectors render last, with the offending manifest path — a silent `pw` that repeats a beat is the worst failure mode this tool has.

**Implementation steps**:

1. Write `tests/baton.test.js` red against golden files for beats 1, 5 (with progress), and 7.
2. Implement the header, the beat strip, and the NEXT block.
3. Add skipped/warning rendering.
4. Assert no model name appears in `src/` (criterion 2's grep) as a test, not only as a CI command.

**Feedback loop**:

- **Playground**: `tests/golden/` — regenerate with `UPDATE_GOLDEN=1 node --test tests/baton.test.js`.
- **Experiment**: beat 1 (nothing done), beat 6 with `2 of 4`, beat 6 with `0 of 0`, a skipped beat, a detector warning.
- **Check command**: `node --test tests/baton.test.js`

### Gitignore preflight

**Overview**: Asks git whether any path the workflow will write is ignored in *this* repo.

```js
/** @returns {{ignored:string[]}} */
export function checkIgnored(cwd, paths) {}
```

**Key decisions**:

- Paths come from the providers' `doneWhenPathExists` globs plus the two wrapper-owned locations (`docs/ideation/`, `openspec/`), de-globbed to their first literal segment. Asking git about a glob is meaningless; asking about `openspec/` is exactly right.
- Uses `git check-ignore --stdin -z`, one process for all paths. Exit code 1 means "nothing ignored" and is the success case — treating it as an error is the obvious bug here.
- The preflight **reports and continues**; it never blocks the baton. The contract puts automatic `.gitignore` editing out of scope, and refusing to work is not the operator's ask.

**Implementation steps**:

1. Write `tests/preflight-gitignore.test.js` red with the required fixture pair — a repo ignoring `openspec/` (must be reported) and a clean repo (must be silent).
2. Implement the single-process `check-ignore` call.
3. Wire the result into `renderBaton` as a warning block.

**Feedback loop**:

- **Playground**: two temp repos, one with `/openspec/` in `.gitignore`.
- **Experiment**: nothing ignored; one path ignored; all paths ignored; no `.gitignore` at all.
- **Check command**: `node --test tests/preflight-gitignore.test.js`

### CLI entry

**Overview**: `pw next` — load providers, resolve the beat, run the preflight, print the baton.

**Key decisions**:

- Exit code is 0 whenever a beat resolved, including when the preflight found problems. The preflight is advice; the baton is the product.
- `--json` prints the raw inference result for the slash command and for future `--auto` to consume, so phase 5 and any v2 work never re-parse human text.
- The slash command `commands/next.md` is a thin wrapper that runs the CLI and shows its output verbatim — no model frontmatter of its own, because the *baton* names the model for the *next* session, not for this one.

**Feedback loop**:

- **Playground**: run `node src/cli.js next` inside each phase-2 fixture.
- **Experiment**: each beat; a repo with no providers directory; a non-git directory.
- **Check command**: `node --test tests/cli.test.js` — the baton suite renders from synthetic state
  and cannot see exit codes, `--json`, or the root-vs-cwd wiring.

### Provider swap test

**Overview**: Proves goal 3 mechanically — swapping a provider costs exactly one file edit.

**Implementation steps**:

1. Copy a fixture repo, commit it so the working tree is clean.
2. Overwrite one file under `providers/` with an alternate binding (different `command` and different `doneWhenPathExists`).
3. Assert `git status --porcelain` has exactly 1 line and its path starts with `providers/`.
4. Assert the emitted baton's command changed **and** the resolved beat changed — command-only would not prove the detector swapped with it.

**Feedback loop**:

- **Playground**: the copied fixture repo.
- **Experiment**: swap the execute provider from `/spec:apply` to `/ideation:execute-spec` and confirm both outputs move.
- **Check command**: `node --test tests/provider-swap.test.js`

## Testing Requirements

### Unit Tests

| Test File | Coverage |
| --- | --- |
| `tests/baton.test.js` | Golden output per beat; manifest-sourced model/effort; skipped and warning rendering; no model literal in `src/` |
| `tests/preflight-gitignore.test.js` | Ignored artifact reported; clean repo silent; missing `.gitignore` |
| `tests/provider-swap.test.js` | One-file diff; command and detector both change |
| `tests/cli.test.js` | Baton on exit 0; one-line no-git guidance on exit 2 with no stack; `--json` parses; unknown command and unknown `next` option exit 2; `--help` answered after the subcommand; `IGNORED BY GIT` still reported from a subdirectory |

**Key test cases**:

- `git check-ignore` exiting 1 is success, not failure.
- A provider whose `handoff` value is unrecognised renders it verbatim rather than dropping the line.
- `0 of 0` progress renders as `0 of 0`, never as complete.

### Manual Testing

- [ ] Run `pw next` in this repo and confirm it names the `specs` beat and the OpenSpec baton.
- [ ] Run `pw next` in `tinetti_dev_tools` and confirm the preflight reports `/openspec/` as ignored.

## Failure Modes

| Component | Failure Mode | Trigger | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| Baton renderer | Silent wrong model | A manifest omits `effort` | Baton implies a default that was never chosen | Render only what the manifest declares; omit the line entirely |
| Baton renderer | Stale repetition | Detector never passes | Same baton forever, operator loops | Warnings block names the manifest and detector |
| Preflight | Inverted logic | `check-ignore` exit 1 read as error | Every clean repo reports a failure | Explicit exit-code test |
| Preflight | False alarm | Glob passed to `check-ignore` unmodified | Noise on every run, operator stops reading it | De-glob to the literal prefix |
| CLI | Unusable outside a repo | Run in `$HOME` | Stack trace instead of guidance | Detect no-git and print a one-line explanation, exit 2 |
| Swap test | Vacuous pass | Only the command asserted | A hardcoded detector would still pass | Assert the resolved beat changes too |

## Validation Commands

```bash
node --test tests/baton.test.js && grep -rqE '(opus|sonnet|haiku)' providers/ && ! grep -rqE '(opus|sonnet|haiku)' src/
node --test tests/preflight-gitignore.test.js
node --test tests/provider-swap.test.js
node --test tests/
```

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
