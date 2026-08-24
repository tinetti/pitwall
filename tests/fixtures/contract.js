import path from 'node:path';

import { writeFile } from '../helpers/repo-fixture.js';
import { refineFixture } from './refine.js';

/**
 * A repository frozen at the `contract` beat: the interview left its data behind, but the contract
 * itself has not been written.
 *
 * @param {string} [branch]
 * @returns {import('./ideate.js').BeatFixture}
 */
export function contractFixture(branch = 'feat/thing') {
  const fixture = refineFixture(branch);
  writeFile(path.join(fixture.dir, 'docs', 'ideation', 'thing', 'contract-data.json'), '{}\n');
  return fixture;
}
