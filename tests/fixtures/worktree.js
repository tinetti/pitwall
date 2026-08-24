import path from 'node:path';

import { createRepo, git, writeFile } from '../helpers/repo-fixture.js';

/**
 * A repository frozen at the `worktree` beat: a feature branch is checked out in the *main*
 * checkout, so ideation has clearly happened but the isolated worktree Pitwall anchors on does not
 * exist yet.
 *
 * The branch carries a commit of its own so it is not trivially contained in the default branch,
 * which would otherwise read as a completed cleanup.
 *
 * @param {string} [branch]
 * @returns {import('./ideate.js').BeatFixture}
 */
export function worktreeFixture(branch = 'feat/thing') {
  const repo = createRepo({ remote: true, originHead: true });
  git(repo, ['checkout', '-b', branch]);
  writeFile(path.join(repo, 'work.txt'), 'in progress\n');
  git(repo, ['add', 'work.txt']);
  git(repo, ['commit', '-m', 'start the change']);
  return { dir: repo, repo, branch };
}
