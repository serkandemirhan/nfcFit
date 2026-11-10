const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { fixture } = require("./offline-fixture.cjs");
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const file = path.resolve(__dirname, "../lib", name + ".ts");
  const mod = new Module(file, module);
  cache.set(name, mod);
  mod.require = (id) => (id.startsWith("./") ? load(id.slice(2)) : require(id));
  mod._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    file,
  );
  return mod.exports;
}
const { COACHING_SCHEMA, createCoachingStore } = load("coaching-store-core");
async function setup(t) {
  const f = await fixture(t);
  for (const sql of COACHING_SCHEMA.split(";").filter((s) => s.trim()))
    await f.db.runAsync(sql);
  const store = createCoachingStore(f.db);
  const exercise = {
    id: "bench",
    name: "Bench press",
    measurements: ["reps", "kg"],
  };
  const plan = {
    id: "plan",
    athlete_id: "account",
    owner_id: "coach",
    tenant_id: null,
    version: 1,
    content: {
      name: "Plan",
      days: [
        {
          id: "day",
          name: "Day",
          dates: ["2026-11-08"],
          exercises: [
            {
              id: "exercise",
              exercise_id: "bench",
              sets: 2,
              reps: 10,
              kg: 40,
              rest_seconds: 60,
              notes: "",
            },
          ],
        },
      ],
    },
  };
  const overview = {
    account_id: "account",
    athlete_id: "account",
    links: [],
    plans: [plan],
    workouts: [],
    reports: [],
    messages: [],
    notifications: [],
    wellness: [],
    consents: [],
  };
  await store.saveOverview("u", overview);
  await store.saveLibrary("u", [exercise]);
  return {
    ...f,
    store,
    plan,
    overview,
    exercise,
    reopen: () => createCoachingStore(f.db),
    start: () =>
      store.createWorkout("u", "workout", plan, "day", "2026-11-08", [
        exercise,
      ]),
  };
}
const cmd = (version, action, rest = {}) => ({
  request_id: "cmd-" + version,
  expected_version: version,
  action,
  ...rest,
});
const set = (version, rest = {}) =>
  cmd(version, "set", {
    actual_set: {
      id: "set-" + version,
      exercise_key: "exercise",
      set_number: version - 1,
      reps: 9,
      kg: 35,
      method: "manual",
      status: "completed",
      occurred_at: "2026-11-07T12:00:00Z",
      notes: "",
      ...rest,
    },
  });
test("workout actuals survive reopening, pending snapshots resist stale pull and accounts stay isolated", async (t) => {
  const f = await setup(t);
  let w = await f.start();
  w = await f.store.command("u", w.id, cmd(1, "start"));
  w = await f.store.command("u", w.id, set(2));
  assert.equal(w.snapshot.exercises[0].reps, 10);
  const reopened = f.reopen();
  assert.equal((await reopened.workout("u", w.id)).actual.sets[0].reps, 9);
  await reopened.saveOverview("u", {
    ...f.overview,
    workouts: [{ ...w, version: 1, actual: { ...w.actual, sets: [] } }],
  });
  assert.equal((await reopened.workout("u", w.id)).actual.sets.length, 1);
  assert.equal((await reopened.jobs("u")).length, 3);
  assert.equal(await reopened.workout("other", w.id), null);
});
test("request retry is idempotent and another request cannot duplicate the same set slot", async (t) => {
  const f = await setup(t);
  await f.start();
  await f.store.command("u", "workout", cmd(1, "start"));
  const c = set(2);
  await f.store.command("u", "workout", c);
  await f.store.command("u", "workout", c);
  assert.equal((await f.store.jobs("u")).length, 3);
  await assert.rejects(
    f.store.command("u", "workout", set(3, { set_number: 1 })),
    /Set zaten/,
  );
  assert.equal((await f.store.workout("u", "workout")).version, 3);
});
test("terminal actuals are immutable and partial finish requires explicit confirmation", async (t) => {
  const f = await setup(t);
  await f.start();
  await f.store.command("u", "workout", cmd(1, "start"));
  await assert.rejects(
    f.store.command("u", "workout", cmd(2, "finish")),
    /Eksik/,
  );
  const w = await f.store.command(
    "u",
    "workout",
    cmd(2, "finish", { partial: true }),
  );
  assert.equal(w.state, "partial");
  await assert.rejects(
    f.store.command("u", "workout", cmd(3, "note", { notes: "rewrite" })),
    /değiştirilemez/,
  );
});
test("conflict preserves actuals and dependent jobs, archives before adopting canonical server workout", async (t) => {
  const f = await setup(t);
  await f.start();
  await f.store.command("u", "workout", cmd(1, "start"));
  let w = await f.store.command("u", "workout", set(2));
  await f.store.reject("u", (await f.store.jobs("u"))[0], "Program değişti");
  w = await f.store.workout("u", "workout");
  assert.equal(w.actual.sets.length, 1);
  assert.equal(w.sync_state, "rejected");
  assert.ok((await f.store.jobs("u")).every((j) => j.state === "rejected"));
  await assert.rejects(
    f.store.command("u", "workout", cmd(3, "pause")),
    /çakışmasını/,
  );
  await f.store.resolveWithServer("u", "workout", {
    ...w,
    id: "canonical",
    version: 10,
    sync_state: "synced",
  });
  assert.equal(await f.store.workout("u", "workout"), null);
  assert.equal((await f.store.workout("u", "canonical")).version, 10);
  const archive = await f.db.getAllAsync(
    "SELECT payload FROM offline_docs WHERE user_id='u' AND key LIKE 'coaching-conflict:%'",
  );
  assert.equal(JSON.parse(archive[0].payload).actual.sets.length, 1);
  assert.ok((await f.store.jobs("u")).every((j) => j.state === "resolved"));
});
test("unplanned exercise metadata stays readable locally but only target fields upload", async (t) => {
  const f = await setup(t);
  await f.start();
  await f.store.command("u", "workout", cmd(1, "start"));
  const e = {
    id: "extra",
    exercise_id: "bench",
    sets: 1,
    reps: 5,
    rest_seconds: 60,
    notes: "",
    name: "Bench",
    measurements: ["reps", "kg"],
  };
  await f.store.command(
    "u",
    "workout",
    cmd(2, "add_exercise", { exercise: e }),
  );
  const payload = JSON.parse((await f.store.jobs("u"))[2].payload);
  assert.equal(payload.exercise.name, undefined);
  assert.equal(payload.exercise.measurements, undefined);
  assert.equal(
    (await f.store.workout("u", "workout")).actual.added[0].name,
    "Bench",
  );
});
test("wellness and goal are immediate and receipts stay visible when next pull fails", async (t) => {
  const f = await setup(t);
  await f.store.queueEntry("u", "water", "/coaching/wellness", {
    id: "water",
    kind: "water",
    amount: 250,
    occurred_at: "2026-11-07T12:00:00Z",
  });
  await f.store.queueEntry("u", "goal", "/coaching/wellness/goal", {
    water_goal_ml: 1800,
  });
  let view = await f.store.overview("u");
  assert.equal(view.water_goal_ml, 1800);
  assert.equal(view.wellness[0].content.amount, 250);
  for (const j of await f.store.jobs("u"))
    await f.store.acknowledge("u", j, { id: j.id });
  view = await f.reopen().overview("u");
  assert.equal(view.water_goal_ml, 1800);
  assert.equal(view.wellness.length, 1);
  assert.equal(view.wellness[0].sync_state, undefined);
});
test("facility workout requires active membership in cached identity", async (t) => {
  const f = await setup(t);
  f.plan.tenant_id = "club";
  await f.store.saveOverview("u", f.overview);
  await assert.rejects(f.start(), /üyeliğini/);
  assert.equal((await f.store.jobs("u")).length, 0);
});
test('offline active duration excludes pauses and preserves occurrence time on replay',async t=>{const f=await setup(t);await f.start();await f.store.command('u','workout',{...cmd(1,'start'),occurred_at:'2026-11-07T10:00:00Z'});await f.store.command('u','workout',{...cmd(2,'pause'),occurred_at:'2026-11-07T10:05:00Z'});await f.store.command('u','workout',{...cmd(3,'resume'),occurred_at:'2026-11-07T10:15:00Z'});const w=await f.store.command('u','workout',{...cmd(4,'finish',{partial:true}),occurred_at:'2026-11-07T10:20:00Z'});assert.equal(w.actual.active_seconds,600);assert.equal(w.actual.started_at,'2026-11-07T10:00:00Z');});
test('exercise performance separates movement IDs and missing weight while using actual local date',()=>{const {exercisePerformance}=load('coaching-performance');const w={snapshot:{exercises:[{id:'a',exercise_id:'bench',name:'Bench'},{id:'b',exercise_id:'plank',name:'Plank'}]},actual:{added:[],sets:[{exercise_key:'a',status:'completed',reps:10,kg:40,occurred_at:'2026-11-07T22:30:00Z'},{exercise_key:'a',status:'completed',reps:8,kg:null,occurred_at:'2026-11-07T22:31:00Z'},{exercise_key:'b',status:'completed',seconds:30,occurred_at:'2026-11-07T22:32:00Z'}]}};const data=exercisePerformance([w]);const bench=data.find(e=>e.id==='bench').days[0],plank=data.find(e=>e.id==='plank').days[0];assert.equal(bench.date,'2026-11-08');assert.equal(bench.volume,400);assert.equal(bench.reps,18);assert.equal(plank.volume,null);assert.equal(plank.seconds,30);assert.equal(plank.reps,null);});

test('account timezone survives queue restart, stale pull and acknowledgement', async t => {
  const f = await setup(t);
  await f.store.queueEntry('u', 'timezone-change', '/coaching/preferences', {timezone:'America/New_York'});
  const restarted = createCoachingStore(f.db);
  assert.equal((await restarted.overview('u')).timezone, 'America/New_York');
  const jobs = await restarted.jobs('u');
  await restarted.acknowledge('u', jobs.find(j => j.id === 'timezone-change'), {timezone:'America/New_York'});
  assert.equal((await restarted.overview('u')).timezone, 'America/New_York');
});

test('calendar days use account timezone at midnight and daylight-saving boundaries', () => {
  const {zonedDate} = load('coaching-performance');
  assert.equal(zonedDate(new Date('2026-11-02T00:30:00Z'), 'America/New_York'), '2026-11-01');
  assert.equal(zonedDate(new Date('2026-03-08T07:30:00Z'), 'America/New_York'), '2026-03-08');
  assert.equal(zonedDate(new Date('2026-11-01T22:30:00Z'), 'Europe/Istanbul'), '2026-11-02');
});

test('coach and facility access require staff roles, not membership or platform status', () => {
  const {canOpenCoachArea, canOpenManagement, isCoach} = load('console-access');
  const member = {account:{is_platform_admin:false},staff:[],memberships:[{status:'active'}]};
  assert.equal(canOpenCoachArea(member),false);
  assert.equal(canOpenManagement(member),false);
  assert.equal(canOpenCoachArea(undefined),false);
  for (const role of ['coach','admin','owner']) {
    const identity = {...member,staff:[{role,status:'active',tenant_status:'active'}]};
    assert.equal(canOpenCoachArea(identity),role !== 'admin');
    assert.equal(canOpenManagement(identity),role !== 'coach');
    assert.equal(isCoach(identity),role === 'coach');
    assert.equal(canOpenCoachArea({...identity,staff:[{role,status:'suspended'}]}),false);
    assert.equal(canOpenCoachArea({...identity,staff:[{role,status:'active',tenant_status:'suspended'}]}),false);
  }
  const platform = {...member,account:{is_platform_admin:true}};
  assert.equal(canOpenManagement(platform),true);
  assert.equal(canOpenCoachArea(platform),false);
});

test('visual workout progress counts distinct completed target slots, not skipped or extra sets', async t => {
  const f = await setup(t);
  const workout = await f.start();
  const {workoutProgress} = load('athlete-presentation');
  const entry = {id:'s1',exercise_key:'exercise',set_number:1,status:'completed',occurred_at:'2026-11-08T12:00:00Z'};
  workout.actual.sets = [entry,{...entry,id:'duplicate'},{...entry,id:'skip',set_number:2,status:'skipped'},{...entry,id:'extra',set_number:3}];
  const result = workoutProgress(workout);
  assert.equal(result.completed,1);
  assert.equal(result.total,2);
  assert.equal(result.ratio,.5);
  assert.equal(result.exercises,0);
});

test('dashboard selects an unfinished future session and does not reuse terminal or rejected active sessions', async t => {
  const f = await setup(t);
  const workout = await f.start();
  const {nextWorkout} = load('athlete-presentation');
  const data = {...f.overview, workouts:[{...workout,state:'completed'}]};
  assert.equal(nextWorkout(data,'2026-11-08').next,undefined);
  data.workouts = [{...workout,state:'in_progress',sync_state:'rejected'}];
  assert.equal(nextWorkout(data,'2026-11-08').active,undefined);
  data.workouts = [{...workout,state:'paused',sync_state:'pending'}];
  assert.equal(nextWorkout(data,'2026-11-08').active.id,workout.id);
});

test('wellness tiles respect account date, preserve unknown mood, and exclude coffee from water', async t => {
  const f = await setup(t);
  const {wellnessToday} = load('athlete-presentation');
  const data = {...f.overview,timezone:'America/New_York',water_goal_ml:1800,wellness:[
    {id:'water',kind:'water',occurred_at:'2026-11-09T02:00:00Z',content:{amount:250}},
    {id:'coffee',kind:'coffee',occurred_at:'2026-11-08T14:00:00Z',content:{amount:150}},
    {id:'bad',kind:'water',occurred_at:'2026-11-08T14:00:00Z',sync_state:'rejected',content:{amount:999}},
  ]};
  const result=wellnessToday(data,'2026-11-08');
  assert.equal(result.waterMl,250);
  assert.equal(result.coffeeCount,1);
  assert.equal(result.waterGoal,1800);
  assert.equal(result.mood,null);
});

test('dashboard elapsed time includes only the running segment and tolerates clock rollback', async t => {
  const f=await setup(t);const w=await f.start();const {workoutElapsedSeconds}=load('athlete-presentation');
  w.actual.active_seconds=120;w.actual.active_since='2026-11-08T12:00:00Z';w.state='in_progress';
  assert.equal(workoutElapsedSeconds(w,Date.parse('2026-11-08T12:05:00Z')),420);
  w.state='paused';assert.equal(workoutElapsedSeconds(w,Date.parse('2026-11-08T12:05:00Z')),120);
  w.state='in_progress';assert.equal(workoutElapsedSeconds(w,Date.parse('2026-11-08T11:00:00Z')),120);
});

test('set entry fills missing slots and keeps edited skipped values', async t => {
  const f=await setup(t);const w=await f.start();const {setDraft}=load('workout-experience');const target=w.snapshot.exercises[0];
  assert.equal(setDraft(w,target).values.kg,'40');
  w.actual.sets=[{id:'last',exercise_key:target.id,set_number:2,status:'completed',reps:8,kg:45,occurred_at:'2026-11-08T10:00:00Z',method:'manual',notes:''}];
  let draft=setDraft(w,target);assert.equal(draft.number,1);assert.equal(draft.values.kg,'45');assert.equal(draft.values.reps,'8');
  const skipped={id:'skip',exercise_key:target.id,set_number:1,status:'skipped',reps:null,kg:null,method:'nfc',notes:'',occurred_at:'2026-11-08T09:00:00Z'};
  w.actual.sets.push(skipped);assert.equal(setDraft(w,target).number,3);draft=setDraft(w,target,skipped);assert.equal(draft.number,1);assert.equal(draft.values.reps,'');
});
test('weekly schedule preserves missed history and scopes plans to the member',async t=>{
  const f=await setup(t);const overview=structuredClone(f.overview);const {memberSchedule}=load('workout-experience');
  overview.plans[0].content.days[0].dates=['2026-11-02','2026-11-04','2026-11-06'];
  const before=JSON.stringify(overview);let schedule=memberSchedule(overview,'2026-11-08');assert.equal(schedule.rest,true);assert.equal(schedule.total,3);assert.equal(schedule.missed.date,'2026-11-06');assert.equal(JSON.stringify(overview),before);
  overview.plans.push({...structuredClone(overview.plans[0]),id:'other',athlete_id:'other-account'});schedule=memberSchedule(overview,'2026-11-08');assert.equal(schedule.total,3);
});
test('trend uses actual finish date and timezone and excludes rejected entries',async t=>{
  const f=await setup(t);const base=await f.start();const {activityTrend}=load('workout-experience');
  const w={...base,state:'partial',scheduled_date:'2026-10-01',actual:{...base.actual,finished_at:'2026-11-07T22:30:00Z',active_seconds:120,sets:[{status:'completed',occurred_at:'2026-11-07T22:29:00Z'}]}};
  const trend=activityTrend([w,{...w,id:'rejected',sync_state:'rejected'}],7,'2026-11-08','Europe/Istanbul');assert.equal(trend.count,1);assert.equal(trend.bins.at(-1).count,1);assert.equal(trend.activeDays,1);assert.equal(trend.seconds,120);assert.equal(trend.sets,1);
  assert.equal(activityTrend([w],7,'2026-11-07','Europe/Istanbul').count,0);
});
test('result highlights compare matching exercises to earlier real sets only',async t=>{
  const f=await setup(t);const current=await f.start();const {workoutHighlights}=load('workout-experience');const target=current.snapshot.exercises[0];
  current.actual.started_at='2026-11-08T10:00:00Z';current.actual.sets=[{exercise_key:target.id,status:'completed',kg:50,occurred_at:'2026-11-08T10:01:00Z'}];
  const previous=structuredClone(current);previous.id='older';previous.actual.sets[0].kg=40;previous.actual.sets[0].occurred_at='2026-11-07T10:00:00Z';
  const future=structuredClone(previous);future.id='future';future.actual.sets[0].kg=100;future.actual.sets[0].occurred_at='2026-11-09T10:00:00Z';
  assert.equal(workoutHighlights(current,[previous,future])[0].delta,10);previous.sync_state='rejected';assert.equal(workoutHighlights(current,[previous]).length,0);
});
test('extra movements count as actual activity without changing planned progress or the saved plan',async t=>{
  const f=await setup(t);let w=await f.start();w=await f.store.command('u',w.id,cmd(1,'start'));const before=JSON.stringify(f.plan);
  w=await f.store.command('u',w.id,cmd(2,'add_exercise',{exercise:{id:'extra',exercise_id:'bench',name:'Extra',measurements:['reps','kg'],sets:3,reps:8,kg:30,rest_seconds:60,notes:''}}));
  w=await f.store.command('u',w.id,set(3,{id:'extra-set',exercise_key:'extra',set_number:1}));
  const {workoutProgress}=load('athlete-presentation');const {activityTrend}=load('workout-experience');const progress=workoutProgress(w);assert.equal(progress.total,2);assert.equal(progress.completed,0);assert.equal(progress.exerciseCount,1);
  assert.equal(activityTrend([w],7,'2026-11-07','Europe/Istanbul').sets,1);assert.equal(JSON.stringify(f.plan),before);
});

test('long-period trend labels include the actual last date and never extend past today', async t => {
  const f = await setup(t);
  const base = await f.start();
  const {activityTrend} = load('workout-experience');
  const workout = {...base,state:'partial',actual:{...base.actual,finished_at:'2026-11-08T08:00:00Z'}};
  for (const range of [7,30,90]) {
    const trend = activityTrend([workout], range, '2026-11-08', 'Europe/Istanbul');
    const bucket = trend.bins.find(b => b.count === 1);
    assert.ok(bucket.date <= '2026-11-08');
    assert.equal(bucket.end_date, '2026-11-08');
    assert.equal(trend.count, 1);
    for (const b of trend.bins) {assert.ok(b.end_date <= '2026-11-08');assert.ok(b.end_date >= b.date);}
    if(range === 7) assert.equal(bucket.date,bucket.end_date);
  }
});

test("member timeline uses actual local date, retains distinct free records and excludes rejected or empty scheduled sessions", () => {
  const { memberDayTimeline, sessionProgressLabel } = load("member-experience");
  const workout = {
    id: "session", state: "partial", scheduled_date: "2026-11-07", sync_state: "pending",
    snapshot: { exercises: [{id:"target",sets:2}] },
    actual: { finished_at:"2026-11-07T22:10:00Z", sets:[
      { exercise_key:"target",set_number:1,status:"completed",occurred_at:"2026-11-07T22:00:00Z" },
      { exercise_key:"extra",set_number:1,status:"completed",occurred_at:"2026-11-07T22:01:00Z" }
    ] }
  };
  const record = {id:"free",createdat:"2026-11-07T22:20:00Z",quantity:10,unit:"repetition"};
  const rows = memberDayTimeline([workout,{...workout,id:"rejected",sync_state:"rejected"},{...workout,id:"empty",actual:{sets:[]}}], [record,{...record,id:"other-unit",unit:"seconds"},{...record,id:"denied",sync_state:"rejected"}], "2026-11-08", "Europe/Istanbul");
  assert.deepEqual(new Set(rows.map(r=>r.id)),new Set(["workout:session","free","other-unit"]));
  assert.equal(rows.at(-1).kind,"workout");
  assert.equal(sessionProgressLabel(workout),"1/2 hedef set");
  assert.equal(memberDayTimeline([workout],[record],"2026-11-07","Europe/Istanbul").length,0);
});

test("card matches only today's own scheduled targets and never reopens terminal or rejected sessions", () => {
  const { plannedCardMatches } = load("member-experience");
  const plan = {id:"own",athlete_id:"self",content:{days:[{id:"day",dates:["2026-11-08"],exercises:[{id:"squat",exercise_id:"squat"},{id:"plank",exercise_id:"plank"}]}]}};
  const data = {account_id:"self",plans:[plan,{...plan,id:"someone",athlete_id:"other"},{...plan,id:"template",athlete_id:null}],workouts:[]};
  assert.equal(plannedCardMatches(data,["squat"],"2026-11-08").length,1);
  assert.equal(plannedCardMatches(data,["squat"],"2026-11-09").length,0);
  assert.equal(plannedCardMatches(data,["unknown"],"2026-11-08").length,0);
  for(const state of ["completed","partial","skipped","cancelled","paused","in_progress"]){
    assert.equal(plannedCardMatches({...data,workouts:[{plan_id:"own",session_key:"day",scheduled_date:"2026-11-08",state}]},["squat"],"2026-11-08").length,0);
  }
  assert.equal(plannedCardMatches({...data,workouts:[{plan_id:"own",session_key:"day",scheduled_date:"2026-11-08",state:"not_started"}]},["squat"],"2026-11-08").length,1);
  assert.equal(plannedCardMatches({...data,workouts:[{plan_id:"own",session_key:"day",scheduled_date:"2026-11-08",state:"not_started",sync_state:"rejected"}]},["squat"],"2026-11-08").length,0);
});

 test("dashboard and sync-details cache coexist and invalidate together without sharing result shapes", async () => {
  const { QueryClient } = require("@tanstack/react-query");
  const { coachingJobKeys } = load("coaching-query-keys");
  const client = new QueryClient();
  const list = coachingJobKeys.list("member"), details = coachingJobKeys.details("member");
  client.setQueryData(list, [{ id: "queued", state: "pending" }]);
  client.setQueryData(details, { jobs: [], archives: [], last: null, error: null });
  assert.equal(client.getQueryData(list).length,1);
  assert.equal(client.getQueryData(details).jobs.length,0);
  await client.invalidateQueries({queryKey:["coaching-jobs","member"]});
  assert.equal(client.getQueryState(list).isInvalidated,true);
  assert.equal(client.getQueryState(details).isInvalidated,true);
  assert.equal(client.getQueryData(coachingJobKeys.list("other")),undefined);
  client.clear();
});

function sessionCase() {
  const day = { id:'sun', name:'Paz', dates:['2026-11-08','2026-11-15','2026-11-22','2026-11-29'], exercises:[{id:'squat',exercise_id:'lib-bodyweight-squat',name:'Squat',sets:4},{id:'push',exercise_id:'lib-knee-push-up',name:'Şınav',sets:4}] };
  const plan = {id:'plan',owner_id:'coach',athlete_id:'self',tenant_id:null,version:1,content:{name:'Plan',timezone:'Europe/Istanbul',days:[day]}};
  const workout = {id:'w',athlete_id:'self',plan_id:'plan',session_key:'sun',scheduled_date:'2026-11-08',state:'partial',snapshot:structuredClone(day),actual:{finished_at:'2026-11-08T08:30:00Z',started_at:'2026-11-08T08:00:00Z',added:[],sets:[1,2].map(n=>({id:'set'+n,exercise_key:'squat',set_number:n,reps:8,status:'completed',occurred_at:'2026-11-08T08:10:00Z'}))}};
  const data = {account_id:'self',athlete_id:'self',timezone:'Europe/Istanbul',plans:[plan],workouts:[workout]};
  return {day,plan,workout,data};
}
const localNoon = new Date('2026-11-08T09:00:00Z');
test('today keeps partial actual 2/8 above the future plan without changing records',()=>{
 const {todaySessions}=load('session-presentation'); const f=sessionCase();const before=JSON.stringify(f.data);
 const view=todaySessions(f.data,localNoon);
 assert.equal(view.primary.workout.id,'w');assert.equal(view.upcoming.date,'2026-11-15');assert.equal(view.results.length,1);
 assert.equal(load('athlete-presentation').workoutProgress(view.primary.workout).completed,2);
 assert.equal(JSON.stringify(f.data),before);
});
test('finished session does not imply achieved target sets or a completed multi-week plan',()=>{
 const {todaySessions,targetSetsAchieved,planSessionProgress}=load('session-presentation');const f=sessionCase();f.workout.state='completed';
 assert.equal(todaySessions(f.data,localNoon).primary.workout.id,'w');assert.equal(targetSetsAchieved(f.workout),false);
 assert.equal(load('workout-experience').memberSchedule(f.data,'2026-11-08').allDone,false);
 f.workout.actual.sets=['squat','push'].flatMap(key=>[1,2,3,4].map(n=>({exercise_key:key,set_number:n,status:'completed',occurred_at:'2026-11-08T08:10:00Z'})));
 assert.equal(targetSetsAchieved(f.workout),true);
 assert.deepEqual(planSessionProgress(f.plan,f.data.workouts),{achieved:1,total:4,complete:false});
});
test('future paused sessions never replace today completed or partial results',()=>{
 const {todaySessions}=load('session-presentation'); const f=sessionCase();
 f.data.workouts.unshift({...structuredClone(f.workout),id:'future',scheduled_date:'2026-11-15',state:'paused',actual:{sets:[],added:[]}});
 for(const state of ['partial','completed']){f.workout.state=state;assert.equal(todaySessions(f.data,localNoon).primary.workout.id,'w');}
});
test('today execution from a previous planned day preserves both dates and actual immutable snapshot',()=>{
 const {todaySessions,sessionContext}=load('session-presentation');const f=sessionCase();f.workout.scheduled_date='2026-11-07';
 f.plan.content.days[0].exercises[0].sets=9;f.plan.content.days[0].name='Yeni gelecek plan';
 const view=todaySessions(f.data,localNoon);assert.equal(view.primary.workout.id,'w');assert.equal(view.primary.day.exercises[0].sets,4);
 assert.match(sessionContext(view.primary,view.today,view.timezone),/Bugün yapılan · 8 Kasım · Planlanan: 7 Kasım/);
 assert.equal(load('athlete-presentation').workoutProgress(view.primary.workout).total,8);
});
test('tomorrow planned session executed today is today result and is not offered again as upcoming',()=>{
 const {todaySessions,sessionContext}=load('session-presentation');const f=sessionCase();f.day.dates=['2026-11-09','2026-11-15'];f.workout.scheduled_date='2026-11-09';
 const view=todaySessions(f.data,localNoon);assert.equal(view.primary.workout.id,'w');assert.equal(view.upcoming.date,'2026-11-15');
 assert.match(sessionContext(view.primary,view.today,view.timezone),/Planlanan: 9 Kasım/);
});
test('yesterday actual result attached to today planned date is not described as executed today',()=>{
 const {todaySessions,sessionContext}=load('session-presentation');const f=sessionCase();f.workout.actual.finished_at='2026-11-07T12:00:00Z';
 const view=todaySessions(f.data,localNoon);assert.equal(view.results.length,0);
 assert.match(sessionContext(view.primary,view.today,view.timezone),/^Yapılan · 7 Kasım · Planlanan: 8 Kasım/);
});
test('account timezone and midnight control today; finish date remains separate from planned date',()=>{
 const {todaySessions,actualSessionDate}=load('session-presentation');const f=sessionCase();f.workout.actual.finished_at='2026-11-07T22:30:00Z';const now=new Date('2026-11-07T22:45:00Z');
 assert.equal(todaySessions(f.data,now).today,'2026-11-08');assert.equal(actualSessionDate(f.workout,'Europe/Istanbul'),'2026-11-08');
 f.data.timezone='America/Los_Angeles';assert.equal(todaySessions(f.data,now).today,'2026-11-07');assert.equal(todaySessions(f.data,now).results.length,1);
 assert.equal(actualSessionDate(f.workout,'Pacific/Auckland'),'2026-11-08');
});
test('DST repeated hour and account zone differing from device do not move the calendar day',()=>{
 const {actualSessionDate,calendarLabel,weekdayLabel}=load('session-presentation');const f=sessionCase();
 for(const at of ['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z']){f.workout.actual.finished_at=at;assert.equal(actualSessionDate(f.workout,'America/New_York'),'2026-11-01');}
 assert.equal(weekdayLabel('2026-11-08'),'Pazar');assert.equal(calendarLabel('2026-11-08'),'8 Kasım');
});
test('missed is past unstarted only; partial, skipped, active and future have distinct states',()=>{
 const {todaySessions,sessionPeriodSummary}=load('session-presentation');const f=sessionCase();
 const past={...structuredClone(f.day),id:'past',dates:['2026-11-06','2026-11-07']};f.plan.content.days.push(past);
 const view=todaySessions(f.data,localNoon);assert.deepEqual(view.missed.map(e=>e.date),['2026-11-06','2026-11-07']);
 assert.deepEqual(sessionPeriodSummary(f.data,'2026-11-02','2026-11-08','2026-11-08'),{completed:0,partial:1,missed:2,skipped:0});
 for(const state of ['paused','in_progress','partial','completed','skipped','cancelled']) {
  const data=structuredClone(f.data);data.workouts.push({...structuredClone(f.workout),id:'past-record',session_key:'past',scheduled_date:'2026-11-07',state});
  assert.equal(todaySessions(data,localNoon).missed.length,1);
 }
});
test('multiple results and an older paused session remain visible alongside today result',()=>{
 const {todaySessions}=load('session-presentation');const f=sessionCase();
 f.data.workouts.push({...structuredClone(f.workout),id:'second',session_key:'second',state:'completed',actual:{...f.workout.actual,finished_at:'2026-11-08T08:45:00Z'}});
 f.data.workouts.push({...structuredClone(f.workout),id:'older',scheduled_date:'2026-11-06',state:'paused',actual:{sets:[],started_at:'2026-11-06T08:00:00Z'}});
 const view=todaySessions(f.data,localNoon);assert.equal(view.results.length,2);assert.equal(view.primary.workout.id,'second');assert.equal(view.previousActive.workout.id,'older');
});
test('session names expand weekdays and infer workout type without mutating historical names',()=>{
 const {sessionDisplayName}=load('session-presentation');const f=sessionCase();
 assert.equal(sessionDisplayName(f.day,'2026-11-08'),'Pazar · Tüm Vücut');assert.equal(f.day.name,'Paz');
 assert.equal(sessionDisplayName({...f.day,name:'Göğüs ve Triceps'},'2026-11-08'),'Pazar · Göğüs ve Triceps');
 assert.equal(sessionDisplayName({...f.day,name:'Pazar · Tüm Vücut'},'2026-11-08'),'Pazar · Tüm Vücut');
 assert.equal(sessionDisplayName({...f.day,exercises:[]},'2026-11-08'),'Pazar · Antrenman');
});
test('rejected and other athlete sessions do not become today approved results or missed substitutes',()=>{
 const {todaySessions}=load('session-presentation');const f=sessionCase();f.workout.sync_state='rejected';
 f.data.workouts.push({...structuredClone(f.workout),id:'other',athlete_id:'someone',sync_state:'synced'});
 const view=todaySessions(f.data,localNoon);assert.equal(view.results.length,0);assert.equal(view.primary.workout.sync_state,'rejected');
});
test('missing finish timestamp never falls back to an invented execution date from planned date',()=>{
 const {actualSessionDate,sessionContext}=load('session-presentation');const f=sessionCase();f.workout.actual={sets:[],added:[]};
 assert.equal(actualSessionDate(f.workout,'Europe/Istanbul'),null);
 assert.match(sessionContext({day:f.day,date:'2026-11-08',workout:f.workout},'2026-11-08'),/Gerçekleşme tarihi kayıtlı değil/);
});

test('a new local day moves prior results to history without converting partial sessions to missed',()=>{
 const {todaySessions}=load('session-presentation');const f=sessionCase();const before=JSON.stringify(f.data);
 const today=todaySessions(f.data,new Date('2026-11-08T20:59:00Z'));assert.equal(today.primary.workout.id,'w');
 const tomorrow=todaySessions(f.data,new Date('2026-11-08T21:01:00Z'));assert.equal(tomorrow.today,'2026-11-09');assert.equal(tomorrow.results.length,0);assert.equal(tomorrow.missed.length,0);assert.equal(tomorrow.upcoming.date,'2026-11-15');assert.equal(JSON.stringify(f.data),before);
});
test('achieving every target in one session still keeps future weeks separate from today result',()=>{
 const {todaySessions,planSessionProgress}=load('session-presentation');const f=sessionCase();f.workout.state='completed';
 f.workout.actual.sets=['squat','push'].flatMap(key=>[1,2,3,4].map(n=>({exercise_key:key,set_number:n,status:'completed',occurred_at:'2026-11-08T08:10:00Z'})));
 const view=todaySessions(f.data,localNoon);assert.equal(view.primary.workout.id,'w');assert.equal(view.upcoming.date,'2026-11-15');assert.equal(planSessionProgress(f.plan,f.data.workouts).complete,false);
});
test('mixed-offset execution timestamps are sorted by time, not timestamp spelling',()=>{
 const {memberDayTimeline}=load('member-experience');const f=sessionCase();delete f.workout.actual.finished_at;delete f.workout.actual.started_at;
 f.workout.actual.sets[0].occurred_at='2026-11-08T10:00:00+03:00';f.workout.actual.sets[1].occurred_at='2026-11-08T08:00:00Z';
 assert.equal(memberDayTimeline([f.workout],[],'2026-11-08','Europe/Istanbul')[0].at,'2026-11-08T08:00:00Z');
});

test('goal card contexts identify upcoming, actual today and differing planned dates explicitly',()=>{
 const {sessionGoalContext}=load('session-presentation');const f=sessionCase();
 const entry={day:f.day,date:'2026-11-08',workout:f.workout};
 assert.deepEqual(sessionGoalContext(entry,'2026-11-08','Europe/Istanbul'),{label:'Bugünün gerçekleşen sonucu',date:'2026-11-08',detail:null});
 assert.deepEqual(sessionGoalContext({day:f.day,date:'2026-11-15'},'2026-11-08','Europe/Istanbul'),{label:'Sıradaki antrenman',date:'2026-11-15',detail:null});
 const older=sessionGoalContext({...entry,date:'2026-11-07'},'2026-11-08','Europe/Istanbul');assert.equal(older.date,'2026-11-08');assert.match(older.detail,/Planlanan: 7 Kasım/);
 f.workout.actual.finished_at='2026-11-07T12:00:00Z';const early=sessionGoalContext(entry,'2026-11-08','Europe/Istanbul');assert.equal(early.label,'Bugün planlanan seans');assert.equal(early.date,'2026-11-08');assert.match(early.detail,/Yapılan · 7 Kasım/);
});

test('Android keyboard viewport caps once using screen geometry instead of adding a second resize',()=>{
 const {keyboardViewportLimit}=load('keyboard-frame');
 // Samsung S22: screen 780dp, keyboard 294dp, system navigation 48dp, measured content top 101dp.
 const limit=keyboardViewportLimit(780,294,48,101);assert.equal(limit,337);
 assert.equal(Math.min(613,limit),337);assert.equal(Math.min(300,limit),300); // A native resized parent is never reduced again.
 assert.equal(keyboardViewportLimit(780,0,48,101),undefined);
 assert.equal(keyboardViewportLimit(780,294,48,500),0);
 assert.equal(keyboardViewportLimit(NaN,294,48,101),undefined);
});

test('canonical club roles enforce per-club navigation and platform has no implicit club authority', () => {
  const {canOpenCoachArea, canOpenManagement} = load('console-access');
  const identity={account:{is_platform_admin:true},staff:[
    {tenant_id:'A',role:'CLUB_MANAGER',status:'active',tenant_status:'active'},
    {tenant_id:'B',role:'TRAINER',status:'active',tenant_status:'active'},
    {tenant_id:'C',role:'CLUB_ADMIN',status:'suspended',tenant_status:'active'},
    {tenant_id:'D',role:'CLUB_ADMIN',status:'active',tenant_status:'suspended'},
  ]};
  assert.equal(canOpenManagement(identity,'A'),true);
  assert.equal(canOpenManagement(identity,'B'),false);
  assert.equal(canOpenCoachArea(identity,'B'),true);
  for(const club of ['C','D','unknown']) {
    assert.equal(canOpenManagement(identity,club),false);
    assert.equal(canOpenCoachArea(identity,club),false);
  }
  assert.equal(canOpenManagement({account:{is_platform_admin:true},staff:[]},'A'),false);
  assert.equal(canOpenCoachArea({account:{is_platform_admin:true},staff:[]},'A'),false);
});

test('web and native role capabilities match the five-role contract including legacy aliases', () => {
  const file=path.resolve(__dirname,'../../../web/club-roles.ts');
  const webModule=new Module(file,module);
  webModule._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);
  for(const helpers of [load('club-roles'),webModule.exports]) {
    for(const [role,operator,trainer,admin] of [
      ['CLUB_ADMIN',true,true,true],['CLUB_MANAGER',true,false,false],['TRAINER',false,true,false],
      ['CLUB_MEMBER',false,false,false],['PLATFORM_ADMIN',false,false,false],
      ['owner',true,true,true],['admin',true,false,false],['coach',false,true,false],['unknown',false,false,false],
    ]) {
      assert.equal(helpers.isClubOperator(role),operator,role);
      assert.equal(helpers.isClubTrainer(role),trainer,role);
      assert.equal(helpers.isClubAdmin(role),admin,role);
    }
  }
});

test('cancelled future assignment stays in sync history but is absent from actionable schedules',async(t)=>{
 const f=await setup(t);const data=structuredClone(f.overview);data.plans[0].content.planning_status='archived';
 const before=JSON.stringify(data);
 assert.equal(load('athlete-presentation').nextWorkout(data,'2026-11-08').next,undefined);
 assert.equal(load('workout-experience').memberSchedule(data,'2026-11-08').days.flatMap(d=>d.sessions??[]).length,0);
 const ids=data.plans[0].content.days[0].exercises.map(e=>e.exercise_id);
 assert.equal(load('member-experience').plannedCardMatches(data,ids,'2026-11-08').length,0);
 assert.equal(JSON.stringify(data),before);
});
