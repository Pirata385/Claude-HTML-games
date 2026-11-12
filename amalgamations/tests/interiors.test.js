const test = require('node:test');
const assert = require('node:assert');
const AM = require('./load.js');

test('caves are connected and have loot', () => {
  for (let s = 1; s <= 40; s++) {
    const L = AM.genCave(s * 7919, 5);
    assert.ok(AM.interiorAllReachable(L), 'cave ' + s);
    assert.ok(L.chests.length >= 1 && L.spawns.length >= 3, 'cave content ' + s);
    assert.ok(L.cells[L.entrance.z * L.w + L.entrance.x] === 1);
  }
});

test('dungeons are connected, have a boss room and gate spawns', () => {
  for (let s = 1; s <= 40; s++) {
    const L = AM.genDungeon(s * 104729, 10);
    assert.ok(L.rooms.length >= 5, 'rooms ' + L.rooms.length);
    assert.ok(AM.interiorAllReachable(L), 'dungeon ' + s);
    assert.ok(L.boss && L.rooms[L.boss.room].boss);
    assert.ok(L.chests.some((c) => c.big));
    assert.ok(L.spawns.some((sp) => sp.gate), 'some spawns gate the boss door');
    assert.ok(Array.from(L.cells).includes(3), 'boss door exists');
  }
});
