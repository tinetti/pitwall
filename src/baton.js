import { BEATS } from './beats.js';

/**
 * What the `handoff` key means for the operator. An unrecognised value is rendered verbatim rather
 * than dropped, so a provider can ask for something Pitwall never anticipated and still be obeyed.
 */
const HANDOVER_LINES = {
  transfer: '/clear, then run:',
  through: 'run:',
};

/** Used when a manifest declares no `handoff` at all — the command still needs introducing. */
const DEFAULT_HANDOVER = 'run:';

/**
 * The repository fact a manifest's `argument` names. Every value returns `null` when the repository
 * cannot supply it, and a null argument is omitted rather than interpolated empty — a command with
 * a blank argument is one the next session cannot run.
 *
 * A Map rather than an object literal, for the same reason `src/cli.js` uses one for subcommands: a
 * manifest whose `argument` reads `constructor` would find a function on a plain object's prototype
 * and be called with the inference state. `loadBookings` rejects that key today, so this is depth
 * rather than a live bug — but the renderer is also reachable with hand-built providers from tests
 * and from `pw start`, and a lookup table should not depend on its only caller validating for it.
 */
const ARGUMENT_SOURCES = new Map([
  ['change-id', (state) => state.changeId],
  ['branch', (state) => state.branch],
  ['none', () => null],
]);

/**
 * What a manifest gets when it names no `argument`. It is the change id because that is what every
 * spec-driven command takes; the key exists for the targets that take something else — the cleanup
 * beat finishes a *branch* — and for the ones that take nothing at all.
 */
const DEFAULT_ARGUMENT = 'change-id';

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
      `${INDENT}└ add one under bookings/ to give this beat a baton`,
    ];
  }

  // The argument is dropped whenever the repository cannot supply it — `changeId` is null until a
  // change exists on disk, and the whole point of the specs beat is that it does not yet. Omitting
  // it is the only honest option: an empty one would hand the next session a command it cannot run.
  const source =
    ARGUMENT_SOURCES.get(provider.argument ?? DEFAULT_ARGUMENT) ??
    ARGUMENT_SOURCES.get(DEFAULT_ARGUMENT);
  const argument = source(state);
  const command = argument ? `${provider.command} ${argument}` : provider.command;

  // Only what the manifest declares. A default effort would be a choice nobody made, attributed to
  // a manifest that never made it.
  const detail = provider.effort ? `${provider.model} · ${provider.effort} effort` : provider.model;

  return [
    'NEXT:',
    `${INDENT}${HANDOVER_LINES[provider.handover] ?? provider.handover ?? DEFAULT_HANDOVER}`,
    `${INDENT}${command}`,
    `${INDENT}└ ${detail}`,
    ...batonText(provider.body),
  ];
}

/**
 * Everything both surfaces say about the repository, appended to whatever `sections` they lead
 * with. The preflight and the warnings are facts about where the change stands, not about the
 * handoff, so `pw status` reports them exactly as `pw next` does.
 *
 * @param {string[]} sections
 * @param {import('./inference.js').Inference} state
 * @param {import('./preflight.js').Preflight} preflight
 * @returns {string} ends with exactly one newline
 */
function withFindings(sections, state, preflight) {
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

/**
 * The whole product in one string: where this repository stands, and what the next session runs.
 *
 * Pure by design — no filesystem, no subprocess, no clock. `pw start` prints this same block after
 * creating a worktree, and a renderer that went looking for its own inputs could not be reused
 * there.
 *
 * @param {import('./inference.js').Inference} state
 * @param {import('./preflight.js').Preflight} [preflight]
 * @returns {string} ends with exactly one newline
 */
export function renderBaton(state, preflight = { ignored: [], warnings: [] }) {
  const position = [header(state), ...strip(state)].join('\n');
  return withFindings([position, nextBlock(state).join('\n')], state, preflight);
}

/**
 * Position without a baton, for `pw status`.
 *
 * The NEXT block is the one thing left out, and leaving it out is the point: re-issuing an
 * instruction to an operator who has already acted on it invites it to be run twice. Sharing
 * {@link withFindings} with {@link renderBaton} is what keeps the two surfaces from disagreeing
 * about where the same repository stands.
 *
 * @param {import('./inference.js').Inference} state
 * @param {import('./preflight.js').Preflight} [preflight]
 * @returns {string} ends with exactly one newline
 */
export function renderPosition(state, preflight = { ignored: [], warnings: [] }) {
  const position = [header(state), ...strip(state)].join('\n');
  return withFindings([position], state, preflight);
}
