import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { WorktreeError, isInside, startWorktree } from '../src/worktree.js';
import {
  cleanupAll,
  createRepo,
  git,
  stubBin,
  tempRoot,
  withPath,
  writeFile,
} from './helpers/repo-fixture.js';

after(cleanupAll);

/** Absolute path to the real git, resolved before any test shadows it on `PATH`. */
const REAL_GIT = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();

/**
 * A `git` shim that records every invocation and then delegates to the real binary.
 *
 * "No fetch was attempted" is otherwise unobservable: a fetch in a remote-less repository fails
 * silently as far as the return value is concerned, so the only honest way to assert the absence of
 * a network side effect is to watch the calls themselves.
 *
 * @returns {{dir:string, calls:() => string[]}}
 */
function recordingGit() {
  const log = path.join(tempRoot(), 'git-calls.log');
  const dir = stubBin('git', `printf '%s\\n' "$*" >> ${JSON.stringify(log)}\nexec ${REAL_GIT} "$@"`);
  return {
    dir,
    calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : []),
  };
}

/**
 * How many worktrees the repository has registered — the count that must not move on a no-op.
 *
 * @param {string} cwd
 * @returns {number}
 */
function worktreeCount(cwd) {
  return git(cwd, ['worktree', 'list', '--porcelain'])
    .split('\n')
    .filter((line) => line.startsWith('worktree ')).length;
}

describe('startWorktree creates the branch and its worktree', () => {
  it('cuts a new branch off origin/<default> and checks it out at the convention path', () => {
    const repo = createRepo({ remote: true, originHead: true });

    const result = startWorktree('feat/demo', { cwd: repo });

    assert.equal(result.path, path.join(path.dirname(repo), `${path.basename(repo)}-feat-demo`));
    assert.equal(result.created, true);
    assert.equal(result.branchCreated, true);
    assert.equal(result.base, 'origin/main');
    assert.equal(fs.existsSync(result.path), true);
    assert.equal(git(result.path, ['symbolic-ref', '--short', 'HEAD']), 'feat/demo');
  });

  it('leaves the new branch untracked, so `git pull` there cannot merge the default branch in', () => {
    const repo = createRepo({ remote: true, originHead: true });
    const result = startWorktree('feat/demo', { cwd: repo });

    // `--default` so an unset key is an empty answer rather than the exit 1 the helper throws on.
    assert.equal(git(result.path, ['config', '--default', '', '--get', 'branch.feat/demo.remote']), '');
  });

  it('keeps the slashes in the branch and flattens them only in the path', () => {
    const repo = createRepo({ remote: true, originHead: true });

    const result = startWorktree('feat/a/b', { cwd: repo });

    assert.equal(path.basename(result.path), `${path.basename(repo)}-feat-a-b`);
    assert.equal(git(result.path, ['symbolic-ref', '--short', 'HEAD']), 'feat/a/b');
  });

  it('checks out a branch that already exists rather than trying to create it again', () => {
    const repo = createRepo({ remote: true, originHead: true });
    git(repo, ['branch', 'feat/existing']);
    const tip = git(repo, ['rev-parse', 'feat/existing']);

    const result = startWorktree('feat/existing', { cwd: repo });

    assert.equal(result.created, true);
    assert.equal(result.branchCreated, false);
    assert.equal(git(result.path, ['rev-parse', 'HEAD']), tip);
  });
});

describe('startWorktree base selection', () => {
  it('falls back to HEAD and attempts no fetch when the repository has no origin', () => {
    const repo = createRepo({ remote: false });
    const recorder = recordingGit();

    const result = withPath(`${recorder.dir}${path.delimiter}${process.env.PATH}`, () =>
      startWorktree('feat/demo', { cwd: repo }),
    );

    assert.equal(result.base, 'HEAD');
    assert.equal(result.created, true);
    assert.deepEqual(
      recorder.calls().filter((call) => call.startsWith('fetch')),
      [],
      'a remote-less repository must never be fetched',
    );
  });

  it('still lands on origin/<default> when the repository has no origin/HEAD of its own', () => {
    // `defaultBranch` would fall back to the current branch here; the fetch repairs `origin/HEAD`
    // first, which is why the fetch has to precede the resolve rather than follow it.
    const repo = createRepo({ remote: true, originHead: false });

    assert.equal(startWorktree('feat/demo', { cwd: repo }).base, 'origin/main');
  });

  it('refuses to guess when the composed base does not resolve', () => {
    // The silent-wrong-base failure mode: `defaultBranch` answers with the *current* branch when
    // origin publishes no HEAD, so `origin/<that>` is a ref that usually does not exist. A reachable
    // origin hides this — git repairs `origin/HEAD` during the fetch — so the case only shows up
    // when the fetch cannot help, which is exactly when guessing would do the most damage.
    const repo = createRepo({ remote: false });
    git(repo, ['remote', 'add', 'origin', path.join(tempRoot(), 'gone.git')]);

    assert.throws(
      () => startWorktree('feat/demo', { cwd: repo }),
      (error) =>
        error instanceof WorktreeError &&
        /default branch/.test(error.message) &&
        /set-head/.test(error.message),
    );
    assert.equal(fs.existsSync(path.join(path.dirname(repo), `${path.basename(repo)}-feat-demo`)), false);
  });

  it('honours an explicit base and rejects one that does not resolve', () => {
    const repo = createRepo({ remote: true, originHead: true });
    git(repo, ['branch', 'release/1']);

    const result = startWorktree('feat/demo', { cwd: repo, base: 'release/1' });
    assert.equal(result.base, 'release/1');

    assert.throws(
      () => startWorktree('feat/other', { cwd: repo, base: 'no/such/ref' }),
      (error) => error instanceof WorktreeError && /no\/such\/ref/.test(error.message),
    );
  });
});

describe('startWorktree is idempotent', () => {
  it('creates nothing on a second invocation and still reports the path', () => {
    const repo = createRepo({ remote: true, originHead: true });
    const first = startWorktree('feat/demo', { cwd: repo });
    const before = worktreeCount(repo);

    const second = startWorktree('feat/demo', { cwd: repo });

    assert.equal(second.path, first.path);
    assert.equal(second.created, false);
    assert.equal(second.branchCreated, false);
    assert.equal(worktreeCount(repo), before);
  });

  it('does nothing at all when called from inside the target worktree', () => {
    const repo = createRepo({ remote: true, originHead: true });
    const created = startWorktree('feat/demo', { cwd: repo });
    const before = worktreeCount(repo);

    const result = startWorktree('feat/demo', { cwd: created.path });

    assert.equal(result.path, created.path);
    assert.equal(result.created, false);
    assert.equal(worktreeCount(repo), before);
    // The nested-worktree failure mode: a sibling of the worktree rather than of the main tree.
    assert.equal(fs.existsSync(`${created.path}-feat-demo`), false);
  });

  it('treats a subdirectory of the target as being inside it', () => {
    const repo = createRepo({ remote: true, originHead: true });
    const created = startWorktree('feat/demo', { cwd: repo });
    const nested = path.join(created.path, 'src', 'deep');
    fs.mkdirSync(nested, { recursive: true });

    assert.equal(startWorktree('feat/demo', { cwd: nested }).created, false);
  });

  it('refuses the no-op when the registered worktree is gone from disk', () => {
    // `git worktree list` still lists a deleted worktree, marked `prunable`. Reporting a clean
    // no-op here would send the operator to `cd` into a directory that is not there.
    const repo = createRepo({ remote: true, originHead: true });
    const created = startWorktree('feat/demo', { cwd: repo });
    fs.rmSync(created.path, { recursive: true, force: true });

    assert.throws(
      () => startWorktree('feat/demo', { cwd: repo }),
      (error) => error instanceof WorktreeError && /prune/.test(error.message),
    );
  });
});

describe('startWorktree refuses what git would only half-explain', () => {
  it('names the remedy for a repository with no commits instead of creating an orphan', () => {
    const repo = createRepo({ commit: false });

    assert.throws(
      () => startWorktree('feat/demo', { cwd: repo }),
      (error) => error instanceof WorktreeError && /no commits/.test(error.message),
    );
    const target = path.join(path.dirname(repo), `${path.basename(repo)}-feat-demo`);
    assert.equal(fs.existsSync(target), false, 'an orphan worktree was created behind the guard');
  });

  it('says where a branch is already checked out, including the main checkout', () => {
    const repo = createRepo({ remote: true, originHead: true });
    git(repo, ['checkout', '-b', 'feat/thing']);

    assert.throws(
      () => startWorktree('feat/thing', { cwd: repo }),
      (error) =>
        error instanceof WorktreeError &&
        error.message.includes('feat/thing') &&
        error.message.includes(repo),
    );
  });

  it('distinguishes an occupied directory from a registered worktree', () => {
    const repo = createRepo({ remote: true, originHead: true });
    const target = path.join(path.dirname(repo), `${path.basename(repo)}-feat-demo`);
    writeFile(path.join(target, 'stray.txt'), 'not a worktree\n');

    assert.throws(
      () => startWorktree('feat/demo', { cwd: repo }),
      (error) => error instanceof WorktreeError && /already exists/.test(error.message),
    );
  });

  it('rejects a branch name git would not accept, before anything is mutated', () => {
    const repo = createRepo({ remote: true, originHead: true });

    for (const name of ['feat/x y', 'feat/..x', '--force']) {
      assert.throws(
        () => startWorktree(name, { cwd: repo }),
        (error) => error instanceof WorktreeError && /branch name/.test(error.message),
        `accepted \`${name}\``,
      );
    }
    assert.equal(worktreeCount(repo), 1);
  });

  it('rejects an empty branch name', () => {
    const repo = createRepo({ remote: true, originHead: true });

    assert.throws(
      () => startWorktree('', { cwd: repo }),
      (error) => error instanceof WorktreeError && /branch/.test(error.message),
    );
  });

  it('reports being outside a repository as its own failure, not as a raw throw', () => {
    assert.throws(
      () => startWorktree('feat/demo', { cwd: tempRoot() }),
      (error) => error instanceof WorktreeError && /not inside a git repository/.test(error.message),
    );
  });
});

describe('isInside', () => {
  it('accepts the path itself and any descendant, and rejects a sibling', () => {
    const root = tempRoot();
    const target = path.join(root, 'repo-feat-demo');
    fs.mkdirSync(path.join(target, 'src'), { recursive: true });

    assert.equal(isInside(target, target), true);
    assert.equal(isInside(target, path.join(target, 'src')), true);
    assert.equal(isInside(target, root), false);
    assert.equal(isInside(target, `${target}-other`), false);
  });
});
