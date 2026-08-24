import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { detectCmd, detectPathExists, loadProviders, providerIsDone } from '../src/providers.js';
import { cleanupAll, tempRoot, writeFile } from './helpers/repo-fixture.js';

after(cleanupAll);

const VALID = [
  '---',
  'stage: contract',
  'command: /ideation:ideation',
  'model: opus',
  'effort: high',
  'handoff: clear',
  'doneWhenPathExists: docs/ideation/*/contract-data.json',
  '---',
  'Run the ideation interview to produce the contract.',
  '',
].join('\n');

/**
 * @param {Record<string,string>} files basename → contents
 * @returns {string} the providers directory
 */
function providerDir(files) {
  const dir = path.join(tempRoot(), 'providers');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, contents] of Object.entries(files)) writeFile(path.join(dir, name), contents);
  return dir;
}

describe('loadProviders', () => {
  it('indexes manifests by stage and keeps the body as baton text', () => {
    const dir = providerDir({ 'ideation-contract.md': VALID });
    const providers = loadProviders(dir);

    assert.equal(providers.size, 1);
    const provider = providers.get('contract');
    assert.equal(provider.stage, 'contract');
    assert.equal(provider.command, '/ideation:ideation');
    assert.equal(provider.model, 'opus');
    assert.equal(provider.effort, 'high');
    assert.equal(provider.handoff, 'clear');
    assert.equal(provider.doneWhenPathExists, 'docs/ideation/*/contract-data.json');
    assert.equal(provider.doneWhenCmd, undefined);
    assert.equal(provider.body, 'Run the ideation interview to produce the contract.\n');
    assert.equal(provider.path, path.join(dir, 'ideation-contract.md'));
  });

  it('returns an empty map for a directory with no manifests', () => {
    assert.equal(loadProviders(providerDir({})).size, 0);
  });

  it('returns an empty map for a directory that does not exist', () => {
    assert.equal(loadProviders(path.join(tempRoot(), 'nope')).size, 0);
  });

  it('ignores files that are not manifests', () => {
    const dir = providerDir({ 'ideation-contract.md': VALID, 'README.txt': 'not a manifest' });
    assert.equal(loadProviders(dir).size, 1);
  });

  it('accepts a manifest whose only detector is doneWhenCmd', () => {
    const manifest = ['---', 'stage: execute', 'command: /spec:apply', 'model: opus', 'doneWhenCmd: exit 0', '---', ''].join('\n');
    const provider = loadProviders(providerDir({ 'openspec-execute.md': manifest })).get('execute');
    assert.equal(provider.doneWhenCmd, 'exit 0');
    assert.equal(provider.doneWhenPathExists, undefined);
  });

  for (const key of ['stage', 'command', 'model']) {
    it(`rejects a manifest missing ${key}`, () => {
      const manifest = VALID.split('\n')
        .filter((line) => !line.startsWith(`${key}:`))
        .join('\n');
      assert.throws(() => loadProviders(providerDir({ 'broken.md': manifest })), new RegExp(`broken\\.md.*${key}`, 's'));
    });
  }

  it('rejects a manifest with no doneWhen* detector — a stage that can never complete stalls inference', () => {
    const manifest = ['---', 'stage: contract', 'command: /ideation:ideation', 'model: opus', '---', ''].join('\n');
    assert.throws(() => loadProviders(providerDir({ 'nodetector.md': manifest })), /nodetector\.md.*doneWhen/s);
  });

  it('rejects two manifests claiming the same stage, naming both files', () => {
    assert.throws(
      () => loadProviders(providerDir({ 'a.md': VALID, 'b.md': VALID })),
      /duplicate stage `contract`.*a\.md.*b\.md/s,
    );
  });

  it('rejects an unknown stage name when the caller supplies the known set', () => {
    const dir = providerDir({ 'ideation-contract.md': VALID });
    assert.throws(() => loadProviders(dir, { knownStages: ['specs', 'execute'] }), /unknown stage `contract`/);
    assert.equal(loadProviders(dir, { knownStages: ['contract'] }).size, 1);
  });

  it('propagates frontmatter parse errors with the manifest path', () => {
    assert.throws(() => loadProviders(providerDir({ 'listy.md': '---\nstage: contract\n- one\n---\n' })), /listy\.md:3:/);
  });
});

describe('detectPathExists', () => {
  it('matches a literal path relative to the repository root', () => {
    const root = tempRoot();
    writeFile(path.join(root, 'openspec', 'changes', 'x', 'tasks.md'), '- [ ] a\n');
    assert.equal(detectPathExists('openspec/changes/x/tasks.md', root), true);
    assert.equal(detectPathExists('openspec/changes/y/tasks.md', root), false);
  });

  it('matches an unquoted glob segment', () => {
    const root = tempRoot();
    writeFile(path.join(root, 'docs', 'ideation', 'pitwall', 'contract-data.json'), '{}');
    assert.equal(detectPathExists('docs/ideation/*/contract-data.json', root), true);
    assert.equal(detectPathExists('docs/ideation/*/nothing.json', root), false);
  });

  it('matches a ** segment across depths', () => {
    const root = tempRoot();
    writeFile(path.join(root, 'a', 'b', 'c', 'tasks.md'), '');
    assert.equal(detectPathExists('**/tasks.md', root), true);
    assert.equal(detectPathExists('**/other.md', root), false);
  });

  it('is false when the repository root does not exist', () => {
    assert.equal(detectPathExists('anything', path.join(tempRoot(), 'missing')), false);
  });

  it('matches a directory as well as a file', () => {
    const root = tempRoot();
    fs.mkdirSync(path.join(root, 'openspec', 'changes'), { recursive: true });
    assert.equal(detectPathExists('openspec/changes', root), true);
  });
});

describe('detectCmd', () => {
  it('is true when the command exits 0', () => {
    assert.equal(detectCmd('exit 0', tempRoot()), true);
  });

  it('is false when the command exits non-zero', () => {
    assert.equal(detectCmd('exit 1', tempRoot()), false);
  });

  it('is false — never thrown — when the command does not exist (exit 127)', () => {
    assert.equal(detectCmd('pitwall-no-such-binary-xyz', tempRoot()), false);
  });

  it('runs in the given cwd and ignores stdout', () => {
    const root = tempRoot();
    writeFile(path.join(root, 'marker'), '');
    assert.equal(detectCmd('cat marker && echo loud', root), true);
  });
});

describe('providerIsDone', () => {
  const root = tempRoot();
  writeFile(path.join(root, 'docs', 'ideation', 'pitwall', 'contract-data.json'), '{}');

  it('uses the path detector alone when it is the only one', () => {
    assert.equal(providerIsDone({ doneWhenPathExists: 'docs/ideation/*/contract-data.json' }, root), true);
    assert.equal(providerIsDone({ doneWhenPathExists: 'docs/ideation/*/missing.json' }, root), false);
  });

  it('uses the command detector alone when it is the only one', () => {
    assert.equal(providerIsDone({ doneWhenCmd: 'exit 0' }, root), true);
    assert.equal(providerIsDone({ doneWhenCmd: 'exit 1' }, root), false);
  });

  it('requires both detectors to pass when both are present', () => {
    const pathOk = 'docs/ideation/*/contract-data.json';
    assert.equal(providerIsDone({ doneWhenPathExists: pathOk, doneWhenCmd: 'exit 0' }, root), true);
    assert.equal(providerIsDone({ doneWhenPathExists: pathOk, doneWhenCmd: 'exit 1' }, root), false);
    assert.equal(providerIsDone({ doneWhenPathExists: 'docs/nope', doneWhenCmd: 'exit 0' }, root), false);
  });

  it('is false when a provider carries no detector at all', () => {
    assert.equal(providerIsDone({}, root), false);
  });
});
