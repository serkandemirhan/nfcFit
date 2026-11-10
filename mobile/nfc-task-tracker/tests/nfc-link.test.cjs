const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const Ndef = require('react-native-nfc-manager/ndef-lib');
const root = path.resolve(__dirname, '..');
const id = '60b978eb-26a4-4709-969a-cc77b37ae590';
const url = `https://nfc-fit.vercel.app/tag/${id}`;

function setup(options = {}) {
  const calls = { writes: [], cleanup: 0, requests: 0, technologies: [], cleanupOptions: [] };
  const manager = {
    isSupported: async () => options.supported !== false,
    start: async () => undefined,
    requestTechnology: async tech => { calls.requests++; calls.technologies.push(tech); },
    cancelTechnologyRequest: async options => { calls.cleanup++; calls.cleanupOptions.push(options); },
    getTag: async () => ({ id: options.uid ?? 'F4C5D94F', ndefMessage: options.records ?? [] }),
    ndefHandler: {
      getNdefStatus: async () => {
        options.beforeStatus?.();
        return { status: options.status ?? 2, capacity: options.capacity ?? 888 };
      },
      writeNdefMessage: async bytes => { calls.writes.push(bytes); },
      getNdefMessage: async () => {
        if (options.readError) throw new Error('Read failed');
        return { ndefMessage: options.reread ?? Ndef.decodeMessage(calls.writes.at(-1)) };
      },
    },
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    cache.set(filename, mod);
    mod.paths = module.paths;
    mod.require = name => {
      if (name === 'react-native-nfc-manager') return { __esModule: true, default: manager, Ndef, NdefStatus: { ReadWrite: 2, ReadOnly: 3 }, NfcTech: { Ndef: 'ndef', NfcA: 'nfca' } };
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === './tag-link') return load(path.join(root, 'lib/tag-link.ts'));
      return require(name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
  }
  return { service: load(path.join(root, 'lib/nfc-manager.ts')).nfcManager, links: load(path.join(root, 'lib/tag-link.ts')), calls };
}

test('writes exactly one HTTPS URI record and reads it back', async () => {
  const { service, calls } = setup();
  const result = await service.writeAppLink('f4:c5:d9:4f', id);
  assert.deepEqual(result, { url, verified: true });
  assert.equal(calls.writes.length, 1);
  const records = Ndef.decodeMessage(calls.writes[0]);
  assert.equal(records.length, 1);
  assert.equal(records[0].type, 'U');
  assert.equal(Ndef.uri.decodePayload(records[0].payload), url);
  assert.equal(calls.cleanup, 1);
});

for (const scenario of [
  { name: 'different physical card', options: { uid: '00112233' }, message: /Farklı kart/ },
  { name: 'read-only card', options: { status: 3 }, message: /salt okunur/ },
  { name: 'insufficient capacity', options: { capacity: 4 }, message: /kapasitesi/ },
]) test(`refuses ${scenario.name} without writing and releases NFC`, async () => {
  const { service, calls } = setup(scenario.options);
  await assert.rejects(service.writeAppLink('F4C5D94F', id), scenario.message);
  assert.equal(calls.writes.length, 0);
  assert.equal(calls.cleanup, 1);
});

test('cancellation before write leaves the card unchanged', async () => {
  const controller = new AbortController();
  const { service, calls } = setup({ beforeStatus: () => controller.abort() });
  await assert.rejects(service.writeAppLink('F4C5D94F', id, controller.signal), /iptal/);
  assert.equal(calls.writes.length, 0);
  assert.equal(calls.cleanup, 1);
});

test('does not report verification when the reread fails', async () => {
  const { service, calls } = setup({ readError: true });
  assert.deepEqual(await service.writeAppLink('F4C5D94F', id), { url, verified: false });
  assert.equal(calls.writes.length, 1);
});

test('TEXT containing the same URL is not a verified URI record', async () => {
  const { service } = setup({ reread: [Ndef.textRecord(url)] });
  assert.equal((await service.writeAppLink('F4C5D94F', id)).verified, false);
});

test('separate verification reads the existing URI without writing', async () => {
  const { service, calls } = setup({ records: [Ndef.uriRecord(url)] });
  assert.equal(await service.verifyAppLink('F4C5D94F', id), true);
  assert.equal(calls.writes.length, 0);
});

test('rejects invalid IDs and nonphysical UIDs before requesting NFC', async () => {
  const { service, calls, links } = setup();
  for (const invalid of ['../../console', 'https://evil.example', '', id + '?url=evil']) {
    assert.throws(() => links.buildTagLink(invalid));
    await assert.rejects(service.writeAppLink('F4C5D94F', invalid));
  }
  await assert.rejects(service.writeAppLink('NFCFIT-TEST-PLANK-01', id));
  assert.equal(calls.requests, 0);
  assert.equal(calls.writes.length, 0);
});


test('Android reads NDEF or blank NFC-A in one session without the one-second cleanup delay', async () => {
  const { service, calls } = setup();
  assert.equal((await service.readTag()).id, 'F4C5D94F');
  assert.deepEqual(calls.technologies, [['ndef', 'nfca']]);
  assert.deepEqual(calls.cleanupOptions, [{ delayMsAndroid: 0 }]);
});

test('aborted read does not start a new NFC session', async () => {
  const { service, calls } = setup();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(service.readTag(controller.signal), /iptal/);
  assert.equal(calls.requests, 0);
});
