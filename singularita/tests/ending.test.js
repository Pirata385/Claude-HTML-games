import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseEnding, ENDINGS, recordsOf } from '../js/systems/ending.js';
import { startRun, endRun } from '../js/systems/run.js';
import { newProfile } from '../js/systems/save.js';

const fresh = () => { const p = newProfile({ name: 'Tess', classId: 'mage', slot: 0, seed: 7 }); p.level = 270; return p; };

test('the choice: Singularita remembers what you asked, and the world remembers you', () => {
  const p = fresh();
  const r = chooseEnding(p, 'mend');
  assert.equal(p.ending, 'mend');
  assert.deepEqual(p.endings, { mend: 1 });
  assert.ok(p.lore.includes('lore_mend') && r.lore === 'lore_mend');
  assert.equal(r.title, ENDINGS.mend.title);
  assert.ok(ENDINGS.mend.epilogue.length >= 2 && ENDINGS.end.epilogue.length >= 2, 'each ending has its own epilogue');
  // Facing it again, you may choose differently: both are remembered.
  chooseEnding(p, 'end');
  assert.equal(p.ending, 'end');
  assert.deepEqual(p.endings, { mend: 1, end: 1 });
  assert.throws(() => chooseEnding(p, 'shrug'));
});

test('records: deepest floor, fastest runs, endings and the cycle', () => {
  const p = fresh();
  p.playTime = 1000;
  startRun(p, 'dim_unmade', { zone: 'cave_9' });
  p.playTime = 1240;
  endRun(p, 'complete');
  startRun(p, 'dim_unmade', { zone: 'cave_9' });
  p.playTime = 1600;
  endRun(p, 'complete');
  startRun(p, 'dim_twins', { zone: 'island' });
  p.playTime = 1700;
  endRun(p, 'fail');
  assert.equal(p.dims.dim_unmade.bestTime, 240, 'the fastest clear is kept');
  assert.equal(p.dims.dim_twins.bestTime, undefined, 'a failed run is not a time');
  chooseEnding(p, 'end');
  const rec = recordsOf(p);
  assert.equal(rec.fastest.dim_unmade, 240);
  assert.deepEqual(rec.endings, { end: 1 });
  assert.equal(rec.cycle, 0);
});
