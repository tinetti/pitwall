import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** Temp roots created by this module, removed by {@link cleanupAll}. @type {string[]} */
const roots = [];

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'Waybill Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@waybill.test',
  GIT_COMMITTER_NAME: 'Waybill Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@waybill.test',
};

/**
 * Run git in `cwd`, throwing on a non-zero exit so a broken fixture fails loudly.
 *
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string} trimmed stdout
 */
export function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

/**
 * A fresh temp directory whose path is fully resolved (macOS `/var` → `/private/var`), so path
 * assertions are not defeated by the tmpdir symlink.
 *
 * @returns {string}
 */
export function tempRoot() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'waybill-')));
  roots.push(root);
  return root;
}

/**
 * @typedef {{ name?: string, branch?: string, commit?: boolean, remote?: boolean,
 *             originHead?: boolean, root?: string }} RepoOptions
 */

/**
 * Build a throwaway git repository.
 *
 * @param {RepoOptions} [options]
 * @returns {string} absolute path to the repository working tree
 */
export function createRepo(options = {}) {
  const { name = 'repo', branch = 'main', commit = true, remote = false, originHead = false } = options;
  const root = options.root ?? tempRoot();
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-b', branch]);

  if (commit) {
    fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
    git(dir, ['add', 'README.md']);
    git(dir, ['commit', '-m', 'initial']);
  }

  if (remote) {
    const bare = path.join(root, `${name}-origin.git`);
    git(root, ['init', '--bare', '-b', branch, bare]);
    git(dir, ['remote', 'add', 'origin', bare]);
    if (commit) {
      git(dir, ['push', '-u', 'origin', branch]);
      if (originHead) git(dir, ['symbolic-ref', 'refs/remotes/origin/HEAD', `refs/remotes/origin/${branch}`]);
    }
  }

  return dir;
}

/**
 * Add a linked worktree as a sibling of `repoDir`, named the way `gwt` names it.
 *
 * @param {string} repoDir main checkout
 * @param {string} branch new branch to check out there
 * @returns {string} absolute path to the linked worktree
 */
export function addWorktree(repoDir, branch) {
  const target = path.join(path.dirname(repoDir), `${path.basename(repoDir)}-${branch.replace(/\//g, '-')}`);
  git(repoDir, ['worktree', 'add', '--no-track', '-b', branch, target]);
  return target;
}

/**
 * Add `childDir` as a submodule of `parentDir`.
 *
 * @param {string} parentDir
 * @param {string} childDir
 * @param {string} [at] path within the parent
 * @returns {string} absolute path to the submodule working tree
 */
export function addSubmodule(parentDir, childDir, at = 'sub') {
  git(parentDir, ['-c', 'protocol.file.allow=always', 'submodule', 'add', childDir, at]);
  git(parentDir, ['commit', '-m', 'add submodule']);
  return path.join(parentDir, at);
}

/**
 * Write an executable stub into a fresh directory suitable for prepending to `PATH`.
 *
 * @param {string} name binary name
 * @param {string} script shell script body (a `#!/bin/sh` shebang is added)
 * @returns {string} the directory containing the stub
 */
export function stubBin(name, script) {
  const dir = path.join(tempRoot(), 'bin');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, `#!/bin/sh\n${script}\n`);
  fs.chmodSync(file, 0o755);
  return dir;
}

/**
 * Run `fn` with `process.env.PATH` replaced, restoring it afterwards.
 *
 * @template T
 * @param {string} value
 * @param {() => T} fn
 * @returns {T}
 */
export function withPath(value, fn) {
  const previous = process.env.PATH;
  process.env.PATH = value;
  try {
    return fn();
  } finally {
    process.env.PATH = previous;
  }
}

/**
 * A copy of the current `PATH` with every directory containing `name` removed, so a real binary
 * installed on the developer's machine cannot turn an absent-CLI test into a false positive.
 *
 * @param {string} name
 * @returns {string}
 */
export function pathWithout(name) {
  return (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter((entry) => entry !== '' && !fs.existsSync(path.join(entry, name)))
    .join(path.delimiter);
}

/**
 * Write a file, creating parent directories as needed.
 *
 * @param {string} file
 * @param {string} contents
 * @returns {string} the file path
 */
export function writeFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  return file;
}

/** Remove every temp root this module created. */
export function cleanupAll() {
  while (roots.length > 0) {
    const root = roots.pop();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
