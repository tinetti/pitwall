import { createRepo } from '../helpers/repo-fixture.js';

/**
 * @typedef {{ dir:string, repo:string, branch:string }} BeatFixture
 *   `dir` is where inference should be run; `repo` is always the main worktree.
 */

/**
 * A repository frozen at the `ideate` beat: the default branch is checked out, nothing has been
 * written, and no later beat is complete.
 *
 * `remote` and `originHead` are set so `defaultBranch` comes from `origin/HEAD` rather than falling
 * back to the current branch — otherwise the "a branch other than the default" half of the ideate
 * rule could never be false for the right reason.
 *
 * @returns {BeatFixture}
 */
export function ideateFixture() {
  const repo = createRepo({ remote: true, originHead: true });
  return { dir: repo, repo, branch: 'main' };
}
