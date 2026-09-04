# Waybill — domain rename design

**Date:** 2026-09-04
**Status:** approved, not yet implemented
**Supersedes the name:** Pitwall

This document is written to be executed without the conversation that produced it. It carries the
metaphor, the full noun mapping, every rename, and the traps. A session holding only this file should
be able to do the work.

---

## 1. Why

Two independent reasons, either of which would be sufficient.

**The vocabulary was five metaphors deep.** `pitwall` is Formula 1. `beat` is music or screenwriting.
`baton` and `handoff` are relay racing. `spine`, `arc`, and "pluggable tool holes" are anatomy and
architecture. `preflight` is aviation. No single world owned the board, and the two nouns that carry
the most weight were the worst served:

- **The thing that travels had no name at all.** The README calls it "a single change." The code
  calls it a `change-id` or a branch. The protagonist of the whole system was unnamed.
- **Nothing named the inference model.** Position is read from artifacts on disk, never recorded in a
  state file. That is the most distinctive idea in the project and no noun expressed it.

**`pitwall` is taken, in this exact niche.** `pitwall@0.1.1` is published on npm by another author,
declares `bin: pitwall`, and describes itself as "Local web app for reviewing Claude Code sessions."
Same audience, same tool category, and it owns the command name.

The rename is free right now. `~/.claude/plugins/marketplaces/tinetti` has **no `pitwall` entry** — a
recursive grep for "pitwall" across `~/.claude/plugins/` and `~/.claude/*.json` returns zero hits.
There is no published identity to migrate. After registration, there would be.

## 2. The metaphor

**A docket of paperwork moving between desks, carried by a freight forwarder.**

The system is a fixed sequence of legs. What travels is not goods but a **docket** — a file that gets
thicker as it goes, because every leg's completion *is* the document it added. `contract-data.json`
being on disk is not evidence that the refine leg finished; it is the thing the refine leg produced.
The stamp and the payload are the same object. That collapse is why this metaphor was chosen over
the alternatives.

A **freight forwarder** is the role the tool already plays. A forwarder owns no trucks. It reads the
consignment, decides the next leg, picks which carrier runs it, and hands over the paperwork. Compare
the current README: *"Pitwall hands off to other tools rather than reimplementing them."*

Two consequences worth keeping in mind while rewriting prose:

- **Say "stamp", never "tracking".** Real parcel tracking is a central database, which is precisely
  what this tool does not have. Stamps are marks on the object itself. Using tracking vocabulary
  would misdescribe the architecture.
- **Handlers are amnesiac by design.** In real logistics no handler knows the whole journey; they
  read what is attached to the thing, do one operation, pass it on. That is `/clear` between
  sessions, and it is the premise of the tool, not a limitation of it.

## 3. Noun mapping

| # | Concept | Was | Now |
| --- | --- | --- | --- |
| 1 | the tool | Pitwall, `pw` | **Waybill**, `waybill` / `wyb` |
| 2 | the change that travels | *(unnamed)* | **docket** |
| 3 | one stage | beat / stage | **leg** |
| 4 | all seven | "the seven beats" | **the route** |
| 5 | the per-session handoff text | baton | **waybill** |
| 6 | the file binding a leg to a tool | provider / manifest | **booking** |
| 7 | where the docket is | position / inference | **last stamp** |
| 8 | completion evidence | detector | **stamp** |
| 9 | session boundary mode | `handoff:` | `handover:` |
| 10 | the workspace | worktree | **bay** |
| 11 | the external tool for a leg | provider | **carrier** |
| 12 | the files on disk | artifacts | **papers** |

Two honest notes about this table:

- **The docket/waybill split is load-bearing.** The docket persists and grows (the artifacts on
  disk); the waybill is issued fresh for each leg (what `waybill next` prints). Two different
  documents in the real world, two different things here. Do not collapse them.
- **`carrier` earns less than the table implies.** It survives as a prose noun and in the booking
  filename convention. It gets no frontmatter field and no symbol, because the carrier is simply
  what `command:` points at. This is fine, but do not invent a `carrier:` key to justify the word.

The booking filename convention becomes meaningful for free: `bookings/openspec-execute.md` reads as
`<carrier>-<leg>.md`. The directory listing is a routing table.

## 4. Naming decisions that were contested

Recorded so they are not relitigated.

**Binary is `waybill`, with `wyb` shipped as a second bin.** `wb` was rejected: clean on this machine
but contested in the wild, most sharply by `aduermael/wb`, a CLI aimed at coding agents — the same
niche. `wyb` was verified clean: no PATH hit, no Homebrew formula, and the npm `wyb` namesake is an
empty 2022 placeholder with no `bin` field. Ship both names rather than documenting an alias:

```json
"bin": { "waybill": "bin/waybill", "wyb": "bin/waybill" }
```

`npm link` installs both. No dotfile edit required.

**npm does not constrain this.** `waybill` on npm is a squat — one version, published 2014,
abandoned Sails scaffold, no `bin` field. It does not matter: the install path is
`git clone && npm link`, which reads the local `package.json` and never consults the registry. If
publishing ever becomes desirable, `@tinetti/waybill` is free.

**`package` was rejected** as concept #2 — fatal collision with npm in a Node repo with a
`package.json`. **`docket` as the tool name** was rejected — one letter from `docker`, on a command
line.

**Rejected vocabulary registers:** the containerized-logistics words (`container`, `manifest`,
`registry`, `pipeline`, `artifact`) are all colonized by Docker, Kubernetes, and CI. Stay in the
freight-paperwork register.

## 5. Behaviour change: `handoff: session` is dropped

This is the one change in scope that is not a pure rename. It was explicitly approved.

`handoff` selects one rendered line above the next command. It is never executed and never validated;
unknown values pass through verbatim (`src/baton.js:118`, `HANDOFF_LINES[v] ?? v ?? DEFAULT_HANDOFF`).

| was | printed | becomes |
| --- | --- | --- |
| `inline` | `run:` | `through` |
| `clear` | `/clear, then run:` | `transfer` |
| `session` | `in a new session, run:` | **removed** |
| absent | `run:` (default) | absent → `through` |

**The key is `handover:`, not `transfer:`.** The obvious rename produced `transfer: transfer` — a
value restating its own key, which reads as a mistake in every booking that sets it. `handover:` is a
plain-English key carrying two metaphor-bearing values, which is the right division of labour:
*through carriage* is the actual freight term for one carrier running consecutive legs without a
break, and that is exactly what `inline` meant.

`carriage:` was considered and rejected — in a text tool, a key named `carriage` invites a
carriage-return misreading for no gain, since the values do all the metaphor work regardless.

Note the near-collision with the old `handoff`: the key barely moves, only its values do. Do not
global-replace `handoff` → `handover`, which would also rewrite unrelated prose. `HANDOFF_LINES` and
`DEFAULT_HANDOFF` are the only two symbols that change.

`session` had **zero users** — no file in `providers/`, `examples/`, or any test set it. It is
dead-but-documented surface, and freight has no natural word for "a second handler starts in parallel
while you keep working." Removing it is low-risk: an unknown value renders verbatim rather than
crashing.

`commands/start.md:38` says "the handoff line says whether to `/clear` first" — prose that already
assumed a two-way distinction. It becomes correct rather than needing a caveat.

## 6. Frontmatter

Parser truth lives at `src/providers.js:13-14`. Unlisted keys are silently dropped
(`src/providers.js:79-81`).

```yaml
---                                    ---
stage: execute                         leg: execute
command: /spec:apply                   command: /spec:apply
model: opus                            model: opus
effort: high                           effort: high
handoff: clear                         handover: through
argument: change-id                    argument: change-id
doneWhenPathExists: …/tasks.md         stampPath: openspec/changes/*/tasks.md
doneWhenCmd: test -f Makefile          stampCmd: test -f Makefile
---                                    ---
```

- `REQUIRED`: `['stage','command','model']` → `['leg','command','model']`
- `OPTIONAL`: `['effort','handoff','argument','doneWhenPathExists','doneWhenCmd']` →
  `['effort','handover','argument','stampPath','stampCmd']`
- `ARGUMENT_SOURCES = ['change-id','branch','none']` — **unchanged**, carries no metaphor.
- Error strings at `src/providers.js:57,60,64,67,74` embed the words "stage", "manifest", and
  "detector" — rewrite to "leg", "booking", "stamp".

`doneWhenPathExists` → `stampPath` is the rename with the most conceptual content: it stops
describing a mechanism and names the thing. That file *is* the leg's stamp. The pair is also
symmetrical for the first time.

## 7. Files and directories

| Was | Now |
| --- | --- |
| `bin/pw` | `bin/waybill` |
| `src/beats.js` | `src/legs.js` |
| `src/baton.js` | `src/waybill.js` |
| `src/providers.js` | `src/bookings.js` |
| `src/worktree.js` | `src/bay.js` |
| `src/preflight.js` | `src/inspection.js` |
| `providers/` | `bookings/` |
| `providers/pitwall-worktree.md` | `bookings/waybill-bay.md` |
| `providers/pitwall-cleanup.md` | `bookings/waybill-cleanup.md` |
| `providers/{ideation,openspec}-*.md` | `bookings/` same basenames |
| `tests/baton.test.js` | `tests/waybill.test.js` |
| `tests/providers.test.js` | `tests/bookings.test.js` |
| `tests/provider-swap.test.js` | `tests/booking-swap.test.js` |
| `tests/worktree.test.js` | `tests/bay.test.js` |
| `tests/fixtures/worktree.js` | `tests/fixtures/bay.js` |
| `tests/golden/worktree.txt` | `tests/golden/bay.txt` |

Unchanged, and deliberately so: `src/inference.js` ("inference" is accurate and metaphor-free),
`src/progress.js`, `src/repo.js`, `src/frontmatter.js`, `src/openspec.js` (proper noun).

`src/preflight.js` → `src/inspection.js` removes the aviation stray. `inspection` is in-world and
more accurate: it checks the docket's papers before it moves.

`tests/index.js:6,12,13,15` carries the import list and must track the test renames.

## 8. Identifier renames

### Public (exported and imported across modules)

| Was | Now | Notes |
| --- | --- | --- |
| `BEATS` (`beats.js:24`) | `LEGS` | highest-fanout symbol: `inference.js:4`, `baton.js:1`, `cli.js:4` |
| typedef `Beat` (`beats.js:6`) | `Leg` | JSDoc in `inference.js:24-26`, `providers.js` |
| typedef `RepoState` (`beats.js:10`) | unchanged | |
| `worktreeIsDone` (`beats.js:57`) | `bayIsDone` | |
| `cleanupIsDone`, `ideateIsDone` | unchanged | |
| `renderBaton` (`baton.js:179`) | `renderWaybill` | `cli.js:5,85,114,174` |
| `renderPosition` (`baton.js:196`) | unchanged | "position" is neutral and accurate; avoids churn |
| `BUILTIN_PROVIDERS` (`inference.js:14`) | `BUILTIN_BOOKINGS` | |
| `resolveBeat` (`inference.js:59`) | `resolveLeg` | |
| typedef `Inference` (`inference.js:17`) | unchanged | |
| `loadProviders` (`providers.js:37`) | `loadBookings` | |
| `detectPathExists` (`providers.js:148`) | `stampedByPath` | |
| `detectCmd` (`providers.js:184`) | `stampedByCmd` | |
| `providerIsDone` (`providers.js:201`) | `bookingIsDone` | |
| `evaluateProvider` (`providers.js:214`) | `evaluateBooking` | |
| typedef `Provider` (`providers.js:8`) | `Booking` | |
| `artifactPaths` (`preflight.js:73`) | `paperPaths` | weakest rename in the set; accepted |
| `parseManifest` (`frontmatter.js:44`) | `parseFrontmatter` | generic parser; "manifest" was wrong before the rename too |
| `findMainWorktree` (`repo.js:29`) | `mainCheckout` | **not** a bay — see §9 |
| `resolveWorktreePath` (`repo.js:44`) | `resolveBayPath` | |
| `inWorktree` (`repo.js:118`) | `inBay` | |
| `worktreeRoot` (`repo.js:138`) | `checkoutRoot` | **not** a bay — see §9 |
| `WorktreeError` (`worktree.js:24`) | `BayError` | |
| `startWorktree` (`worktree.js:180`) | `startBay` | |
| `isInside` (`worktree.js:103`) | unchanged | |

### Internal

| Was | Now |
| --- | --- |
| `worktreePath` (`beats.js:41`) | `bayPath` |
| `HANDOFF_LINES` (`baton.js:7`) | `HANDOVER_LINES` |
| `DEFAULT_HANDOFF` (`baton.js:14`) | `DEFAULT_HANDOVER` |
| `batonText` (`baton.js:90`) | `waybillText` |
| `beatIsDone` (`inference.js:30`) | `legIsDone` |
| `DETECTOR_TIMEOUT_MS` (`providers.js:26`) | `STAMP_TIMEOUT_MS` |
| `header`, `strip`, `nextBlock`, `REQUIRED`, `OPTIONAL`, `WRAPPER_PATHS`, `git`, `listWorktrees` | unchanged |

`baton.js:47,180,197` use a local `const position` — same word, different concept from
`renderPosition`. Harmless, but do not let a careless global replace merge them.

## 9. The `worktree` rule — three categories, not two

This is the section most likely to cause a silent break. There are three buckets, and the middle one
was nearly missed.

**Bucket 1 — git wire format. Never rename.**

`src/repo.js:31-32` does `first.slice('worktree '.length)`, parsing the literal prefix out of
`git worktree list --porcelain` output. Renaming that string breaks silently, and tests may still
pass. Also:

- `src/repo.js:30` `tryGit(cwd, ['worktree','list','--porcelain'])`
- `src/worktree.js:70` `git(cwd, ['worktree','list','--porcelain'])`
- `src/worktree.js:245-246` `['worktree','add', …]`
- `src/worktree.js:210` user-facing instruction to run `git worktree prune`
- `src/beats.js:72` JSDoc referencing `git worktree list --porcelain`
- `tests/baton.test.js:107`, `tests/inference.test.js:229`, `tests/helpers/repo-fixture.js:93`,
  `tests/worktree.test.js:48` — `git(..., ['worktree', ...])` argv
- `tests/worktree.test.js:193` comment about `git worktree list` marking `prunable`
- `.gitignore:2` `.claude/worktrees/` — Claude Code's own directory, external convention

**Bucket 2 — the main checkout. Rename away from `worktree`, but not to `bay`.**

A bay is the workspace cut for one docket. The main checkout is the thing you cut it from. Naming it
`findMainBay` would assert something false.

- `findMainWorktree` → `mainCheckout`
- `worktreeRoot` → `checkoutRoot`

**Bucket 3 — the domain workspace. Rename to `bay`.**

- `src/beats.js:26` `{ id: 'worktree', owner: 'wrapper' }` — the leg id becomes `'bay'`
- `src/beats.js:41,51,57,59,83` — `worktreePath`, `worktreeIsDone` and call sites
- `src/inference.js:31` `if (beat.id === 'worktree')` — string comparison against the leg id
- `src/repo.js:44,118` `resolveWorktreePath`, `inWorktree`
- `providers/pitwall-worktree.md:1` `stage: worktree`
- Every `'worktree'` string literal in fixture and assertion arrays: `tests/baton.test.js:59,80,131,254`,
  `tests/cli.test.js:125`, `tests/commands.test.js:235`, `tests/inference.test.js:59,112,201,212`

**One sentence contains both senses.** `providers/pitwall-worktree.md:14` and its golden mirror
`tests/golden/worktree.txt:15`: *"detects the worktree from repository state — `git worktree list`"*.
The first is domain (→ bay), the second is git (→ unchanged).

`src/worktree.js` is ambiguous as a module — it shells out to `git worktree add`, but it exists
solely to create the domain bay. Decision: **rename the module to `src/bay.js` and its exports to
`startBay` / `BayError`; leave every argv string untouched.**

## 10. Plugin and command surface

`.claude-plugin/plugin.json` currently:

```json
{
  "name": "pitwall",
  "version": "0.1.0",
  "description": "Workflow spine with pluggable tool holes: one command names the beat, the next command, and the model it wants.",
  "author": { "name": "John Tinetti", "email": "john@tinetti.net" },
  "homepage": "https://github.com/tinetti/pitwall",
  "keywords": ["workflow", "handoff", "session", "worktree", "model-routing", "ideation", "openspec"]
}
```

Edits: `name` → `waybill`; `homepage` → `https://github.com/tinetti/waybill`; `description` rewritten
("beat" → "leg", and "pluggable tool holes" is anatomy-metaphor debris — say carriers). `keywords`
contains no `pitwall` string but should swap `worktree` → `bay` and drop `handoff` for `handover`.

No `commands`, `agents`, `skills`, or `bin` keys are declared — those are discovered from directory
layout, so the manifest is a smaller job than expected. **Changing `name` renames every slash
command**: `/pitwall:next` → `/waybill:next`, and likewise `start`, `status`, `spec:*`.

`package.json:2,4,8` — `name`, `description` (contains "baton"), and the `bin` map.

Literal `/pitwall:*` strings outside `docs/`: `README.md:53,54,56,63,82,83,84,152`;
`commands/status.md:31`; `providers/pitwall-worktree.md:5` (`command: /pitwall:start`) and its mirror
`tests/golden/worktree.txt:7`.

`commands/next.md:19`, `commands/start.md:26`, `commands/status.md:23` each embed the literal string
`pitwall:` in a `CLAUDE_PLUGIN_ROOT` fallback error message.

**Trap:** `providers/pitwall-worktree.md:5` is the only booking that names a slash command belonging
to this tool. It and `tests/golden/worktree.txt:7` must move together or the suite breaks.

## 11. Golden fixtures are derived — regenerate, never hand-edit

9 files, 111 lines, of which 36 contain renamed vocabulary. `tests/baton.test.js:42` rewrites them
when `UPDATE_GOLDEN=1`.

Order matters: goldens are pure output of the booking bodies plus `src/baton.js`. Regenerate **after**
`bookings/*.md` and `src/waybill.js` are done, not before.

Golden content is not only headers — `tests/golden/worktree.txt:10-16` and `ideate.txt:13` are
verbatim copies of booking prose containing "beat", "Pitwall", "doneWhenCmd", "baton", "worktree",
and "artifact". They will come out correct automatically if the bookings are correct first.

Per the existing README instruction: read the regenerated goldens before committing them. That is the
whole point of making regeneration explicit.

## 12. Explicitly out of scope

**`docs/ideation/pitwall/` is not renamed — including the directory name.** 12 files, ~904 lines. It
is the frozen ideation archive from when this project was designed. It is a historical record, and
rewriting it to say "waybill" would make it claim a design that did not happen. It accurately
describes a project that was called Pitwall. Leaving it excluded also nearly halves the diff.

The three absolute paths containing `pitwall` live inside that archive's prose
(`context-map.md`, `run-2026-08-24.html`, `run-2026-08-24.json`) and stay as they are.

`HANDOFF.md` and `pitwall-flow.html` are untracked working files, not project source. Out of scope;
delete or move them separately.

## 13. Migration outside the repository

These are not file edits and will not appear in the diff. **Skipping the symlink step silently breaks
`/spec:propose` and `/spec:apply` in every Claude Code session, and you would not find out until leg
5 or 6.**

1. **Rename the directory** `~/Projects/pitwall` → `~/Projects/waybill`.
2. **Relink four symlinks.** `~/.claude/commands/spec/{apply,archive,explore,propose}.md` currently
   point at absolute paths under the old directory name:
   ```
   apply.md -> /Users/tinetti/Projects/pitwall/commands/spec/apply.md
   ```
   These are load-bearing: `bookings/openspec-specs.md` and `bookings/openspec-execute.md` name the
   bare `/spec:propose` and `/spec:apply`, which resolve at user scope through these links, not
   through the plugin namespace.
   ```
   for f in explore propose apply archive; do
     ln -sf "$HOME/Projects/waybill/commands/spec/$f.md" "$HOME/.claude/commands/spec/$f.md"
   done
   ```
3. **Relink the binaries.** `npm unlink -g pitwall` (or remove the stale `pw` from
   `/opt/homebrew/bin/`), then `npm link` from the renamed clone. Verify both `waybill --help` and
   `wyb --help`.

`~/.claude/commands/mar.md` points elsewhere and is unaffected.

## 14. Verification

Run in this order:

1. `node --test tests/` — 252 tests currently pass; the suite must return to 252 green.
2. `UPDATE_GOLDEN=1 node --test tests/waybill.test.js`, then read the regenerated goldens by eye
   before committing.
3. `grep -rn -i 'pitwall\|baton\|\bbeat\b\|provider\|doneWhen\|handoff:' --exclude-dir=.git --exclude-dir=docs .`
   should return nothing outside the excluded archive.
4. `grep -rn "'worktree'" src/ tests/` — every remaining hit must be git argv, and each one should be
   checkable against §9 bucket 1.
5. Smoke: `wyb next` and `waybill status` from the renamed clone.
6. Smoke: `/waybill:next` resolves in a fresh Claude Code session, and `/spec:propose` still resolves
   through the relinked symlinks.
7. `tests/commands.test.js` asserts zero dependencies and no build step — it must still pass, i.e.
   the rename adds no tooling.

## 15. Suggested sequencing

Small commits, in an order where the suite is green at each step where that is achievable.

1. Frontmatter keys + `src/providers.js` → `src/bookings.js` + `providers/` → `bookings/`; drop
   `session`. Update the bookings' own frontmatter.
2. `src/beats.js` → `src/legs.js`, `BEATS` → `LEGS`, leg id `worktree` → `bay`.
3. `src/worktree.js` → `src/bay.js` and the §9 bucket-2/3 identifier renames. Highest-risk step;
   the git argv audit belongs here.
4. `src/baton.js` → `src/waybill.js`, `src/preflight.js` → `src/inspection.js`.
5. Booking prose bodies and `commands/*.md`.
6. Regenerate goldens; rename test files.
7. `plugin.json`, `package.json`, `bin/waybill`, README.
8. Out-of-repo migration (§13), by hand, last.

Steps 1–7 are one branch and one worktree. Step 8 happens after the branch merges, because it renames
the directory the worktree lives under.
