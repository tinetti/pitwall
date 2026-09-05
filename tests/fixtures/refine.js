import { addWorktree, createRepo } from '../helpers/repo-fixture.js';

/**
 * A repository frozen at the `refine` leg: the feature bay exists and is where work happens,
 * but the ideation interview has produced nothing yet.
 *
 * @param {string} [branch]
 * @returns {import('./ideate.js').LegFixture}
 */
export function refineFixture(branch = 'feat/thing') {
  const repo = createRepo({ remote: true, originHead: true });
  const dir = addWorktree(repo, branch);
  return { dir, repo, branch };
}
