import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { parseManifest } from './frontmatter.js';

/**
 * @typedef {{stage:string,command:string,model:string,effort?:string,handoff?:string,
 *            doneWhenPathExists?:string,doneWhenCmd?:string,body:string,path:string}} Provider
 */

const REQUIRED = ['stage', 'command', 'model'];
const OPTIONAL = ['effort', 'handoff', 'doneWhenPathExists', 'doneWhenCmd'];

/** Milliseconds a `doneWhenCmd` detector is allowed before it is killed. */
const DETECTOR_TIMEOUT_MS = 10000;

/**
 * Load, validate, and index the provider manifests in `dir`.
 *
 * @param {string} dir directory holding `*.md` manifests
 * @param {{ knownStages?: Iterable<string> }} [options] when `knownStages` is given, a manifest
 *   binding any other stage is rejected; the beat model that owns that list lives in a later layer.
 * @returns {Map<string, Provider>} keyed by stage
 * @throws {Error} on a malformed manifest, a missing detector, or two manifests claiming one stage
 */
export function loadProviders(dir, options = {}) {
  const known = options.knownStages ? new Set(options.knownStages) : null;

  /** @type {string[]} */
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return new Map();
  }

  /** @type {Map<string, Provider>} */
  const providers = new Map();
  for (const entry of entries.filter((name) => name.endsWith('.md')).sort()) {
    const file = path.join(dir, entry);
    const { meta, body } = parseManifest(fs.readFileSync(file, 'utf8'), file);

    for (const key of REQUIRED) {
      if (!meta[key]) throw new Error(`${file}: missing required key \`${key}\``);
    }
    if (!meta.doneWhenPathExists && !meta.doneWhenCmd) {
      throw new Error(
        `${file}: manifest must define \`doneWhenPathExists\` or \`doneWhenCmd\`; ` +
          'a stage with no detector can never be marked done',
      );
    }
    if (known && !known.has(meta.stage)) {
      throw new Error(`${file}: unknown stage \`${meta.stage}\``);
    }

    const existing = providers.get(meta.stage);
    if (existing) {
      throw new Error(`duplicate stage \`${meta.stage}\`: ${existing.path} and ${file}`);
    }

    /** @type {Provider} */
    const provider = { stage: meta.stage, command: meta.command, model: meta.model, body, path: file };
    for (const key of OPTIONAL) {
      if (meta[key] !== undefined) provider[key] = meta[key];
    }
    providers.set(provider.stage, provider);
  }

  return providers;
}

/**
 * @param {string} segment
 * @returns {RegExp}
 */
function segmentToRegExp(segment) {
  const source = segment
    .split('')
    .map((char) => {
      if (char === '*') return '[^/]*';
      if (char === '?') return '[^/]';
      return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${source}$`);
}

/**
 * @param {string} dir
 * @returns {import('node:fs').Dirent[]}
 */
function readdirSafe(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * @param {string} dir
 * @param {string[]} segments
 * @returns {boolean}
 */
function walk(dir, segments) {
  if (segments.length === 0) return fs.existsSync(dir);
  const [head, ...rest] = segments;

  if (head === '**') {
    if (walk(dir, rest)) return true;
    return readdirSafe(dir).some(
      (entry) => entry.isDirectory() && walk(path.join(dir, entry.name), segments),
    );
  }
  if (!head.includes('*') && !head.includes('?')) return walk(path.join(dir, head), rest);

  const pattern = segmentToRegExp(head);
  return readdirSafe(dir).some(
    (entry) => pattern.test(entry.name) && walk(path.join(dir, entry.name), rest),
  );
}

/**
 * `doneWhenPathExists`: a glob resolved relative to the repository root. Supports `*` and `?`
 * within a segment and `**` across segments — deliberately not a full glob dialect.
 *
 * @param {string} pattern
 * @param {string} repoRoot
 * @returns {boolean}
 */
export function detectPathExists(pattern, repoRoot) {
  const segments = pattern.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.length === 0) return false;
  return walk(repoRoot, segments);
}

/**
 * `doneWhenCmd`: judged by exit code only; stdout is ignored. A missing binary (exit 127) is
 * simply not-done — a detector never throws, because one broken manifest must not stop inference.
 *
 * @param {string} command
 * @param {string} cwd
 * @returns {boolean}
 */
export function detectCmd(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: 'ignore',
    timeout: DETECTOR_TIMEOUT_MS,
    windowsHide: true,
  });
  return !result.error && result.status === 0;
}

/**
 * Evaluate a provider's detectors. Both must pass when both are present — there are no boolean
 * combinators and no expression language by design.
 *
 * @param {Pick<Provider,'doneWhenPathExists'|'doneWhenCmd'>} provider
 * @param {string} repoRoot
 * @returns {boolean}
 */
export function providerIsDone(provider, repoRoot) {
  const checks = [];
  if (provider.doneWhenPathExists) checks.push(() => detectPathExists(provider.doneWhenPathExists, repoRoot));
  if (provider.doneWhenCmd) checks.push(() => detectCmd(provider.doneWhenCmd, repoRoot));
  if (checks.length === 0) return false;
  return checks.every((check) => check());
}
