const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.resolve(__dirname, '../lib/starter-programs.ts');
const mod = new Module(file, module);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, file);
const {starterPrograms, starterContent} = mod.exports;
const catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../backend/data/exercise_catalog.json')));
let id = 0;
const uuid = () => `id-${++id}`;
test('starter schedules cross months/leap days, reference real exercises and use independent target IDs', () => {
  for (const preset of starterPrograms) {
    const content = starterContent(preset.id, '2028-02-28', 'Europe/Istanbul', uuid);
    assert.equal(content.days.length, 2);
    assert.equal(content.days[1].dates[0], '2028-03-02');
    const ids = content.days.flatMap(d => [d.id, ...d.exercises.map(e => e.id)]);
    assert.equal(new Set(ids).size, ids.length);
    for (const day of content.days) for (const target of day.exercises) {
      const exercise = catalog.find(e => e.id === target.exercise_id);
      assert.ok(exercise, target.exercise_id);
      assert.ok(target.reps == null || exercise.measurements.includes('reps'));
      assert.ok(target.seconds == null || exercise.measurements.includes('seconds'));
    }
    const second = starterContent(preset.id, '2028-02-28', 'Europe/Istanbul', uuid);
    second.days[0].exercises[0].sets = 99;
    assert.equal(content.days[0].exercises[0].sets, 2);
  }
});
test('invalid preset or date cannot generate a partial schedule', () => {
  assert.throws(() => starterContent('unknown', '2026-11-08', 'Europe/Istanbul', uuid));
  assert.throws(() => starterContent('core', '2026-02-30', 'Europe/Istanbul', uuid));
});
