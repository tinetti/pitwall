# Implementation Spec: Pitwall - Phase 1

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

Phase 1 builds the substrate every later phase reads: a repository skeleton with no build step, a
deliberately small frontmatter parser, the provider-manifest loader, and the repo-shape helpers that
locate a worktree. Nothing user-facing ships here — no commands, no plugin manifest — because the
command set is still moving and a second place to register commands would drift.

Runtime is plain ESM JavaScript on Node with JSDoc annotations rather than TypeScript. The contract
forbids a build step, and `.js` keeps `engines.node` at `>=22.0.0` instead of requiring the 22.18+
type-stripping runtime. Types are documented, not enforced; that tradeoff is recorded in Open Items.

The load-bearing constraint is the *cap* on the frontmatter parser. The contract rejected a general
YAML parser, so this parser accepts exactly `key: value` scalar lines between `---` fences and
**throws** on anything else — a leading `-`, a nested indent, a `|` or `>` block. Throwing is the
feature: it prevents a general YAML dialect from accreting one manifest at a time.

## Decisions Considered and Rejected

_Carried from the contract; consult before making gap decisions._

- **Provider manifests are markdown with flat scalar-only frontmatter; parser capped at `key: value`, body is baton text** — rejected: general YAML (library or hand-rolled), and pure JSON manifests. Nothing outside Pitwall's loader reads these files, so the "idiom" argument buys only familiarity; the body doubling as baton prose earns the markdown, and capping the parser removes YAML edge cases from the blocking phase.
- **Detectors are two declarative keys judged by path glob or exit code** — rejected: arbitrary predicate logic or shell-eval inside the manifest. An unbounded detector is a plugin execution runtime no goal asks for.
- **Worktree path resolution lands in phase 1, consumed by both inference and the worktree command** — rejected: phases 2 and 4 parallel with the derivation living in phase 4. The worktree is the anchor for inference, so phase 2's detectors need the derivation phase 4 was going to implement.
- **The openspec CLI is a declared external dependency with a tasks.md fallback** — rejected: treating `openspec status --json` as ambient. The capability probe lands here so phase 2 can branch on it.
- **Zero third-party npm runtime dependencies; `node --test` as the harness** — rejected: a test framework plus a YAML library. A workflow tool that must run in any repo cannot carry an install step.
- **Infer stage from repository reality; ship no state file** — rejected: `.pitwall/state.json`. A second source of truth drifts the moment a stage is done by hand.

## Feedback Strategy

**Inner-loop command**: `node --test tests/frontmatter.test.js`

**Playground**: The `node --test` runner against temp-directory git fixtures built by
`tests/helpers/repo-fixture.js`.

**Why this approach**: Every phase-1 unit is a pure function over strings or over a throwaway git
repo, so a scoped test file is the tightest possible loop — sub-second, no server, no network.

## File Changes

### New Files

| File Path | Purpose |
| --- | --- |
| `package.json` | `type: module`, `engines.node >=22.0.0`, `test` script, **no** `dependencies`, **no** `build` script |
| `.gitignore` | `node_modules/` only — must NOT ignore `docs/`, `openspec/`, or `providers/` |
| `src/frontmatter.js` | Capped parser: flat `key: value` scalars between `---` fences; throws on list/nested/block syntax |
| `src/providers.js` | Load, validate, and index `providers/*.md` manifests by stage |
| `src/repo.js` | `findMainWorktree`, `resolveWorktreePath`, `currentBranch`, `defaultBranch`, `hasRemote`, `inWorktree` |
| `src/openspec.js` | Capability probe for the `openspec` CLI; records the JSON field names inference will read |
| `tests/helpers/repo-fixture.js` | Build a throwaway git repo in a temp dir; used by phase-1 tests |
| `tests/frontmatter.test.js` | Parser accept/reject cases |
| `tests/providers.test.js` | Manifest load, validation, and detector-shape rejection |
| `tests/repo.test.js` | Worktree path derivation, remote-less fallback, main-worktree resolution |

## Implementation Details

### Frontmatter parser

**Overview**: Splits a manifest into `{ meta, body }`, where `meta` is a flat string map and `body`
is the verbatim markdown used later as baton text.

```js
/**
 * @param {string} source
 * @returns {{ meta: Record<string,string>, body: string }}
 * @throws {Error} on list, nested, or block scalar syntax
 */
export function parseManifest(source) {}
```

**Key decisions**:

- Reject rather than ignore unsupported syntax. A silently-ignored `-` item is a manifest that lies.
- Values are trimmed strings; no coercion to number or boolean. Consumers coerce what they need.
- Quotes are stripped only when they wrap the entire value, so a glob containing `*` needs no quoting.

**Implementation steps**:

1. Write `tests/frontmatter.test.js` first, red: valid flat manifest, missing closing fence, list item, nested indent, `|` block, duplicate key, empty body.
2. Implement the fence split and line loop until green.
3. Add the duplicate-key rejection last — it is the case most likely to be forgotten.

**Feedback loop**:

- **Playground**: `tests/frontmatter.test.js` with one smoke case, run in watch-free single-shot mode.
- **Experiment**: parse a 0-key manifest, a 1-key manifest, a manifest whose body contains `---`, and each rejection case.
- **Check command**: `node --test tests/frontmatter.test.js`

### Provider manifest schema and loader

**Overview**: A provider manifest binds one workflow beat to a command, a model, and a done-detector.

```
---
stage: contract
command: /ideation:ideation
model: opus
effort: high
handoff: clear
doneWhenPathExists: docs/ideation/*/contract-data.json
doneWhenCmd: (optional; exit 0 means done)
---
Run the ideation interview to produce the contract. …baton body…
```

```js
/** @typedef {{stage:string,command:string,model:string,effort?:string,handoff?:string,
 *             doneWhenPathExists?:string,doneWhenCmd?:string,body:string,path:string}} Provider */
/** @returns {Map<string, Provider>} keyed by stage */
export function loadProviders(dir) {}
```

**Key decisions**:

- Required keys are `stage`, `command`, `model`, and at least one `doneWhen*`. A manifest missing a detector is rejected — a stage that can never be marked done would stall inference forever.
- Exactly one manifest per stage. Two manifests claiming the same stage is an error, not a precedence puzzle.
- `doneWhenPathExists` is a glob resolved relative to the repo root; `doneWhenCmd` is judged by exit code only, stdout ignored.
- **No detector DSL.** No expression evaluation, no boolean combinators. If both keys are present, both must pass.

**Implementation steps**:

1. Write `tests/providers.test.js` red: valid load, missing detector, duplicate stage, unknown stage name, both-detectors-pass, one-fails.
2. Implement load + validate, returning a `Map` keyed by stage.
3. Implement detector evaluation as two small functions so phase 2 can call them per beat.

**Feedback loop**:

- **Playground**: temp `providers/` directory written per test case.
- **Experiment**: 0 manifests, 1 manifest, 2 manifests claiming one stage, a manifest with only `doneWhenCmd`.
- **Check command**: `node --test tests/providers.test.js`

### Repo-shape helpers

**Pattern to follow**: `/Users/tinetti/tinetti_dev_tools/files/zsh/git.zsh:267-288` (`gwt`) — the sibling-path convention being ported.

**Overview**: Pure-ish functions over `git` output that answer where the main worktree is and where a
branch's worktree would live.

```js
export function findMainWorktree(cwd) {}            // absolute path
export function resolveWorktreePath(branch, cwd) {} // `${dirname(main)}/${basename(main)}-${branch.replace(/\//g,'-')}`
export function defaultBranch(cwd) {}               // origin/HEAD when a remote exists, else current HEAD's branch
export function hasRemote(cwd) {}                   // false for a fresh repo with no origin
export function inWorktree(cwd) {}                  // git-dir !== git-common-dir, and not a submodule
```

**Key decisions**:

- `inWorktree` must exclude submodules: `git rev-parse --show-superproject-working-tree` returning a path means submodule, not worktree.
- `defaultBranch` must not shell out to `git fetch`. Fetching is a side effect that belongs to phase 4's command, not to a query helper inference calls repeatedly.
- All helpers take an explicit `cwd` so fixtures can drive them without `process.chdir`.

**Implementation steps**:

1. Write `tests/repo.test.js` red against fixtures: plain repo, repo with a linked worktree, repo with no commits, repo with no remote, submodule.
2. Implement each helper over `git rev-parse` / `git worktree list --porcelain`.
3. Assert the derived path string exactly matches the `gwt` convention for a branch containing `/`.

**Feedback loop**:

- **Playground**: `tests/helpers/repo-fixture.js` — `git init` in a temp dir, optional commit, optional worktree, optional remote.
- **Experiment**: branches `feat/x`, `feat/x/y`, and `plain`; repo with and without `origin`; inside and outside the linked worktree.
- **Check command**: `node --test tests/repo.test.js`

### openspec capability probe

**Overview**: Determines once whether `openspec status --json` is usable, and records which fields
inference may read.

```js
/** @returns {{available:boolean, version?:string, fields?:string[]}} */
export function probeOpenspec(cwd) {}
```

**Key decisions**:

- The probe never throws. An absent CLI is an expected state, not an error — phase 2 falls back to parsing `tasks.md` checkboxes.
- Record the observed field names in the phase-2 spec's notes when the probe is first run against a real change; do not hardcode a shape this phase cannot verify.

**Feedback loop**:

- **Playground**: a stub `openspec` executable on `PATH` inside the fixture, so tests never depend on the real CLI.
- **Experiment**: stub present and exiting 0 with JSON; stub absent; stub present but exiting non-zero.
- **Check command**: `node --test tests/repo.test.js`

## Testing Requirements

### Unit Tests

| Test File | Coverage |
| --- | --- |
| `tests/frontmatter.test.js` | Accept flat scalars; reject lists, nesting, block scalars, duplicate keys, unterminated fence |
| `tests/providers.test.js` | Load/validate manifests; reject missing detector and duplicate stage; detector evaluation |
| `tests/repo.test.js` | Worktree path derivation incl. slashed branches; main-worktree resolution; no-remote and no-commit repos; submodule exclusion; openspec probe against a stub |

**Key test cases**:

- A manifest body containing a literal `---` line is preserved verbatim in `body`.
- `resolveWorktreePath('feat/a/b')` yields `…/repo-feat-a-b`.
- A repo with zero commits does not throw in any helper.
- A submodule is not reported as a worktree.

### Manual Testing

- [ ] `node --test tests/` passes on a clean clone with no `node_modules/`.
- [ ] `git check-ignore -q docs providers` exits non-zero (nothing the workflow writes is ignored).

## Failure Modes

| Component | Failure Mode | Trigger | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| Frontmatter parser | Silent truncation | Manifest missing the closing `---` | Body swallowed into meta; baton text disappears | Throw with the file path and line number |
| Frontmatter parser | Dialect creep | A future manifest uses a list | Parser quietly returns a string | Explicit rejection is the specified behaviour |
| Provider loader | Stage stalls forever | Manifest has no `doneWhen*` key | Inference can never advance past that beat | Reject at load time |
| Provider loader | Ambiguous binding | Two manifests claim one stage | Nondeterministic beat resolution | Reject at load time |
| repo.js | Wrong anchor | `git rev-parse` run inside a submodule | Worktree path derived from the wrong repo | Superproject check in `inWorktree` |
| repo.js | Empty-repo crash | Fresh `git init`, no commits | Helpers throw and every later beat is unreachable | Fixture covers the no-commit repo |
| openspec probe | False positive | A different `openspec` binary on PATH | Phase 2 reads fields that do not exist | Probe records fields; phase 2 falls back on shape mismatch |

## Validation Commands

```bash
node --test tests/
node -e 'const p=require("./package.json");process.exit((Object.keys(p.dependencies||{}).length===0 && !(p.scripts||{}).build)?0:1)'
```

## Open Items

- [ ] JSDoc gives documentation but no enforcement; decide in a later phase whether a `typescript` devDependency for `tsc --noEmit` is worth the contributor install step.
- [ ] Record the real `openspec status --json` field names in the phase-2 spec once the probe runs against an actual change.

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
