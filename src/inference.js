import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEGS, cleanupIsDone, ideateIsDone, bayIsDone } from './legs.js';
import { evaluateBooking, loadBookings } from './bookings.js';
import { checkoutRoot, currentBranch, defaultBranch, superprojectRoot } from './repo.js';
import { discoverChangeId, executeProgress } from './progress.js';

/**
 * The bookings Waybill ships with, used when a caller supplies none. Exported so the CLI can load
 * the same map it hands to {@link resolveLeg} and derive the inspection's paper paths from it,
 * rather than keeping a second copy of this path.
 */
export const BUILTIN_BOOKINGS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bookings');

/**
 * @typedef {{beat:string|null, index:number, completed:string[], skipped:string[],
 *            progress?:{done:number,total:number,source:string,changeId:string|null},
 *            provider?:import('./bookings.js').Booking, branch:string|null,
 *            changeId:string|null, warnings:string[]}} Inference
 */

/**
 * @param {import('./legs.js').Leg} leg
 * @param {import('./legs.js').RepoState} state
 * @param {Map<string, import('./bookings.js').Booking>} providers
 * @param {string[]} warnings collected in place
 * @returns {boolean}
 */
function legIsDone(leg, state, providers, warnings) {
  if (leg.id === 'bay') return bayIsDone(state);
  if (leg.id === 'cleanup') return cleanupIsDone(state);

  const provider = providers.get(leg.id);
  if (!provider) return false;

  const result = evaluateBooking(provider, state.root);
  warnings.push(...result.warnings);
  return result.done;
}

/**
 * Where this repository stands, derived from nothing but repository reality.
 *
 * The walk runs the leg list in order and stops at the first incomplete leg rather than jumping
 * to the last complete one. That is deliberate: the operator is allowed to do any stage by hand,
 * and skipping ahead silently would hide it. Work done out of order surfaces in `skipped` instead.
 *
 * Repository and stamp failures never throw: a directory outside any repository, a detached
 * HEAD, and a stamp that cannot be executed are all reported through `warnings`, because a
 * wrapper that crashes is worse than a wrapper that admits it does not know. Loading the built-in
 * bookings is the one exception — it sits in the loader tier, where a malformed booking is a bug
 * and throws with the offending file and key.
 *
 * @param {string} cwd
 * @param {Map<string, import('./bookings.js').Booking>} [providers] defaults to the built-ins
 * @returns {Inference}
 */
export function resolveLeg(cwd, providers) {
  /** @type {string[]} */
  const warnings = [];
  const manifests = providers ?? loadBookings(BUILTIN_BOOKINGS, { knownStages: LEGS.map((leg) => leg.id) });

  // Inside a submodule every git query answers for the submodule's own tree, so the legs would be
  // resolved against a repository the operator's change does not live in. Anchor on the
  // superproject instead, and say so — a silently redirected answer is its own failure mode.
  const superproject = superprojectRoot(cwd);
  if (superproject !== null) {
    warnings.push(`${cwd} is inside a submodule; resolving against the superproject ${superproject}`);
  }
  const anchor = superproject ?? cwd;

  const root = checkoutRoot(anchor);
  if (root === null) {
    warnings.push(`not a git repository: ${cwd}`);
    return {
      beat: LEGS[0].id,
      index: 1,
      completed: [],
      skipped: [],
      provider: manifests.get(LEGS[0].id),
      branch: null,
      changeId: null,
      warnings,
    };
  }

  /** @type {import('./legs.js').RepoState} */
  const state = { cwd: anchor, root, branch: currentBranch(anchor), base: defaultBranch(anchor) };

  // Every leg but `ideate` is judged on its own; `ideate` is judged on what came after it.
  const done = LEGS.map((leg, i) => (i === 0 ? false : legIsDone(leg, state, manifests, warnings)));
  done[0] = ideateIsDone(state, done.some(Boolean));

  const current = done.indexOf(false);
  const beat = current === -1 ? null : LEGS[current].id;
  const lastComplete = done.lastIndexOf(true);

  const result = {
    beat,
    index: current === -1 ? LEGS.length : current + 1,
    completed: LEGS.filter((_, i) => done[i]).map((entry) => entry.id),
    // Holes: incomplete legs that later work has already run past. The current leg is one of them
    // by construction and is excluded — it is already reported as `beat`, and naming it twice would
    // have the waybill say "do the bay leg" and "you skipped the bay leg" at once.
    skipped: LEGS.filter((_, i) => !done[i] && i > current && i < lastComplete).map((entry) => entry.id),
    provider: beat === null ? undefined : manifests.get(beat),
    branch: state.branch,
    changeId: discoverChangeId(root),
    warnings,
  };

  if (beat === 'execute') {
    result.progress = executeProgress(root, result.changeId);
    // The filesystem walk only sees changes that already carry a `tasks.md`; `openspec list --json`
    // names active changes regardless. When only the CLI found one, take its id — phase 3
    // interpolates `changeId` into the waybill's command, and an empty one beside a progress line
    // for a named change is worse than no progress at all.
    result.changeId ??= result.progress.changeId;
  }
  return result;
}
