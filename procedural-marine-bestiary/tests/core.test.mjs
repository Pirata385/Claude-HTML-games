// Unit tests for the pure game logic inside index.html (no DOM, no p5.js).
// Run from the repository root:
//   node --test procedural-marine-bestiary/tests/core.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(here, '..', 'index.html'), 'utf8');

// The game's inline script must run without a DOM and expose its pure logic on
// window.PMB. Loading it here proves the core does not touch the page at load time.
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const source of inlineScripts) vm.runInContext(source, sandbox, { filename: 'index.html' });
const PMB = sandbox.PMB;

// Values created inside the vm realm fail strict deepEqual prototype checks,
// so comparisons go through a JSON round trip.
const plain = (value) => JSON.parse(JSON.stringify(value));
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const CLASS_IDS = ['fish', 'cartilage', 'cetacean', 'crustacean', 'gastropod', 'asteriid', 'sponge', 'cnidarian'];

function genomeWith(classId, overrides, seed = 1) {
  const genome = PMB.randomGenome(classId, PMB.rng(seed));
  for (const [key, value] of Object.entries(overrides)) genome[PMB.GENE_INDEX[key]] = value;
  return genome;
}

function seededSave(count, classId = 'fish', now = 1_000_000) {
  const save = PMB.Save.createEmpty(now);
  const rand = PMB.rng(count * 31 + 7);
  const specimens = [];
  for (let i = 0; i < count; i++) {
    specimens.push(PMB.Save.recordCatch(save, classId, PMB.randomGenome(classId, rand), now + i));
  }
  return { save, specimens };
}

function assertFiniteEverywhere(value, where) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${where} is not finite: ${value}`);
  } else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) assertFiniteEverywhere(inner, `${where}.${key}`);
  }
}

describe('taxonomy', () => {
  it('lists the eight required classes with their specified names and ids', () => {
    assert.deepEqual(plain(PMB.CLASSES.map((c) => c.id)), CLASS_IDS);
    assert.deepEqual(plain(PMB.CLASSES.map((c) => c.name)), [
      'Vertebrate Fish (Osteichthyes)',
      'Cartilaginous Fish (Chondrichthyes)',
      'Cetaceans',
      'Crustaceans',
      'Gastropods',
      'Asteriidae (sea stars & related echinoderms)',
      'Porifera (sponges)',
      'Cnidarians',
    ]);
  });

  it('gives every class at least two subgroups, each with a common and a Latin name', () => {
    for (const c of PMB.CLASSES) {
      assert.ok(c.subgroups.length >= 2, `${c.name} has ${c.subgroups.length} subgroups`);
      for (const s of c.subgroups) assert.ok(s.name && s.latin, `${c.name}: subgroup ${s.id} is incomplete`);
    }
  });
});

describe('genome', () => {
  it('defines exactly 42 uniquely keyed genes, each in a known group', () => {
    assert.equal(PMB.GENES.length, 42);
    assert.equal(new Set(PMB.GENES.map((g) => g.key)).size, 42);
    const groups = new Set(['body', 'appendage', 'surface', 'color', 'identity', 'behavior']);
    for (const gene of PMB.GENES) assert.ok(groups.has(gene.group), `${gene.key} has group ${gene.group}`);
  });

  it('random genomes hold 42 valid genes for every class', () => {
    const rand = PMB.rng(7);
    for (const id of CLASS_IDS) {
      for (let i = 0; i < 50; i++) {
        const genome = PMB.randomGenome(id, rand);
        assert.equal(genome.length, 42);
        assert.equal(PMB.isValidGenome(genome), true);
      }
    }
  });

  it('the same seed reproduces the same genome', () => {
    assert.deepEqual(plain(PMB.randomGenome('fish', PMB.rng(42))), plain(PMB.randomGenome('fish', PMB.rng(42))));
  });

  it('different seeds produce different genome uids', () => {
    const a = PMB.genomeUid('fish', PMB.randomGenome('fish', PMB.rng(1)));
    const b = PMB.genomeUid('fish', PMB.randomGenome('fish', PMB.rng(2)));
    assert.notEqual(a, b);
  });

  it('isValidGenome rejects a wrong length, NaN and out-of-range genes', () => {
    const good = PMB.randomGenome('sponge', PMB.rng(3));
    assert.equal(PMB.isValidGenome(good), true);
    assert.equal(PMB.isValidGenome(good.slice(0, 41)), false);
    assert.equal(PMB.isValidGenome([...good.slice(0, 41), Number.NaN]), false);
    assert.equal(PMB.isValidGenome([...good.slice(0, 41), 1.2]), false);
  });

  it('changing a single gene changes the genome uid', () => {
    const genome = PMB.randomGenome('cnidarian', PMB.rng(9));
    const changed = genome.slice();
    changed[PMB.GENE_INDEX.shyness] = (genome[PMB.GENE_INDEX.shyness] + 0.5) % 1;
    assert.notEqual(PMB.genomeUid('cnidarian', genome), PMB.genomeUid('cnidarian', changed));
  });
});

describe('phenotype decoding', () => {
  it('is deterministic and never mutates the genome it reads', () => {
    const genome = PMB.randomGenome('cnidarian', PMB.rng(11));
    const before = plain(genome);
    const first = PMB.decode('cnidarian', genome);
    assert.deepEqual(plain(PMB.decode('cnidarian', genome)), plain(first));
    assert.deepEqual(plain(genome), before);
  });

  it('produces only finite numbers for every class', () => {
    const rand = PMB.rng(21);
    for (const id of CLASS_IDS) {
      for (let i = 0; i < 40; i++) assertFiniteEverywhere(PMB.decode(id, PMB.randomGenome(id, rand)), id);
    }
  });

  it('reports its own class and a subgroup that belongs to that class', () => {
    for (const c of PMB.CLASSES) {
      const p = PMB.decode(c.id, PMB.randomGenome(c.id, PMB.rng(5)));
      assert.equal(p.classId, c.id);
      assert.ok(c.subgroups.some((s) => s.id === p.subgroupId), `${c.name}: ${p.subgroupId}`);
    }
  });

  it('the lineage gene reaches every subgroup of each class', () => {
    for (const c of PMB.CLASSES) {
      const seen = new Set();
      for (let i = 0; i < 40; i++) seen.add(PMB.decode(c.id, genomeWith(c.id, { lineage: i / 40 })).subgroupId);
      assert.deepEqual(plain([...seen].sort()), plain(c.subgroups.map((s) => s.id).sort()), c.name);
    }
  });

  it('uses only the allowed motion styles, swim styles and rarity tiers', () => {
    const styles = ['pelagic', 'pulse', 'crawl', 'sessile', 'drift'];
    const swims = ['steady', 'bursty', 'hover', 'glide', 'undulate'];
    const tiers = PMB.RARITY_TIERS.map((t) => t.name);
    const rand = PMB.rng(77);
    for (const id of CLASS_IDS) {
      for (let i = 0; i < 60; i++) {
        const p = PMB.decode(id, PMB.randomGenome(id, rand));
        assert.ok(styles.includes(p.behavior.style), p.behavior.style);
        assert.ok(swims.includes(p.behavior.swim), p.behavior.swim);
        assert.ok(tiers.includes(p.rarity.tier), p.rarity.tier);
      }
    }
  });

  it('colors are integer RGB triples in the 0-255 range', () => {
    const rand = PMB.rng(31);
    for (const id of CLASS_IDS) {
      for (let i = 0; i < 20; i++) {
        const rgb = PMB.decode(id, PMB.randomGenome(id, rand)).palette.rgb;
        for (const key of Object.keys(rgb)) {
          assert.equal(rgb[key].length, 3, key);
          for (const channel of rgb[key]) assert.ok(Number.isInteger(channel) && channel >= 0 && channel <= 255, key);
        }
      }
    }
  });

  it('the bioluminescence gene drives the Bioluminescent special trait', () => {
    assert.ok(PMB.decode('fish', genomeWith('fish', { bioluminescence: 0.95 })).specials.includes('Bioluminescent'));
    assert.ok(!PMB.decode('fish', genomeWith('fish', { bioluminescence: 0.1 })).specials.includes('Bioluminescent'));
  });

  it('the shyness gene raises the decoded shyness', () => {
    const bold = PMB.decode('fish', genomeWith('fish', { shyness: 0.05 })).behavior.shyness;
    const shy = PMB.decode('fish', genomeWith('fish', { shyness: 0.95 })).behavior.shyness;
    assert.ok(shy > bold + 0.5, `bold ${bold}, shy ${shy}`);
  });

  it('the scale gene raises the decoded size within a class', () => {
    const small = PMB.decode('cetacean', genomeWith('cetacean', { scale: 0.05 })).sizeCm;
    const large = PMB.decode('cetacean', genomeWith('cetacean', { scale: 0.95 })).sizeCm;
    assert.ok(large > small * 2, `small ${small}, large ${large}`);
  });

  it('glowing species favor the midnight zone, pale ones the sunlit zone', () => {
    assert.equal(PMB.decode('fish', genomeWith('fish', { bioluminescence: 0.95 })).favoredZone, 'midnight');
    assert.equal(PMB.decode('fish', genomeWith('fish', { bioluminescence: 0.05, lightness: 0.9 })).favoredZone, 'sunlit');
  });
});

describe('diversity', () => {
  it('500 specimens per class have 500 distinct visual signatures', () => {
    for (const c of PMB.CLASSES) {
      const rand = PMB.rng(1000 + c.name.length);
      const signatures = new Set();
      for (let i = 0; i < 500; i++) {
        const p = PMB.decode(c.id, PMB.randomGenome(c.id, rand));
        signatures.add(JSON.stringify([p.form, p.palette.rgb, p.morph]));
      }
      assert.equal(signatures.size, 500, c.name);
    }
  });

  it('500 specimens per class have 500 distinct motion signatures', () => {
    for (const c of PMB.CLASSES) {
      const rand = PMB.rng(2000 + c.name.length);
      const signatures = new Set();
      for (let i = 0; i < 500; i++) {
        const p = PMB.decode(c.id, PMB.randomGenome(c.id, rand));
        signatures.add(JSON.stringify([p.behavior, p.motion]));
      }
      assert.equal(signatures.size, 500, c.name);
    }
  });

  it('2,000 specimens get distinct names once the naming registry is applied', () => {
    const rand = PMB.rng(99);
    const taken = new Set();
    const bases = new Set();
    for (let i = 0; i < 2000; i++) {
      const id = CLASS_IDS[i % CLASS_IDS.length];
      const base = PMB.decode(id, PMB.randomGenome(id, rand)).names.common;
      bases.add(base);
      taken.add(PMB.Naming.assignUnique(base, taken));
    }
    assert.equal(taken.size, 2000);
    assert.ok(bases.size > 1500, `only ${bases.size} distinct base names`);
  });
});

describe('rarity', () => {
  it('skews toward common and reaches every tier', () => {
    const rand = PMB.rng(5);
    const counts = Object.fromEntries(PMB.RARITY_TIERS.map((t) => [t.name, 0]));
    const total = 20000;
    for (let i = 0; i < total; i++) {
      const id = CLASS_IDS[i % CLASS_IDS.length];
      counts[PMB.decode(id, PMB.randomGenome(id, rand)).rarity.tier] += 1;
    }
    const share = (name) => counts[name] / total;
    for (const name of Object.keys(counts)) assert.ok(counts[name] > 0, `${name} never appears`);
    assert.ok(share('Common') > 0.45, `Common share ${share('Common')}`);
    assert.ok(share('Mythic') < 0.03, `Mythic share ${share('Mythic')}`);
    assert.ok(share('Common') > share('Uncommon'));
    assert.ok(share('Uncommon') > share('Rare'));
    assert.ok(share('Rare') > share('Exquisite'));
    assert.ok(share('Exquisite') > share('Mythic'));
  });
});

describe('names and flavor', () => {
  it('scientific designations read "Genus epithet" with Latin-style capitals', () => {
    const rand = PMB.rng(8);
    for (const id of CLASS_IDS) {
      for (let i = 0; i < 50; i++) {
        assert.match(PMB.decode(id, PMB.randomGenome(id, rand)).names.scientific, /^[A-Z][a-z]+ [a-z]+$/);
      }
    }
  });

  it('common names have at least two words and flavor text has at least two sentences', () => {
    const rand = PMB.rng(12);
    for (const id of CLASS_IDS) {
      for (let i = 0; i < 20; i++) {
        const p = PMB.decode(id, PMB.randomGenome(id, rand));
        assert.ok(p.names.common.split(' ').length >= 2, p.names.common);
        assert.ok(p.flavor.split('.').filter((s) => s.trim()).length >= 2, p.flavor);
      }
    }
  });
});

describe('save data', () => {
  it('normalize never throws and always returns usable collections', () => {
    for (const junk of [null, undefined, 'nope', 42, { specimens: 5, tanks: 'x' }]) {
      const save = PMB.Save.normalize(junk, 1000);
      assert.equal(save.version, 1);
      assert.equal(typeof save.specimens, 'object');
      assert.ok(Array.isArray(save.tanks));
      assert.ok(Array.isArray(save.order));
    }
  });

  it('recording the same genome twice enters it once and numbers entries in discovery order', () => {
    const save = PMB.Save.createEmpty(1000);
    const g1 = PMB.randomGenome('gastropod', PMB.rng(1));
    const g2 = PMB.randomGenome('gastropod', PMB.rng(2));
    const first = PMB.Save.recordCatch(save, 'gastropod', g1, 1000);
    const again = PMB.Save.recordCatch(save, 'gastropod', g1, 5000);
    const second = PMB.Save.recordCatch(save, 'gastropod', g2, 6000);
    assert.equal(Object.keys(save.specimens).length, 2);
    assert.equal(again.uid, first.uid);
    assert.equal(first.catalogNo, 1);
    assert.equal(second.catalogNo, 2);
    assert.equal(first.caughtAt, 1000, 'the discovery timestamp is never overwritten');
    assert.equal(save.order.length, 2);
  });

  it('every new catch gets a name that no other specimen in the save has', () => {
    const { specimens } = seededSave(200, 'crustacean');
    const names = specimens.map((s) => s.name);
    assert.equal(new Set(names).size, names.length);
  });

  it('serializes and restores genomes and tank membership without loss', () => {
    const { save, specimens } = seededSave(3, 'cetacean');
    PMB.Tanks.keep(save, specimens[0].uid, 2000);
    const restored = PMB.Save.normalize(JSON.parse(PMB.Save.serialize(save)), 3000);
    const [kept, unplaced] = [specimens[0], specimens[1]];
    assert.deepEqual(plain(restored.specimens[kept.uid].genome), plain(kept.genome));
    assert.equal(restored.tanks.length, 1);
    assert.deepEqual(plain(restored.tanks[0].members), [kept.uid]);
    assert.equal(restored.specimens[kept.uid].status, 'tank');
    assert.equal(restored.specimens[unplaced.uid].status, 'unplaced');
  });

  it('normalize drops broken genomes and repairs memberships that disagree', () => {
    const { save, specimens } = seededSave(2, 'sponge');
    const raw = JSON.parse(PMB.Save.serialize(save));
    raw.specimens[specimens[0].uid].genome = raw.specimens[specimens[0].uid].genome.slice(0, 41);
    raw.specimens[specimens[1].uid].status = 'tank'; // claims a tank that never listed it
    const restored = PMB.Save.normalize(raw, 2000);
    assert.equal(restored.specimens[specimens[0].uid], undefined);
    assert.equal(restored.specimens[specimens[1].uid].status, 'unplaced');
    assert.ok(!restored.order.includes(specimens[0].uid));
  });
});

describe('aquariums', () => {
  it('keeping a creature with no tank opens the first tank automatically', () => {
    const { save, specimens } = seededSave(1);
    const tank = PMB.Tanks.keep(save, specimens[0].uid, 2000);
    assert.equal(save.tanks.length, 1);
    assert.equal(tank.id, save.tanks[0].id);
    assert.equal(save.specimens[specimens[0].uid].status, 'tank');
    assert.equal(save.specimens[specimens[0].uid].tankId, tank.id);
  });

  it('a tank holds at most 40 creatures', () => {
    const { save, specimens } = seededSave(41);
    for (const s of specimens.slice(0, 40)) assert.ok(PMB.Tanks.keep(save, s.uid, 2000));
    assert.equal(save.tanks[0].members.length, 40);
  });

  it('keeping into a full tank overflows into a new tank', () => {
    const { save, specimens } = seededSave(41);
    for (const s of specimens) PMB.Tanks.keep(save, s.uid, 2000);
    assert.equal(save.tanks.length, 2);
    assert.equal(save.tanks[0].members.length, 40);
    assert.equal(save.tanks[1].members.length, 1);
  });

  it('moving into a full tank is refused and the creature stays where it was', () => {
    const { save, specimens } = seededSave(41);
    const full = PMB.Tanks.create(save, 2000);
    for (const s of specimens.slice(0, 40)) PMB.Tanks.keep(save, s.uid, 2000, full.id);
    const other = PMB.Tanks.create(save, 2000);
    PMB.Tanks.keep(save, specimens[40].uid, 2000, other.id);
    assert.equal(PMB.Tanks.move(save, specimens[40].uid, full.id, 2100), false);
    assert.equal(save.specimens[specimens[40].uid].tankId, other.id);
    assert.equal(full.members.length, 40);
  });

  it('keeping the same creature twice never duplicates its membership', () => {
    const { save, specimens } = seededSave(1);
    PMB.Tanks.keep(save, specimens[0].uid, 2000);
    PMB.Tanks.keep(save, specimens[0].uid, 3000);
    assert.equal(save.tanks[0].members.filter((uid) => uid === specimens[0].uid).length, 1);
  });

  it('releasing keeps the bestiary entry, frees the slot and returns the creature to the ocean', () => {
    const { save, specimens } = seededSave(1);
    PMB.Tanks.keep(save, specimens[0].uid, 2000);
    assert.equal(PMB.Tanks.release(save, specimens[0].uid, 3000), true);
    const entry = save.specimens[specimens[0].uid];
    assert.equal(entry.status, 'ocean');
    assert.equal(entry.tankId, null);
    assert.equal(save.tanks[0].members.length, 0);
    assert.equal(Object.keys(save.specimens).length, 1);
    assert.equal(save.stats.releases, 1);
  });

  it('a tank holds at most 30 decorations and rejects unknown kinds', () => {
    const save = PMB.Save.createEmpty(1000);
    const tank = PMB.Tanks.create(save, 1000);
    for (let i = 0; i < 30; i++) assert.ok(PMB.Tanks.addDecor(save, tank.id, 'boulder', 0.5, 0.5, 1000 + i));
    assert.equal(PMB.Tanks.addDecor(save, tank.id, 'boulder', 0.5, 0.5, 2000), null);
    assert.equal(PMB.Tanks.addDecor(save, tank.id, 'unicorn', 0.1, 0.1, 2000), null);
  });
});

describe('care', () => {
  const now = 10 * DAY;
  const base = {
    classId: 'fish',
    genome: genomeWith('fish', { shyness: 0.9 }),
    lastFed: now - 60_000,
    now,
    tankCount: 10,
    decorCategories: ['rock', 'plant'],
    coverNearby: true,
    plantNearby: true,
    lightMode: 'day',
  };
  const comfort = (overrides) => PMB.Care.comfort({ ...base, ...overrides }).value;

  it('a recently fed creature is more comfortable than a hungry one', () => {
    assert.ok(comfort({}) > comfort({ lastFed: now - 8 * HOUR }));
  });

  it('a shy creature is calmer with cover nearby', () => {
    assert.ok(comfort({ coverNearby: true }) > comfort({ coverNearby: false }));
  });

  it('a bold creature does not depend on cover', () => {
    const genome = genomeWith('fish', { shyness: 0.05 });
    assert.equal(comfort({ genome, coverNearby: true }), comfort({ genome, coverNearby: false }));
  });

  it('crowding lowers comfort', () => {
    assert.ok(comfort({ tankCount: 5 }) > comfort({ tankCount: 40 }));
  });

  it('comfort stays within 0-100 even in the worst case', () => {
    const worst = comfort({ lastFed: now - 400 * DAY, tankCount: 40, decorCategories: [], coverNearby: false, plantNearby: false });
    assert.ok(worst >= 0 && worst <= 100, `worst case ${worst}`);
  });

  it('moodFor maps comfort onto the four mood labels', () => {
    assert.equal(PMB.Care.moodFor(90), 'Thriving');
    assert.equal(PMB.Care.moodFor(80), 'Thriving');
    assert.equal(PMB.Care.moodFor(79.9), 'Content');
    assert.equal(PMB.Care.moodFor(60), 'Content');
    assert.equal(PMB.Care.moodFor(59.9), 'Uneasy');
    assert.equal(PMB.Care.moodFor(40), 'Uneasy');
    assert.equal(PMB.Care.moodFor(39.9), 'Stressed');
  });

  it('feeding a tank resident resets its hunger and counts the meal', () => {
    const { save, specimens } = seededSave(1);
    const uid = specimens[0].uid;
    assert.equal(PMB.Care.feed(save, uid, 5000), false, 'unplaced creatures cannot be fed');
    PMB.Tanks.keep(save, uid, 1000);
    assert.equal(PMB.Care.feed(save, uid, 5000), true);
    assert.equal(save.specimens[uid].lastFed, 5000);
    assert.equal(save.stats.feeds, 1);
  });
});

describe('gentle catch dwell', () => {
  const frame = 1 / 60;
  const run = (seconds, input, start = 0) => {
    let progress = start;
    for (let t = 0; t < seconds; t += frame) progress = PMB.Scoop.dwellStep(progress, frame, input);
    return progress;
  };

  it('holding still over a calm creature completes a catch in about 1.2 seconds', () => {
    const calm = { inRing: true, scoopSpeed: 0, fear: 0 };
    assert.ok(run(1.0, calm) < 1);
    assert.ok(run(1.3, calm) >= 1);
  });

  it('moving quickly over a creature resets its progress', () => {
    assert.equal(run(2, { inRing: true, scoopSpeed: 200, fear: 0 }, 0.5), 0);
  });

  it('a frightened creature never lets progress grow', () => {
    assert.ok(run(3, { inRing: true, scoopSpeed: 0, fear: 0.9 }, 0.2) <= 0.2);
  });

  it('leaving the ring drops progress and progress stays within 0-1', () => {
    assert.ok(run(0.5, { inRing: false, scoopSpeed: 0, fear: 0 }, 0.8) < 0.8);
    assert.ok(run(5, { inRing: true, scoopSpeed: 0, fear: 0 }, 0) <= 1);
  });
});

describe('ocean world', () => {
  it('maps depth to the four zones: sunlit, twilight, midnight and abyss', () => {
    assert.equal(PMB.World.zoneForDepth(0).id, 'sunlit');
    assert.equal(PMB.World.zoneForDepth(1000).id, 'sunlit');
    assert.equal(PMB.World.zoneForDepth(1500).id, 'twilight');
    assert.equal(PMB.World.zoneForDepth(6000).id, 'midnight');
    assert.equal(PMB.World.zoneForDepth(25000).id, 'abyss');
  });

  it('chunk features are deterministic and anchored inside their chunk', () => {
    const size = PMB.World.CHUNK_SIZE;
    const features = [];
    for (let cx = -1; cx <= 2; cx++) {
      for (let cy = -2; cy <= 1; cy++) {
        const a = PMB.World.chunkFeatures(12345, cx, cy);
        assert.deepEqual(plain(a), plain(PMB.World.chunkFeatures(12345, cx, cy)));
        for (const f of a) {
          assert.ok(f.x >= cx * size && f.x < (cx + 1) * size, `x ${f.x} outside chunk ${cx}`);
          assert.ok(f.y >= cy * size && f.y < (cy + 1) * size, `y ${f.y} outside chunk ${cy}`);
        }
        features.push(...a);
      }
    }
    assert.ok(features.length > 0);
  });

  it('currents are finite and never exceed the maximum current speed', () => {
    for (let i = 0; i < 500; i++) {
      const c = PMB.World.currentAt(i * 37.1, i * -21.9, i * 0.13);
      assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y));
      assert.ok(Math.hypot(c.x, c.y) <= PMB.World.MAX_CURRENT + 1e-9);
    }
  });

  it('class weights form a distribution over all eight classes in every zone', () => {
    for (const zone of PMB.World.ZONES) {
      const weights = PMB.World.classWeights(zone.id);
      assert.deepEqual(plain(Object.keys(weights).sort()), plain(CLASS_IDS.slice().sort()));
      const sum = Object.values(weights).reduce((total, w) => total + w, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `${zone.id} weights sum to ${sum}`);
    }
  });
});

describe('deliverable', () => {
  it('is one self-contained HTML file whose only references are to allowed CDN hosts', () => {
    const refs = [...html.matchAll(/\b(?:src|href)="([^"]*)"/g)].map((m) => m[1]);
    const allowed = /^https:\/\/(cdnjs\.cloudflare\.com(\/|$)|cdn\.jsdelivr\.net\/npm\/|fonts\.googleapis\.com(\/|$)|fonts\.gstatic\.com(\/|$))/;
    for (const ref of refs) assert.ok(allowed.test(ref), `unexpected reference: ${ref}`);
    assert.ok(refs.some((ref) => /p5/.test(ref)), 'p5.js must be loaded from a CDN');
  });

  it('pins the p5.js CDN build to an exact version', () => {
    assert.match(html, /p5(?:\.js)?[@/]\d+\.\d+\.\d+/);
  });
});
