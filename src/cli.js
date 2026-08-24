import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BEATS } from './beats.js';
import { renderBaton } from './baton.js';
import { BUILTIN_PROVIDERS, resolveBeat } from './inference.js';
import { artifactPaths, checkIgnored } from './preflight.js';
import { loadProviders } from './providers.js';
import { superprojectRoot, worktreeRoot } from './repo.js';

const USAGE = [
  'Usage: pw <command> [options]',
  '',
  'Commands:',
  '  next    Where this change stands, and the baton for the next session',
  '',
  'Options:',
  '  --json  Print the raw inference result instead of the baton',
  '  --help  Print this message',
].join('\n');

/**
 * Options `next` accepts. Anything else is rejected rather than ignored: `--jsonn` silently
 * printing the human baton would be misparsed by the very script `--json` exists for.
 */
const NEXT_FLAGS = new Set(['--json']);

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

  // `resolveBeat` deliberately never throws outside a repository — it returns a plausible-looking
  // `ideate` beat plus a warning — so the no-git case has to be caught before it, not around it.
  // The submodule redirect is applied first so the preflight and the inference answer for one repo.
  const root = worktreeRoot(superprojectRoot(cwd) ?? cwd);
  if (root === null) {
    io.err(`pitwall: ${cwd} is not inside a git repository — run pw from a repository checkout\n`);
    return 2;
  }

  const providers = loadProviders(BUILTIN_PROVIDERS, { knownStages: BEATS.map((beat) => beat.id) });
  const state = resolveBeat(cwd, providers);

  if (args.includes('--json')) {
    io.out(`${JSON.stringify(state, null, 2)}\n`);
    return 0;
  }

  io.out(renderBaton(state, checkIgnored(root, artifactPaths(providers))));
  return 0;
}

/** Subcommands, as a Map so a bare `constructor` on the command line resolves to nothing. */
const COMMANDS = new Map([['next', next]]);

/**
 * Argument parsing lives here and only here: phase 5's `bin/pw` is a wrapper around this function,
 * and a second parser in the wrapper would drift from it.
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
