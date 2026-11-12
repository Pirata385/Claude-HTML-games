// Amalgamations — power instances and power fusion.
// fusePowers(a, b): A is the delivery (its shape and reach), B becomes the payload that triggers where A
// lands or ends, and the two elements combine through the 66-entry ELEMENT_COMBOS table.
// Order matters: Fireball + Frost Nova (an orb that bursts into ice) is not Frost Nova + Fireball
// (an ice burst that then sprays fire bolts). 19 powers → 342 ordered fusions.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});

  // Where/when the payload triggers, by the primary shape.
  const TRIGGER = {
    projectile: 'On impact,', meteor: 'Where it lands,', chain: 'At the last target,', cone: 'At the end of the wave,',
    nova: 'Then', dash: 'At the end of the dash,', blink: 'On arrival,', beam: "Every half second at the beam's end,",
    heal: 'When it fades,', zone: 'When it collapses,', storm: 'When lightning strikes,', trap: 'When sprung,',
    boomerang: 'At the far end of its flight,', buff: 'While active, every 1.5 s', shield: 'While active, every 1.5 s',
    summon: 'When a spirit bites,',
  };
  const PRIMARY_TEXT = {
    projectile: (p) => (p.count > 1 ? `Fires ${p.count} ${p.homing ? 'homing ' : ''}projectiles` : 'Fires a projectile'),
    nova: (p) => (p.pulses > 1 ? 'Bursts around you twice' : 'Bursts around you'),
    chain: (p) => `Lightning arcs between up to ${p.jumps + 1} enemies`,
    cone: () => 'A wave sweeps the area in front of you',
    dash: () => 'You dash forward, untouchable',
    heal: () => 'Grows a healing zone',
    blink: () => 'You blink behind your target',
    beam: () => 'Channels a piercing beam',
    meteor: (p) => (p.count > 1 ? `Calls down a shower of ${p.count} meteors` : 'Calls down a meteor'),
    summon: (p) => `Summons ${p.count} spirit beast${p.count > 1 ? 's' : ''}`,
    shield: () => 'Shields you and reflects damage',
    zone: () => 'Opens a vortex that drags enemies in',
    storm: () => 'Summons a storm cloud that strikes enemies',
    trap: () => 'Plants a hidden trap',
    boomerang: () => 'Throws a blade that flies out and back',
    buff: () => 'Empowers you and terrifies nearby enemies',
  };
  const PAYLOAD_TEXT = {
    projectile: 'sprays shards in every direction', nova: 'erupts in a burst', chain: 'arcs lightning to nearby enemies',
    cone: 'releases a wave', dash: 'blasts enemies away', heal: 'leaves a healing patch', blink: 'pulls you to that spot',
    beam: 'fires a short ray', meteor: 'drops a small meteor', summon: 'calls a spirit beast', shield: 'shields you',
    zone: 'opens a small vortex', storm: 'leaves a small storm cloud', trap: 'leaves a trap', boomerang: 'flings a spinning blade',
    buff: 'empowers you',
  };
  const EFFECT_TEXT = {
    burn: 'burns', poison: 'poisons', bleed: 'causes bleeding', slow: 'slows', freeze: 'freezes', stun: 'stuns',
    shock: 'shocks', soak: 'soaks', blind: 'blinds', root: 'roots', fear: 'terrifies', knock: 'knocks back',
    pull: 'pulls enemies in', vuln: 'makes enemies vulnerable', weaken: 'weakens enemies', lifesteal: 'steals life',
    heal: 'heals you', pierce: 'pierces armour', crit: 'crits more', refund: 'refunds energy', spread: 'spreads statuses on kill',
    haste: 'hastens you', execute: 'executes weak enemies', chain: 'jumps further',
  };

  const copy = (o) => JSON.parse(JSON.stringify(o));

  function basePower(id) {
    const P = AM.POWERS[id];
    if (!P) throw new Error('Unknown power ' + id);
    const el = AM.ELEMENTS[P.element];
    const s = {
      id, fused: false, parts: [id], name: P.name, element: P.element, elements: [P.element], color: el.color,
      shape: P.shape, params: copy(P.params), dmg: P.dmg, cd: P.cd, energy: P.energy,
      effects: copy(P.effects), payload: null, desc: P.desc,
    };
    return s;
  }

  function mergeEffects(lists, cap) {
    const map = new Map();
    for (const [list, k, prio] of lists) {
      for (const e of list) {
        const ne = Object.assign({}, e);
        if (ne.dur) ne.dur = AM.round2(ne.dur * k);
        if (ne.power != null && ne.type !== 'knock' && ne.type !== 'pull') ne.power = AM.round2(ne.power * k);
        ne.chance = AM.clamp(ne.chance == null ? 1 : ne.chance, 0, 1);
        ne._p = prio;
        const old = map.get(ne.type);
        if (!old) map.set(ne.type, ne);
        else {
          old.chance = Math.max(old.chance, ne.chance);
          if (ne.dur) old.dur = Math.max(old.dur || 0, ne.dur);
          if (ne.power != null) old.power = Math.max(old.power || 0, ne.power);
          old._p = Math.max(old._p, prio);
        }
      }
    }
    const out = [...map.values()].sort((a, b) => b._p - a._p).slice(0, cap);
    for (const e of out) delete e._p;
    return out;
  }

  // The payload is a smaller version of B.
  function payloadOf(B) {
    const p = copy(B.params);
    for (const k of ['radius', 'range', 'explode', 'distance', 'puddle']) if (p[k]) p[k] = AM.round2(p[k] * 0.7);
    for (const k of ['dur', 'puddleDur']) if (p[k]) p[k] = AM.round2(p[k] * 0.6);
    if (p.count) p.count = Math.max(1, Math.round(p.count * 0.6));
    if (p.jumps) p.jumps = Math.max(1, Math.round(p.jumps * 0.6));
    if (B.shape === 'projectile') { p.count = 6; p.range = 5; p.spread = Math.PI * 2; delete p.homing; }
    if (p.shield) p.shield = AM.round2(p.shield * 0.4);
    if (p.heal) p.heal = AM.round2(p.heal * 0.6);
    return { shape: B.shape, element: B.element, params: p, dmg: AM.round2(B.dmg * 0.45), effects: copy(B.effects).slice(0, 2) };
  }

  function fusePowers(aId, bId) {
    if (aId === bId) throw new Error('Cannot fuse a power with itself');
    const A = basePower(aId), B = basePower(bId);
    const PA = AM.POWERS[aId], PB = AM.POWERS[bId];
    const s = basePower(aId);
    s.id = aId + '+' + bId;
    s.fused = true;
    s.parts = [aId, bId];
    s.elements = [A.element, B.element];

    // element combination
    let combo, comboName;
    if (A.element === B.element) {
      comboName = AM.ELEMENTS[A.element].intense;
      combo = null;
      s.color = AM.shade(AM.ELEMENTS[A.element].color, 0.05);
    } else {
      combo = AM.ELEMENT_COMBOS[[A.element, B.element].sort().join('+')];
      comboName = combo.name;
      s.color = combo.color;
    }
    s.combo = comboName;

    // numbers
    s.dmg = AM.round2(A.dmg * 0.8 + B.dmg * 0.25);
    s.cd = AM.round2(Math.max(A.cd, B.cd) * 0.9 + 1);
    s.energy = Math.round((A.energy + B.energy) * 0.7);

    // shape synergies
    let special = null;
    if (A.shape === 'projectile' && B.shape === 'projectile') {
      s.params.count = (A.params.count || 1) + 2; s.params.spread = Math.max(A.params.spread || 0, 0.5);
      if (B.params.homing) s.params.homing = 1;
      special = 'multishot';
    } else if (A.shape === 'meteor' && B.shape === 'projectile') {
      s.params.count = 3 + (B.params.count > 1 ? 2 : 0); s.params.radius = AM.round2(s.params.radius * 0.75);
      special = 'shower';
    } else if (A.shape === 'nova' && B.shape === 'nova') {
      s.params.pulses = 2; special = 'double';
    } else if ((A.shape === 'dash' || A.shape === 'blink') && (B.shape === 'dash' || B.shape === 'blink')) {
      if (s.params.distance) s.params.distance = AM.round2(s.params.distance * 1.4);
      if (s.params.range) s.params.range = AM.round2(s.params.range * 1.4);
      special = 'long';
    } else if (/zone|storm|heal|trap/.test(A.shape) && /zone|storm|heal|trap/.test(B.shape)) {
      s.params.radius = AM.round2(s.params.radius * 1.25); if (s.params.dur) s.params.dur = AM.round2(s.params.dur * 1.3);
      special = 'wide';
    }

    s.payload = special === 'multishot' || special === 'shower' ? null : payloadOf(B);
    if (special === 'multishot' || special === 'shower') {
      // the second projectile power folds in as extra effects instead of a payload
      s.dmg = AM.round2(A.dmg * 0.75 + B.dmg * 0.35);
    }

    const k = A.element === B.element ? 1.3 : 1;
    const lists = [[A.effects, k, 3], [B.effects, 0.75 * k, 1]];
    if (combo) lists.unshift([[combo.effect], 1, 5]);
    s.effects = mergeEffects(lists, 4);
    if (s.payload) s.payload.effects = mergeEffects([[s.payload.effects, 0.8, 1]], 2);

    s.name = `${comboName} ${PA.noun} ${PB.word}`;
    s.desc = describe(s);
    return s;
  }

  function describe(s) {
    const parts = [];
    parts.push(PRIMARY_TEXT[s.shape](s.params) + '.');
    if (s.payload) parts.push(`${TRIGGER[s.shape]} it ${PAYLOAD_TEXT[s.payload.shape]}.`);
    const fx = s.effects.map((e) => EFFECT_TEXT[e.type]).filter(Boolean);
    if (fx.length) parts.push('It ' + (fx.length > 1 ? fx.slice(0, -1).join(', ') + ' and ' + fx[fx.length - 1] : fx[0]) + '.');
    return parts.join(' ');
  }

  // Get a power spec from an id ("fireball" or "fireball+frostnova").
  const cache = new Map();
  function powerSpec(id) {
    if (cache.has(id)) return cache.get(id);
    const parts = id.split('+');
    const spec = parts.length === 2 ? fusePowers(parts[0], parts[1]) : basePower(id);
    cache.set(id, spec);
    return spec;
  }
  // Essence cost to fuse two powers.
  const fusionCost = (aId, bId) => Math.round(20 + (AM.POWERS[aId].energy + AM.POWERS[bId].energy) * 0.8);

  Object.assign(AM, { basePower, fusePowers, powerSpec, powerFusionCost: fusionCost, POWER_EFFECT_TEXT: EFFECT_TEXT });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
