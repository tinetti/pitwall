import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BEATS, cleanupIsDone, ideateIsDone, worktreeIsDone } from './beats.js';
import { evaluateProvider, loadProviders } from './providers.js';
import { currentBranch, defaultBranch, superprojectRoot, worktreeRoot } from './repo.js';
import { discoverChangeId, executeProgress } from './progress.js';

/** The manifests Pitwall ships with, used when a caller supplies none. */
const BUILTIN_PROVIDERS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'providers');

/**
 * @typedef {{beat:string|null, index:number, completed:string[], skipped:string[],
 *            progress?:{done:number,total:number,source:string,changeId:string|null},
 *            provider?:import('./providers.js').Provider, branch:string|null,
 *            changeId:string|null, warnings:string[]}} Inference
 */

/**
 * @param {import('./beats.js').Beat} beat
 * @param {import('./beats.js').RepoState} state
 * @param {Map<string, import('./providers.js').Provider>} providers
 * @param {string[]} warnings collected in place
 * @returns {boolean}
 */
function beatIsDone(beat, state, providers, warnings) {
  if (beat.id === 'worktree') return worktreeIsDone(state);
  if (beat.id === 'cleanup') return cleanupIsDone(state);

  const provider = providers.get(beat.id);
  if (!provider) return false;

  const result = evaluateProvider(provider, state.root);
  warnings.push(...result.warnings);
  return result.done;
}

/**
 * Where this repository stands, derived from nothing but repository reality.
 *
 * The walk runs the beat list in order and stops at the first incomplete beat rather than jumping
 * to the last complete one. That is deliberate: the operator is allowed to do any stage by hand,
 * and skipping ahead silently would hide it. Work done out of order surfaces in `skipped` instead.
 *
 * Repository and detector failures never throw: a directory outside any repository, a detached
 * HEAD, and a detector that cannot be executed are all reported through `warnings`, because a
 * wrapper that crashes is worse than a wrapper that admits it does not know. Loading the built-in
 * manifests is the one exception — it sits in the loader tier, where a malformed manifest is a bug
 * and throws with the offending file and key.
 *
 * @param {string} cwd
 * @param {Map<string, import('./providers.js').Provider>} [providers] defaults to the built-ins
 * @returns {Inference}
 */
export function resolveBeat(cwd, providers) {
  /** @type {string[]} */
  const warnings = [];
  const manifests = providers ?? loadProviders(BUILTIN_PROVIDERS, { knownStages: BEATS.map((beat) => beat.id) });

  // Inside a submodule every git query answers for the submodule's own tree, so the beats would be
  // resolved against a repository the operator's change does not live in. Anchor on the
  // superproject instead, and say so — a silently redirected answer is its own failure mode.
  const superproject = superprojectRoot(cwd);
  if (superproject !== null) {
    warnings.push(`${cwd} is inside a submodule; resolving against the superproject ${superproject}`);
  }
  const anchor = superproject ?? cwd;

  const root = worktreeRoot(anchor);
  if (root === null) {
    warnings.push(`not a git repository: ${cwd}`);
    return {
      beat: BEATS[0].id,
      index: 1,
      completed: [],
      skipped: [],
      provider: manifests.get(BEATS[0].id),
      branch: null,
      changeId: null,
      warnings,
    };
  }

  /** @type {import('./beats.js').RepoState} */
  const state = { cwd: anchor, root, branch: currentBranch(anchor), base: defaultBranch(anchor) };

  // Every beat but `ideate` is judged on its own; `ideate` is judged on what came after it.
  const done = BEATS.map((beat, i) => (i === 0 ? false : beatIsDone(beat, state, manifests, warnings)));
  done[0] = ideateIsDone(state, done.some(Boolean));

  const current = done.indexOf(false);
  const beat = current === -1 ? null : BEATS[current].id;
  const lastComplete = done.lastIndexOf(true);

  const result = {
    beat,
    index: current === -1 ? BEATS.length : current + 1,
    completed: BEATS.filter((_, i) => done[i]).map((entry) => entry.id),
    // Holes: incomplete beats that later work has already run past. The current beat is one of them
    // by construction and is excluded — it is already reported as `beat`, and naming it twice would
    // have the baton say "do the worktree beat" and "you skipped the worktree beat" at once.
    skipped: BEATS.filter((_, i) => !done[i] && i > current && i < lastComplete).map((entry) => entry.id),
    provider: beat === null ? undefined : manifests.get(beat),
    branch: state.branch,
    changeId: discoverChangeId(root),
    warnings,
  };

  if (beat === 'execute') {
    result.progress = executeProgress(root, result.changeId);
    // The filesystem walk only sees changes that already carry a `tasks.md`; `openspec list --json`
    // names active changes regardless. When only the CLI found one, take its id — phase 3
    // interpolates `changeId` into the baton command, and an empty one beside a progress line for a
    // named change is worse than no progress at all.
    result.changeId ??= result.progress.changeId;
  }
  return result;
}
