import fs from 'node:fs';
import path from 'node:path';

import { changeStatus, openspecAvailable } from './openspec.js';

const CHANGES = path.join('openspec', 'changes');

/** Archived changes live one level deeper under this name and are never the active change. */
const ARCHIVE = 'archive';

/** A markdown task checkbox at any indent, under any of the three list bullets. */
const CHECKBOX = /^[ \t]*[-*+][ \t]+\[([ xX])\](?=[ \t]|$)/;

/** An opening or closing code fence, backtick or tilde, at any indent. */
const FENCE = /^[ \t]*(`{3,}|~{3,})/;

/**
 * Drop every fenced code block, so a checkbox shown as an example in a snippet is not counted as
 * work. An unclosed fence swallows the rest of the file, which is the conservative reading — an
 * undercount is visible as stalled progress, an overcount reads as finished work.
 *
 * @param {string} text
 * @returns {string}
 */
function stripFences(text) {
  /** @type {string[]} */
  const kept = [];
  /** @type {string|null} */
  let open = null;

  for (const line of text.split('\n')) {
    const fence = FENCE.exec(line)?.[1][0] ?? null;
    if (open === null) {
      if (fence !== null) open = fence;
      else kept.push(line);
    } else if (fence === open) {
      open = null;
    }
  }

  return kept.join('\n');
}

/**
 * @param {string} text contents of a `tasks.md`
 * @returns {{done:number,total:number}}
 */
function countTasks(text) {
  let done = 0;
  let total = 0;
  for (const line of stripFences(text).split('\n')) {
    const match = CHECKBOX.exec(line);
    if (!match) continue;
    total += 1;
    if (match[1] !== ' ') done += 1;
  }
  return { done, total };
}

/**
 * @param {string} repoRoot
 * @param {string} changeId
 * @returns {string} contents of the change's `tasks.md`, or `''` when there is none
 */
function readTasks(repoRoot, changeId) {
  try {
    return fs.readFileSync(path.join(repoRoot, CHANGES, changeId, 'tasks.md'), 'utf8');
  } catch {
    return '';
  }
}

/**
 * @param {string} repoRoot
 * @returns {string[]} active change ids that carry a tasks list, sorted by name
 */
function changeIds(repoRoot) {
  const dir = path.join(repoRoot, CHANGES);
  /** @type {import('node:fs').Dirent[]} */
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== ARCHIVE)
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(dir, name, 'tasks.md')))
    .sort();
}

/**
 * The change a repository is currently working on.
 *
 * A repository may hold several active changes and nothing in the tree says which one is live, so
 * the rule is fixed and stated rather than guessed: the first unfinished change by name, falling
 * back to the last name when every change is finished. `openspec list --json` is picked from by the
 * same rule, so the two sources agree whenever they see the same changes — but they need not see the
 * same ones: this walk requires a `tasks.md` and the CLI does not, so the CLI can name a change this
 * function returns `null` for. `resolveLeg` resolves that one-sided case in the CLI's favour.
 *
 * @param {string} repoRoot
 * @returns {string|null}
 */
export function discoverChangeId(repoRoot) {
  const ids = changeIds(repoRoot);
  if (ids.length === 0) return null;
  for (const id of ids) {
    const { done, total } = countTasks(readTasks(repoRoot, id));
    if (total === 0 || done < total) return id;
  }
  return ids[ids.length - 1];
}

/**
 * `n of N` for the execute beat, from the CLI when it answers and from the tasks list when it does
 * not. Both paths return the same shape so the baton renderer never branches on which one ran.
 *
 * `total: 0` is reported literally. A change with no tasks is a specs-beat problem, and calling
 * `0 of 0` complete would hide it.
 *
 * @param {string} repoRoot
 * @param {string|null} [changeId] `null` means "already looked, there is none"; omit it to have
 *   {@link discoverChangeId} pick one, so a caller that has resolved an id never pays for a second
 *   walk of `openspec/changes/`
 * @returns {{done:number,total:number,source:'openspec'|'tasks-md',changeId:string|null}}
 */
export function executeProgress(repoRoot, changeId) {
  const id = changeId === undefined ? discoverChangeId(repoRoot) : changeId;

  if (openspecAvailable(repoRoot)) {
    const status = changeStatus(repoRoot, id ?? undefined);
    if (status) {
      return { done: status.done, total: status.total, source: 'openspec', changeId: status.changeId };
    }
  }

  const counts = id === null ? { done: 0, total: 0 } : countTasks(readTasks(repoRoot, id));
  return { ...counts, source: 'tasks-md', changeId: id };
}
