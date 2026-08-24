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
 * Run a `doneWhenCmd`, separating "it ran and said no" from "it could not run at all". Only the
 * second is worth reporting: a detector that answers `false` forever with no explanation is the
 * hard-stall failure mode.
 *
 * @param {string} command
 * @param {string} cwd
 * @returns {{ran:boolean, notFound:boolean, status:number|null}}
 */
function runDetector(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: 'ignore',
    timeout: DETECTOR_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status === null) return { ran: false, notFound: false, status: null };
  if (result.status === 127) return { ran: false, notFound: true, status: 127 };
  return { ran: true, notFound: false, status: result.status };
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
  const result = runDetector(command, cwd);
  return result.ran && result.status === 0;
}

/**
 * Evaluate a provider's detectors. Both must pass when both are present — there are no boolean
 * combinators and no expression language by design.
 *
 * The rule lives once, in {@link evaluateProvider}; this is the verdict without the warnings, for
 * callers that have nothing to report them to. Two copies of "both must pass, path first" would
 * drift.
 *
 * @param {Pick<Provider,'doneWhenPathExists'|'doneWhenCmd'>} provider
 * @param {string} repoRoot
 * @returns {boolean}
 */
export function providerIsDone(provider, repoRoot) {
  return evaluateProvider(provider, repoRoot).done;
}

/**
 * The provider's verdict, plus the warnings a caller needs to explain a beat that never completes.
 * A detector that cannot be executed at all — missing binary, spawn failure, timeout — is still
 * not-done, but silently so it would look identical to honest work remaining.
 *
 * @param {Provider} provider
 * @param {string} repoRoot
 * @returns {{done:boolean, warnings:string[]}}
 */
export function evaluateProvider(provider, repoRoot) {
  /** @type {string[]} */
  const warnings = [];
  const label = provider.path ?? `<${provider.stage}>`;
  let checked = false;
  let done = true;

  if (provider.doneWhenPathExists) {
    checked = true;
    try {
      done = detectPathExists(provider.doneWhenPathExists, repoRoot);
    } catch (error) {
      warnings.push(`${label}: doneWhenPathExists failed: ${error.message}`);
      done = false;
    }
  }

  if (done && provider.doneWhenCmd) {
    checked = true;
    const result = runDetector(provider.doneWhenCmd, repoRoot);
    if (!result.ran) {
      const reason = result.notFound ? 'command not found' : 'could not be executed';
      warnings.push(`${label}: doneWhenCmd ${reason}: ${provider.doneWhenCmd}`);
      done = false;
    } else {
      done = result.status === 0;
    }
  }

  return { done: checked && done, warnings };
}
