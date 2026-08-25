import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';

import {
  currentBranch,
  defaultBranch,
  findMainWorktree,
  hasRemote,
  inWorktree,
  resolveWorktreePath,
} from '../src/repo.js';
import { probeOpenspec } from '../src/openspec.js';
import {
  addSubmodule,
  addWorktree,
  cleanupAll,
  createRepo,
  git,
  pathWithout,
  stubBin,
  tempRoot,
  withPath,
} from './helpers/repo-fixture.js';

after(cleanupAll);

describe('findMainWorktree', () => {
  it('returns the main worktree from the repository root', () => {
    const repo = createRepo();
    assert.equal(findMainWorktree(repo), repo);
  });

  it('returns the main worktree from a subdirectory', () => {
    const repo = createRepo();
    const sub = path.join(repo, 'a', 'b');
    fs.mkdirSync(sub, { recursive: true });
    assert.equal(findMainWorktree(sub), repo);
  });

  it('returns the main worktree from inside a linked worktree', () => {
    const repo = createRepo();
    const linked = addWorktree(repo, 'feat/x');
    assert.equal(findMainWorktree(linked), repo);
  });

  it('works in a repository with zero commits', () => {
    const repo = createRepo({ commit: false });
    assert.equal(findMainWorktree(repo), repo);
  });

  it('works when the repository path contains a space', () => {
    const repo = createRepo({ name: 'my repo' });
    assert.equal(findMainWorktree(repo), repo);
  });

  it('throws outside a git repository', () => {
    assert.throws(() => findMainWorktree(tempRoot()), /not a git repository/i);
  });
});

describe('resolveWorktreePath', () => {
  it('derives a sibling of the main worktree for a plain branch', () => {
    const repo = createRepo();
    assert.equal(resolveWorktreePath('plain', repo), path.join(path.dirname(repo), 'repo-plain'));
  });

  it('replaces every slash in the branch name', () => {
    const repo = createRepo();
    const dir = path.dirname(repo);
    assert.equal(resolveWorktreePath('feat/x', repo), path.join(dir, 'repo-feat-x'));
    assert.equal(resolveWorktreePath('feat/a/b', repo), path.join(dir, 'repo-feat-a-b'));
  });

  it('derives the same path from inside a linked worktree', () => {
    const repo = createRepo();
    const linked = addWorktree(repo, 'feat/x');
    assert.equal(resolveWorktreePath('feat/a/b', linked), path.join(path.dirname(repo), 'repo-feat-a-b'));
  });

  it('handles a repository path containing a space', () => {
    const repo = createRepo({ name: 'my repo' });
    assert.equal(resolveWorktreePath('feat/x', repo), path.join(path.dirname(repo), 'my repo-feat-x'));
  });

  it('works in a repository with zero commits', () => {
    const repo = createRepo({ commit: false, branch: 'ideation/pitwall' });
    assert.equal(resolveWorktreePath('feat/x', repo), path.join(path.dirname(repo), 'repo-feat-x'));
  });
});

describe('currentBranch', () => {
  it('reports the checked-out branch', () => {
    assert.equal(currentBranch(createRepo({ branch: 'main' })), 'main');
  });

  it('reports the branch of a repository with zero commits', () => {
    assert.equal(currentBranch(createRepo({ commit: false, branch: 'ideation/pitwall' })), 'ideation/pitwall');
  });

  it('returns null on a detached HEAD', () => {
    const repo = createRepo();
    git(repo, ['checkout', '--detach']);
    assert.equal(currentBranch(repo), null);
  });

  it('returns null outside a git repository', () => {
    assert.equal(currentBranch(tempRoot()), null);
  });
});

describe('hasRemote', () => {
  it('is false for a fresh repository with no origin', () => {
    assert.equal(hasRemote(createRepo()), false);
  });

  it('is true once origin exists', () => {
    assert.equal(hasRemote(createRepo({ remote: true })), true);
  });

  it('is false outside a git repository', () => {
    assert.equal(hasRemote(tempRoot()), false);
  });
});

describe('defaultBranch', () => {
  it('reads origin/HEAD when a remote publishes one', () => {
    const repo = createRepo({ branch: 'trunk', remote: true, originHead: true });
    git(repo, ['checkout', '-b', 'feat/x']);
    assert.equal(defaultBranch(repo), 'trunk');
  });

  it('falls back to the current branch when origin publishes no HEAD', () => {
    const repo = createRepo({ branch: 'main', remote: true });
    git(repo, ['checkout', '-b', 'feat/x']);
    assert.equal(defaultBranch(repo), 'feat/x');
  });

  it('falls back to the current branch when there is no remote', () => {
    assert.equal(defaultBranch(createRepo({ branch: 'trunk' })), 'trunk');
  });

  it('does not throw in a repository with zero commits', () => {
    assert.equal(defaultBranch(createRepo({ commit: false, branch: 'main' })), 'main');
  });
});

describe('inWorktree', () => {
  it('is false in the main worktree', () => {
    assert.equal(inWorktree(createRepo()), false);
  });

  it('is true inside a linked worktree', () => {
    const repo = createRepo();
    assert.equal(inWorktree(addWorktree(repo, 'feat/x')), true);
  });

  it('is true from a subdirectory of a linked worktree', () => {
    const repo = createRepo();
    const linked = addWorktree(repo, 'feat/x');
    const sub = path.join(linked, 'nested');
    fs.mkdirSync(sub, { recursive: true });
    assert.equal(inWorktree(sub), true);
  });

  it('is false inside a submodule', () => {
    const root = tempRoot();
    const parent = createRepo({ root, name: 'parent' });
    const child = createRepo({ root, name: 'child' });
    assert.equal(inWorktree(addSubmodule(parent, child)), false);
  });

  it('is false outside a git repository', () => {
    assert.equal(inWorktree(tempRoot()), false);
  });

  it('is false in a repository with zero commits', () => {
    assert.equal(inWorktree(createRepo({ commit: false })), false);
  });
});

describe('probeOpenspec', () => {
  const STUB = [
    'if [ "$1" = "--version" ]; then echo "1.9.0"; exit 0; fi',
    'if [ "$1" = "status" ]; then echo \'{"changeName":"x","isComplete":false}\'; exit 0; fi',
    'exit 1',
  ].join('\n');

  const absent = () => pathWithout('openspec');

  it('reports the CLI as available and records its version and observed fields', () => {
    const cwd = tempRoot();
    const result = withPath(`${stubBin('openspec', STUB)}:${absent()}`, () => probeOpenspec(cwd));
    assert.equal(result.available, true);
    assert.equal(result.version, '1.9.0');
    assert.deepEqual(result.fields, ['changeName', 'isComplete']);
  });

  it('reports unavailable when the CLI is absent', () => {
    const result = withPath(absent(), () => probeOpenspec(tempRoot()));
    assert.equal(result.available, false);
    assert.equal(result.version, undefined);
  });

  it('reports unavailable when the CLI exits non-zero', () => {
    const stub = stubBin('openspec', 'exit 3');
    const result = withPath(`${stub}:${absent()}`, () => probeOpenspec(tempRoot()));
    assert.equal(result.available, false);
  });

  it('records no fields when the status output is not JSON', () => {
    const stub = stubBin(
      'openspec',
      ['if [ "$1" = "--version" ]; then echo "1.9.0"; exit 0; fi', 'echo "not json"', 'exit 0'].join('\n'),
    );
    const result = withPath(`${stub}:${absent()}`, () => probeOpenspec(tempRoot()));
    assert.equal(result.available, true);
    assert.equal(result.fields, undefined);
  });

  it('never throws when the CLI hangs', () => {
    const stub = stubBin(
      'openspec',
      ['if [ "$1" = "--version" ]; then echo "1.9.0"; exit 0; fi', 'sleep 30'].join('\n'),
    );
    const result = withPath(`${stub}:${absent()}`, () => probeOpenspec(tempRoot()));
    assert.equal(result.available, true);
    assert.equal(result.fields, undefined);
  });
});
