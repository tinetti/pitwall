import { addWorktree, createRepo } from '../helpers/repo-fixture.js';

/**
 * A repository frozen at the `refine` beat: the feature worktree exists and is where work happens,
 * but the ideation interview has produced nothing yet.
 *
 * @param {string} [branch]
 * @returns {import('./ideate.js').BeatFixture}
 */
export function refineFixture(branch = 'feat/thing') {
  const repo = createRepo({ remote: true, originHead: true });
  const dir = addWorktree(repo, branch);
  return { dir, repo, branch };
}
