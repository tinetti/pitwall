import { BEATS } from './beats.js';

/**
 * What the `handoff` key means for the operator. An unrecognised value is rendered verbatim rather
 * than dropped, so a provider can ask for something Pitwall never anticipated and still be obeyed.
 */
const HANDOFF_LINES = {
  clear: '/clear, then run:',
  session: 'in a new session, run:',
  inline: 'run:',
};

/** Used when a manifest declares no `handoff` at all — the command still needs introducing. */
const DEFAULT_HANDOFF = 'run:';

const INDENT = '  ';

/**
 * @param {import('./inference.js').Inference} state
 * @returns {string}
 */
function header(state) {
  const position =
    state.beat === null
      ? `all ${BEATS.length} beats complete`
      : `beat ${state.index} of ${BEATS.length} (${state.beat})`;
  return state.branch ? `${state.branch} · ${position}` : position;
}

/**
 * The beat strip: a positional walk of {@link BEATS}, not a replay of `completed`. Work done out of
 * order leaves completed beats *after* the current one, and concatenating the two lists would print
 * them in an order the repository never went through.
 *
 * @param {import('./inference.js').Inference} state
 * @returns {string[]}
 */
function strip(state) {
  const completed = new Set(state.completed);
  const skipped = new Set(state.skipped);
  const lines = [];

  const ticks = BEATS.filter((beat) => completed.has(beat.id)).map((beat) => `✓ ${beat.id}`);
  if (ticks.length > 0) lines.push(`${INDENT}${ticks.join('  ')}`);

  if (state.beat !== null) {
    const progress = state.progress
      ? ` (${state.progress.done} of ${state.progress.total} tasks)`
      : '';
    lines.push(`${INDENT}▶ ${state.beat}${progress}`);
  }

  for (const beat of BEATS) {
    if (skipped.has(beat.id)) lines.push(`${INDENT}⚠ ${beat.id} (skipped)`);
  }
  return lines;
}

/**
 * Indent the manifest body without leaving trailing whitespace on its blank lines — golden files
 * make every space load-bearing.
 *
 * @param {string} body
 * @returns {string[]}
 */
function batonText(body) {
  const trimmed = body.trim();
  if (trimmed === '') return [];
  return ['', ...trimmed.split('\n').map((line) => (line === '' ? '' : `${INDENT}${line}`))];
}

/**
 * @param {import('./inference.js').Inference} state
 * @returns {string[]}
 */
function nextBlock(state) {
  if (state.beat === null) {
    return ['NEXT:', `${INDENT}nothing to hand off — every beat is complete`];
  }

  const provider = state.provider;
  if (!provider) {
    return [
      'NEXT:',
      `${INDENT}no provider manifest is bound to the ${state.beat} beat`,
      `${INDENT}└ add one under providers/ to give this beat a baton`,
    ];
  }

  // `changeId` is null until a change exists on disk, and the whole point of the specs beat is that
  // it does not yet. Omitting the argument is the only honest option: interpolating an empty one
  // would hand the next session a command it cannot run.
  const command = state.changeId ? `${provider.command} ${state.changeId}` : provider.command;

  // Only what the manifest declares. A default effort would be a choice nobody made, attributed to
  // a manifest that never made it.
  const detail = provider.effort ? `${provider.model} · ${provider.effort} effort` : provider.model;

  return [
    'NEXT:',
    `${INDENT}${HANDOFF_LINES[provider.handoff] ?? provider.handoff ?? DEFAULT_HANDOFF}`,
    `${INDENT}${command}`,
    `${INDENT}└ ${detail}`,
    ...batonText(provider.body),
  ];
}

/**
 * The whole product in one string: where this repository stands, and what the next session runs.
 *
 * Pure by design — no filesystem, no subprocess, no clock. Phases 4 and 5 print the same block from
 * `pw start` and `pw status`, and a renderer that went looking for its own inputs could not be
 * reused by either.
 *
 * @param {import('./inference.js').Inference} state
 * @param {import('./preflight.js').Preflight} [preflight]
 * @returns {string} ends with exactly one newline
 */
export function renderBaton(state, preflight = { ignored: [], warnings: [] }) {
  const sections = [[header(state), ...strip(state)].join('\n'), nextBlock(state).join('\n')];

  if (preflight.ignored.length > 0) {
    sections.push(
      [
        'IGNORED BY GIT:',
        ...preflight.ignored.map(
          (query) => `${INDENT}⚠ ${query} — artifacts written here will never be committed`,
        ),
      ].join('\n'),
    );
  }

  // Last, and never suppressed: a beat that silently repeats forever is the worst failure this tool
  // has, and the warning naming the manifest is the only thing that explains it.
  const warnings = [...state.warnings, ...(preflight.warnings ?? [])];
  if (warnings.length > 0) {
    sections.push(['WARNINGS:', ...warnings.map((text) => `${INDENT}⚠ ${text}`)].join('\n'));
  }

  return `${sections.join('\n\n')}\n`;
}
