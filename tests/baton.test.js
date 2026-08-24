import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BEATS } from '../src/beats.js';
import { renderBaton } from '../src/baton.js';
import { resolveBeat } from '../src/inference.js';
import { cleanupAll, createRepo, git, pathWithout, tempRoot, withPath, writeFile } from './helpers/repo-fixture.js';
import { ideateFixture } from './fixtures/ideate.js';
import { worktreeFixture } from './fixtures/worktree.js';
import { refineFixture } from './fixtures/refine.js';
import { contractFixture } from './fixtures/contract.js';
import { specsFixture } from './fixtures/specs.js';
import { CHANGE_ID, executeFixture } from './fixtures/execute.js';
import { cleanupFixture } from './fixtures/cleanup.js';

after(cleanupAll);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, 'golden');
const SRC = path.join(HERE, '..', 'src');

/** The golden files are byte-exact, so the real openspec CLI must never influence what is rendered. */
const resolve = (dir) => withPath(pathWithout('openspec'), () => resolveBeat(dir));

/** Nothing ignored, nothing to report — the shape every golden case is rendered against. */
const CLEAN = { ignored: [], warnings: [] };

/**
 * Compare against `tests/golden/<name>.txt`, or rewrite it when `UPDATE_GOLDEN=1`.
 *
 * Regeneration is deliberately an environment flag rather than a CLI flag: a golden file that
 * rewrites itself during a normal run is a tautology, so the only way to update one is to ask.
 *
 * @param {string} name
 * @param {string} actual
 */
function assertGolden(name, actual) {
  const file = path.join(GOLDEN, `${name}.txt`);
  if (process.env.UPDATE_GOLDEN === '1') {
    fs.mkdirSync(GOLDEN, { recursive: true });
    fs.writeFileSync(file, actual);
  }
  assert.equal(actual, fs.readFileSync(file, 'utf8'), `golden mismatch: ${file}`);
}

/**
 * A synthetic inference result, so the rendering rules can be exercised without a repository.
 *
 * @param {Partial<import('../src/inference.js').Inference>} [overrides]
 * @returns {import('../src/inference.js').Inference}
 */
function state(overrides = {}) {
  return {
    beat: 'specs',
    index: 5,
    completed: ['ideate', 'worktree', 'refine', 'contract'],
    skipped: [],
    provider: {
      stage: 'specs',
      command: '/spec:propose',
      model: 'placeholder-model',
      effort: 'high',
      handoff: 'clear',
      body: '',
      path: '/providers/openspec-specs.md',
    },
    branch: 'feat/session-handoff',
    changeId: 'add-session-handoff',
    warnings: [],
    ...overrides,
  };
}

describe('renderBaton golden output', () => {
  const cases = [
    ['ideate', ideateFixture],
    ['worktree', worktreeFixture],
    ['refine', refineFixture],
    ['contract', contractFixture],
    ['specs', specsFixture],
    ['execute', executeFixture],
    ['cleanup', cleanupFixture],
  ];

  for (const [id, build] of cases) {
    it(`renders the ${id} beat`, () => {
      assertGolden(id, renderBaton(resolve(build().dir), CLEAN));
    });
  }

  it('renders a repository whose seven beats are all complete', () => {
    const repo = createRepo({ remote: true, originHead: true });
    writeFile(path.join(repo, 'docs', 'ideation', 'thing', 'contract-data.json'), '{}\n');
    writeFile(path.join(repo, 'docs', 'ideation', 'thing', 'contract.md'), '# Contract\n');
    writeFile(path.join(repo, 'openspec', 'changes', CHANGE_ID, 'tasks.md'), '- [x] a\n- [x] b\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-m', 'every artifact']);

    const elsewhere = path.join(tempRoot(), 'off-convention');
    git(repo, ['worktree', 'add', '--no-track', '-b', 'feat/thing', elsewhere]);

    const result = resolve(elsewhere);
    assert.equal(result.beat, null);
    assertGolden('complete', renderBaton(result, CLEAN));
  });
});

describe('renderBaton header and beat strip', () => {
  it('names the branch, the position, and the current beat', () => {
    assert.equal(
      renderBaton(state(), CLEAN).split('\n')[0],
      `feat/session-handoff · beat 5 of ${BEATS.length} (specs)`,
    );
  });

  it('drops the branch prefix entirely on a detached HEAD rather than printing null', () => {
    const first = renderBaton(state({ branch: null }), CLEAN).split('\n')[0];
    assert.equal(first, `beat 5 of ${BEATS.length} (specs)`);
    assert.equal(first.includes('null'), false);
  });

  it('walks the beat list positionally, so completed beats after the current one keep their place', () => {
    const output = renderBaton(
      state({ beat: 'worktree', index: 2, completed: ['ideate', 'refine', 'contract'], provider: undefined }),
      CLEAN,
    );
    assert.equal(output.split('\n')[1], '  ✓ ideate  ✓ refine  ✓ contract');
    assert.equal(output.split('\n')[2], '  ▶ worktree');
  });

  it('names a skipped beat rather than hiding it', () => {
    const output = renderBaton(state({ skipped: ['refine'] }), CLEAN);
    assert.match(output, /^ {2}⚠ refine \(skipped\)$/m);
  });

  it('says every beat is complete when the walk fell off the end', () => {
    const output = renderBaton(
      state({ beat: null, index: 7, completed: BEATS.map((beat) => beat.id), provider: undefined }),
      CLEAN,
    );
    assert.equal(output.split('\n')[0], `feat/session-handoff · all ${BEATS.length} beats complete`);
    assert.equal(output.includes('▶'), false);
    assert.match(output, /NEXT:\n {2}nothing to hand off/);
  });
});

describe('renderBaton progress', () => {
  const withProgress = (done, total) =>
    renderBaton(
      state({
        beat: 'execute',
        index: 6,
        completed: ['ideate', 'worktree', 'refine', 'contract', 'specs'],
        progress: { done, total, source: 'tasks-md', changeId: CHANGE_ID },
      }),
      CLEAN,
    );

  it('reports n of N beside the current beat', () => {
    assert.match(withProgress(2, 4), /^ {2}▶ execute \(2 of 4 tasks\)$/m);
  });

  it('reports 0 of 0 literally, never as complete', () => {
    const output = withProgress(0, 0);
    assert.match(output, /^ {2}▶ execute \(0 of 0 tasks\)$/m);
    assert.equal(output.includes('complete'), false);
  });

  it('reports n of n while the beat is still current', () => {
    assert.match(withProgress(4, 4), /^ {2}▶ execute \(4 of 4 tasks\)$/m);
  });

  it('omits the progress suffix on the six beats that carry none', () => {
    assert.match(renderBaton(state(), CLEAN), /^ {2}▶ specs$/m);
  });
});

describe('renderBaton NEXT block', () => {
  /**
   * @param {Partial<import('../src/providers.js').Provider>} provider
   * @param {Partial<import('../src/inference.js').Inference>} [rest]
   */
  const next = (provider, rest = {}) =>
    renderBaton(state({ ...rest, provider: { ...state().provider, ...provider } }), CLEAN);

  it('interpolates the command and the change id', () => {
    assert.match(next({}), /^ {2}\/spec:propose add-session-handoff$/m);
  });

  it('omits the argument when no change has been scaffolded yet', () => {
    assert.match(next({}, { changeId: null }), /^ {2}\/spec:propose$/m);
  });

  it('sources model and effort from the manifest', () => {
    assert.match(next({ model: 'some-model', effort: 'low' }), /^ {2}└ some-model · low effort$/m);
  });

  it('omits the effort entirely when the manifest declares none, rather than defaulting', () => {
    const output = next({ model: 'some-model', effort: undefined });
    assert.match(output, /^ {2}└ some-model$/m);
    assert.equal(output.includes('effort'), false);
  });

  for (const [handoff, line] of [
    ['clear', '/clear, then run:'],
    ['session', 'in a new session, run:'],
    ['inline', 'run:'],
  ]) {
    it(`renders the ${handoff} handoff as "${line}"`, () => {
      assert.equal(next({ handoff }).split('\n').includes(`  ${line}`), true);
    });
  }

  it('renders an unrecognised handoff verbatim rather than dropping the line', () => {
    assert.match(next({ handoff: 'hand the laptop to Dave' }), /^ {2}hand the laptop to Dave$/m);
  });

  it('falls back to a bare instruction when the manifest declares no handoff', () => {
    assert.match(next({ handoff: undefined }), /^ {2}run:\n {2}\/spec:propose/m);
  });

  it('carries the manifest body through as the baton prose', () => {
    const output = next({ body: 'Do the thing.\n\nThen do the other thing.\n' });
    assert.match(output, /^ {2}Do the thing\.$/m);
    assert.match(output, /^ {2}Then do the other thing\.$/m);
    // A blank separator line must stay blank; indenting it would leave trailing whitespace.
    assert.equal(output.includes('  \n'), false);
  });

  it('says so plainly when no manifest is bound to the beat, instead of emitting an empty block', () => {
    const output = renderBaton(state({ beat: 'worktree', index: 2, provider: undefined }), CLEAN);
    assert.match(output, /NEXT:\n {2}no provider manifest is bound to the worktree beat/);
    assert.match(output, /providers\//);
  });
});

describe('renderBaton reports what it could not do', () => {
  it('names every gitignored artifact path', () => {
    const output = renderBaton(state(), { ignored: ['openspec/', 'docs/ideation/'], warnings: [] });
    assert.match(output, /^IGNORED BY GIT:$/m);
    assert.match(output, /^ {2}⚠ openspec\/ /m);
    assert.match(output, /^ {2}⚠ docs\/ideation\/ /m);
  });

  it('omits the ignored block entirely when the repository is clean', () => {
    assert.equal(renderBaton(state(), CLEAN).includes('IGNORED BY GIT'), false);
  });

  it('names the offending manifest when a detector could not run', () => {
    const output = renderBaton(
      state({ warnings: ['/providers/openspec-specs.md: doneWhenCmd command not found: nope'] }),
      CLEAN,
    );
    assert.match(output, /^WARNINGS:$/m);
    assert.match(output, /openspec-specs\.md/);
  });

  it('reports a preflight that could not answer alongside the inference warnings', () => {
    const output = renderBaton(state({ warnings: ['inference said so'] }), {
      ignored: [],
      warnings: ['preflight said so'],
    });
    assert.match(output, /inference said so/);
    assert.match(output, /preflight said so/);
  });

  it('always ends with exactly one trailing newline', () => {
    const output = renderBaton(state(), CLEAN);
    assert.equal(output.endsWith('\n'), true);
    assert.equal(output.endsWith('\n\n'), false);
  });
});

describe('criterion 2: no model name is hardcoded anywhere in src/', () => {
  /**
   * @param {string} dir
   * @returns {string[]}
   */
  function filesUnder(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? filesUnder(full) : [full];
    });
  }

  it('finds no model literal in any source file, comments included', () => {
    const offenders = filesUnder(SRC).filter((file) =>
      /(opus|sonnet|haiku)/i.test(fs.readFileSync(file, 'utf8')),
    );
    assert.deepEqual(offenders, [], 'model names must live in providers/, never in src/');
  });
});
