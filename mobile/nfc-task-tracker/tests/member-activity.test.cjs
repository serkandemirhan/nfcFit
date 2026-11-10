const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { QueryClient } = require('@tanstack/react-query');
const source = path.resolve(__dirname, '../lib/member-activity.ts');
const loaded = new Module(source, module);
loaded._compile(ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, source);
const { combineMemberExerciseLogs: combine, summarizeMemberExercises: summarize, recordedMinutes, publishConfirmedTenantActivity: publish } = loaded.exports;
const activity = (overrides = {}) => ({ id: 'scan-1', tenant_id: 'club-1', tenant_name: 'Salon', tenant: 'Salon', exercise_id: 'pushup', exercise: 'Şınav', quantity: 10, unit: 'reps', source: 'nfc', created_at: '2026-11-07T12:00:00Z', tag_id: 'card-1', tag: 'Kart', ...overrides });

test('salon exercises appear without personal selections, sorted and deduplicated', () => {
  const plank = activity({ id: 'scan-2', exercise_id: 'plank', exercise: 'Plank', quantity: 30, unit: 'seconds', created_at: '2026-11-07T13:00:00Z' });
  const logs = combine([], [activity(), plank, activity()], 'member-1');
  assert.deepEqual(logs.map(log => log.exercise_name), ['Plank', 'Şınav']);
  assert.ok(logs.every(log => log.user_id === 'member-1'));
  assert.equal(summarize(logs, []).length, 2);
  assert.equal(recordedMinutes(logs), 0.5);
  assert.equal(summarize(logs, [])[0].calories, null);
});

test('personal IDs, club IDs, and units cannot merge unrelated exercise totals', () => {
  const personal = { id: 'scan-1', exercise_type_id: 'pushup', exercise_name: 'Şınav', quantity: 4, unit: 'reps', source: 'manual', calorie_estimate: 2, createdat: '2026-11-07T14:00:00Z', user_id: 'member-1' };
  const rows = summarize(combine([personal], [activity(), activity({ id: 'scan-2', tenant_id: 'club-2' }), activity({ id: 'scan-3', unit: 'seconds' })], 'member-1'), []);
  assert.equal(rows.length, 4);
  assert.equal(rows.find(row => row.key.startsWith('personal:')).calories, 2);
  assert.equal(rows.filter(row => row.calories === null).length, 3);
});

test('confirmed save updates only the current member once and preserves older records', async () => {
  const client = new QueryClient();
  const key = ['tenant-activities', 'member-1'];
  client.setQueryData(key, [activity({ id: 'old', created_at: '2026-11-06T12:00:00Z' })]);
  client.setQueryData(['tenant-activities', 'member-2'], []);
  await publish(client, 'member-1', activity());
  await publish(client, 'member-1', activity());
  assert.deepEqual(client.getQueryData(key).map(log => log.id), ['scan-1', 'old']);
  assert.deepEqual(client.getQueryData(['tenant-activities', 'member-2']), []);
  assert.equal(client.getQueryState(key).isInvalidated, true);
  client.clear();
});

test('old in-flight history response cannot overwrite a newly saved activity', async () => {
  const client = new QueryClient();
  const key = ['tenant-activities', 'member-1'];
  client.setQueryData(key, []);
  let release;
  const pending = client.fetchQuery({ queryKey: key, queryFn: () => new Promise(resolve => { release = resolve; }) }).catch(() => undefined);
  await publish(client, 'member-1', activity());
  release([]);
  await pending;
  assert.equal(client.getQueryData(key)[0].id, 'scan-1');
  client.clear();
});

test('completion after logout does not recreate a cleared member cache', async () => {
  const client = new QueryClient();
  client.setQueryData(['tenant-activities', 'member-1'], []);
  client.clear();
  await publish(client, 'member-1', activity());
  assert.equal(client.getQueryData(['tenant-activities', 'member-1']), undefined);
  client.clear();
});
