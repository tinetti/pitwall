import path from 'node:path';

import { writeFile } from '../helpers/repo-fixture.js';
import { specsFixture } from './specs.js';
import { CHANGE_ID } from './execute.js';

const TASKS = ['# Tasks', '', '- [x] 1.1 Scaffold', '- [x] 1.2 Implement', '  - [X] 1.3 Test', ''].join('\n');

/**
 * A repository frozen at the `cleanup` beat: every task is ticked, so the six beats before this one
 * are complete, and the feature worktree is still on disk waiting to be folded back in.
 *
 * @param {string} [branch]
 * @returns {import('./ideate.js').BeatFixture}
 */
export function cleanupFixture(branch = 'feat/thing') {
  const fixture = specsFixture(branch);
  writeFile(path.join(fixture.dir, 'openspec', 'changes', CHANGE_ID, 'tasks.md'), TASKS);
  return fixture;
}
