# Context Map: pitwall

**Phase**: 5
**Gates**: 5/5 ready
**Verdict**: GO

## Gates (Phase 5)

| Gate | Status | Evidence |
| --- | --- | --- |
| Scope clarity | ready | Phase 4 has landed (HEAD `b15b937`, working tree clean but for untracked `docs/`); `src/` holds 11 modules, `commands/` holds `next.md` + `start.md`, `providers/` holds 6 manifests, `tests/` holds 9 suites. The 8 new paths and 2 modified paths at `spec-phase-5.md:50-64` are all named. **Six unlisted modified files** are pinned to exact assertions: `tests/index.js` must gain `import './commands.test.js';` (fifth consecutive phase the table omits it); `tests/inference.test.js:79-86` asserts the shipped manifest key set is exactly `['contract','execute','ideate','refine','specs','worktree']` and its title says "cleanup is the last one still unmanifested"; `tests/inference.test.js:141-143` asserts `resolve(cleanupFixture().dir).provider === undefined` and **loses its subject entirely** once cleanup is bound — after this phase no beat is unmanifested, so the case must move to a synthetic empty provider map or be deleted; `tests/golden/cleanup.txt` regenerates the moment `providers/pitwall-cleanup.md` lands; `src/baton.js` must grow a position-only render path for `pw status` (the spec lists only `src/cli.js`); `tests/cli.test.js` / `tests/baton.test.js` need the `status` cases. Two spec items cannot be built as literally written and need a decision, both recorded under Risks with measured evidence (`providers/superpowers-execute.md` makes `loadProviders` throw; the cleanup baton renders `/mar add-thing`). |
| Pattern familiarity | ready | Every packaging precedent on this machine was read, not assumed: all **79** `plugin.json` files under `~/.claude/plugins` were surveyed for their key sets (none declares `commands`); `~/.claude/plugins/marketplaces/tinetti/.claude-plugin/marketplace.json` read for the `ideation` github-source entry shape; `~/.claude/plugins/marketplaces/tinetti/scripts/sync-marketplace.ts:63-73` read and confirms the spec's object-source-preservation claim verbatim; `~/.claude/plugins/cache/nicknisi/ideation/0.26.0/` read as the closest github-sourced sibling layout. All four vendoring sources read end-to-end (`~/.claude/commands/spec/{apply,archive,explore,propose}.md`), plus `~/tinetti_dev_tools/files/home/.claude/commands/mar.md`. In-repo: `src/cli.js:1-189` (whole transport layer), `src/baton.js:1-141` (whole renderer), `src/providers.js:27-71`, `src/frontmatter.js:1-95`, `src/beats.js:63-85` (`cleanupIsDone`), `src/inference.js:99-121`, `src/preflight.js:73-81`, `tests/inference.test.js:1-395`, `tests/provider-swap.test.js:1-97`, `tests/cli.test.js:1-80`, `tests/baton.test.js:1-60,270-295`, `commands/next.md`, `commands/start.md`, `providers/pitwall-worktree.md`. |
| Dependency awareness | ready | Full blast radius mapped below and measured where measurable. `src/cli.js` gains a third verb; its only importer is `tests/cli.test.js:7` and, after this phase, `bin/pw` — the export surface stays at `run` alone. `providers/pitwall-cleanup.md` is the widest-radius file: it feeds `loadProviders` (`src/providers.js:27`), `artifactPaths` (`src/preflight.js:73-81`), `resolveBeat` (`src/inference.js:107`) and `renderBaton` (`src/baton.js:93`), and turns three green assertions red exactly as `providers/pitwall-worktree.md` did in phase 4. `providers/superpowers-execute.md` was **measured** to throw `duplicate stage \`execute\`` from `src/providers.js:57-60`, which would break every invocation of `next`, `start` and `status`. Cross-repo consumers named: `tinetti/claude-plugins`'s `marketplace.json`, and the `~/.claude/commands/spec/` originals that `providers/openspec-{specs,execute}.md` point at. |
| Edge case coverage | ready | Concrete list below, with every packaging and adoption behaviour **measured this session** rather than inferred — including four the spec does not mention (an extensionless `bin/pw` loads as ESM under Node 26 even without `"type":"module"`; `parseManifest` returns `{meta:{},body:source}` rather than throwing when a command file has no frontmatter at all, so "every command file parses" is satisfiable by a file with no frontmatter; `renderBaton` appends `state.changeId` to *every* provider command including `/mar`; nested command subdirectories have no precedent anywhere in the 79-plugin corpus, so `/pitwall:spec:apply` vs `/spec:apply` is unverified). |
| Test strategy | ready | Inner loop `node --test tests/commands.test.js`; full gate `node --test tests/` **verified green right now at 215 tests / 0 fail** (~28 s) on node v26.0.0 / git 2.50.1, so any red after this phase is phase 5's. The spec's zero-dependency validation command was run verbatim and **exits 0** today. All four vendoring sources plus both existing command files were run through `parseManifest` this session and all six parse (hyphenated keys `allowed-tools` / `argument-hint` are accepted by `src/frontmatter.js:10`). `tests/provider-swap.test.js:39-51`'s `committedCopy()` is the ready-made harness for any test that needs a throwaway plugin tree. |

## Gates (Phase 4 — retained for reference)

| Gate | Status | Evidence |
| --- | --- | --- |
| Scope clarity | ready | The 3 new paths and 2 modified paths in `spec-phase-4.md:48-57` are all named with a concrete signature, and phase 3 has landed (commit `dad4229`). **Four unlisted modified files** were identified and pinned to exact assertions: `tests/index.js` must gain `./worktree.test.js`; `tests/golden/worktree.txt` regenerates the moment `providers/pitwall-worktree.md` lands; `tests/inference.test.js:79-83` asserts the shipped manifest set; `tests/inference.test.js:133-135` asserts `resolve(worktreeFixture().dir).provider === undefined`. |
| Pattern familiarity | ready | `gwt` re-read at `/Users/tinetti/tinetti_dev_tools/files/zsh/git.zsh:265-289`. Every file the phase touches or imitates was read end-to-end: `src/repo.js:1-157`, `src/cli.js:1-105`, `src/baton.js:108-141`, `src/preflight.js:73-123`, `src/inference.js:23-40,59-122`, `src/beats.js:24-61`, `src/providers.js:27-71`, `tests/cli.test.js:1-174`, `tests/helpers/repo-fixture.js:26-178`, `commands/next.md`. |
| Dependency awareness | ready | `src/worktree.js`, `commands/start.md`, `tests/worktree.test.js` new. Forward: `src/cli.js` gains `status` in phase 5; `bin/pw` wraps `run()`; `commands/start.md` becomes an entry `tests/commands.test.js` must find in both directions; `providers/pitwall-worktree.md` sets the precedent `providers/pitwall-cleanup.md` follows. |
| Edge case coverage | ready | Every git behaviour **measured on git 2.50.1**, including three the spec does not mention and one the spec names but the existing helper does not deliver. |
| Test strategy | ready | Inner loop `node --test tests/worktree.test.js`; full gate verified green at 188 tests / 0 fail. |

## Gates (Phase 3 — retained for reference)

| Gate | Status | Evidence |
| --- | --- | --- |
| Scope clarity | ready | All 8 new paths in `spec-phase-3.md:46-53` named with concrete signatures; two unlisted modified files identified (`tests/index.js:6-9`). |
| Pattern familiarity | ready | Every phase-1/2 module and suite read end-to-end; the `Inference` typedef at `src/inference.js:13-17` pinned. Golden-file testing had no in-repo precedent. |
| Dependency awareness | ready | `src/baton.js`, `src/preflight.js`, `src/cli.js`, `commands/next.md` all new; forward consumers mapped from phases 4-5. |
| Edge case coverage | ready | `git check-ignore` semantics measured, not inferred, including three silent false-negative modes and the exit-128 case. |
| Test strategy | ready | Inner loop `node --test tests/baton.test.js`; full gate verified green at 122 tests / 0 fail. |

## Gates (Phase 2 — retained for reference)

| Gate | Status | Evidence |
| --- | --- | --- |
| Scope clarity | ready | All 8 new paths and the 1 modified path in `spec-phase-2.md:49-65` named with concrete signatures; one unlisted modified file identified (`tests/index.js`). |
| Pattern familiarity | ready | Every phase-1 module and test read end-to-end; manifest shape pinned by the `VALID` fixture at `tests/providers.test.js:11-22`. |
| Dependency awareness | ready | `src/openspec.js` had exactly one consumer (`tests/repo.test.js:14`); forward consumers mapped from phases 3-5. |
| Edge case coverage | ready | Measured against the live `openspec` 1.9.0 CLI and a real 42-task `tasks.md`. |
| Test strategy | ready | `node --test tests/` verified green at 79 tests / 0 fail before the phase began. |

## Gates (Phase 1 — retained for reference)

| Gate | Status | Evidence |
| --- | --- | --- |
| Scope clarity | ready | Greenfield repo — `git ls-files` returned 0 tracked files; the spec named all 10 new files with a concrete signature for every exported function. |
| Pattern familiarity | ready | `/Users/tinetti/tinetti_dev_tools/files/zsh/git.zsh:267-288` (`gwt`) read along with `git-default-branch` (:3-7) and `git-main-worktree` (:115-117). |
| Dependency awareness | ready | No existing consumers; forward consumers mapped from the later phase specs. |
| Edge case coverage | ready | Verified empirically against live repos (zero-commit repo, real linked worktree, macOS tmpdir symlink, no-remote repos). |
| Test strategy | ready | `node --test tests/` with per-file inner loops; node v26.0.0 and git 2.50.1 confirmed present. |

## Key Patterns

### Phase 5 (the code and artifacts phase 5 must consume, imitate, or copy)

**Packaging**

- `/Users/tinetti/.claude/plugins/marketplaces/tinetti/.claude-plugin/marketplace.json` — the `ideation` entry is the exact shape the hand-written Pitwall entry must match: `{name, source:{source:'github', repo:'tinetti/pitwall'}, description, repository, author, maintainer, keywords}`. Note what a github-sourced entry **omits**: no `version` key (the plugin's own `plugin.json` owns it) and no `./plugins/...` path. Top-level keys are `name, description, upstream, owner, plugins`; entries are sorted by name.
- `/Users/tinetti/.claude/plugins/marketplaces/tinetti/scripts/sync-marketplace.ts:63-73` — the preservation rule, verbatim: `marketplace.plugins.filter(p => typeof p.source === 'object')` is kept and re-merged with the regenerated `./plugins/*` entries, then sorted by `name.localeCompare`. The spec's claim at `spec-phase-5.md:16-17` is **true as stated**; an object `source` is the only thing that survives a sync.
- `/Users/tinetti/.claude/plugins/cache/nicknisi/ideation/0.26.0/.claude-plugin/plugin.json` — the closest github-sourced sibling. Keys used: `name, version, homepage, description, author, keywords`. No `commands`, no `repository`, no `license`. Its repo root carries `README.md`, `LICENSE`, `package.json` and the content directories — the layout `tinetti/pitwall` should mirror.
- **All 79 `plugin.json` files under `~/.claude/plugins` were surveyed; not one declares a `commands` key.** The only structural keys that appear anywhere are `skills` and `hooks` (in the `.cursor-plugin`/`.codex-plugin`/`.kimi-plugin` variants of superpowers) and `mcpServers` (chrome-devtools-mcp) — and in each case the value is a list of **paths**, not of command names. Commands are discovered by convention from `commands/`. See Risks: the spec's "`plugin.json` lists exactly the shipped commands" has no precedent to copy and needs a decision about where the declared list lives.
- `/Users/tinetti/Projects/pitwall/package.json` — currently `{name, version, description, type:"module", license, engines:{node:">=22"}, scripts:{test}}`. There is no `dependencies`, no `devDependencies`, no `build`. The `bin` key is the only addition this phase; adding anything else to `scripts` risks the criterion.

**Cleanup baton**

- `/Users/tinetti/Projects/pitwall/providers/pitwall-worktree.md` — the exact precedent `providers/pitwall-cleanup.md` must follow, and it already answers the phase-4 question the spec re-poses here. It carries `doneWhenCmd: false` (a detector that is provably dead code, because `src/inference.js:31-32` short-circuits both wrapper-owned beats) plus a body paragraph explaining *why* the dead detector is there. Copy that shape exactly: `doneWhenCmd: false` and **not** `doneWhenPathExists`, because a path detector would leak into `artifactPaths` (`src/preflight.js:73-81`) and print a spurious `IGNORED BY GIT` line.
- `/Users/tinetti/Projects/pitwall/src/beats.js:63-85` — `cleanupIsDone`. Wrapper-owned and unchanged this phase: branch and base both present and different, `isMerged(branch, base)`, and no directory at the `gwt` convention path. Both conditions are already required, which is the `spec-phase-5.md:161` mitigation already implemented.
- `/Users/tinetti/tinetti_dev_tools/files/home/.claude/commands/mar.md:1-12` — the baton's target. `argument-hint: "[<MR number | MR URL | source branch>]"`, `allowed-tools: Bash(git:*), Bash(gh:*), Bash(glab:*), Bash(jq:*), Bash(cd:*), Bash(pwd), ExitWorktree, AskUserQuestion`. It invokes the `merge-and-reset` skill (present at `~/.claude/skills/merge-and-reset`). This is the precise prerequisite list the README must name. Note the argument shape — it is why `/mar add-thing` (see Risks) is wrong rather than merely odd.
- `/Users/tinetti/Projects/pitwall/src/baton.js:76-106` — `nextBlock`. Three things constrain the cleanup manifest: `command` is emitted verbatim with `state.changeId` appended when non-null (`:93`); `handoff` maps through `HANDOFF_LINES` (`clear`/`session`/`inline`) and an unrecognised value is printed verbatim (`:101`); the body is indented two spaces with blank lines left bare (`:66-70`).

**`pw status`**

- `/Users/tinetti/Projects/pitwall/src/baton.js:22-57,119-141` — `header(state)` and `strip(state)` are already the exact "position without a baton" content, and they are module-private. `renderBaton` composes `[header+strip, nextBlock]` and then appends the `IGNORED BY GIT` and `WARNINGS` sections. A position-only surface is that composition minus `nextBlock`; export a second function (`renderPosition`) rather than adding a boolean parameter, and decide once whether `status` keeps the preflight and warnings sections (it should — they are position facts, not baton facts).
- `/Users/tinetti/Projects/pitwall/src/cli.js:12-22,66-86,148-152` — `USAGE` is a literal array that must gain a `status` line; `COMMANDS` is a `Map` so the third verb is one line; `next(cwd, args, io)` is the signature to match, and `status` should reuse `next`'s exact `repoRoot` guard and `--json` handling or deliberately not offer `--json`.

**Adoption / vendoring**

- `/Users/tinetti/.claude/commands/spec/{apply,archive,explore,propose}.md` — four regular files (not symlinks), 347-577 bytes each, tracked in **no** git repository (confirmed: `git -C ~/tinetti_dev_tools ls-files | grep commands` returns only `mar.md` and `merge-and-reset.md`). Their frontmatter is the model routing: `explore` and `propose` are `model: opus, effort: high`; `archive` is `model: sonnet, effort: low`; `apply` is `model: inherit` with **no `effort` key at all**. All four carry `allowed-tools: Bash(openspec:*)` and a `description` whose parenthetical restates the routing. All four bodies are the same four-part shape: "Invoke the `opsx:<verb>` skill and follow it exactly", the no-`openspec/` guard, an optional extra paragraph, then `<Label>: $ARGUMENTS`. Copy byte-for-byte per `spec-phase-5.md:124`.
- `/Users/tinetti/.claude/commands/mar.md` → symlink to `/Users/tinetti/tinetti_dev_tools/files/home/.claude/commands/mar.md` — **the precedent for the phase's Open Item**. The symlink-a-tracked-file-into-`~/.claude` pattern already exists on this machine for exactly this purpose; "delete or symlink the originals" is not a new mechanism, it is the one already in use for `/mar`.
- `/Users/tinetti/Projects/bottlebook/.claude/commands/opsx/{apply,archive,explore,propose,sync,update}.md` — what `opsx:*` actually **is**: six per-project *slash commands* under `<project>/.claude/commands/opsx/`, written by `openspec init`, with frontmatter `name, description, allowed-tools, category, tags`. `git -C ~/Projects/bottlebook check-ignore -v` confirms `.gitignore:20:.claude/` ignores them. The spec calls them "the `opsx:*` skill" (`spec-phase-5.md:125`) — they are commands, and the README/manifest note must say which. Pitwall's own repo has **no `.claude/` and no `openspec/` at all**, so the `/spec:* → opsx:*` chain does not resolve inside this repository.

**Superpowers**

- `/Users/tinetti/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/subagent-driven-development/SKILL.md` — the target exists, at version 6.3.0, installed user-scope. It is a **skill**, and superpowers ships **no `commands/` directory at all** (its top level is `skills, hooks, scripts, docs, tests, assets` plus metadata). So `superpowers:subagent-driven-development` is not a slash command; the manifest's `command:` value is the first non-slash-command baton target Pitwall would emit, and `src/baton.js:93` will still append `state.changeId` to it.
- `/Users/tinetti/Projects/pitwall/tests/provider-swap.test.js:19-31,57-66` — `ALTERNATE` plus the "costs exactly one file edit" assertion. This is already the proof the decision log says the superpowers manifest will become, and it proves it by **overwriting** `providers/openspec-execute.md` in place, asserting `^ ?M providers/openspec-execute\.md$`. Read this before deciding where `superpowers-execute.md` can live.

### Phase 4 (retained)

- `/Users/tinetti/tinetti_dev_tools/files/zsh/git.zsh:265-289` — `gwt` in full. The two-branch fork ported into `src/worktree.js`; the `--no-track` comment at :283-284 is the rationale cited verbatim. Not ported: the unconditional `origin/$(git-default-branch)` default at :268, the unconditional fetch at :282, the trailing `cd` at :288.
- `/Users/tinetti/Projects/pitwall/src/repo.js:29-47` — `findMainWorktree` (the only helper that throws) and `resolveWorktreePath(branch, cwd)`, branch-first, `/` → `-`, sibling-of-main from inside a linked worktree.
- `/Users/tinetti/Projects/pitwall/src/repo.js:13-17` — `tryGit`, the private never-throw `spawnSync` wrapper.
- `/Users/tinetti/Projects/pitwall/src/repo.js:68-84` — `hasRemote` and `defaultBranch`; `defaultBranch` is not sufficient for base selection on its own.
- `/Users/tinetti/Projects/pitwall/src/cli.js:11-20,26,39-68,78-101` — the whole transport layer; `run` answers `--help` anywhere in argv.
- `/Users/tinetti/Projects/pitwall/src/cli.js:49-53` — the not-a-repo pre-check, now factored into `repoRoot(cwd, io)` at `src/cli.js:46-53`.
- `/Users/tinetti/Projects/pitwall/src/baton.js:108-141` — `renderBaton`, pure, and its JSDoc still names `pw status` as a phase-5 caller.
- `/Users/tinetti/Projects/pitwall/src/beats.js:41-61` — `worktreePath(state)` and `worktreeIsDone(state)`; the latter derives its path from the *current* branch.
- `/Users/tinetti/Projects/pitwall/src/providers.js:12,44-52` — `REQUIRED = ['stage','command','model']` and the hard throw when a manifest declares neither detector.
- `/Users/tinetti/Projects/pitwall/providers/ideation-contract.md` — the canonical manifest text: key order `stage, command, model, effort, handoff, doneWhen*`, then two-to-three lines of second-person baton prose with no leading blank. `providers/openspec-execute.md` is the `doneWhenCmd` variant.
- `/Users/tinetti/Projects/pitwall/tests/helpers/repo-fixture.js:58-95` — `createRepo({name, branch, commit, remote, originHead, root})` and `addWorktree(repoDir, branch)`.
- `/Users/tinetti/Projects/pitwall/tests/cli.test.js:23-66` — `isolated(fn)` and `cli(argv, cwd)`. Its JSDoc explicitly says it drives `run` "exactly the way phase 5's `bin/pw` will".
- `/Users/tinetti/Projects/pitwall/commands/next.md` — the slash-command idiom; `commands/start.md` is the same skeleton plus `$ARGUMENTS` and an `argument-hint`.
- `/Users/tinetti/.claude/plugins/marketplaces/tinetti/plugins/sidequest/commands/capture.md:4` — the `argument-hint` precedent.

### Phase 3 (retained)

- `/Users/tinetti/Projects/pitwall/src/inference.js:13-17` — the `Inference` typedef, the whole input to `renderBaton`: `{beat, index, completed, skipped, progress?, provider?, branch, changeId, warnings}`. **It carries no `base`** — relevant to the cleanup baton's `git diff <default>...<branch>`.
- `/Users/tinetti/Projects/pitwall/src/inference.js:95-117` — the construction site.
- `/Users/tinetti/Projects/pitwall/src/beats.js:24-32` — `BEATS`, the fixed 7-entry ordered list.
- `/Users/tinetti/Projects/pitwall/src/providers.js:8-9` — the `Provider` typedef; `effort` and `handoff` optional and omitted rather than defaulted.
- `/Users/tinetti/Projects/pitwall/src/frontmatter.js:94` — `body` carries a trailing newline; `src/baton.js:66-70` trims it.
- `/Users/tinetti/Projects/pitwall/src/repo.js:138-140` — `worktreeRoot(cwd)` returns `null` outside a repository.
- `/Users/tinetti/Projects/pitwall/src/openspec.js:11-20` — the private `run(cwd,args)` with a 2000 ms timeout.
- `/Users/tinetti/Projects/pitwall/tests/inference.test.js:35-53` — `absent()` and `providerMap(files)`.
- `/Users/tinetti/Projects/pitwall/tests/inference.test.js:115-127` — the table-driven per-beat loop over the seven fixture builders.
- `/Users/tinetti/Projects/pitwall/tests/baton.test.js:31-46` — `assertGolden(name, actual)` with the `UPDATE_GOLDEN=1` regeneration branch.
- `/Users/tinetti/Projects/pitwall/tests/index.js:1-14` — the aggregator; every suite must be imported here or Node 26 never runs it.

### Phase 2 (retained)

- `/Users/tinetti/Projects/pitwall/src/providers.js:132-171` — `detectPathExists`, `detectCmd`; `src/providers.js:198-228` — `evaluateProvider` returning `{done, warnings}`.
- `/Users/tinetti/Projects/pitwall/src/providers.js:27-71` — `loadProviders(dir, {knownStages})`.
- `/Users/tinetti/Projects/pitwall/tests/providers.test.js:11-22` — the canonical manifest text and key order.
- `/Users/tinetti/Projects/pitwall/tests/repo.test.js:183-231` — the stub-`PATH` idiom.

### Phase 1 (retained)

- `/Users/tinetti/tinetti_dev_tools/files/zsh/git.zsh:267-288` (`gwt`) — path derivation ported at `src/repo.js:44-47`.
- `/Users/tinetti/tinetti_dev_tools/files/zsh/git.zsh:115-117` (`git-main-worktree`) — ported at `src/repo.js:29-34`.
- `/Users/tinetti/tinetti_dev_tools/files/zsh/git.zsh:3-7` (`git-default-branch`) — deliberately diverged (`src/repo.js:80-84`).
- `/Users/tinetti/Projects/pitwall/docs/ideation/pitwall/contract.md:72-91` — the decision log; consult before any gap decision.
- `/Users/tinetti/tinetti_dev_tools/files/home/AGENTS.md` — governing convention doc. **`README.md` lands this phase** (`spec-phase-5.md:57`); there is still no repo-local `CLAUDE.md`.

## Dependencies

### Phase 5

- `src/cli.js:12-22,148-152` (**modified**) — `USAGE` gains a `status` line and `COMMANDS` gains `['status', status]`. Its only current importer is `tests/cli.test.js:7`; `bin/pw` becomes the second. Keep the export surface at `run` alone — `tests/cli.test.js:44-46` already documents that contract.
- `src/baton.js` (**modified, not listed in the spec**) — `header` (`:22-28`) and `strip` (`:38-57`) are private. `pw status` needs them; export a `renderPosition(state, preflight)` beside `renderBaton` rather than duplicating the composition, and keep both pure. Consumers of `src/baton.js` today: `src/cli.js:5`, `tests/baton.test.js:8`, `tests/provider-swap.test.js:8`.
- `bin/pw` → new. Imports `run` from `../src/cli.js` and sets `process.exitCode`; must not re-parse argv (`src/cli.js:154-161` says so in a comment). Needs the executable bit committed (`git update-index --chmod=+x` if the umask loses it) and `package.json` `"bin": {"pw": "bin/pw"}`. **Measured**: an extensionless `bin/pw` containing `import` statements runs correctly under node v26 both as `node bin/pw` and as `./bin/pw`, with or without `"type":"module"` in the nearest `package.json`.
- `providers/pitwall-cleanup.md` (**new; the file with the widest blast radius this phase**) — consumed by `loadProviders` (`src/providers.js:27`, which throws unless it carries a detector key, `:47-52`), by `artifactPaths` (`src/preflight.js:73-81`, path detectors only), by `resolveBeat` (`src/inference.js:107`) and by `renderBaton` (`src/baton.js:93-104`). Landing it turns three currently-green assertions red:
  - `tests/inference.test.js:79-86` — `assert.deepEqual([...providers.keys()].sort(), ['contract','execute','ideate','refine','specs','worktree'])` must gain `'cleanup'`, and the test name "cleanup is the last one still unmanifested" must be rewritten.
  - `tests/inference.test.js:141-143` — `it('leaves provider undefined for a beat with no manifest yet')` asserts `resolve(cleanupFixture().dir).provider === undefined`. After this phase **every beat has a manifest**, so unlike phase 4 there is no beat left to re-point it at. Either delete it (and lose coverage of the unbound-beat render path, which `tests/baton.test.js` still covers synthetically) or rebuild it on `providerMap({})` (`tests/inference.test.js:48-53`).
  - `tests/golden/cleanup.txt` — currently the seven-line "no provider manifest is bound to the cleanup beat" block; it becomes a real NEXT block. Regenerate with `UPDATE_GOLDEN=1` and **read the diff** (see Risks — the naive regeneration blesses `/mar add-thing`).
  - `tests/inference.test.js:88-93` ("names a model and an effort on every manifest") does **not** break, but constrains the new manifest to carry both `model` and `effort`.
  - `tests/inference.test.js:204-229` ("falls off the end of the walk") does **not** break — it asserts `provider === undefined` only when `beat === null`, which `src/inference.js:107` guarantees independently of the manifests.
  - `tests/provider-swap.test.js:70-80` does **not** break — it resolves the cleanup fixture to `beat:'cleanup'` and never inspects the provider.
- `providers/superpowers-execute.md` (**new; cannot land in `providers/` as written**) — **measured**: `loadProviders` throws `duplicate stage \`execute\`: …/openspec-execute.md and …/superpowers-execute.md` (`src/providers.js:57-60`). Since `BUILTIN_PROVIDERS` (`src/inference.js:14`) points at `providers/` and every subcommand calls `loadProviders` on it (`src/cli.js:76,129`), shipping both files makes `pw next`, `pw start` and `pw status` all throw an unhandled error. See Risks for the three ways out.
- `commands/status.md` → new. Third entry in the `commands/` tree; whatever `tests/commands.test.js` compares against must list it.
- `commands/spec/{explore,propose,apply,archive}.md` → new, and the **first nested command subdirectory anywhere in the 79-plugin corpus on this machine**. Consumed by Claude Code's command discovery (namespacing unverified) and referenced indirectly by `providers/openspec-specs.md` (`command: /spec:propose`) and `providers/openspec-execute.md` (`command: /spec:apply`). If nesting namespaces them as `/pitwall:spec:apply`, those two manifests are silently wrong — and changing them would modify two files the spec does not list plus regenerate `tests/golden/{specs,execute}.txt`.
- `.claude-plugin/plugin.json` → new. Consumed by Claude Code's plugin loader, by `tests/commands.test.js`, and — indirectly — by the hand-written marketplace entry, which reads its `version`.
- `tests/commands.test.js` → new. Reads `.claude-plugin/plugin.json`, walks `commands/` (recursively, because of `commands/spec/`), and calls `parseManifest` (`src/frontmatter.js:44`) on each file. Also asserts `package.json` has no `dependencies` and no `build` script (`spec-phase-5.md:148`), duplicating criterion 7 in-suite.
- `tests/index.js` (**modified, not listed in the spec — fifth consecutive phase**) — must gain `import './commands.test.js';` in alphabetical position (between `./cli.test.js` and `./frontmatter.test.js`). Miss it and `node --test tests/` on Node 26 passes with phase 5's suite never running.
- `package.json` (**modified**) — `bin` only. Adding a `build` script or any dependency fails criterion 7 and the in-suite assertion.
- `README.md` → new. No consumer in code; named by contract scope line 53 and by the marketplace entry's implicit expectation.
- **Cross-repo (outside this repository's blast radius but inside the phase's)**: `tinetti/claude-plugins`'s `.claude-plugin/marketplace.json` gains a hand-written github-source entry; `~/.claude/commands/spec/` is deleted or symlinked; `~/tinetti_dev_tools/.gitignore:9` (`/openspec/`) is un-ignored before the acceptance run.

### Phase 4 (retained)

- `src/worktree.js` → imports `resolveWorktreePath` and `hasRemote`/`defaultBranch`. Consumed by `src/cli.js:10` and `tests/worktree.test.js`. Side-effects-and-facts only; the CLI owns all output.
- `src/cli.js:11-20,68` — gained `start`; the export surface stayed at `run`.
- `providers/pitwall-worktree.md` — landed with `doneWhenCmd: false`; turned three phase-3 assertions red exactly as predicted.
- `commands/start.md` — sits beside `commands/next.md`.
- `tests/index.js` — gained `./worktree.test.js`.
- `package.json` → not modified in phase 4; the `bin` key was deferred to phase 5.

### Phase 3 (retained)

- `src/baton.js` → consumed by `src/cli.js`, `tests/baton.test.js`, `tests/provider-swap.test.js`. Kept pure.
- `src/preflight.js` → consumed only by `src/cli.js`. `checkIgnored(cwd, paths)`'s `cwd` must be the repository root.
- `src/cli.js` → the file with the most forward pressure.
- `commands/next.md` → created the `commands/` directory.
- `tests/index.js` → must import every suite.
- `providers/*.md` → read by `src/preflight.js` and copied (never mutated) by `tests/provider-swap.test.js:39-51`.
- `src/inference.js` → return shape is stable; do not widen it (but see Risks — the cleanup diff line may force the question).

### Phase 2 (retained)

- `src/openspec.js` gained `changeStatus` additively; `probeOpenspec`'s shape is asserted in five places in `tests/repo.test.js:192-230`.
- `src/beats.js` → `BEATS` consumed by `src/inference.js` and as the `knownStages` argument to `loadProviders`.
- `src/progress.js` → `executeProgress` and `discoverChangeId` consumed by `resolveBeat`.
- `tests/fixtures/*` → exactly 7 entries, asserted at `tests/inference.test.js:68-70`. **`tests/commands.test.js` must not add a fixture** — that assertion counts the directory.

### Phase 1 (retained)

Phase 1 had no existing consumers; all of its forward contracts are now live.

## Conventions

- **Naming**: lowercase single-word module files under `src/`; tests mirror as `tests/<module>.test.js` and are imported from `tests/index.js`; shared scaffolding under `tests/helpers/`; per-beat builders under `tests/fixtures/<beat>.js`. Manifests are `providers/<tool>-<stage>.md` — hence `providers/pitwall-cleanup.md` and `providers/superpowers-execute.md`. Slash commands are `commands/<verb>.md`, one per CLI subcommand; `commands/spec/` is the first namespaced exception.
- **Imports**: plain ESM (`"type": "module"`), relative specifiers with explicit `.js`, node builtins via `node:`. Order in every file: node builtins, blank line, local modules. **Zero dependencies and zero devDependencies** — `package.json` has neither key, criterion 7 checks it, and `spec-phase-5.md:148` re-asserts it in-suite.
- **Error handling**: three tiers, all now established. The *loader* layer throws with `file:line: message` (`src/frontmatter.js:19-21`, `src/providers.js:45,48,54,59`). The *probe/detector* layer never throws (`src/repo.js:13-17`, `src/providers.js:198-228`, `src/openspec.js:11-20`). The *mutating* layer throws a typed `WorktreeError` that `src/cli.js:121-127` unwraps into a one-line operator message with exit 2, rethrowing anything else. `pw status` is a query, so it belongs in tier two.
- **Types**: JSDoc only, no TypeScript, no build step. `@typedef` inline at the top of the module that owns the type; `@param`/`@returns` on every export; a prose sentence above each export explaining *why*, not what.
- **Testing**: `node:test`'s `describe`/`it` + `node:assert/strict`; `after(cleanupAll)` at module top; table-driven loops where cases are uniform; `assert.throws` with a `/regex/s` naming both file and offending key. Golden files live in `tests/golden/<name>.txt`, are byte-exact, and regenerate only under `UPDATE_GOLDEN=1`. TDD is mandatory per AGENTS.md — write `tests/commands.test.js` red first, per `spec-phase-5.md:106`.
- **Comments**: sparse and rationale-only. Every existing comment explains a decision; none restates code. `commands/next.md:6-9,13-17` and `commands/start.md:7-10,14-24` establish that the same rule applies to HTML comments inside command files.
- **Model names**: `tests/baton.test.js:277-294` walks `src/` recursively and fails if `/opus|sonnet|haiku/i` appears in any file, comments included. It scans **`src/` only** — `bin/pw`, `commands/`, `README.md` and `.claude-plugin/plugin.json` are outside it, but criterion 2's shell form (`! grep -rqE '(opus|sonnet|haiku)' src/`) is equally scoped, so keep model names in `providers/` regardless. Note the vendored `commands/spec/*.md` carry `model: opus`/`model: sonnet` — correct and required, and outside `src/`.
- **Frontmatter**: `src/frontmatter.js:10` accepts `[A-Za-z_][A-Za-z0-9_-]*` keys, so `allowed-tools` and `argument-hint` parse; values are trimmed and wrapping quotes stripped (`:27-34`); lists, indents, block scalars and duplicate keys throw. Verified this session: all four `~/.claude/commands/spec/*.md`, `mar.md`, `commands/next.md` and `commands/start.md` parse cleanly.
- **New this phase**: the first executable file (`bin/pw`), the first nested command directory, the first repo-level `README.md`, the first plugin manifest, and the first files vendored verbatim from outside the repo. Pin each convention in the commit that introduces it.

## Verified Packaging, Plugin and Adoption Facts (Phase 5 — measured this session)

- **`node --test tests/` is green at 215 tests / 0 fail, ~28 s**, on node v26.0.0 / git 2.50.1. HEAD is `b15b937` ("feat: cut the branch and its worktree with `pw start`"); the working tree is clean apart from untracked `docs/`.
- **The spec's zero-dependency validation command passes today**: `node -e 'const p=require("./package.json");process.exit((Object.keys(p.dependencies||{}).length===0 && !(p.scripts||{}).build)?0:1)'` exits 0. (Note it uses `require` against a `"type":"module"` package — that works because `-e` code is CJS by default.)
- **The local repository has no `origin`** (`git remote -v` is empty) — but it now has **four commits**, contradicting `spec-phase-5.md:14`'s "at spec time, no commits". The push prerequisite stands; the "no commits" premise is stale.
- **`loadProviders` throws on a second manifest for one stage.** Measured with a copy of the shipped `providers/` plus a `superpowers-execute.md`: `duplicate stage \`execute\`: …/openspec-execute.md and …/superpowers-execute.md` (`src/providers.js:57-60`). Files are read in `.sort()` order, so `openspec-execute.md` wins the race and `superpowers-execute.md` is always the one named second.
- **A shipped cleanup manifest renders `/mar add-thing`.** Measured end-to-end: a `providers/pitwall-cleanup.md` with `command: /mar` resolved against `cleanupFixture()` produces `changeId = "add-thing"` and a NEXT block reading `/mar add-thing`. `src/baton.js:93` appends `state.changeId` to *every* provider command, and `src/inference.js:109` sets `changeId` on every beat, not just `execute`.
- **`Inference` carries no `base`.** `src/inference.js:17-20` and the construction at `:99-111` expose `branch` but never the default branch, so a baton line of the form `git diff <default>...<branch>` cannot be interpolated without widening the inference shape (which `src/beats.js:79-85` already computes as `state.base` and then discards).
- **An extensionless `bin/pw` with `import` statements works.** Measured under node v26: `node bin/pw` and `./bin/pw` both succeed, **with or without** `"type":"module"` in the nearest `package.json` (module-syntax detection is on by default). The executable bit is the only thing that must be right.
- **No `plugin.json` on this machine declares a `commands` key.** All 79 were surveyed. The only structural keys observed anywhere are `skills`/`hooks` (superpowers' `.cursor-plugin`, `.codex-plugin`, `.kimi-plugin` variants) and `mcpServers` (chrome-devtools-mcp), and in each case the value is a list of **paths**. Commands are discovered by convention from `commands/`.
- **No plugin on this machine has a nested `commands/<dir>/` subdirectory.** Every `commands/` directory found under `~/.claude/plugins` (cloudflare, spec-driven, sidequest, feature-dev, code-modernization, commit-commands, hookify, ralph-loop, …) is flat. `commands/spec/` would be the first, and its resulting slash-command name is therefore unverified on this machine.
- **`sync-marketplace.ts` really does preserve object sources** (`:63-73`), and the `ideation` entry is the live specimen: `source: {source:'github', repo:'tinetti/ideation'}`, no `version` key, with `repository`, `author`, `maintainer` and `keywords`. Entries are re-sorted by name on every sync, so a hand-written entry's position is not stable — only its content is.
- **The four `spec/*.md` originals are regular files in no git repository.** `~/.claude/commands/spec/` contains four `-rw-r--r--` files; `git -C ~/tinetti_dev_tools ls-files | grep commands` returns only `files/home/.claude/commands/{mar,merge-and-reset}.md`. The problem statement's third defect is real and unchanged.
- **`~/.claude/commands/mar.md` is already a symlink** into `~/tinetti_dev_tools/files/home/.claude/commands/mar.md`. The Open Item's "symlink" option is the mechanism already in use on this machine, not a new idea.
- **`opsx:*` are per-project slash commands, not skills**, at `<project>/.claude/commands/opsx/{apply,archive,explore,propose,sync,update}.md`, and `.claude/` is gitignored in the projects that have them (measured in `~/Projects/bottlebook`: `.gitignore:20:.claude/`). **Pitwall's own repository has no `.claude/` and no `openspec/`**, so `/spec:apply` → `opsx:apply` resolves to nothing here.
- **`~/tinetti_dev_tools/.gitignore` line 9 is `/openspec/`** — the rollout prerequisite at `spec-phase-5.md:180` is real and precisely located.
- **`superpowers` 6.3.0 is installed user-scope** at `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0`; `skills/subagent-driven-development/SKILL.md` exists; the plugin ships **no `commands/` directory**.
- **`openspec` 1.9.0 is on `PATH` at `/opt/homebrew/bin/openspec`** — every test that must not see it still needs `pathWithout('openspec')`.
- **All six command files parse under `src/frontmatter.js`.** `commands/next.md` → `description, allowed-tools`; `commands/start.md` → `description, argument-hint, allowed-tools`; `spec/apply.md` → `description, model, allowed-tools` (**no `effort`**); `spec/{archive,explore,propose}.md` → `description, model, effort, allowed-tools`; `mar.md` → `description, argument-hint, allowed-tools`.
- **`parseManifest` does not throw on a file with no frontmatter.** `src/frontmatter.js:49-51` returns `{meta:{}, body:source}` when line 1 is not `---`. "Every command file parses" is therefore satisfied by a file with no frontmatter at all; the test must assert a required key (`description`) to have teeth.

## Verified Git Facts for `startWorktree` (Phase 4 — retained, all still true)

- **`git worktree add <path> -b <branch>` on an unborn HEAD SUCCEEDS**, printing `No possible source branch, inferring '--orphan'`. Only the explicit-base form fails (`fatal: invalid reference: HEAD`). The guard must be a positive pre-check (`git rev-parse --quiet --verify HEAD`).
- **Re-running the create command errors on the branch, not the path**: `fatal: a branch named 'feat/a/b' already exists`.
- **`git worktree list --porcelain`**: blank-line-separated records, main worktree first, keys `worktree`, `HEAD`, `branch refs/heads/…`, git's realpath'd paths.
- **A deleted-but-registered worktree carries a `prunable` line** and re-adding fails with `missing but already registered worktree`.
- **A branch already checked out in another worktree — including the main checkout — is fatal**, which is exactly the `tests/fixtures/worktree.js` shape.
- **An existing non-empty target directory is fatal and distinct**: `fatal: '<path>' already exists`.
- **`origin/HEAD` unset**: `symbolic-ref` exits 128 and `src/repo.js:80-84` silently returns `currentBranch(cwd)`. `git rev-parse --quiet --verify origin/<name>` is the free local validity check.
- **`git fetch --quiet origin` in a remote-less repo**: `fatal: 'origin' does not appear to be a git repository`.
- **`git check-ref-format --branch <name>`** exits 0 for `feat/x`, 128 for `feat/x y`, `-x`, `--force`, `feat/..x`.
- **macOS tmpdir symlink persists**: compare `fs.realpathSync(cwd)`, and accept subdirectories.
- **Inference does not see the new worktree from the old cwd** — `worktreeIsDone` derives its path from the current branch.

## Verified `git check-ignore` Facts (Phase 3 — retained, all still true)

- **Exit codes are three-valued**: `0` matched, `1` nothing matched, `128` git refused.
- **A directory-only pattern matches only with a trailing slash, or if the directory exists on disk.**
- **Absolute paths never match**; repo-relative only.
- **Paths resolve against the process cwd, not the repo root.**
- **A glob passed unmodified matches and is echoed back verbatim** — hence `deglob`.
- **`--no-index` breaks the check**; do not add it.
- **Output framing**: one pathname per NUL including a trailing NUL, so the split needs `.filter(Boolean)`.
- **This repo's `.gitignore` is only `node_modules/`**, so `openspec/`, `docs/ideation/` and `providers/` all come back exit 1.

## Verified openspec 1.9.0 Facts (Phase 2 — retained, all still true)

- **`openspec status --json` (no `--change`) exits 1**, so `probe.fields` is `undefined` in production.
- **`openspec status --change <id> --json` exits 0 and carries no task counts.**
- **`openspec instructions apply --change <id> --json`** carries `progress` as `{total, complete, remaining}`.
- **`openspec list --json`** returns `{changes:[{name, completedTasks, totalTasks, …}], root:{…}}`.
- **The `tasks.md` fallback is count-exact**; `openspec/changes/*/tasks.md` excludes archived changes.
- **`timeout(1)` is not installed on this machine.**

## Verified Git/Node Facts (Phases 1-2 — retained, all still true)

- `git rev-parse --abbrev-ref HEAD` exits 128 in a zero-commit repo; `git symbolic-ref --short HEAD` is the safe form.
- `git rev-parse --path-format=absolute --git-dir --git-common-dir` avoids a relative/absolute mismatch.
- `git rev-parse --show-superproject-working-tree` exits 0 with empty output when not a submodule.
- `git worktree list --porcelain` works in a zero-commit repo and lists the main worktree first.
- macOS `os.tmpdir()` is `/var/folders/…` but git reports `/private/var/folders/…`.
- **Node is v26.0.0, git 2.50.1.**

## Edge Cases for the Builder

**Cleanup manifest and baton** — `changeId` is non-null at the cleanup beat, so `/mar` renders as `/mar <change-id>` unless the interpolation at `src/baton.js:93` is scoped (measured); the manifest must carry a detector key or `loadProviders` throws, and it must be `doneWhenCmd: false` rather than a path detector so it does not leak into `artifactPaths`; it must carry both `model` and `effort` (`tests/inference.test.js:88-93`); `handoff` must be one of `clear`/`session`/`inline` or it prints verbatim (`src/baton.js:101`); the `git diff` review line has no `base` to interpolate from (`Inference` carries none) so it is either literal placeholder prose in the body or a source change; the plugin installed without `tinetti_dev_tools` emits a baton to a `/mar` that does not exist (the spec's own failure table, mitigated by the README and by the target being manifest-configured); branch merged but worktree still present (`cleanupIsDone` already requires both, `src/beats.js:79-85`); standing on the default branch (explicitly not done, `:81`); a worktree registered off the convention path (reads as cleaned up — deliberate, and `tests/inference.test.js:212-216` depends on it).

**Packaging** — `plugin.json` must be valid JSON *and* agree with `commands/` in both directions; a command file present on disk but absent from the declared list must fail; a declared file that was renamed must fail; a command file with **no frontmatter at all** must fail (measured: `parseManifest` returns empty meta rather than throwing, so assert on `description`); a command file with malformed frontmatter (duplicate key, indented line, list item, block scalar, missing closing fence) must fail; the walk must recurse into `commands/spec/` or the four vendored files are invisible to the test; `bin/pw` must be executable in git's index, not just on disk; `bin/pw` must not re-parse argv; `package.json` must gain `bin` and nothing else; adding a `commands` key to `plugin.json` may double-register every command (no precedent to measure against).

**`pw status`** — outside a repository (same `repoRoot` guard, exit 2, no stack trace); unknown option (reject rather than ignore, matching `NEXT_FLAGS` at `src/cli.js:28,66-71`); whether `--json` is offered at all (if it is, it must be the same `Inference` shape `next --json` prints, or two scripts disagree); `beat === null` (the header says "all 7 beats complete" and there is no strip line — `src/baton.js:24-26,46`); no completed beats (the tick line is suppressed entirely, `:44`); skipped beats (rendered after the current beat, `:53-55`); whether the `IGNORED BY GIT` and `WARNINGS` sections belong on `status` (they are position facts, not baton facts — decide once); a golden file for the new surface so the "position without a baton" promise is byte-checked.

**Vendored spec commands** — `apply.md` has `model: inherit` and **no `effort` key**, so any test asserting "every vendored command names a model and an effort" fails on it; the copies must be byte-identical to the originals (`spec-phase-5.md:124`); their `$ARGUMENTS` lines must survive verbatim; the `opsx:*` layer is a per-project gitignored install and is absent from Pitwall's own repo; the originals drift the moment either copy is edited (the README must name the canonical one); if nesting renames them to `/pitwall:spec:apply`, the two OpenSpec manifests point at commands that no longer exist.

**Superpowers manifest** — shipping it in `providers/` throws `duplicate stage` on every invocation (measured); its `command` value is a skill name, not a slash command, so the baton's "run:" framing is slightly wrong and `changeId` still gets appended; adding it must cost exactly one file and zero `src/` edits or goal 3 is false (`spec-phase-5.md:134` says that is a finding, not a workaround); `git status --porcelain` showing exactly one file is satisfied by an *add* as well as an *edit*, so the manual check does not distinguish the working case from the broken one.

**Marketplace and rollout** — the local repo has no `origin` (measured); the marketplace clone available locally is a read-only cache (`~/.claude/plugins/marketplaces/tinetti`), not a working clone; the entry must be object-sourced or the next `sync-marketplace.ts` run deletes it; entries are re-sorted by name on sync; `~/tinetti_dev_tools/.gitignore:9` (`/openspec/`) destroys the change folder when `/mar` removes the worktree.

**Phase 4 edge cases (retained)** — `startWorktree` base selection (no origin; `origin/HEAD` set; `origin/HEAD` unset; unfetched default; caller-supplied base; non-`main` default), idempotence (registered and present; registered but `prunable`; present but unregistered; cwd is the target; cwd is a subdirectory; cwd in a different linked worktree; realpath mismatch), branch state (absent; exists without a worktree; already checked out in the main checkout; checked out at a non-convention path; contains `/`; invalid ref; flag-shaped; empty), repository shape (zero commits; detached HEAD; not a repository; submodule; unwritable parent; path with spaces), and the `start` subcommand's argument, flag, `--help`, outside-repo, post-create-inference-anchor, no-op, `cd`-line and exit-code cases.

**Phase 3 edge cases (retained)** — `renderBaton`: `provider === undefined`, `beat === null`, `branch === null`, `changeId === null`, completed beats after the current beat, non-empty `skipped`, three warning sources; manifest side: absent `effort`/`handoff`, unrecognised `handoff`, body trailing newline, shared `refine`/`contract` command. `checkIgnored`: exit 1 vs 128, directory-only pattern with the directory absent, absolute paths, non-root cwd, no `.gitignore`, unmodified globs, empty path list, nested-prefix duplicates, negations, `core.excludesFile`. CLI: `$HOME`, subdirectory, linked worktree, submodule, `--json` shape, unknown subcommand, no subcommand, `--help`.

**Phase 2 edge cases (retained)** — `resolveBeat`: nothing done; not in git; detached HEAD; submodule; zero commits; no origin; absent provider manifest; last beat complete; skipped-beat holes. `executeProgress`: `0/0`, fenced code blocks, tilde fences, unclosed fences, `- [X]`, `* [ ]`, nested indents, malformed/non-zero/hanging stub, multiple active changes, archived changes.

**Phase 1 edge cases (retained)** — frontmatter: literal `---` in the body, missing closing fence, duplicate key, value containing `:`, unquoted glob, CRLF. Provider loader: zero manifests, missing required key, no detector, duplicate stage, exit 127. Repo helpers: `feat/a/b` → `repo-feat-a-b`, paths with spaces, zero commits, no origin, linked worktree, submodule, detached HEAD, subdirectory cwd, not-a-repo.

## Risks

- **`providers/superpowers-execute.md` cannot be added to `providers/` — it breaks the product.** Measured: `loadProviders` throws `duplicate stage \`execute\`` (`src/providers.js:57-60`), and `BUILTIN_PROVIDERS` (`src/inference.js:14`) is that directory, loaded unconditionally by `next` (`src/cli.js:76`) and `start` (`:129`). Shipping both execute manifests makes every Pitwall command throw an unhandled error. Three ways out, all with costs: (a) ship it outside the loaded directory — `examples/superpowers-execute.md` or `providers/available/` — and have the README say the swap is "copy this over `openspec-execute.md`", which keeps the one-file property but is no longer literally "adding a file"; (b) make it a documented *replacement* the operator applies by overwriting `providers/openspec-execute.md`, which is exactly what `tests/provider-swap.test.js:57-66` already proves and costs one *modified* file; (c) change `loadProviders` to disambiguate, which is a `src/` edit and makes goal 3 false by the spec's own standard (`spec-phase-5.md:134`). **Decide before writing the file**, and record the decision — the spec's "Adding it must touch exactly one file" test passes for an add that then crashes the tool, so the stated manual check cannot catch this.
- **The shipped cleanup baton will read `/mar add-thing`, and the golden file will bless it.** Measured end-to-end this session with a real `pitwall-cleanup.md`: `state.changeId` is `"add-thing"` at the cleanup beat and `src/baton.js:93` appends it to *every* provider command. `/mar`'s own `argument-hint` is `[<MR number | MR URL | source branch>]`, so the operator is handed a command that will try to merge an MR named after the OpenSpec change. The fix is a `src/baton.js` change (scope the interpolation to the beats that want it, or let the manifest opt in) plus a golden regeneration — neither is in the spec's File Changes table. Running `UPDATE_GOLDEN=1` without reading the diff will freeze the bug into `tests/golden/cleanup.txt`.
- **The `git diff <default>...<branch>` line the spec requires cannot be interpolated with what the baton is given.** `spec-phase-5.md:75` says the baton includes it "so the operator can review before finishing". `Inference` (`src/inference.js:17-20`) carries `branch` but no `base` — `src/beats.js:81` computes `state.base` and discards it. So the line is either literal prose in the manifest body (honest, but the operator substitutes both names by hand), or `Inference` grows a field and `src/baton.js` grows a substitution — which is a source change on behalf of one manifest, exactly the coupling the manifest format exists to avoid. Decide it explicitly; the decision log is silent.
- **`pw status` is being built before the evidence its own decision entry demands.** `contract.md:48` scopes it as "Promote **only if** the combined `/pitwall:next` output proves too dense in the acceptance run", and `spec-phase-5.md:28` repeats the reason ("It traced to no goal and no criterion; promote it only if the combined output proved too dense"). The acceptance run is criterion 9 and is itself a phase-5 manual step (`spec-phase-5.md:154`) that has not happened. Building `status` now inverts the gate: the surface ships first and the evidence for it is gathered afterwards, at which point removing it is harder than never adding it. **Decision-log contradiction, flagged as a readiness concern**: either run the acceptance beat-walk against `pw next` first and let it decide, or record that the gate was waived and why. It costs a command file, a `src/baton.js` export, a CLI verb, a golden file, a `plugin.json` entry and a README section if the answer turns out to be no.
- **The superpowers decision's stated reason no longer holds.** `spec-phase-5.md:27` / `contract.md:91` justify deferring the superpowers manifest because "it becomes the first real exercise of the 1-file-edit swap". But `tests/provider-swap.test.js:57-66` already exercises that swap mechanically — it overwrites `providers/openspec-execute.md` and asserts `git status --porcelain` is exactly one line matching `^ ?M providers/openspec-execute\.md$` — and has been green since phase 2. **Decision-log contradiction**: the rejected alternative's premise ("nothing proves the swap yet") is false against the codebase, and the version of the proof the entry describes (an *add*, not an *edit*) is the one that cannot work. The honest framing is that the superpowers manifest is a second *binding*, not the swap proof.
- **`commands/spec/` is the first nested plugin command directory on this machine, and the namespace it produces is unverified.** Every one of the 79 plugins surveyed has a flat `commands/`. If Claude Code namespaces a subdirectory as `/pitwall:spec:apply`, then `providers/openspec-execute.md`'s `command: /spec:apply` and `providers/openspec-specs.md`'s `/spec:propose` point at commands that no longer exist under those names, and fixing that modifies two manifests the spec does not list plus regenerates `tests/golden/{specs,execute}.txt`. This is precisely why the Open Item ("delete or symlink the originals") is load-bearing rather than cosmetic: **symlinking** keeps `/spec:*` resolving at user scope and makes the vendored copies the tracked source, and `~/.claude/commands/mar.md` is already exactly that arrangement. Resolve the Open Item before the acceptance run, not after.
- **"`plugin.json` lists exactly the shipped commands" has no precedent and may double-register.** Not one plugin manifest on this machine declares a `commands` key; the loader discovers `commands/` by convention. Where the key does appear in sibling ecosystems (`skills`, `hooks`, `mcpServers`) it is a list of **paths** and is **additive** to convention discovery. So declaring `"commands": ["./commands/next.md", …]` may register every command twice, and it certainly cannot be validated against the docs from inside this repo. Options: keep the declared list in `plugin.json` and verify it against a real install (which is exactly what `spec-phase-5.md:37-38`'s playground is for — do it before trusting the test), or keep `plugin.json` conventional and have `tests/commands.test.js` compare `commands/` against a list that lives somewhere the loader does not read. Either way the bidirectional test is worth having; only the location of the declared list is in question.
- **`tests/inference.test.js:141-143` loses its subject, and the obvious fix deletes coverage.** After this phase every beat has a manifest, so "leaves provider undefined for a beat with no manifest yet" has nowhere to point. Phase 4 solved the same problem by moving the assertion from `worktree` to `cleanup`; phase 5 has no next beat. Rebuild it on `providerMap({})` (`tests/inference.test.js:48-53`) rather than deleting it — the unbound-beat render path at `src/baton.js:82-88` is still reachable by any operator who removes a manifest, and it is the branch `tests/golden/cleanup.txt` currently pins.
- **`tests/index.js` is a required edit the spec's File Changes table omits for the fifth phase running.** Add `import './commands.test.js';` or `node --test tests/` on Node 26 runs 215 tests, passes, and proves nothing about phase 5.
- **The `pw` shell alias does not come from the plugin install.** `package.json`'s `bin` key is honoured by `npm link` / `npm i -g`, not by Claude Code's marketplace install, which clones the repo into `~/.claude/plugins/cache/…` and never runs npm. So after `/plugin install pitwall@tinetti`, `/pitwall:next` works and `pw` does not. The README must say which install gives which surface, or the "short alias" scope item (`contract.md:52`) silently fails on the second machine it was written for.
- **The acceptance run cannot be done in Pitwall's own repository.** This repo has an `origin`-less history on branch `ideation/pitwall`, so `defaultBranch` returns the current branch, `branch === base`, and `cleanupIsDone` (`src/beats.js:81`) returns false unconditionally — the seventh beat can never be observed here. It also has no `openspec/` and no `.claude/`, so the `/spec:*` → `opsx:*` chain does not resolve. Run the 7-beat acceptance change in a scratch repository with a real origin and a real `openspec init`, and un-ignore `openspec/` in `tinetti_dev_tools` first (`~/tinetti_dev_tools/.gitignore:9`) if that is the host.
- **The spec's own "no commits" premise is stale.** `spec-phase-5.md:14` says the local repo has "no `origin` and, at spec time, no commits". `origin` is still absent (verified), but there are now four commits through `b15b937`. The push prerequisite is unchanged; the sentence is not evidence of anything anymore.
- **Retained from phase 4**: the post-create baton must be resolved from the new worktree (now implemented at `src/cli.js:130,144` — do not let `status` copy the *wrong* half of that pattern; `status` answers for the operator's cwd, not for a created path); the unborn-HEAD guard is a positive pre-check because the no-base form silently creates an orphan; `defaultBranch` returns the current branch when `origin/HEAD` is unset; the `worktree` fixture is the state in which `git worktree add` fails; a registered-but-`prunable` worktree defeats a naive idempotence guard.
- **Retained from phase 3**: the gitignore preflight's naive form is silent exactly when it matters; `git check-ignore` exit 128 is a third case; model names must never enter `src/` (`tests/baton.test.js:277-294` scans `src/` only, so `bin/`, `commands/` and `README.md` are unguarded by that test — criterion 2's shell form is scoped the same way).
- **Retained from phase 1**: the `git check-ignore -q docs providers` command in the phase-1 spec is still broken as written (`--quiet` accepts one pathname); split it.
