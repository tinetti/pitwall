/**
 * Deliberately capped frontmatter parser.
 *
 * Accepts exactly flat `key: value` scalar lines between `---` fences and throws on anything
 * else — lists, nested indents, block scalars, duplicate keys. Throwing is the feature: it keeps
 * a general YAML dialect from accreting one manifest at a time.
 */

const FENCE = '---';
const KEY = /^([A-Za-z_][A-Za-z0-9_-]*):([\s\S]*)$/;
const BLOCK_SCALAR = /^[|>][-+]?\d*$/;

/**
 * @param {string} label
 * @param {number} line 1-based line number within the source
 * @param {string} message
 * @returns {Error}
 */
function fail(label, line, message) {
  return new Error(`${label}:${line}: ${message}`);
}

/**
 * @param {string} value
 * @returns {string}
 */
function stripWrappingQuotes(value) {
  if (value.length < 2) return value;
  const first = value[0];
  if ((first === '"' || first === "'") && value[value.length - 1] === first) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Split a manifest into its frontmatter map and its verbatim body.
 *
 * @param {string} source
 * @param {string} [path] source label used in error messages
 * @returns {{ meta: Record<string,string>, body: string }}
 * @throws {Error} on list, nested, or block scalar syntax, a duplicate key, or a missing fence
 */
export function parseManifest(source, path) {
  const label = path ?? '<manifest>';
  const text = source.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  if (lines[0]?.trimEnd() !== FENCE) {
    return { meta: {}, body: source };
  }

  let close = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trimEnd() === FENCE) {
      close = i;
      break;
    }
  }
  if (close === -1) {
    throw fail(label, 1, 'frontmatter is missing its closing `---` fence');
  }

  /** @type {Record<string,string>} */
  const meta = {};
  for (let i = 1; i < close; i += 1) {
    const raw = lines[i];
    const lineNo = i + 1;
    if (raw.trim() === '') continue;

    if (/^\s/.test(raw)) {
      throw fail(label, lineNo, 'indented (nested) frontmatter is not supported; only flat `key: value` lines');
    }
    if (raw.trimStart().startsWith('- ') || raw.trim() === '-') {
      throw fail(label, lineNo, 'list items are not supported in frontmatter; only flat `key: value` lines');
    }

    const match = KEY.exec(raw);
    if (!match) {
      throw fail(label, lineNo, `expected a flat \`key: value\` line, got: ${raw.trim()}`);
    }

    const key = match[1];
    const value = match[2].trim();
    if (BLOCK_SCALAR.test(value)) {
      throw fail(label, lineNo, 'block scalars (`|`, `>`) are not supported in frontmatter');
    }
    if (Object.prototype.hasOwnProperty.call(meta, key)) {
      throw fail(label, lineNo, `duplicate key \`${key}\``);
    }
    meta[key] = stripWrappingQuotes(value);
  }

  return { meta, body: lines.slice(close + 1).join('\n') };
}
