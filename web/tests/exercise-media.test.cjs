const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const filename = path.resolve(__dirname, '../../mobile/nfc-task-tracker/lib/exercise-media-presentation.ts');
const mod = new Module(filename, module);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, filename);
const {imageFrames, thumbnail, positionLabel} = mod.exports;
const bundle = require('../../backend/data/exercise_media.json');
test('thumbnail never substitutes for a position and static poses never become fake animation pairs', () => {
  const bench = {media: bundle['lib-bench-press']};
  assert.equal(thumbnail(bench).role, 'thumbnail');
  assert.deepEqual(imageFrames(bench).map(m => m.role), ['position_1', 'position_2']);
  const side = {media: bundle['lib-side-plank']};
  assert.equal(imageFrames(side).length, 1);
  assert.equal(positionLabel(imageFrames(side)[0], 0), 'Sabit duruş');
});
test('legacy images remain compatible; insecure URLs and animation files are not list thumbnails', () => {
  const legacy = {media: [{media_type:'image',url:'https://media.example/owned.webp'}, {media_type:'image',url:'http://bad.example/image.webp'}, {media_type:'animation',url:'https://media.example/move.gif'}]};
  assert.equal(imageFrames(legacy).length, 1);
  assert.equal(thumbnail(legacy).url, 'https://media.example/owned.webp');
  assert.equal(thumbnail({media:[]}), undefined);
  assert.deepEqual(imageFrames({}), []);
});
