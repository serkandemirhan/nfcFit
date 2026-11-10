const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/react-query');
const source = path.resolve(__dirname, '../lib/management-cache.ts');
const loaded = new Module(source, module);
loaded._compile(ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, source);
const { applyConfirmedTagDeletion } = loaded.exports;
const key = ['club-management', 'owner', 'club-1', 'owner'];
function fixture() {
  return {
    tags: [{ id: 'card-1', name: 'Birinci kart' }, { id: 'card-2', name: 'İkinci kart' }], dashboard: { tenant: { cards: 2 }, activities_today: 1 },
    members: [{ id: 'member' }], exercises: [], staff: [], activities: [{ id: 'history' }],
  };
}

test('confirmed deletion updates an active list without refetching or changing another club', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const original = fixture();
  client.setQueryData(key, original);
  const otherKey = ['club-management', 'owner', 'club-2', 'owner'];
  client.setQueryData(otherKey, fixture());
  let calls = 0;
  const observer = new QueryObserver(client, { queryKey: key, queryFn: async () => { calls++; return original; }, staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  applyConfirmedTagDeletion(client, key, 'card-1');
  const current = client.getQueryData(key);
  assert.deepEqual(current.tags.map(tag => tag.id), ['card-2']);
  assert.equal(current.dashboard.tenant.cards, 1);
  assert.equal(current.activities, original.activities);
  assert.equal(current.members, original.members);
  assert.equal(client.getQueryData(otherKey).tags.length, 2);
  assert.equal(calls, 0);
  assert.equal(client.getQueryState(key).isInvalidated, true);
  unsubscribe(); client.clear();
});

test('repeated completion cannot decrement the capacity counter twice', () => {
  const client = new QueryClient();
  client.setQueryData(key, fixture());
  applyConfirmedTagDeletion(client, key, 'card-1');
  applyConfirmedTagDeletion(client, key, 'card-1');
  assert.equal(client.getQueryData(key).dashboard.tenant.cards, 1);
  client.clear();
});

test('completion after the cache was cleared does not recreate an old account list', () => {
  const client = new QueryClient();
  applyConfirmedTagDeletion(client, key, 'card-1');
  assert.equal(client.getQueryData(key), undefined);
  client.clear();
});

test('an older in-flight refresh cannot bring a confirmed deleted card back', async () => {
  const client = new QueryClient();
  const original = fixture();
  client.setQueryData(key, original);
  let release;
  const observer = new QueryObserver(client, { queryKey: key, queryFn: () => new Promise(resolve => { release = resolve; }), staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  const pendingRefresh = observer.refetch();
  await client.cancelQueries({ queryKey: key, exact: true });
  applyConfirmedTagDeletion(client, key, 'card-1');
  release(original);
  await pendingRefresh;
  assert.deepEqual(client.getQueryData(key).tags.map(tag => tag.id), ['card-2']);
  unsubscribe(); client.clear();
});

test('confirmed card creation appears immediately without reloading management or identity', () => {
  const { applyConfirmedManagementSave } = loaded.exports;
  const client = new QueryClient();
  client.setQueryData(key, fixture());
  let calls = 0;
  const observer = new QueryObserver(client, { queryKey: key, queryFn: async () => { calls++; return fixture(); }, staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  const saved = { id: 'card-3', name: 'Yeni kart', exercise_id: null, exercise: null };
  applyConfirmedManagementSave(client, key, 'tags', saved);
  applyConfirmedManagementSave(client, key, 'tags', { ...saved, name: 'Düzenlenen' });
  assert.equal(client.getQueryData(key).tags.length, 3);
  assert.equal(client.getQueryData(key).dashboard.tenant.cards, 3);
  assert.equal(calls, 0);
  unsubscribe(); client.clear();
});

test('confirmed exercise edit updates its linked cards without mixing clubs', () => {
  const { applyConfirmedManagementSave } = loaded.exports;
  const client = new QueryClient();
  const original = fixture();
  original.tags[0] = { id: 'card-1', exercise_id: 'plank', exercise: { id: 'plank', name: 'Eski' } };
  client.setQueryData(key, original);
  const other = ['club-management', 'owner', 'other-club', 'owner'];
  client.setQueryData(other, fixture());
  const exercise = { id: 'plank', name: 'Plank', unit: 'seconds', default_quantity: 45, active: true };
  applyConfirmedManagementSave(client, key, 'exercises', exercise);
  assert.deepEqual(client.getQueryData(key).tags[0].exercise, exercise);
  assert.equal(client.getQueryData(key).exercises.length, 1);
  assert.equal(client.getQueryData(other).exercises.length, 0);
  client.clear();
  applyConfirmedManagementSave(client, key, 'exercises', exercise);
  assert.equal(client.getQueryData(key), undefined);
});

test('membership approval and repeated confirmations update list and capacity exactly once',()=>{
 const {applyConfirmedMemberSave}=loaded.exports,client=new QueryClient();const original=fixture();original.dashboard.tenant={cards:2,active_members:2,pending_joins:1};original.dashboard.inactive_members=0;original.members=[{id:'member',account_id:'account',name:'Ada',email:'ada@test',status:'pending',requested_at:'2026-11-08'}];client.setQueryData(key,original);
 applyConfirmedMemberSave(client,key,{id:'member',status:'active'});applyConfirmedMemberSave(client,key,{id:'member',status:'active'});
 const updated=client.getQueryData(key);assert.equal(updated.members[0].name,'Ada');assert.equal(updated.dashboard.tenant.active_members,3);assert.equal(updated.dashboard.tenant.pending_joins,0);
 applyConfirmedMemberSave(client,key,{id:'member',status:'suspended'});assert.equal(client.getQueryData(key).dashboard.tenant.active_members,2);assert.equal(client.getQueryData(key).dashboard.inactive_members,1);assert.equal(client.getQueryData(key).activities,original.activities);client.clear();
});
test('confirmed staff role changes preserve contact information and cannot resurrect a cleared account cache',()=>{const {applyConfirmedStaffSave}=loaded.exports,client=new QueryClient();const original=fixture();original.staff=[{id:'staff',name:'Ece',email:'ece@test',account_id:'ece',role:'TRAINER',status:'active'}];client.setQueryData(key,original);applyConfirmedStaffSave(client,key,{id:'staff',role:'CLUB_MANAGER',status:'active'});assert.equal(client.getQueryData(key).staff[0].name,'Ece');assert.equal(client.getQueryData(key).staff[0].role,'CLUB_MANAGER');client.clear();applyConfirmedStaffSave(client,key,original.staff[0]);assert.equal(client.getQueryData(key),undefined);});
