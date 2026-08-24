import path from 'node:path';

import { writeFile } from '../helpers/repo-fixture.js';
import { contractFixture } from './contract.js';

/**
 * A repository frozen at the `specs` beat: the contract is written, but no change has been
 * scaffolded under `openspec/changes/`.
 *
 * @param {string} [branch]
 * @returns {import('./ideate.js').BeatFixture}
 */
export function specsFixture(branch = 'feat/thing') {
  const fixture = contractFixture(branch);
  writeFile(path.join(fixture.dir, 'docs', 'ideation', 'thing', 'contract.md'), '# Contract\n');
  return fixture;
}
