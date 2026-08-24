import { spawnSync } from 'node:child_process';

/** Milliseconds any openspec invocation is allowed before it is killed. */
const TIMEOUT_MS = 2000;

/**
 * @param {string} cwd
 * @param {string[]} args
 * @returns {{ ok: boolean, stdout: string }}
 */
function run(cwd, args) {
  const result = spawnSync('openspec', args, {
    cwd,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return { ok: false, stdout: '' };
  return { ok: true, stdout: result.stdout ?? '' };
}

/**
 * Capability probe for the `openspec` CLI.
 *
 * Availability is judged by `openspec --version`, which succeeds unconditionally when the CLI is
 * installed; `openspec status --json` is not a availability test because it demands a change id.
 * The observed top-level JSON field names are recorded rather than assumed, so a later phase reads
 * a shape this phase actually saw.
 *
 * Never throws — an absent CLI is an expected state, and callers fall back to parsing `tasks.md`.
 *
 * @param {string} cwd
 * @returns {{available:boolean, version?:string, fields?:string[]}}
 */
export function probeOpenspec(cwd) {
  const version = run(cwd, ['--version']);
  if (!version.ok) return { available: false };

  /** @type {{available:boolean, version?:string, fields?:string[]}} */
  const probe = { available: true, version: version.stdout.trim() || undefined };

  const status = run(cwd, ['status', '--json']);
  if (status.ok) {
    try {
      const parsed = JSON.parse(status.stdout);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        probe.fields = Object.keys(parsed).sort();
      }
    } catch {
      // Non-JSON output records no fields; the CLI is still available.
    }
  }

  return probe;
}
