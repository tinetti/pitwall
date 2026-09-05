import { spawnSync } from 'node:child_process';

/**
 * @typedef {{ignored:string[], warnings:string[]}} Inspection
 *   `warnings` is additive to the shape the spec names: `git check-ignore` has three outcomes, not
 *   two, and folding "git refused to answer" into "nothing is ignored" would make this check
 *   silently useless in exactly the repositories worth checking.
 */

/** Milliseconds `git check-ignore` is allowed before it is killed. */
const CHECK_TIMEOUT_MS = 2000;

/**
 * Where Waybill itself writes, independent of any booking. These are queried with a trailing slash
 * for the same reason every derived path is — see {@link checkIgnored}.
 */
const WRAPPER_PATHS = ['docs/ideation/', 'openspec/'];

/** A final segment carrying an extension — the only shape that reads as a file rather than a dir. */
const LOOKS_LIKE_FILE = /[^/.]\.[^/.]+$/;

/**
 * The literal directory prefix of a `stampPath` glob, or the pattern itself when it holds
 * no glob at all. Asking git about `docs/ideation/*` is meaningless: check-ignore does not expand
 * the pattern, it matches the literal string and echoes it back, so a hit would name a path that
 * does not exist.
 *
 * @param {string} pattern
 * @returns {string|null} the query to send git, or `null` when nothing literal survives
 */
function deglob(pattern) {
  const segments = pattern.split('/').filter((segment) => segment !== '' && segment !== '.');
  const literal = [];
  for (const segment of segments) {
    if (segment.includes('*') || segment.includes('?')) break;
    literal.push(segment);
  }
  if (literal.length === 0) return null;

  // git treats a trailing slash as "this is a directory", and a directory-only rule (`/openspec/`)
  // matches a *nonexistent* path only when the query carries one — which is every path this
  // inspection asks about. A truncated pattern is a directory by construction; an untruncated one
  // is a directory too unless its last segment carries an extension, and adding the slash to a file
  // query would stop a file rule matching. `Makefile`-shaped papers are the known blind spot,
  // and a missed report is the safe side of that trade.
  const query = literal.join('/');
  const truncated = literal.length < segments.length;
  return truncated || !LOOKS_LIKE_FILE.test(literal[literal.length - 1]) ? `${query}/` : query;
}

/**
 * Drop any path an ancestor already covers. `openspec/` and `openspec/changes/` both match a
 * `/openspec/` rule, and reporting one rule twice trains the operator to skim the block.
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
function collapse(paths) {
  const sorted = [...new Set(paths)].sort();
  return sorted.filter(
    (candidate) =>
      !sorted.some((other) => other !== candidate && other.endsWith('/') && candidate.startsWith(other)),
  );
}

/**
 * Every location the workflow will write, derived from the bookings rather than from a list in
 * code — a swapped carrier brings its own paper directory with it.
 *
 * @param {Map<string, Pick<import('./bookings.js').Booking,'stampPath'>>} bookings
 * @returns {string[]} repo-relative queries, ready for {@link checkIgnored}
 */
export function paperPaths(bookings) {
  const paths = [...WRAPPER_PATHS];
  for (const booking of bookings.values()) {
    if (!booking.stampPath) continue;
    const query = deglob(booking.stampPath);
    if (query !== null) paths.push(query);
  }
  return collapse(paths);
}

/**
 * Ask git which of `paths` this repository ignores, in one process.
 *
 * Three outcomes, and conflating any two of them is the bug this function exists to avoid: exit 0
 * means at least one path matched, exit 1 means none did and is the ordinary success case, and exit
 * 128 means git refused — a path outside the repository, or no repository at all.
 *
 * `cwd` must be the repository root: check-ignore resolves its arguments against the process
 * directory, so the same query run from a subdirectory silently matches nothing.
 *
 * Nothing here throws. The inspection is advice printed beside a waybill, and a wrapper that crashes
 * because it could not offer advice is worse than one that says it could not.
 *
 * @param {string} cwd repository root
 * @param {string[]} paths repo-relative; directories must carry a trailing slash, or a
 *   directory-only `.gitignore` rule will not match a directory that does not exist yet
 * @returns {Inspection}
 */
export function checkIgnored(cwd, paths) {
  const queries = paths.filter((query) => query !== '');
  if (queries.length === 0) return { ignored: [], warnings: [] };

  const result = spawnSync('git', ['check-ignore', '--stdin', '-z'], {
    cwd,
    encoding: 'utf8',
    input: `${queries.join('\0')}\0`,
    timeout: CHECK_TIMEOUT_MS,
    windowsHide: true,
  });

  if (!result.error && result.status === 0) {
    return { ignored: result.stdout.split('\0').filter(Boolean), warnings: [] };
  }
  if (!result.error && result.status === 1) return { ignored: [], warnings: [] };

  const detail = (result.error?.message ?? result.stderr ?? '').trim().split('\n')[0];
  return {
    ignored: [],
    warnings: [`git check-ignore could not answer for ${cwd}${detail ? `: ${detail}` : ''}`],
  };
}
