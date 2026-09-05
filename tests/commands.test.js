import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { LEGS } from '../src/legs.js';
import { renderBaton } from '../src/baton.js';
import { parseManifest } from '../src/frontmatter.js';
import { loadBookings } from '../src/bookings.js';
import { cleanupAll, tempRoot, writeFile } from './helpers/repo-fixture.js';

after(cleanupAll);

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMANDS = path.join(ROOT, 'commands');
const PROVIDERS = path.join(ROOT, 'bookings');

/**
 * The command set Pitwall claims to ship.
 *
 * It lives here rather than in a `commands` key in `.claude-plugin/plugin.json` deliberately, and
 * the reason was measured against a scratch install rather than assumed: with no key, `commands/`
 * is discovered by convention and everything resolves, nested files included; with a file-path
 * array (`"commands": ["./commands/top.md", "./commands/sub/nested.md"]`) the nested command stops
 * resolving entirely, which would silently unregister all four `commands/spec/*.md`. Not one
 * plugin manifest installed on this machine declares the key. A list the loader never reads still
 * gives this suite the second opinion it needs: a renamed or deleted command file fails against it
 * either way. `spec-phase-5.md` records the deviation.
 */
const DECLARED = [
  'next.md',
  'spec/apply.md',
  'spec/archive.md',
  'spec/explore.md',
  'spec/propose.md',
  'start.md',
  'status.md',
];

/**
 * Every `*.md` under `dir`, as slash-joined relative paths. The walk recurses because
 * `commands/spec/` is namespaced — a flat `readdirSync` would report the four vendored routing
 * commands as missing while they sit right there.
 *
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {string[]} sorted
 */
function shipped(dir, prefix = '') {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) return shipped(path.join(dir, entry.name), rel);
      return entry.name.endsWith('.md') ? [rel] : [];
    })
    .sort();
}

/**
 * Why each of `files` is not a usable command file, if it is not.
 *
 * `description` is asserted rather than "it parses", because parsing is not a real check on its
 * own: a file with no frontmatter at all comes back as an empty map instead of throwing, so a
 * command whose fences were lost would pass a parse-only test and then install with no description.
 *
 * @param {string} dir
 * @param {string[]} files relative paths, as {@link shipped} returns them
 * @returns {string[]}
 */
function problems(dir, files) {
  const found = [];
  for (const rel of files) {
    const file = path.join(dir, ...rel.split('/'));
    let meta;
    try {
      ({ meta } = parseManifest(fs.readFileSync(file, 'utf8'), rel));
    } catch (error) {
      // Already `<file>:<line>: <message>` — the parser names its own source.
      found.push(error.message);
      continue;
    }
    if (!meta.description) found.push(`${rel}: frontmatter names no description`);
  }
  return found;
}

/**
 * A throwaway copy of the shipped command tree, so the negative cases below break a real directory
 * rather than asserting against a hand-built one that never resembled the product.
 *
 * @returns {string} the copied `commands/` directory
 */
function scratch() {
  const dir = path.join(tempRoot(), 'commands');
  for (const rel of DECLARED) {
    const target = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(COMMANDS, ...rel.split('/')), target);
  }
  return dir;
}

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

describe('the shipped command set', () => {
  it('agrees with the declared set in both directions', () => {
    assert.deepEqual(shipped(COMMANDS), DECLARED);
  });

  it('gives every command file frontmatter with a description', () => {
    assert.deepEqual(problems(COMMANDS, DECLARED), []);
  });

  it('notices a declared command file that was renamed', () => {
    const dir = scratch();
    fs.renameSync(path.join(dir, 'status.md'), path.join(dir, 'position.md'));

    const found = shipped(dir);
    assert.equal(found.includes('status.md'), false);
    assert.notDeepEqual(found, DECLARED);
  });

  it('notices a command file shipped without being declared', () => {
    const dir = scratch();
    writeFile(path.join(dir, 'stray.md'), '---\ndescription: "stray"\n---\n');

    assert.notDeepEqual(shipped(dir), DECLARED);
  });

  it('rejects a command file that lost its frontmatter fences entirely', () => {
    const dir = scratch();
    writeFile(path.join(dir, 'status.md'), '# Pitwall: status\n\nno frontmatter here\n');

    assert.deepEqual(problems(dir, DECLARED), ['status.md: frontmatter names no description']);
  });

  it('rejects a command file whose frontmatter does not parse', () => {
    const dir = scratch();
    writeFile(
      path.join(dir, 'status.md'),
      '---\ndescription: "one"\ndescription: "two"\n---\nbody\n',
    );

    assert.deepEqual(problems(dir, DECLARED), ['status.md:3: duplicate key `description`']);
  });

  it('keeps the vendored routing commands byte-identical to what they encode', () => {
    // The whole point of vendoring is that the `model:`/`effort:` frontmatter *is* the routing.
    // A copy that quietly lost it would still parse and still install.
    const routing = {
      'spec/apply.md': { model: 'inherit', effort: undefined },
      'spec/archive.md': { model: 'sonnet', effort: 'low' },
      'spec/explore.md': { model: 'opus', effort: 'high' },
      'spec/propose.md': { model: 'opus', effort: 'high' },
    };
    for (const [rel, expected] of Object.entries(routing)) {
      const source = fs.readFileSync(path.join(COMMANDS, ...rel.split('/')), 'utf8');
      const { meta } = parseManifest(source, rel);
      assert.equal(meta.model, expected.model, rel);
      assert.equal(meta.effort, expected.effort, rel);
      assert.match(source, /\$ARGUMENTS/, `${rel} lost its argument line`);
    }
  });
});

describe('the plugin manifest', () => {
  it('is valid JSON naming the plugin', () => {
    const plugin = readJson('.claude-plugin/plugin.json');
    assert.equal(plugin.name, 'pitwall');
    assert.ok(plugin.description, 'plugin.json has no description');
    assert.ok(Array.isArray(plugin.keywords) && plugin.keywords.length > 0);
  });

  it('carries the same name and version as package.json, so an install cannot report two', () => {
    const plugin = readJson('.claude-plugin/plugin.json');
    const pkg = readJson('package.json');
    assert.equal(plugin.name, pkg.name);
    assert.equal(plugin.version, pkg.version);
  });

  it('declares no `commands` key — the loader discovers commands/ by convention', () => {
    assert.equal(readJson('.claude-plugin/plugin.json').commands, undefined);
  });
});

/**
 * The shipped bookings, copied to a throwaway directory so a swap can be applied to them without
 * touching the developer's checkout.
 *
 * @returns {string} the copied `bookings/` directory
 */
function scratchProviders() {
  const dir = path.join(tempRoot(), 'bookings');
  fs.mkdirSync(dir, { recursive: true });
  for (const entry of fs.readdirSync(PROVIDERS).filter((name) => name.endsWith('.md'))) {
    fs.copyFileSync(path.join(PROVIDERS, entry), path.join(dir, entry));
  }
  return dir;
}

describe('the worked alternative binding in examples/', () => {
  // Nothing under `examples/` is on any load path — `loadBookings` only ever reads `bookings/` —
  // so a typo in `leg`, `argument`, or the stamp would surface for the first time on the
  // operator who followed the README and overwrote their working manifest with it.
  it('loads as a drop-in replacement for the execute manifest', () => {
    const dir = scratchProviders();
    fs.copyFileSync(
      path.join(ROOT, 'examples', 'superpowers-execute.md'),
      path.join(dir, 'openspec-execute.md'),
    );

    const providers = loadBookings(dir, { knownStages: LEGS.map((leg) => leg.id) });
    const provider = providers.get('execute');
    assert.ok(provider, 'the swapped manifest does not bind the execute stage');
    assert.equal(provider.command, 'superpowers:subagent-driven-development');
    assert.equal(providers.size, fs.readdirSync(dir).length, 'the swap left a stage unbound');
  });

  it('renders a baton naming the skill with no argument appended', () => {
    const dir = scratchProviders();
    fs.copyFileSync(
      path.join(ROOT, 'examples', 'superpowers-execute.md'),
      path.join(dir, 'openspec-execute.md'),
    );
    const provider = loadBookings(dir, { knownStages: LEGS.map((leg) => leg.id) }).get('execute');

    // `changeId` is deliberately non-null: `argument: none` is the only thing keeping it off the
    // end of a skill name that takes no argument.
    const baton = renderBaton({
      beat: 'execute',
      index: 6,
      completed: ['ideate', 'bay', 'refine', 'contract', 'specs'],
      skipped: [],
      provider,
      branch: 'feat/thing',
      changeId: 'add-thing',
      warnings: [],
    });

    assert.match(baton, /^ {2}superpowers:subagent-driven-development$/m);
    assert.equal(baton.includes('subagent-driven-development add-thing'), false);
  });
});

describe('criterion 7: zero dependencies and no build step', () => {
  const pkg = readJson('package.json');

  it('declares no dependencies of any kind', () => {
    assert.deepEqual(Object.keys(pkg.dependencies ?? {}), []);
    assert.deepEqual(Object.keys(pkg.devDependencies ?? {}), []);
  });

  it('declares no build script', () => {
    assert.equal((pkg.scripts ?? {}).build, undefined);
  });

  it('points `pw` at an executable shim that exists', () => {
    assert.equal(pkg.bin.pw, 'bin/pw');
    const shim = path.join(ROOT, pkg.bin.pw);
    assert.equal(fs.existsSync(shim), true);
    assert.notEqual(fs.statSync(shim).mode & 0o111, 0, 'bin/pw is not executable');
  });

  it('keeps argument parsing out of the shim, so it cannot drift from the CLI', () => {
    const shim = fs.readFileSync(path.join(ROOT, 'bin', 'pw'), 'utf8');
    assert.match(shim, /^#!\/usr\/bin\/env node$/m);
    assert.match(shim, /run\(process\.argv\.slice\(2\)\)/);
  });

  it('actually runs: `pw --help` exits 0 and prints the usage banner', () => {
    // Reading the shim's text cannot catch a broken import path or a throw on load — the file
    // would still contain both lines above and still be dead on arrival for anyone who ran it.
    const result = spawnSync(process.execPath, [path.join(ROOT, 'bin', 'pw'), '--help'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^Usage: pw <command> \[options\]$/m);
    assert.match(result.stdout, /^ {2}status +Where this change stands, without the baton$/m);
  });
});
