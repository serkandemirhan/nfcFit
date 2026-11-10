const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  ts = require("typescript");
const file = path.resolve(__dirname, "../lib/trainer-planning.ts"),
  mod = new Module(file, module);
mod._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  file,
);
const {
  copyWeek,
  detachDay,
  dayDate,
  planningCoverage,
  assignmentImpact,
  recordedSetProgress,
  exerciseSearchText,
} = mod.exports;
const fixture = () => ({
  name: "Independent plan",
  goal: "Strength",
  difficulty: "beginner",
  weeks: 4,
  start_date: "2028-02-28",
  timezone: "Europe/Istanbul",
  rest_dates: ["2028-02-29"],
  days: [
    {
      id: "legacy",
      name: "Full body",
      dates: ["2028-02-28", "2028-03-06"],
      exercises: [
        {
          id: "target",
          exercise_id: "bench",
          sets: 4,
          reps: 12,
          rest_seconds: 60,
          notes: "",
        },
      ],
    },
  ],
});
test("editing a recurring legacy date detaches that week and preserves old targets", () => {
  const source = fixture(),
    before = structuredClone(source),
    result = detachDay(source, "legacy", "2028-03-06");
  result.day.exercises[0].reps = 8;
  assert.deepEqual(source, before);
  assert.equal(
    result.content.days.find((d) => d.id === "legacy").exercises[0].reps,
    12,
  );
  assert.deepEqual(result.day.dates, ["2028-03-06"]);
});
test("week copying replaces destination, shifts leap dates and creates independent IDs", () => {
  const source = fixture(),
    result = copyWeek(source, 0, 1);
  assert.equal(result.days.length, 2);
  assert.deepEqual(result.rest_dates, ["2028-02-29", "2028-03-07"]);
  assert.deepEqual(result.days[0].dates, ["2028-02-28"]);
  assert.deepEqual(result.days[1].dates, ["2028-03-06"]);
  assert.notEqual(
    result.days[0].exercises[0].id,
    result.days[1].exercises[0].id,
  );
  result.days[1].exercises[0].sets = 9;
  assert.equal(source.days[0].exercises[0].sets, 4);
});
test("copying a later week backwards drops destination rest markers without mutating source", () => {
  const source = fixture(),
    result = copyWeek(source, 1, 0);
  assert.deepEqual(result.rest_dates, []);
  assert.deepEqual(source.rest_dates, ["2028-02-29"]);
  assert.equal(dayDate("2028-02-28", 2), "2028-03-01");
});

test("publication review lists empty weeks and counts distinct unconfigured dates", () => {
  const content = fixture(),
    coverage = planningCoverage(content);
  assert.deepEqual(coverage.emptyWeeks, [3, 4]);
  assert.equal(coverage.unconfiguredDates.length, 25);
  assert.equal(coverage.weeks[0].trainingDays, 1);
  assert.equal(coverage.weeks[0].restDays, 1);
  assert.equal(coverage.weeks[0].unconfiguredDates.length, 5);
  assert.equal(coverage.weeks[0].unconfiguredDates[0], "2028-03-01");
  const multiple = {
    ...content,
    days: [...content.days, { ...content.days[0], id: "second-session" }],
  };
  assert.deepEqual(planningCoverage(multiple), coverage);
});
test("a deliberately configured recovery week is not mistaken for an empty week", () => {
  const content = fixture();
  content.rest_dates = Array.from({ length: 28 }, (_, i) =>
    dayDate(content.start_date, i),
  ).filter((dt) => !content.days[0].dates.includes(dt));
  const coverage = planningCoverage(content);
  assert.deepEqual(coverage.emptyWeeks, []);
  assert.deepEqual(coverage.unconfiguredDates, []);
  assert.equal(coverage.weeks[2].trainingDays, 0);
  assert.equal(coverage.weeks[2].restDays, 7);
});

test("assignment impact respects interval boundaries and excludes draft/archive plans", () => {
  const plan = { id: "a", content: { ...fixture(), weeks: 1 } };
  assert.equal(assignmentImpact([plan], "2028-03-05", 1)[0].overlaps, true);
  assert.equal(assignmentImpact([plan], "2028-03-06", 1)[0].overlaps, false);
  assert.equal(assignmentImpact([plan], "2028-02-21", 1)[0].overlaps, false);
  assert.equal(
    assignmentImpact(
      [{ ...plan, content: { ...plan.content, planning_status: "draft" } }],
      "2028-02-28",
      1,
    ).length,
    0,
  );
});
for (const completed of [4, 5])
  test(`recorded progress distinguishes ${completed}/4 without mutating history`, () => {
    const workout = {
      snapshot: { exercises: [{ id: "bench", sets: 4 }] },
      actual: {
        sets: Array.from({ length: completed }, (_, i) => ({
          id: String(i),
          exercise_key: "bench",
          status: "completed",
        })),
      },
    };
    workout.actual.sets.push({
      id: "skip",
      exercise_key: "bench",
      status: "skipped",
    });
    const before = JSON.stringify(workout);
    assert.deepEqual(recordedSetProgress(workout, "bench"), {
      planned: 4,
      completed,
      extra: Math.max(0, completed - 4),
      achieved: true,
    });
    assert.equal(JSON.stringify(workout), before);
  });
test("member-added exercises have no invented prescription", () => {
  const workout = {
    snapshot: { exercises: [] },
    actual: { sets: [{ exercise_key: "extra", status: "completed" }] },
  };
  assert.deepEqual(recordedSetProgress(workout, "extra"), {
    planned: 0,
    completed: 1,
    extra: 1,
    achieved: false,
  });
});

test("exercise search accepts Turkish accents and dotless i without changing library identity", () => {
  assert.equal(exerciseSearchText("Şınav"), exerciseSearchText("sinav"));
  assert.equal(
    exerciseSearchText("Eğimli BENCH"),
    exerciseSearchText("egimli bench"),
  );
});
