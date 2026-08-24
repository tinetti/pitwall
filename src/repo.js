import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Run git and return its trimmed stdout, or `null` when git fails for any reason.
 * Queries never throw: a fresh `git init` with no commits and a directory outside any repository
 * are both expected states for a tool that inspects whatever repo it is pointed at.
 *
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string|null}
 */
function tryGit(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

/**
 * Absolute path to the main worktree — the sibling anchor every derived path hangs off.
 *
 * Ported from `git-main-worktree` (tinetti_dev_tools/files/zsh/git.zsh:115-117), but the literal
 * `worktree ` prefix is sliced rather than split on whitespace so paths containing spaces survive.
 *
 * @param {string} cwd
 * @returns {string} absolute path
 * @throws {Error} when `cwd` is not inside a git repository
 */
export function findMainWorktree(cwd) {
  const listing = tryGit(cwd, ['worktree', 'list', '--porcelain']);
  const first = listing?.split('\n').find((line) => line.startsWith('worktree '));
  if (!first) throw new Error(`not a git repository: ${cwd}`);
  return first.slice('worktree '.length);
}

/**
 * Where a branch's worktree lives: a sibling of the main worktree, suffixed with the branch name
 * and every `/` flattened to `-`. Ports the `gwt` convention (git.zsh:267-288).
 *
 * @param {string} branch
 * @param {string} cwd
 * @returns {string} absolute path
 */
export function resolveWorktreePath(branch, cwd) {
  const main = findMainWorktree(cwd);
  return path.join(path.dirname(main), `${path.basename(main)}-${branch.replace(/\//g, '-')}`);
}

/**
 * The checked-out branch, or `null` on a detached HEAD or outside a repository.
 *
 * `git symbolic-ref` is used rather than `rev-parse --abbrev-ref HEAD`, which exits 128 in a
 * repository with zero commits.
 *
 * @param {string} cwd
 * @returns {string|null}
 */
export function currentBranch(cwd) {
  return tryGit(cwd, ['symbolic-ref', '--short', 'HEAD']);
}

/**
 * True when the repository has an `origin` remote.
 *
 * @param {string} cwd
 * @returns {boolean}
 */
export function hasRemote(cwd) {
  return tryGit(cwd, ['remote', 'get-url', 'origin']) !== null;
}

/**
 * The branch new work forks from: `origin/HEAD` when the remote publishes one, otherwise the
 * current branch. Never fetches — fetching is a side effect belonging to the worktree command,
 * not to a query inference calls repeatedly.
 *
 * @param {string} cwd
 * @returns {string|null}
 */
export function defaultBranch(cwd) {
  const head = tryGit(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (head) return head.replace(/^origin\//, '');
  return currentBranch(cwd);
}

/**
 * True when `cwd` sits in a linked worktree rather than the main one.
 *
 * A submodule also has a git-dir distinct from its superproject's, so the superproject check comes
 * first — otherwise a submodule would anchor worktree paths to the wrong repository.
 *
 * @param {string} cwd
 * @returns {boolean}
 */
export function inWorktree(cwd) {
  const superproject = tryGit(cwd, ['rev-parse', '--show-superproject-working-tree']);
  if (superproject === null || superproject !== '') return false;

  const dirs = tryGit(cwd, ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir']);
  if (dirs === null) return false;
  const [gitDir, commonDir] = dirs.split('\n');
  return Boolean(gitDir) && Boolean(commonDir) && gitDir !== commonDir;
}
