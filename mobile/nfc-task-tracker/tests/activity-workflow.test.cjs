const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const Module = require('node:module'); const ts = require('typescript');
const source = path.resolve(__dirname, '../lib/activity-workflow.ts'); const loaded = new Module(source, module);
loaded._compile(ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, source);
const { createActivityWorkflow, goalProgress, weeklyTrend } = loaded.exports;
const intent = { tagId: 'card', exercise: 'Şınav', unit: 'repetition', tenant: 'Salon', quantity: 10 };
function storage() { const data = new Map(); return { data, getItem: async k => data.get(k) ?? null, setItem: async (k,v) => { data.set(k,v); }, removeItem: async k => { data.delete(k); } }; }

test('lost response and app restart retry the same persisted request', async () => {
 const store = storage(); const calls = []; let sequence = 0;
 const record = async (tag, quantity, id) => { calls.push(id); if (calls.length === 1) throw new Error('connection lost after commit'); return { id: 'saved' }; };
 const first = createActivityWorkflow(store, record, () => `request-${++sequence}`);
 await assert.rejects(first.submit('member-1', intent));
 assert.equal((await first.load('member-1')).requestId, 'request-1');
 const restarted = createActivityWorkflow(store, record, () => `request-${++sequence}`);
 assert.equal((await restarted.submit('member-1', intent)).id, 'saved');
 assert.deepEqual(calls, ['request-1','request-1']); assert.equal(await restarted.load('member-1'), null);
});

test('another quantity cannot overwrite an uncertain recording, and accounts are isolated', async () => {
 const store = storage(); let calls = 0;
 const workflow = createActivityWorkflow(store, async () => { calls++; throw new Error('offline'); }, () => 'id');
 await assert.rejects(workflow.submit('member-1', intent));
 await assert.rejects(workflow.submit('member-1', { ...intent, quantity: 20 }), /bekleyen/);
 assert.equal(calls, 1); assert.equal(await workflow.load('member-2'), null);
 assert.equal((await workflow.load('member-1')).quantity, 10);
});

test('double taps do not issue parallel recording requests', async () => {
 const store = storage(); let release; let calls = 0;
 const workflow = createActivityWorkflow(store, async () => { calls++; return new Promise(resolve => { release = resolve; }); }, () => 'id');
 const first = workflow.submit('member', intent);
 await assert.rejects(workflow.submit('member', intent), /sürüyor/);
 await new Promise(resolve => setImmediate(resolve)); release({ id: 'saved' }); await first;
 assert.equal(calls, 1);
});

test('storage failure prevents sending, definitive validation failure clears pending, timeout preserves it', async () => {
 let calls = 0; const store = storage(); store.setItem = async () => { throw new Error('disk'); };
 const blocked = createActivityWorkflow(store, async () => { calls++; }, () => 'id');
 await assert.rejects(blocked.submit('member', intent)); assert.equal(calls, 0);
 const goodStore = storage(); const rejected = createActivityWorkflow(goodStore, async () => { throw Object.assign(new Error('inactive'), { status: 410 }); }, () => 'id');
 await assert.rejects(rejected.submit('member', intent)); assert.equal(await rejected.load('member'), null);
 const timeout = createActivityWorkflow(goodStore, async () => { throw Object.assign(new Error('timeout'), { status: 408 }); }, () => 'id');
 await assert.rejects(timeout.submit('member', intent)); assert.ok(await timeout.load('member'));
});

test('goal guidance never exceeds 100 percent and does not invent targets', () => {
 assert.deepEqual(goalProgress(20,30), { percent: 67, remaining:10, complete:false });
 assert.deepEqual(goalProgress(40,30), { percent:100, remaining:0, complete:true });
 assert.deepEqual(goalProgress(10,null), { percent:0, remaining:0, complete:false });
});

test('weekly chart compares record counts across 14 local days, without mixing quantities', () => {
 const timeline = Array.from({length:14},(_,i) => ({day:`2026-11-${String(i+1).padStart(2,'0')}`,count:i<7?1:2}));
 const result = weeklyTrend(timeline,[{createdat:'2026-11-14T12:00:00'}]);
 assert.equal(result.total,15); assert.equal(result.previous,7); assert.equal(result.activeDays,7); assert.equal(result.change,114);
 assert.equal(result.days[6].count,3); assert.equal(timeline[13].count,2);
 assert.equal(weeklyTrend(timeline.map(d=>({...d,count:0})),[]).change,null);
});


test('goal celebration is claimed once per account, exercise, unit and day, including after restart', async () => {
 const { createGoalCelebrationClaim } = loaded.exports;
 const store = storage(); const claim = createGoalCelebrationClaim(store);
 assert.deepEqual(await Promise.all([claim('member','2026-11-07','plank','seconds'), claim('member','2026-11-07','plank','seconds')]), [true,false]);
 assert.equal(await createGoalCelebrationClaim(store)('member','2026-11-07','plank','seconds'),false);
 assert.equal(await claim('another','2026-11-07','plank','seconds'),true);
 assert.equal(await claim('member','2026-11-08','plank','seconds'),true);
});
