import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BEATS } from '../src/beats.js';
import { resolveBeat } from '../src/inference.js';
import { executeProgress } from '../src/progress.js';
import { loadProviders } from '../src/providers.js';
import {
  addSubmodule,
  cleanupAll,
  createRepo,
  git,
  pathWithout,
  stubBin,
  tempRoot,
  withPath,
  writeFile,
} from './helpers/repo-fixture.js';
import { ideateFixture } from './fixtures/ideate.js';
import { worktreeFixture } from './fixtures/worktree.js';
import { refineFixture } from './fixtures/refine.js';
import { contractFixture } from './fixtures/contract.js';
import { specsFixture } from './fixtures/specs.js';
import { CHANGE_ID, executeFixture } from './fixtures/execute.js';
import { cleanupFixture } from './fixtures/cleanup.js';

after(cleanupAll);

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const KNOWN_STAGES = BEATS.map((beat) => beat.id);

/** A `PATH` with the real openspec CLI removed, so inference is judged on repository state alone. */
const absent = () => pathWithout('openspec');

/**
 * @param {string} dir
 * @param {Map<string, import('../src/providers.js').Provider>} [providers]
 */
const resolve = (dir, providers) => withPath(absent(), () => resolveBeat(dir, providers));

/**
 * @param {Record<string,string>} files basename → contents
 * @returns {Map<string, import('../src/providers.js').Provider>}
 */
function providerMap(files) {
  const dir = path.join(tempRoot(), 'providers');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, contents] of Object.entries(files)) writeFile(path.join(dir, name), contents);
  return loadProviders(dir, { knownStages: KNOWN_STAGES });
}

describe('BEATS', () => {
  it('is the fixed seven-beat model, in order', () => {
    assert.deepEqual(KNOWN_STAGES, [
      'ideate',
      'worktree',
      'refine',
      'contract',
      'specs',
      'execute',
      'cleanup',
    ]);
  });

  it('has one fixture per beat and no strays — criterion 1 counts this directory', () => {
    assert.equal(fs.readdirSync(FIXTURES).length, BEATS.length);
  });
});

describe('the shipped provider manifests', () => {
  const providers = loadProviders(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'providers'),
    { knownStages: KNOWN_STAGES },
  );

  it('binds a baton to every beat that has one — cleanup is the last one still unmanifested', () => {
    // `worktree` is wrapper-owned for *detection* and provider-bound for its baton: `owner` in
    // BEATS says who supplies the detector, not who supplies the command and the prose.
    assert.deepEqual(
      [...providers.keys()].sort(),
      ['contract', 'execute', 'ideate', 'refine', 'specs', 'worktree'],
    );
  });

  it('names a model and an effort on every manifest, so no stage can leave one unsourced', () => {
    for (const provider of providers.values()) {
      assert.ok(provider.model, `${provider.path} has no model`);
      assert.ok(provider.effort, `${provider.path} has no effort`);
    }
  });

  it('keeps refine and contract on one command, separated only by detector', () => {
    assert.equal(providers.get('refine').command, providers.get('contract').command);
    assert.notEqual(
      providers.get('refine').doneWhenPathExists,
      providers.get('contract').doneWhenPathExists,
    );
  });
});

describe('resolveBeat', () => {
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
    it(`resolves the ${id} fixture to the ${id} beat`, () => {
      const fixture = build();
      const result = resolve(fixture.dir);

      assert.equal(result.beat, id);
      assert.equal(result.index, KNOWN_STAGES.indexOf(id) + 1);
      assert.deepEqual(result.completed, KNOWN_STAGES.slice(0, KNOWN_STAGES.indexOf(id)));
      assert.deepEqual(result.skipped, []);
      assert.deepEqual(result.warnings, []);
      assert.equal(result.branch, fixture.branch);
    });
  }

  it('carries the provider manifest for the current beat', () => {
    const result = resolve(specsFixture().dir);
    assert.equal(result.provider.command, '/spec:propose');
    assert.match(result.provider.path, /openspec-specs\.md$/);
  });

  it('carries the manifest for a wrapper-owned beat too, since the baton is not the detector', () => {
    const result = resolve(worktreeFixture().dir);
    assert.equal(result.provider.command, '/pitwall:start');
    assert.match(result.provider.path, /pitwall-worktree\.md$/);
  });

  it('leaves provider undefined for a beat with no manifest yet', () => {
    assert.equal(resolve(cleanupFixture().dir).provider, undefined);
  });

  it('reports execute progress from the tasks list, and only on the execute beat', () => {
    assert.deepEqual(resolve(executeFixture().dir).progress, {
      done: 1,
      total: 3,
      source: 'tasks-md',
      changeId: CHANGE_ID,
    });
    assert.equal(resolve(specsFixture().dir).progress, undefined);
  });

  it('names the change id once one has been scaffolded', () => {
    assert.equal(resolve(executeFixture().dir).changeId, CHANGE_ID);
    assert.equal(resolve(specsFixture().dir).changeId, null);
  });

  it('adopts the CLI change id when the filesystem walk found none', () => {
    // The one case where the two sources disagree: `discoverChangeId` skips `archive` while the
    // specs detector's `openspec/changes/*/tasks.md` still matches it, so the beat is `execute`
    // with no id from disk. Phase 3 interpolates this id into the baton command.
    const { dir } = specsFixture();
    writeFile(path.join(dir, 'openspec', 'changes', 'archive', 'tasks.md'), '- [ ] a\n');

    const listing = JSON.stringify({
      changes: [{ name: CHANGE_ID, completedTasks: 4, totalTasks: 9 }],
      root: { path: '.', source: 'x' },
    });
    const stub = stubBin(
      'openspec',
      ['if [ "$1" = "--version" ]; then echo "1.9.0"; exit 0; fi', `echo '${listing}'`].join('\n'),
    );

    const result = withPath(`${stub}:${absent()}`, () => resolveBeat(dir));
    assert.equal(result.beat, 'execute');
    assert.equal(result.progress.changeId, CHANGE_ID);
    assert.equal(result.changeId, CHANGE_ID);
  });

  it('never names the current beat as skipped, even with later beats complete', () => {
    const { dir } = worktreeFixture();
    writeFile(path.join(dir, 'docs', 'ideation', 'thing', 'contract-data.json'), '{}\n');
    writeFile(path.join(dir, 'docs', 'ideation', 'thing', 'contract.md'), '# Contract\n');

    const result = resolve(dir);
    assert.equal(result.beat, 'worktree');
    assert.deepEqual(result.completed, ['ideate', 'refine', 'contract']);
    assert.deepEqual(result.skipped, []);
  });

  it('names the hole a stage done by hand out of order leaves behind', () => {
    const { dir } = worktreeFixture();
    writeFile(path.join(dir, 'docs', 'ideation', 'thing', 'contract.md'), '# Contract\n');
    writeFile(path.join(dir, 'openspec', 'changes', CHANGE_ID, 'tasks.md'), '- [ ] a\n');

    const result = resolve(dir);
    assert.equal(result.beat, 'worktree');
    assert.deepEqual(result.completed, ['ideate', 'contract', 'specs']);
    assert.deepEqual(result.skipped, ['refine']);
  });

  it('falls off the end of the walk when all seven beats pass', () => {
    const repo = createRepo({ remote: true, originHead: true });
    writeFile(path.join(repo, 'docs', 'ideation', 'thing', 'contract-data.json'), '{}\n');
    writeFile(path.join(repo, 'docs', 'ideation', 'thing', 'contract.md'), '# Contract\n');
    writeFile(path.join(repo, 'openspec', 'changes', CHANGE_ID, 'tasks.md'), '- [x] a\n- [x] b\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-m', 'every artifact']);

    // Registered off the `gwt` path on purpose: `worktreeIsDone` sees a linked worktree while
    // `cleanupIsDone` sees nothing at the convention path, which is the one arrangement in which
    // all seven beats can be complete at once (both detectors are convention-keyed by design).
    const elsewhere = path.join(tempRoot(), 'off-convention');
    git(repo, ['worktree', 'add', '--no-track', '-b', 'feat/thing', elsewhere]);

    const result = resolve(elsewhere);
    assert.equal(result.beat, null);
    assert.equal(result.index, BEATS.length);
    assert.deepEqual(result.completed, KNOWN_STAGES);
    assert.deepEqual(result.skipped, []);
    assert.equal(result.provider, undefined);
    assert.equal(result.progress, undefined);
    assert.deepEqual(result.warnings, []);

    // `index` alone cannot tell this state from a current `cleanup` beat; `beat` is the discriminator.
    assert.equal(resolve(cleanupFixture().dir).index, result.index);
  });

  it('resolves against the superproject when called from inside a submodule', () => {
    const fixture = specsFixture();
    const sub = addSubmodule(fixture.dir, createRepo({ name: 'child' }));

    const result = resolve(sub);
    assert.equal(result.beat, 'specs');
    assert.equal(result.branch, fixture.branch);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /submodule/);
    assert.equal(result.warnings[0].includes(fixture.dir), true);
  });

  it('does not mark a beat skipped when nothing after it is complete', () => {
    assert.deepEqual(resolve(contractFixture().dir).skipped, []);
  });

  it('degrades a detector that cannot run to a warning rather than a throw', () => {
    const providers = providerMap({
      'broken-specs.md': [
        '---',
        'stage: specs',
        'command: /spec:propose',
        'model: placeholder',
        'doneWhenCmd: pitwall-no-such-binary-xyz',
        '---',
        '',
      ].join('\n'),
    });

    const result = resolve(specsFixture().dir, providers);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /broken-specs\.md/);
    assert.match(result.warnings[0], /pitwall-no-such-binary-xyz/);
    assert.equal(result.completed.includes('specs'), false);
  });

  it('never throws outside a git repository', () => {
    const result = resolve(tempRoot());
    assert.equal(result.beat, 'ideate');
    assert.equal(result.branch, null);
    assert.match(result.warnings[0], /not a git repository/);
  });

  it('never throws on a detached HEAD', () => {
    const repo = createRepo({ remote: true, originHead: true });
    git(repo, ['checkout', '--detach', 'HEAD']);
    const result = resolve(repo);
    assert.equal(result.branch, null);
    assert.equal(result.beat, 'ideate');
  });

  it('never throws in a repository with no commits', () => {
    assert.equal(resolve(createRepo({ commit: false })).beat, 'ideate');
  });
});

describe('executeProgress', () => {
  /**
   * @param {string} tasks contents of `tasks.md`, or `null` to omit the file entirely
   * @returns {string} the repository root
   */
  function changeRepo(tasks) {
    const root = tempRoot();
    if (tasks !== null) writeFile(path.join(root, 'openspec', 'changes', CHANGE_ID, 'tasks.md'), tasks);
    return root;
  }

  const count = (tasks) => withPath(absent(), () => executeProgress(changeRepo(tasks)));

  it('reports an empty tasks list as 0 of 0 rather than as complete', () => {
    assert.deepEqual(count('# Tasks\n'), { done: 0, total: 0, source: 'tasks-md', changeId: CHANGE_ID });
  });

  it('reports 0 of 0 when there is no change at all', () => {
    assert.deepEqual(count(null), { done: 0, total: 0, source: 'tasks-md', changeId: null });
  });

  for (const [label, tasks, expected] of [
    ['0 of 3', '- [ ] a\n- [ ] b\n- [ ] c\n', { done: 0, total: 3 }],
    ['2 of 3', '- [x] a\n- [X] b\n- [ ] c\n', { done: 2, total: 3 }],
    ['3 of 3', '- [x] a\n- [x] b\n- [x] c\n', { done: 3, total: 3 }],
    ['nested indents', '- [x] a\n  - [ ] a.1\n\t- [ ] a.2\n', { done: 1, total: 3 }],
    ['asterisk and plus bullets', '* [x] a\n+ [ ] b\n', { done: 1, total: 2 }],
  ]) {
    it(`counts ${label}`, () => {
      const result = count(tasks);
      assert.equal(result.done, expected.done);
      assert.equal(result.total, expected.total);
    });
  }

  it('ignores checkboxes inside a fenced code block', () => {
    const tasks = ['- [x] real', '', '```md', '- [ ] example', '- [x] example', '```', '', '- [ ] also real', ''].join('\n');
    assert.deepEqual(count(tasks), { done: 1, total: 2, source: 'tasks-md', changeId: CHANGE_ID });
  });

  it('ignores checkboxes inside a tilde-fenced block', () => {
    const tasks = ['- [x] real', '~~~', '- [ ] example', '~~~', ''].join('\n');
    assert.equal(count(tasks).total, 1);
  });

  it('treats an unclosed fence as swallowing the rest of the file', () => {
    const tasks = ['- [x] real', '```', '- [ ] example', ''].join('\n');
    assert.equal(count(tasks).total, 1);
  });

  it('ignores archived changes when discovering the change id', () => {
    const root = tempRoot();
    writeFile(path.join(root, 'openspec', 'changes', 'archive', '2026-01-01-old', 'tasks.md'), '- [ ] a\n');
    writeFile(path.join(root, 'openspec', 'changes', CHANGE_ID, 'tasks.md'), '- [x] a\n');
    const result = withPath(absent(), () => executeProgress(root));
    assert.equal(result.changeId, CHANGE_ID);
    assert.deepEqual([result.done, result.total], [1, 1]);
  });

  it('picks the first unfinished change by name when several are active', () => {
    const root = tempRoot();
    writeFile(path.join(root, 'openspec', 'changes', 'a-done', 'tasks.md'), '- [x] a\n');
    writeFile(path.join(root, 'openspec', 'changes', 'b-open', 'tasks.md'), '- [ ] a\n');
    writeFile(path.join(root, 'openspec', 'changes', 'c-open', 'tasks.md'), '- [ ] a\n');
    assert.equal(withPath(absent(), () => executeProgress(root)).changeId, 'b-open');
  });

  describe('with the openspec CLI on PATH', () => {
    /**
     * @param {string} script body of the stub, after the `--version` reply
     * @param {string} tasks contents of `tasks.md`
     * @returns {{done:number,total:number,source:string,changeId:string|null}}
     */
    function withStub(script, tasks = '- [ ] a\n- [ ] b\n') {
      const root = changeRepo(tasks);
      const stub = stubBin('openspec', ['if [ "$1" = "--version" ]; then echo "1.9.0"; exit 0; fi', script].join('\n'));
      return withPath(`${stub}:${absent()}`, () => executeProgress(root));
    }

    const listJson = (rows) => `echo '${JSON.stringify({ changes: rows, root: { path: '.', source: 'x' } })}'`;

    it('prefers the CLI when it reports usable counts', () => {
      const result = withStub(listJson([{ name: CHANGE_ID, completedTasks: 5, totalTasks: 9 }]));
      assert.deepEqual(result, { done: 5, total: 9, source: 'openspec', changeId: CHANGE_ID });
    });

    it('falls back to the tasks list when the CLI emits malformed JSON', () => {
      assert.deepEqual(withStub('echo "not json"'), {
        done: 0,
        total: 2,
        source: 'tasks-md',
        changeId: CHANGE_ID,
      });
    });

    it('falls back to the tasks list when the CLI exits non-zero', () => {
      assert.equal(withStub('exit 1').source, 'tasks-md');
    });

    it('falls back to the tasks list when the JSON has the wrong shape', () => {
      assert.equal(withStub(listJson([{ name: CHANGE_ID, done: 5, total: 9 }])).source, 'tasks-md');
    });

    it('falls back to the tasks list when the CLI hangs', () => {
      assert.equal(withStub('sleep 30').source, 'tasks-md');
    });
  });
});
