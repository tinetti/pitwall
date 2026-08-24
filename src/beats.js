import fs from 'node:fs';

import { inWorktree, isMerged, resolveWorktreePath } from './repo.js';

/**
 * @typedef {{id:string, owner:'provider'|'wrapper', progress?:boolean}} Beat
 */

/**
 * @typedef {{cwd:string, root:string, branch:string|null, base:string|null}} RepoState
 *   `root` is the working tree the detectors resolve against; `base` is the default branch.
 */

/**
 * The beat model. Fixed and exported rather than configurable: "7/7 beats" is a standing invariant
 * the success criteria are stated against, and the fixture directory is counted against this list.
 *
 * `owner` says who supplies the *detector*, not who supplies the baton — the two wrapper-owned
 * beats still take their command and model from a manifest, because the anchor and the terminus
 * must be relied on while everything they hand to is swappable.
 *
 * @type {Beat[]}
 */
export const BEATS = [
  { id: 'ideate', owner: 'provider' },
  { id: 'worktree', owner: 'wrapper' },
  { id: 'refine', owner: 'provider' },
  { id: 'contract', owner: 'provider' },
  { id: 'specs', owner: 'provider' },
  { id: 'execute', owner: 'provider', progress: true },
  { id: 'cleanup', owner: 'wrapper' },
];

/**
 * Where the current branch's worktree would live, or `null` when there is no branch to derive it
 * from — a detached HEAD and a directory outside any repository both land here.
 *
 * @param {RepoState} state
 * @returns {string|null}
 */
function worktreePath(state) {
  if (!state.branch) return null;
  try {
    return resolveWorktreePath(state.branch, state.cwd);
  } catch {
    return null;
  }
}

/**
 * The `worktree` beat is done once the isolated tree exists — either we are standing in it, or it
 * sits where the naming convention says it should.
 *
 * @param {RepoState} state
 * @returns {boolean}
 */
export function worktreeIsDone(state) {
  if (inWorktree(state.cwd)) return true;
  const target = worktreePath(state);
  return target !== null && fs.existsSync(target);
}

/**
 * The `cleanup` beat is done once the work has landed and its tree is gone.
 *
 * Standing on the default branch is explicitly *not* done: there is no feature branch to fold back
 * in yet, and treating that as a completed cleanup would make the `ideate` rule below fire in every
 * untouched repository.
 *
 * "No worktree remains" is judged against the `gwt` convention path only, deliberately matching
 * {@link worktreeIsDone}: a worktree the operator registered somewhere else reads as cleaned up
 * while it is still checked out. Asking `git worktree list --porcelain` instead would answer for
 * every path, but then the two wrapper detectors would disagree about what "the worktree" is, and
 * the beat Pitwall anchors on is the one at the convention path.
 *
 * @param {RepoState} state
 * @returns {boolean}
 */
export function cleanupIsDone(state) {
  const { branch, base } = state;
  if (!branch || !base || branch === base) return false;
  if (!isMerged(branch, base, state.cwd)) return false;
  const target = worktreePath(state);
  return target !== null && !fs.existsSync(target);
}

/**
 * The `ideate` beat leaves no artifact by design — a rough-ideation conversation writes nothing —
 * so it is judged by what it must have preceded: any later beat being complete, or a branch other
 * than the default being checked out.
 *
 * @param {RepoState} state
 * @param {boolean} laterComplete whether any beat after this one is complete
 * @returns {boolean}
 */
export function ideateIsDone(state, laterComplete) {
  if (laterComplete) return true;
  return Boolean(state.branch && state.base && state.branch !== state.base);
}
