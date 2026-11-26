// Água-Tinta — species, sightings and zone data (owner B). §6.1–6.5, §15.11.
'use strict';
module.exports = function (T) {
  const SIZE_HOOK = { XS: 1, S: 1, M: 2, L: 3, XL: 4, XXL: 4 };

  T.test('42 species + 3 sightings, unique ids in roster order', () => {
    const { AQ } = T.load();
    T.eq(AQ.species.list.length, 42);
    T.eq(AQ.species.ids(), AQ.ENUM.SPECIES.slice());
    T.eq(new Set(AQ.species.ids()).size, 42);
    T.eq(AQ.sightings.list.map((s) => s.id), AQ.ENUM.SIGHTINGS.slice());
    for (const id of AQ.species.ids()) T.ok(AQ.species.get(id) && AQ.species.get(id).id === id, id);
    T.eq(AQ.species.get('nope'), null);
    T.eq(AQ.sightings.get('nope'), null);
  });

  T.test('rarity and kind totals (§6.1)', () => {
    const { AQ } = T.load();
    const count = (f) => AQ.species.list.filter(f).length;
    T.eq([count((s) => s.rarity === 'C'), count((s) => s.rarity === 'U'), count((s) => s.rarity === 'R'), count((s) => s.rarity === 'L')], [10, 14, 14, 4]);
    T.eq(count((s) => s.kind === 'fish'), 22); // roster table (§6.1 rows); the '25' in the totals line counts odd species too
    T.eq(AQ.species.list.filter((s) => s.rarity === 'L').map((s) => s.id), AQ.ENUM.LEGENDARIES.slice());
  });

  T.test('every field is valid against AQ.ENUM', () => {
    const { AQ } = T.load();
    const E = AQ.ENUM, bad = [];
    for (const s of AQ.species.list) {
      const chk = (ok, what) => { if (!ok) bad.push(s.id + ': ' + what); };
      chk(E.RARITY.includes(s.rarity), 'rarity'); chk(E.SIZE.includes(s.size), 'size');
      chk(E.KIND.includes(s.kind), 'kind'); chk(E.BEHAVIOR.includes(s.behavior), 'behavior');
      chk(E.FIGHT.includes(s.fight.style), 'fight.style');
      chk(s.zones.length >= 1 && s.zones.every((z) => E.ZONES.includes(z) && AQ.zones.get(z)), 'zones');
      chk(s.habitat.every((h) => E.HABITAT.includes(h)), 'habitat');
      chk(E.LIGHT.includes(s.light), 'light'); chk(s.id === 'tinteira' || E.DIET.includes(s.diet), 'diet');
      chk(s.time === null || (s.time.length && s.time.every((p) => E.PHASES.includes(p))), 'time');
      chk(s.weather === null || (s.weather.length && s.weather.every((w) => E.WEATHER.includes(w))), 'weather');
      const baits = Object.keys(s.baits);
      chk(baits.length && baits.every((b) => E.BAITS.includes(b)), 'baits');
      chk(baits.some((b) => s.baits[b] > 0), 'affinity > 0');
      chk(s.len[0] < s.len[1], 'len'); chk(s.kgMax > 0, 'kgMax');
      chk(s.id === 'tinteira' ? s.value === 0 : s.value > 0, 'value');
      chk(s.depth[0] >= 0 && s.depth[1] <= 1 && s.depth[0] < s.depth[1], 'depth');
      chk(s.hookMin >= SIZE_HOOK[s.size] && s.hookMin <= 4, 'hookMin');
      chk(s.gearTier >= 1 && s.gearTier <= 5, 'gearTier');
      chk(s.fight.power > 0 && s.fight.stamina > 0 && s.fight.speed > 0, 'fight numbers');
      chk(s.fight.tell === { C: 0.7, U: 0.55, R: 0.45, L: 0.4 }[s.rarity], 'tell');
      chk(s.wariness >= 0 && s.wariness <= 3 && s.biteWindow > 0, 'wariness/window');
      chk(s.glow === 0 || s.glow === 1, 'glow'); chk(typeof s.breeds === 'boolean', 'breeds');
      chk(s.keep === (s.id !== 'tinteira'), 'keep');
      chk(s.sprite === s.id, 'sprite key');
    }
    T.eq(bad, []);
  });

  T.test('fight specials (§4.8)', () => {
    const { AQ } = T.load();
    const sp = (id) => AQ.species.get(id).fight.special;
    T.eq(sp('baiacu').inflateAt, 0.7);
    for (const id of ['arraia', 'polvo', 'ermitao', 'aranha']) T.ok(sp(id).grip, id + ' grip');
    T.ok(sp('isopode').roll);
    T.eq([sp('polvo').inkChance, sp('lula').inkChance, sp('vampira').inkChance], [0.4, 0.5, 0.5]);
    T.ok(sp('vampira').glowInk);
    T.eq(['camarao', 'cavalo', 'aguaviva', 'caravela', 'atolla'].map((id) => sp(id).tear), [0.6, 0.5, 0.5, 0.35, 0.45]);
    T.ok(sp('tipografo').scramble && sp('atolla').alarm);
    T.eq(AQ.species.get('camarao').produces.item, 'camarao');
  });

  T.test('English name and flavour for every species and sighting', () => {
    const { AQ } = T.load();
    const missing = [];
    for (const id of AQ.species.ids()) for (const k of ['name', 'flavor']) if (!AQ.i18n.has('sp.' + id + '.' + k, 'en')) missing.push('sp.' + id + '.' + k);
    for (const s of AQ.sightings.list) for (const k of ['name', 'flavor']) if (!AQ.i18n.has('sighting.' + s.id + '.' + k, 'en')) missing.push('sighting.' + s.id + '.' + k);
    for (const z of AQ.ENUM.ZONES) if (!AQ.i18n.has('zone.' + z + '.name', 'en')) missing.push('zone.' + z);
    for (const p of AQ.ENUM.PHASES) if (!AQ.i18n.has('phase.' + p, 'en')) missing.push('phase.' + p);
    for (const w of AQ.ENUM.WEATHER) if (!AQ.i18n.has('weather.' + w, 'en')) missing.push('weather.' + w);
    T.eq(missing, []);
  });

  T.test('every zone has a common species in every phase', () => {
    const { AQ } = T.load();
    const miss = [];
    for (const z of AQ.ENUM.ZONES) for (const ph of AQ.ENUM.PHASES) {
      const ok = AQ.species.inZone(z).some((s) => s.rarity === 'C' &&
        AQ.ENUM.WEATHER.some((w) => AQ.spawn.conditionsMet(s, { phase: ph, weather: w, bait: 'massa' })));
      if (!ok) miss.push(z + '/' + ph);
    }
    T.eq(miss, []);
  });

  T.test('every species is catchable somewhere: conditions met and depth reachable with Linha V', () => {
    const { AQ } = T.load();
    const E = AQ.ENUM, bad = [];
    for (const s of AQ.species.list) {
      let ok = false;
      for (const ph of E.PHASES) for (const w of E.WEATHER) for (const b of E.BAITS) {
        if ((s.baits[b] || 0) > 0 && AQ.spawn.conditionsMet(s, { phase: ph, weather: w, bait: b })) ok = true;
      }
      const z = AQ.zones.get(s.zones[0]);
      if (!ok) bad.push(s.id + ' conditions');
      if (!(s.depth[0] * z.depth <= 350)) bad.push(s.id + ' depth');
    }
    T.eq(bad, []);
  });

  T.test('zones (§5.1)', () => {
    const { AQ } = T.load();
    T.eq(AQ.zones.order, AQ.ENUM.ZONES.slice());
    T.eq(AQ.zones.list.map((z) => z.depth), [70, 100, 140, 220, 320]);
    T.eq(AQ.zones.list.map((z) => z.popFactor), [1.0, 1.1, 0.9, 0.7, 0.6]);
    T.eq(AQ.zones.list.map((z) => z.frenzy), [true, true, true, true, false]);
    for (const z of AQ.zones.list) {
      T.ok(z.order === AQ.zones.order.indexOf(z.id) && z.mPerUnit > 0 && z.dark && z.floorProfile, z.id);
      T.ok(z.sightings.every((id) => AQ.sightings.get(id) && AQ.sightings.get(id).zones.includes(z.id)), z.id + ' sightings');
      for (let x = 0; x < 200; x += 7) {
        const y = AQ.zones.floorY(z.id, x), fp = z.floorProfile;
        T.ok(y >= z.depth * fp.base - 1e-9 && y <= z.depth * (fp.base + fp.amp) + 1e-9, z.id + ' floorY');
      }
    }
    T.near(AQ.zones.depthM('mar', 100), 90, 1e-9);
  });
};
