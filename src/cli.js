import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BEATS } from './beats.js';
import { renderBaton, renderPosition } from './baton.js';
import { BUILTIN_PROVIDERS, resolveBeat } from './inference.js';
import { artifactPaths, checkIgnored } from './preflight.js';
import { loadProviders } from './providers.js';
import { superprojectRoot, worktreeRoot } from './repo.js';
import { WorktreeError, isInside, startWorktree } from './worktree.js';

const USAGE = [
  'Usage: pw <command> [options]',
  '',
  'Commands:',
  '  next            Where this change stands, and the baton for the next session',
  '  start <branch>  Create the branch and its worktree, then hand off the next beat',
  '  status          Where this change stands, without the baton',
  '',
  'Options:',
  '  --json  Print the raw inference result instead of the baton (`next` only)',
  '  --help  Print this message',
].join('\n');

/**
 * Options `next` accepts. Anything else is rejected rather than ignored: `--jsonn` silently
 * printing the human baton would be misparsed by the very script `--json` exists for.
 */
const NEXT_FLAGS = new Set(['--json']);

/** Every line the CLI writes below a heading is indented by this, matching the baton. */
const INDENT = '  ';

/**
 * The repository every subcommand answers for, or `null` once the operator has been told there is
 * none.
 *
 * `resolveBeat` deliberately never throws outside a repository — it returns a plausible-looking
 * `ideate` beat plus a warning — so the no-git case has to be caught before it, not around it. The
 * submodule redirect is applied first so the preflight, the inference, and any worktree created
 * here all answer for one repository.
 *
 * @param {string} cwd
 * @param {{err:(text:string)=>void}} io
 * @returns {string|null} absolute path to the working tree root
 */
function repoRoot(cwd, io) {
  const root = worktreeRoot(superprojectRoot(cwd) ?? cwd);
  if (root === null) {
    io.err(`pitwall: ${cwd} is not inside a git repository — run pw from a repository checkout\n`);
    return null;
  }
  return root;
}

/**
 * `pw next` — resolve the beat, check the artifact paths, print one baton.
 *
 * Exit 0 whenever a beat resolved, preflight findings included: the preflight is advice and the
 * baton is the product. Exit 2 is reserved for "there is nothing here to answer about".
 *
 * @param {string} cwd
 * @param {string[]} args
 * @param {{out:(text:string)=>void, err:(text:string)=>void}} io
 * @returns {number} exit code
 */
function next(cwd, args, io) {
  const unknown = args.find((arg) => !NEXT_FLAGS.has(arg));
  if (unknown !== undefined) {
    io.err(`pitwall: unknown option \`${unknown}\` for \`next\`\n${USAGE}\n`);
    return 2;
  }

  const root = repoRoot(cwd, io);
  if (root === null) return 2;

  const providers = loadProviders(BUILTIN_PROVIDERS, { knownStages: BEATS.map((beat) => beat.id) });
  const state = resolveBeat(cwd, providers);

  if (args.includes('--json')) {
    io.out(`${JSON.stringify(state, null, 2)}\n`);
    return 0;
  }

  io.out(renderBaton(state, checkIgnored(root, artifactPaths(providers))));
  return 0;
}

/**
 * `pw status` — the same position `next` reports, with the handoff left out.
 *
 * Deliberately takes no options at all, `--json` included. `next --json` already prints the whole
 * inference, and a second machine-readable surface would be a second thing to keep in step with a
 * shape that has no reason to differ.
 *
 * @param {string} cwd
 * @param {string[]} args
 * @param {{out:(text:string)=>void, err:(text:string)=>void}} io
 * @returns {number} exit code
 */
function status(cwd, args, io) {
  // `--help` is answered by `run` before dispatch, so no argument reaching here is one we know.
  if (args.length > 0) {
    io.err(`pitwall: unknown option \`${args[0]}\` for \`status\`\n${USAGE}\n`);
    return 2;
  }

  const root = repoRoot(cwd, io);
  if (root === null) return 2;

  const providers = loadProviders(BUILTIN_PROVIDERS, { knownStages: BEATS.map((beat) => beat.id) });
  const state = resolveBeat(cwd, providers);

  io.out(renderPosition(state, checkIgnored(root, artifactPaths(providers))));
  return 0;
}

/**
 * `pw start <branch>` — cut the branch and its worktree, then hand off the beat that follows.
 *
 * Leaving the operator at a bare success message would recreate the exact gap Pitwall exists to
 * close, so the baton is printed here too. It is resolved from the *new* worktree rather than from
 * `cwd`: the worktree beat is detected from the branch that is checked out, so asked from the
 * operator's tree the answer would still be "create a worktree" — the beat just done.
 *
 * @param {string} cwd
 * @param {string[]} args
 * @param {{out:(text:string)=>void, err:(text:string)=>void}} io
 * @returns {number} exit code
 */
function start(cwd, args, io) {
  // `--help` is answered by `run` before dispatch, so no option reaching here is one we know.
  const flag = args.find((arg) => arg.startsWith('-'));
  if (flag !== undefined) {
    io.err(`pitwall: unknown option \`${flag}\` for \`start\`\n${USAGE}\n`);
    return 2;
  }
  const [branch, ...extra] = args;
  if (!branch || extra.length > 0) {
    io.err(`pitwall: \`start\` takes exactly one branch name\n${USAGE}\n`);
    return 2;
  }

  const root = repoRoot(cwd, io);
  if (root === null) return 2;

  /** @type {import('./worktree.js').StartResult} */
  let result;
  try {
    result = startWorktree(branch, { cwd: root });
  } catch (error) {
    // Only this module's own failures are operator-facing; anything else is a bug and must not be
    // dressed up as advice.
    if (!(error instanceof WorktreeError)) throw error;
    io.err(`pitwall: ${error.message}\n`);
    return 2;
  }

  const providers = loadProviders(BUILTIN_PROVIDERS, { knownStages: BEATS.map((beat) => beat.id) });
  const state = resolveBeat(result.path, providers);

  // The one place Pitwall names a shell command rather than a slash command: a tool-invoked shell
  // cannot change the operator's directory, so the move has to be theirs to make.
  const lines = isInside(result.path, cwd)
    ? [`already inside the ${branch} worktree at ${result.path} — nothing to do`]
    : [
        result.created
          ? `worktree created at ${result.path}`
          : `worktree already exists at ${result.path}`,
        `${INDENT}cd ${result.path}`,
      ];

  io.out(`${lines.join('\n')}\n\n`);
  io.out(renderBaton(state, checkIgnored(result.path, artifactPaths(providers))));
  return 0;
}

/** Subcommands, as a Map so a bare `constructor` on the command line resolves to nothing. */
const COMMANDS = new Map([
  ['next', next],
  ['start', start],
  ['status', status],
]);

/**
 * Argument parsing lives here and only here: `bin/pw` is a wrapper around this function, and a
 * second parser in the wrapper would drift from it.
 *
 * @param {string[]} [argv] arguments after the program name
 * @param {{cwd?:string, out?:(text:string)=>void, err?:(text:string)=>void}} [options]
 * @returns {number} exit code
 */
export function run(argv = [], options = {}) {
  const out = options.out ?? ((text) => process.stdout.write(text));
  const err = options.err ?? ((text) => process.stderr.write(text));
  const cwd = options.cwd ?? process.cwd();
  const [name, ...args] = argv;

  // Help is answered wherever it appears, not only as the first word: `pw next --help` is what an
  // operator types, and rendering a baton in reply would be an answer to a different question.
  if (argv.includes('--help') || argv.includes('-h')) {
    out(`${USAGE}\n`);
    return 0;
  }
  if (name === undefined) {
    err(`${USAGE}\n`);
    return 2;
  }

  const command = COMMANDS.get(name);
  if (!command) {
    err(`pitwall: unknown command \`${name}\`\n${USAGE}\n`);
    return 2;
  }
  return command(cwd, args, { out, err });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
