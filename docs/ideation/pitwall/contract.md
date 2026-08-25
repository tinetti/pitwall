# Pitwall Contract

**Created**: 2026-08-24
**Readiness**: All 5 gates ready
**Status**: Approved
**Approval**: Express — single consolidated confirmation, no per-artifact review
**Supersedes**: None

## Problem Statement

A single change moves through seven beats -- rough ideation, branch and worktree, refined ideation, contract, specs, execute specs 1..n, cleanup -- spanning three separate tool ecosystems and at least four Claude sessions. No tool models the arc. Each session boundary costs a manual re-orientation: which stage is this, which command comes next, which model does it want, and does the work live in the main checkout or a worktree.

Two beats are modeled by nothing at all. The branch-and-worktree moment, which the user's own AGENTS.md mandates for feature work, is invoked by no planning tool -- gwt is a zsh function nothing calls. And no command ends by naming its successor, so the baton is carried in the user's head across a /clear that deliberately erases everything else.

The partial fix already in place is unmanaged and fragile: ~/.claude/commands/spec/{explore,propose,apply,archive}.md encode which model runs which stage, and they exist in no git repository -- one disk failure from gone, and unreproducible on a second machine.

## Goals

1. At each of the 7 beats, one command names the current stage, the next command, and the model plus effort it wants -- zero notes consulted, zero recall required.
2. 100% of stages source their model and effort from a declarative provider manifest rather than from the operator's memory.
3. Replacing the tool bound to any pluggable stage costs exactly 1 manifest file edit and 0 edits to Pitwall itself.
4. The branch-and-worktree beat reduces to a single command that is idempotent and correct from either the main checkout or an existing worktree.

## Success Criteria

- [ ] Stage inference resolves the correct beat from repository reality at all 7 beats, including mid-execute n-of-N progress. — check: `node --test tests/inference.test.js && test "$(ls tests/fixtures | wc -l)" -eq 7` → exits 0
- [ ] The baton names the command, model, and effort declared in that stage's provider manifest, and no model name is hardcoded anywhere in Pitwall's source. — check: `node --test tests/baton.test.js && grep -rqE '(opus|sonnet|haiku)' providers/ && ! grep -rqE '(opus|sonnet|haiku)' src/` → exits 0
- [ ] Swapping a provider costs exactly one manifest file edit and zero edits to Pitwall's source: the swap fixture asserts a working-tree diff of exactly 1 path, under providers/. — check: `node --test tests/provider-swap.test.js` → exits 0
- [ ] The worktree beat creates one worktree at the sibling-path convention, is idempotent on re-run, is a no-op inside the target worktree, and falls back correctly when the repo has no origin remote. — check: `node --test tests/worktree.test.js` → exits 0
- [ ] The gitignore preflight detects every workflow artifact path that git check-ignore matches in the host repo and stays silent on a clean repo (fixture pair: ignored must be reported, clean must be silent). — check: `node --test tests/preflight-gitignore.test.js` → exits 0
- [ ] Every declared command file exists and parses, and the plugin manifest lists exactly the shipped commands. — check: `node --test tests/commands.test.js` → exits 0
- [ ] Pitwall ships zero third-party npm runtime dependencies and needs no build step (external CLIs are a separate, declared category and are stubbed in fixtures). — check: `node -e 'const p=require("./package.json");process.exit((Object.keys(p.dependencies||{}).length===0 && !(p.scripts||{}).build)?0:1)'` → exits 0
- [ ] The full self-test suite passes from a clean checkout. — check: `node --test tests/` → exits 0
- [ ] One real change is driven root-to-merged-PR through Pitwall; the operator lists which of the 7 beats, if any, required consulting notes. — judgment call: Operator runs a real change end to end and names the beats that required a lookup; pass at zero beats.

## Scope Boundaries

### In Scope

- Stage inference core -- derive the current beat from git state, worktree presence, and provider detectors — Every other feature renders this; it is what replaces the rejected state file.
- Provider manifests: markdown with flat scalar-only frontmatter, body used verbatim as baton text, and a bounded two-key detector (doneWhenPathExists glob, optional doneWhenCmd judged by exit code) — The detector must swap with the provider; bounding it declaratively prevents an expression evaluator growing inside a data file.
- /pitwall:next -- one surface printing current beat, completed beats, n-of-N execute progress, and the baton (command, model, effort, whether to /clear) — Goal 1 names one command; a second rendering of the same inference result is traced to no goal.
- /pitwall:start -- branch and worktree creation at the direction-known beat — The beat no existing tool models, and the anchor that lets inference locate later artifacts.
- Gitignore preflight -- report every workflow artifact path that git check-ignore matches in the host repo — Untracked artifacts die when /mar removes the worktree; this makes the host-repo hazard a product feature instead of an untestable assertion.
- Cleanup baton to a manifest-configured target (default /mar) — Goal 1 claims 7/7 beats, so the seventh cannot sit in a later tier; /mar is a personal dotfile, so the target must be declarative.
- Built-in provider manifests for ideation and OpenSpec — One manifest per pluggable stage is what day-one operation needs.
- Self-test suite over temp-repo fixtures frozen at each of the 7 beats — User-chosen mechanical gate; what makes the inference safe to refactor.
- /pitwall:status as a separate position-without-baton surface — Promote only if the combined /pitwall:next output proves too dense in the acceptance run.
- superpowers provider manifest for the execute beat — A second binding for an already-bound stage; it becomes the first real exercise of the 1-file-edit swap.
- Vendor the four unmanaged ~/.claude/commands/spec/*.md into version control — The OpenSpec manifest emits batons pointing at files that exist in no git repo -- the problem statement's own third defect.
- Packaging as a github-sourced plugin registered in the tinetti marketplace — Matches how ideation is installed; makes a second machine a one-line install.
- pw short alias — The most-used commands are typed many times per change.
- README and install docs naming external prerequisites (openspec CLI, /mar, gh) — A standalone repo with undeclared prerequisites is unusable on a second machine.

### Out of Scope

- The inner TDD / implement / review loop — OpenSpec apply and superpowers already own it; duplicating it would make Pitwall a competitor rather than a spine.
- Merge and branch-deletion mechanics — /mar already does this well; Pitwall hands off to it.
- The interview itself — ideation's evidence gates and plan critics are better than anything this project would produce.
- Any persisted state file for workflow position — Explicitly rejected -- a second source of truth drifts the first time a stage is done by hand.
- Non-code workflows (writing, research, ops runbooks) — The stage model is built on git and spec artifacts; generalizing now would dilute v1.
- Cross-machine state sync or telemetry — Inference from repository reality is already machine-independent; nothing to sync.
- Automatically editing a host repo's .gitignore — The preflight reports the hazard; un-ignoring someone's repo is their call, and one-shot remediations belong in phase notes.

### Future Considerations

- --auto drive mode: tmux window plus claude --model <m> -p per stage — Feasibility confirmed (claude CLI exposes --model, -p, --fork-session) but it is the riskiest surface and the half used least.
- Append-only handoff notes file per change — Carries decisions and dead ends across sessions; inference does not need it, so it is additive.

## Decisions Considered and Rejected

- **Build a thin wrapper with pluggable provider holes** — rejected: Adopt OpenSpec or ideation wholesale as the workflow spine. Neither models the worktree beat, per-stage model routing, or the session baton; binding the workflow to one tool makes replacing that tool a rewrite rather than a config edit.
- **Hybrid authority -- direct (baton) by default, drive (--auto) available later** — rejected: A pure orchestrator that launches every session itself. Baton mode is the half used every day and needs no new infrastructure; a session launcher is the piece most likely to need iteration and the piece whose crashes the operator must debug.
- **Infer stage from repository reality; ship no state file** — rejected: A .pitwall/state.json recording stage, providers, and history. A second source of truth drifts the moment a stage is done by hand, and inference stays correct even when the operator bypasses the wrapper entirely.
- **Each provider manifest carries its own done-detector** — rejected: Pitwall hardcodes detectors for the tools it knows about. Inference facts are provider-specific (contract-data.json implies ideation); a hardcoded detector would make 'every stage is a hole' false, since swapping a provider would silently break stage resolution.
- **Pitwall owns the worktree beat and the cleanup handoff outright** — rejected: Making worktree and cleanup pluggable like the other stages. They are the two beats no existing tool models, and the worktree is the anchor that lets inference locate every later artifact -- pluggable anchors cannot be relied on.
- **One baton per spec/phase during execute** — rejected: One baton for the whole execute stage; one baton per task. A phase is roughly one session's worth of context; whole-stage cannot report 3-of-9 progress, and per-task churns sessions for a 10+ item tasks.md.
- **v1 ships baton mode and the worktree beat; --auto is deferred** — rejected: Shipping drive mode in v1. The inference model is the load-bearing idea and must be proven before a session launcher is layered on top of it.
- **A self-test recipe over temp-repo fixtures is the mechanical gate** — rejected: No pre-check (the real run is the test); manual dry-run only. A broken detector would otherwise surface mid-change, and fixtures are what make the inference safe to refactor later.
- **Standalone repo tinetti/pitwall, registered in the marketplace as a github-sourced plugin** — rejected: plugins/pitwall in the claude-plugins marketplace; files/home/.claude in tinetti_dev_tools. Cleanest boundary and independent versioning; a marketplace-sibling worktree would land inside the directory Claude Code scans for marketplaces.
- **Name it Pitwall, with pw as the short alias** — rejected: wot, stint, pacenote. The pit wall calls strategy and decides who drives what and when, which is exactly the model-routing and stage-sequencing role; wot and stint were considered and set aside after direct comparison.
- **Workflow artifacts must be tracked in git, not gitignored** — rejected: Leaving openspec/ and ideation docs ignored as they are today in tinetti_dev_tools. Untracked files do not travel to a new worktree and are destroyed when /mar removes it, so the change folder would vanish at exactly the moment the PR needs it.
- **Zero third-party runtime dependencies; node --test as the harness** — rejected: A test framework plus a YAML library. A workflow tool that must run in any repo on any machine cannot carry an install step; frontmatter parsing is small enough to own.
- **Provider manifests are markdown with flat scalar-only frontmatter; the parser is capped at key: value and the body is the baton text** — rejected: General YAML (library or hand-rolled) and pure JSON manifests. Critic showed nothing outside Pitwall's loader reads these files, so the md+frontmatter 'idiom' argument buys only familiarity -- but the body doubling as baton prose earns the markdown; capping the parser removes the YAML edge cases from the blocking phase.
- **Detectors are two declarative keys judged by path glob or exit code** — rejected: Arbitrary predicate logic or shell-eval inside the manifest. An unbounded detector is a plugin execution runtime no goal asks for; goal 3 only needs the detector to swap with its provider.
- **One command surface: /pitwall:next prints position and baton together** — rejected: Shipping /pitwall:status as a separate MVP command. Two lenses independently found status traced to no goal and covered by no criterion, while duplicating rendering, alias, manifest and README surface.
- **The openspec CLI is a declared external dependency with a tasks.md checkbox fallback detector** — rejected: Treating openspec status --json as ambiently available. It appeared in phase notes but in no goal, scope item, or prereq, and it silently contradicted the zero-dependency claim; the JSON shape is unverified, so a fallback is required.
- **Worktree path resolution (findMainWorktree, resolveWorktreePath) lands in phase 1, consumed by both inference and the worktree command** — rejected: Phases 2 and 4 running parallel with the sibling-path derivation living in phase 4. The contract calls the worktree the anchor for inference, so phase 2's detectors need the derivation phase 4 was going to implement -- a circular dependency declared as parallelism.
- **The gitignore hazard becomes a shipped preflight, not an acceptance assertion** — rejected: tests/artifacts-tracked.test.js as the check for artifact tracking. It asserts a host-repo property that Pitwall's own fixtures cannot observe -- a git init fixture with no .gitignore passes for free while the real repo still loses the change folder.
- **The cleanup baton ships in MVP with a manifest-configured target defaulting to /mar** — rejected: Cleanup in the Full tier with /mar hardcoded. Goal 1 claims 7/7 beats so the seventh cannot sit in a later tier, and /mar is a personal dotfile pair plus gh/jq -- installing the plugin alone would emit a baton to a command that does not exist.
- **MVP ships two built-in manifests (ideation, OpenSpec); superpowers moves to Full** — rejected: Three built-in manifests in MVP. superpowers is a second candidate for an already-bound beat; deferring it makes it the first real test of the one-file-edit swap promise.

## Execution Plan

_Added during Phase 5 handoff. Pick up this contract cold and know exactly how to execute._

### Dependency Graph

```
Scaffold, manifest format, and repo-shape helpers
  └── Stage inference core  (blocked by Scaffold, manifest format, and repo-shape helpers)
        ├── Baton command and gitignore preflight  (blocked by Stage inference core)
              └── Cleanup baton, packaging, and adoption  (blocked by Baton command and gitignore preflight, Worktree beat)
        └── Worktree beat  (blocked by Stage inference core)
```

### Execution Steps

**Run the project** (recommended) — autopilot reads this contract, plans dependency waves, runs independent phases in parallel, and gates on failure:

```bash
/ideation:autopilot docs/ideation/pitwall/contract.md
```

**Or run it unattended** — a `/goal` is a durability wrapper around the same autopilot run: Claude re-checks the condition before it is allowed to stop, so failures get repaired and re-run. Generated by `contract-gen --print-goal`; this is the only copy of that string:

```
/goal Drive the Pitwall contract (pitwall) to completion with /ideation:autopilot.

1. Run `/ideation:autopilot docs/ideation/pitwall/contract.md`. All commits belong on branch ideation/pitwall — switch to it before any run.
2. It dispatches a BACKGROUND workflow. Wait for the completion notification — never start a second autopilot run while one is in flight.
3. Then run the ideation plugin's `scripts/verify.mjs` against `docs/ideation/pitwall/contract-data.json` and leave its VERIFY line in the conversation. Resolve the plugin's install directory first — `${CLAUDE_PLUGIN_ROOT}/scripts/verify.mjs` is a placeholder, not a shell variable, and bash will not expand it. That line is the only evidence this goal is judged on.
4. If anything failed, fix the spec or the implementation and go back to step 1. Autopilot skips phases that already have commits.

Done when the most recent VERIFY line reads fail=0 and commits=5/5 — or when two consecutive VERIFY lines are identical and still failing, in which case name the failing checks and stop, because a contract whose checks have rotted must not trap the run.
```

**Or run phases manually** in dependency order:

**Strategy**: Hybrid

1. **Phase 1** — Scaffold, manifest format, and repo-shape helpers _(blocking)_

   ```bash
   /ideation:execute-spec docs/ideation/pitwall/spec-phase-1.md
   ```

2. **Phase 2** — Stage inference core _(blocking)_

   ```bash
   /ideation:execute-spec docs/ideation/pitwall/spec-phase-2.md
   ```

3. **Phase 3** — Baton command and gitignore preflight _(blocked by Stage inference core)_

   ```bash
   /ideation:execute-spec docs/ideation/pitwall/spec-phase-3.md
   ```

4. **Phase 4** — Worktree beat _(blocked by Stage inference core)_

   ```bash
   /ideation:execute-spec docs/ideation/pitwall/spec-phase-4.md
   ```

5. **Phase 5** — Cleanup baton, packaging, and adoption _(blocked by Baton command and gitignore preflight, Worktree beat)_

   ```bash
   /ideation:execute-spec docs/ideation/pitwall/spec-phase-5.md
   ```

---

_This contract was generated from brain dump input. Review and approve before proceeding to specification._
