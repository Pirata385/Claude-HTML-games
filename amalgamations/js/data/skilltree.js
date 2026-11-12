// Amalgamations — the skill tree: six branches on a radial graph, 11 nodes each (66 in total).
// Any root can be your starting point; you can buy a node if it is a root or touches a node you own.
// The outer rings of neighbouring branches are linked, so paths can cross between branches.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});

  // mods use the same keys as stats.js (pct values are fractions).
  const BRANCHES = [
    {
      id: 'brawler', name: 'Brawler', color: '#ff5a4a', power: 'quakeslam',
      blurb: 'Hit hard up close and soak up punishment.',
      root: { name: 'Brawler', mods: { meleeDmg: 0.06 } },
      r2: [{ name: 'Heavy Hands', mods: { meleeDmg: 0.08 } }, { name: 'Thick Neck', mods: { hpPct: 0.06 } }],
      r3: [{ name: 'Momentum', mods: { atkSpeed: 0.05 } }, { name: 'Bone Breaker', notable: true, mods: { meleeDmg: 0.15, knock: 1 }, desc: '+15% melee damage; your melee hits knock enemies back.' }],
      r4: [{ name: 'Grit', mods: { hpPct: 0.06 } }, { name: 'Brute Force', mods: { dmgPct: 0.06 } }, { name: 'Bloodied Rage', notable: true, mods: { lowHpDmg: 0.2 }, desc: '+20% damage while under half health.' }],
      r5: [{ name: 'Iron Jaw', mods: { def: 3 } }, { name: 'Smash', mods: { meleeDmg: 0.08 } }],
      key: { name: 'Berserker', mods: { dmgPct: 0.3, defPct: -0.1, lowHpDmg: 0.15 }, desc: '+30% damage and +15% more below half health, but -10% defence.' },
    },
    {
      id: 'ranger', name: 'Ranger', color: '#5fd068', power: 'galedash',
      blurb: 'Speed, precision and critical strikes.',
      root: { name: 'Ranger', mods: { critChance: 0.03 } },
      r2: [{ name: 'Light Feet', mods: { speedPct: 0.05 } }, { name: 'Steady Aim', mods: { rangedDmg: 0.08 } }],
      r3: [{ name: 'Sharp Eyes', mods: { critChance: 0.03 } }, { name: 'Eagle Eye', notable: true, mods: { critDmg: 0.3 }, desc: '+30% critical damage.' }],
      r4: [{ name: 'Fleet', mods: { dodgeCd: 0.1 } }, { name: 'Long Shot', mods: { range: 0.1, rangedDmg: 0.06 } }, { name: 'Hunter', notable: true, mods: { critChance: 0.06, speedPct: 0.05 }, desc: '+6% critical chance and +5% speed.' }],
      r5: [{ name: 'Precision', mods: { critDmg: 0.12 } }, { name: 'Tailwind', mods: { speedPct: 0.05 } }],
      key: { name: 'Glass Cannon', mods: { dmgPct: 0.4, hpPct: -0.25 }, desc: '+40% damage but -25% health.' },
    },
    {
      id: 'elementalist', name: 'Elementalist', color: '#4aa3ff', power: 'fireball',
      blurb: 'Master powers, energy and elements.',
      root: { name: 'Elementalist', mods: { powerDmg: 0.06 } },
      r2: [{ name: 'Deep Well', mods: { maxEnergy: 15 } }, { name: 'Spark', mods: { powerDmg: 0.08 } }],
      r3: [{ name: 'Flow', mods: { energyRegen: 0.15 } }, { name: 'Attunement', notable: true, mods: { allElem: 0.1, statusDur: 0.2 }, desc: '+10% elemental damage; statuses you cause last 20% longer.' }],
      r4: [{ name: 'Quick Mind', mods: { cdr: 0.05 } }, { name: 'Channeling', mods: { powerDmg: 0.08 } }, { name: 'Fusion Adept', notable: true, mods: { fusedDmg: 0.15, cdr: 0.05 }, desc: 'Fused powers deal 15% more damage; -5% cooldowns.' }],
      r5: [{ name: 'Surge', mods: { energyRegen: 0.15 } }, { name: 'Overcharge', mods: { powerDmg: 0.1 } }],
      key: { name: 'Overflow', mods: { powerSlots: 1, maxEnergy: 20 }, desc: 'Unlocks a fourth power slot and +20 energy.' },
    },
    {
      id: 'guardian', name: 'Guardian', color: '#ffcf4a', power: 'ironskin',
      blurb: 'Defence, shields, thorns and staying power.',
      root: { name: 'Guardian', mods: { def: 2 } },
      r2: [{ name: 'Plating', mods: { defPct: 0.08 } }, { name: 'Vigor', mods: { hpPct: 0.06 } }],
      r3: [{ name: 'Barbs', mods: { thorns: 0.08 } }, { name: 'Bulwark', notable: true, mods: { dr: 0.08 }, desc: 'Take 8% less damage.' }],
      r4: [{ name: 'Mending', mods: { regen: 0.004 } }, { name: 'Shieldwall', mods: { shieldPow: 0.2 } }, { name: 'Second Wind', notable: true, mods: { potionPow: 0.3, regen: 0.004 }, desc: 'Potions heal 30% more; +0.4% health/s.' }],
      r5: [{ name: 'Stone Skin', mods: { defPct: 0.08 } }, { name: 'Hardy', mods: { hpPct: 0.06 } }],
      key: { name: 'Unbreakable', mods: { ccImmune: 1, defPct: 0.2 }, desc: 'Immune to stun, freeze, root and fear; +20% defence.' },
    },
    {
      id: 'primal', name: 'Primal', color: '#ff9a3a', power: 'battleroar',
      blurb: 'Lean into your fusion: traits, natural weapons and lifesteal.',
      root: { name: 'Primal', mods: { naturalDmg: 0.08 } },
      r2: [{ name: 'Feral', mods: { naturalDmg: 0.1 } }, { name: 'Blood Scent', mods: { lifesteal: 0.02 } }],
      r3: [{ name: 'Wild Pace', mods: { atkSpeed: 0.06 } }, { name: 'Wild Blood', notable: true, mods: { atkSpeed: 0.1, traitStr: 0.1 }, desc: '+10% attack speed; fusion traits are 10% stronger.' }],
      r4: [{ name: 'Instinct', mods: { traitStr: 0.08 } }, { name: 'Gorge', mods: { lifesteal: 0.02 } }, { name: 'Apex', notable: true, mods: { naturalDmg: 0.15, critChance: 0.04 }, desc: '+15% natural attack damage and +4% crit chance.' }],
      r5: [{ name: 'Savage', mods: { naturalDmg: 0.1 } }, { name: 'Twin Souls', mods: { traitStr: 0.08 } }],
      key: { name: 'Chimera Heart', mods: { chimera: 1 }, desc: 'Both parent traits work at full strength instead of 70%.' },
    },
    {
      id: 'wanderer', name: 'Wanderer', color: '#3fd6c6', power: 'shadowstep',
      blurb: 'Explore further: loot, gold, experience and mobility.',
      root: { name: 'Wanderer', mods: { xpPct: 0.05 } },
      r2: [{ name: 'Prospector', mods: { mining: 0.3 } }, { name: 'Pockets', mods: { goldPct: 0.1 } }],
      r3: [{ name: 'Pathfinder', mods: { speedPct: 0.05 } }, { name: 'Treasure Sense', notable: true, mods: { findPct: 0.2, chestSense: 1 }, desc: '+20% item find; chests show on your minimap.' }],
      r4: [{ name: 'Scholar', mods: { xpPct: 0.08 } }, { name: 'Haggler', mods: { shopDiscount: 0.15 } }, { name: 'Evasive', notable: true, mods: { evade: 0.06, dodgeCd: 0.1 }, desc: '+6% evasion and dodge recharges 10% faster.' }],
      r5: [{ name: 'Lucky', mods: { findPct: 0.1 } }, { name: 'Gold Nose', mods: { goldPct: 0.15 } }],
      key: { name: 'Fleetfoot', mods: { dodgeCharges: 1, speedPct: 0.05 }, desc: 'Store two dodge charges; +5% speed.' },
    },
  ];

  const NODES = {};
  const EDGES = [];
  const link = (a, b) => EDGES.push([a, b]);
  BRANCHES.forEach((B, bi) => {
    const ang = (bi / BRANCHES.length) * Math.PI * 2 - Math.PI / 2;
    const add = (key, def, ring, off, kind) => {
      const id = `${B.id}.${key}`;
      const a = ang + off;
      NODES[id] = {
        id, branch: B.id, name: def.name, mods: def.mods, desc: def.desc || null,
        kind: kind || (def.notable ? 'notable' : 'minor'), cost: kind === 'keystone' ? 2 : 1,
        x: Math.cos(a) * ring * 70, y: Math.sin(a) * ring * 70, color: B.color,
        power: kind === 'root' ? B.power : null,
      };
      return id;
    };
    const root = add('root', B.root, 1.25, 0, 'root');
    const r2 = B.r2.map((d, i) => add('r2' + i, d, 2.2, i ? 0.2 : -0.2));
    const r3 = B.r3.map((d, i) => add('r3' + i, d, 3.1, i ? 0.17 : -0.17));
    const r4 = B.r4.map((d, i) => add('r4' + i, d, 4.0, [-0.3, 0, 0.3][i]));
    const r5 = B.r5.map((d, i) => add('r5' + i, d, 4.9, i ? 0.13 : -0.13));
    const key = add('key', B.key, 5.8, 0, 'keystone');
    link(root, r2[0]); link(root, r2[1]);
    link(r2[0], r3[0]); link(r2[1], r3[1]);
    link(r3[0], r4[0]); link(r3[0], r4[1]); link(r3[1], r4[1]); link(r3[1], r4[2]);
    link(r4[0], r5[0]); link(r4[2], r5[1]);
    link(r5[0], key); link(r5[1], key);
  });
  // bridges between neighbouring branches (outer ring)
  BRANCHES.forEach((B, bi) => {
    const prev = BRANCHES[(bi + BRANCHES.length - 1) % BRANCHES.length];
    link(`${B.id}.r40`, `${prev.id}.r42`);
  });
  const ADJ = {};
  for (const id in NODES) ADJ[id] = [];
  for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }

  function canBuy(owned, id, points) {
    const n = NODES[id];
    if (!n || owned.has(id) || points < n.cost) return false;
    if (n.kind === 'root') return true;
    return ADJ[id].some((o) => owned.has(o));
  }
  // Total mods from owned nodes.
  function treeMods(owned) {
    const out = {};
    for (const id of owned) {
      const n = NODES[id];
      if (!n) continue;
      for (const k in n.mods) out[k] = (out[k] || 0) + n.mods[k];
    }
    return out;
  }

  Object.assign(AM, { SKILL_BRANCHES: BRANCHES, SKILL_NODES: NODES, SKILL_EDGES: EDGES, SKILL_ADJ: ADJ, canBuySkill: canBuy, treeMods });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
