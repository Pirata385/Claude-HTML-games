// Amalgamations — static low-poly models for props, structures and pickups (built once, cached).
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const R = AM.R || (AM.R = {});
  const PI = Math.PI;
  const cache = new Map();

  function build(fn) { const gb = new R.GeoBuilder(false); fn(gb, (o, pos, rot) => { o.m = R.mat(pos, rot); gb.box(o); }); return gb.build(); }

  const PROP_BUILDERS = {
    tree: (gb, add) => {
      add({ w: 0.32, h: 1.3, l: 0.32, c: 0.05, col: '#7a5233' }, [0, 0.65, 0]);
      add({ w: 1.7, h: 1.1, l: 1.7, c: 0.3, col: '#4f9a3f' }, [0, 1.75, 0]);
      add({ w: 1.25, h: 0.8, l: 1.25, c: 0.25, col: '#5fae4a' }, [0.1, 2.45, -0.05]);
    },
    pine: (gb, add) => {
      add({ w: 0.28, h: 1.0, l: 0.28, col: '#6a4a2e' }, [0, 0.5, 0]);
      add({ w: 1.6, h: 1.0, l: 1.6, c: 0.08, tt: 0.45, col: '#2f6e3c' }, [0, 1.3, 0]);
      add({ w: 1.2, h: 0.9, l: 1.2, c: 0.06, tt: 0.4, col: '#367a44' }, [0, 2.0, 0]);
      add({ w: 0.8, h: 0.8, l: 0.8, c: 0.05, tt: 0.2, col: '#3e874c' }, [0, 2.65, 0]);
    },
    pineSnow: (gb, add) => {
      add({ w: 0.28, h: 1.0, l: 0.28, col: '#6a4a2e' }, [0, 0.5, 0]);
      add({ w: 1.6, h: 1.0, l: 1.6, c: 0.08, tt: 0.45, col: '#3a6e58' }, [0, 1.3, 0]);
      add({ w: 1.25, h: 0.25, l: 1.25, c: 0.06, tt: 0.7, col: '#f4f8fb' }, [0, 1.85, 0]);
      add({ w: 1.1, h: 0.85, l: 1.1, c: 0.06, tt: 0.35, col: '#427a63' }, [0, 2.15, 0]);
      add({ w: 0.6, h: 0.45, l: 0.6, c: 0.05, tt: 0.2, col: '#f4f8fb' }, [0, 2.75, 0]);
    },
    deadtree: (gb, add) => {
      add({ w: 0.28, h: 2.0, l: 0.28, tt: 0.6, col: '#5a4a3e' }, [0, 1.0, 0]);
      add({ w: 0.14, h: 0.9, l: 0.14, tt: 0.5, col: '#5a4a3e' }, [0.3, 1.6, 0], [0, 0, -0.8]);
      add({ w: 0.12, h: 0.7, l: 0.12, tt: 0.5, col: '#5a4a3e' }, [-0.25, 1.9, 0.1], [0.2, 0, 0.9]);
    },
    cactus: (gb, add) => {
      add({ w: 0.45, h: 1.7, l: 0.45, c: 0.12, col: '#4f9a4a' }, [0, 0.85, 0]);
      add({ w: 0.5, h: 0.24, l: 0.24, c: 0.08, col: '#4f9a4a' }, [0.4, 0.8, 0]);
      add({ w: 0.24, h: 0.6, l: 0.24, c: 0.08, col: '#4f9a4a' }, [0.6, 1.1, 0]);
      add({ w: 0.4, h: 0.22, l: 0.22, c: 0.08, col: '#4f9a4a' }, [-0.35, 1.1, 0]);
      add({ w: 0.22, h: 0.45, l: 0.22, c: 0.08, col: '#4f9a4a' }, [-0.5, 1.33, 0]);
    },
    bush: (gb, add) => {
      add({ w: 0.95, h: 0.6, l: 0.95, c: 0.22, col: '#3f8a3a' }, [0, 0.3, 0]);
      for (let i = 0; i < 5; i++) { const a = i * 1.3; add({ w: 0.12, h: 0.12, l: 0.12, c: 0.03, col: '#e04a5a' }, [Math.cos(a) * 0.36, 0.42 + (i % 2) * 0.1, Math.sin(a) * 0.36]); }
    },
    flowers: (gb, add) => {
      for (let i = 0; i < 4; i++) { const a = i * 1.7; add({ w: 0.04, h: 0.25, l: 0.04, col: '#3f8a3a' }, [Math.cos(a) * 0.25, 0.12, Math.sin(a) * 0.25]); add({ w: 0.14, h: 0.1, l: 0.14, c: 0.03, col: '#ffffff' }, [Math.cos(a) * 0.25, 0.27, Math.sin(a) * 0.25]); }
    },
    grass: (gb, add) => {
      for (let i = 0; i < 4; i++) { const a = i * 1.6; add({ w: 0.07, h: 0.38, l: 0.04, tt: 0.2, col: '#6faa4a' }, [Math.cos(a) * 0.18, 0.18, Math.sin(a) * 0.18], [0, a, (i % 2 ? 0.2 : -0.2)]); }
    },
    reeds: (gb, add) => {
      for (let i = 0; i < 5; i++) { const a = i * 1.3; add({ w: 0.05, h: 1.0, l: 0.05, col: '#7a8a4a' }, [Math.cos(a) * 0.25, 0.5, Math.sin(a) * 0.25], [0.08 * Math.sin(a), 0, 0.08 * Math.cos(a)]); add({ w: 0.08, h: 0.22, l: 0.08, c: 0.02, col: '#6a4a2e' }, [Math.cos(a) * 0.25, 0.95, Math.sin(a) * 0.25]); }
    },
    deadbush: (gb, add) => {
      for (let i = 0; i < 5; i++) { const a = i * 1.25; add({ w: 0.05, h: 0.55, l: 0.05, col: '#8a6a4a' }, [Math.cos(a) * 0.12, 0.25, Math.sin(a) * 0.12], [Math.sin(a) * 0.6, 0, Math.cos(a) * 0.6]); }
    },
    rock: (gb, add) => {
      add({ w: 1.3, h: 0.8, l: 1.1, c: 0.22, tt: 0.75, col: '#8d939b' }, [0, 0.4, 0]);
      add({ w: 0.7, h: 0.5, l: 0.6, c: 0.14, col: '#7c828a' }, [0.55, 0.25, 0.35], [0, 0.5, 0]);
    },
    log: (gb, add) => {
      add({ w: 0.42, h: 0.42, l: 1.8, c: 0.1, col: '#7a5233' }, [0, 0.21, 0], [0, 0, 0]);
      add({ w: 0.3, h: 0.3, l: 0.02, c: 0.06, col: '#c8a070' }, [0, 0.21, 0.91]);
      add({ w: 0.3, h: 0.3, l: 0.02, c: 0.06, col: '#c8a070' }, [0, 0.21, -0.91]);
    },
    bones: (gb, add) => {
      add({ w: 0.6, h: 0.1, l: 0.1, col: '#efe6d0' }, [0, 0.05, 0], [0, 0.4, 0]);
      add({ w: 0.22, h: 0.2, l: 0.25, c: 0.05, col: '#efe6d0' }, [0.35, 0.1, 0.1]);
      add({ w: 0.5, h: 0.08, l: 0.08, col: '#efe6d0' }, [-0.1, 0.04, 0.25], [0, -0.7, 0]);
    },
    iceSpike: (gb, add) => {
      add({ w: 0.6, h: 1.8, l: 0.6, tt: 0.1, col: '#a8e4f5' }, [0, 0.9, 0]);
      add({ w: 0.35, h: 1.0, l: 0.35, tt: 0.1, col: '#c8f0fa' }, [0.4, 0.5, 0.2], [0, 0, -0.3]);
    },
    mushroomS: (gb, add) => {
      add({ w: 0.12, h: 0.3, l: 0.12, col: '#efe4cf' }, [0, 0.15, 0]);
      add({ w: 0.34, h: 0.16, l: 0.34, c: 0.06, tt: 0.6, col: '#d6453d' }, [0, 0.34, 0]);
      add({ w: 0.08, h: 0.2, l: 0.08, col: '#efe4cf' }, [0.25, 0.1, 0.1]);
      add({ w: 0.2, h: 0.1, l: 0.2, c: 0.04, tt: 0.6, col: '#c9a24a' }, [0.25, 0.23, 0.1]);
    },
    giantShroom: (gb, add) => {
      add({ w: 0.5, h: 2.4, l: 0.5, c: 0.1, col: '#e8dcc8' }, [0, 1.2, 0]);
      add({ w: 2.6, h: 0.9, l: 2.6, c: 0.4, tt: 0.55, col: '#9a5ad0' }, [0, 2.7, 0]);
      for (let i = 0; i < 5; i++) { const a = i * 1.25; add({ w: 0.3, h: 0.05, l: 0.3, col: '#f0d8ff' }, [Math.cos(a) * 0.7, 3.05, Math.sin(a) * 0.7]); }
    },
    glowShroom: (gb, add) => {
      add({ w: 0.1, h: 0.4, l: 0.1, col: '#d8d0e8' }, [0, 0.2, 0]);
      add({ w: 0.36, h: 0.18, l: 0.36, c: 0.06, tt: 0.5, col: '#7af0ff', bucket: 1 }, [0, 0.45, 0]);
      add({ w: 0.08, h: 0.25, l: 0.08, col: '#d8d0e8' }, [0.22, 0.12, -0.12]);
      add({ w: 0.22, h: 0.12, l: 0.22, c: 0.04, tt: 0.5, col: '#ff8af0', bucket: 1 }, [0.22, 0.28, -0.12]);
    },
    crystal: (gb, add) => {
      add({ w: 0.5, h: 1.5, l: 0.5, tt: 0.15, col: '#7ae4ff', bucket: 1 }, [0, 0.75, 0], [0, 0.4, 0.1]);
      add({ w: 0.35, h: 1.0, l: 0.35, tt: 0.15, col: '#b48aff', bucket: 1 }, [0.4, 0.45, 0.1], [0, 0, -0.4]);
      add({ w: 0.3, h: 0.8, l: 0.3, tt: 0.15, col: '#7ae4ff', bucket: 1 }, [-0.35, 0.35, -0.1], [0.2, 0, 0.5]);
      add({ w: 0.8, h: 0.2, l: 0.8, c: 0.08, col: '#8a96a8' }, [0, 0.1, 0]);
    },
    lavarock: (gb, add) => {
      add({ w: 1.2, h: 0.7, l: 1.0, c: 0.2, tt: 0.7, col: '#2a2220' }, [0, 0.35, 0]);
      add({ w: 0.6, h: 0.06, l: 0.08, col: '#ff7a2f', bucket: 1 }, [0.1, 0.7, 0.1], [0, 0.6, 0]);
      add({ w: 0.08, h: 0.4, l: 0.06, col: '#ff7a2f', bucket: 1 }, [0.58, 0.35, 0.1]);
    },
    vent: (gb, add) => {
      add({ w: 1.3, h: 0.9, l: 1.3, c: 0.15, tt: 0.45, col: '#3a2e2a' }, [0, 0.45, 0]);
      add({ w: 0.45, h: 0.08, l: 0.45, col: '#ffb43a', bucket: 1 }, [0, 0.9, 0]);
    },
  };
  const ORE_COL = { iron: '#d8a070', goldore: '#f2c14e', crystal: '#7ae4ff', stone: '#b0b6bc' };
  for (const ore in ORE_COL) {
    PROP_BUILDERS['ore_' + ore] = (gb, add) => {
      add({ w: 1.2, h: 0.85, l: 1.1, c: 0.2, tt: 0.7, col: '#7c828a' }, [0, 0.42, 0]);
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.3; add({ w: 0.22, h: 0.22, l: 0.22, c: 0.05, col: ORE_COL[ore], bucket: ore === 'crystal' ? 1 : 0 }, [Math.cos(a) * 0.45, 0.35 + (i % 2) * 0.25, Math.sin(a) * 0.42]); }
    };
  }
  function propGeo(type) {
    if (!cache.has('p:' + type)) cache.set('p:' + type, build(PROP_BUILDERS[type]));
    return cache.get('p:' + type);
  }

  // ---------- structures ----------
  function buildVillage(world, s) {
    const L = world.villageLayout(s);
    return build((gb, add) => {
      const at = (x, z) => [x - s.x, z - s.z];
      // plaza
      add({ w: 12, h: 0.06, l: 12, c: 1.5, col: '#cdb88a' }, [0, 0.03, 0]);
      for (const h of L.houses) {
        const [x, z] = at(h.x, h.z);
        const m = (pos, rot) => R.mat([x + pos[0] * Math.cos(h.rot) + pos[2] * Math.sin(h.rot), pos[1], z - pos[0] * Math.sin(h.rot) + pos[2] * Math.cos(h.rot)], [0, h.rot + (rot || 0), 0]);
        const box = (o, pos, rot) => { o.m = m(pos, rot); gb.box(o); };
        box({ w: h.w, h: h.h, l: h.d, c: 0.05, col: h.wall }, [0, h.h / 2, 0]);
        box({ w: h.w + 0.5, h: 1.6, l: h.d + 0.5, c: 0.04, tt: 0.2, col: h.roof }, [0, h.h + 0.8, 0]);
        box({ w: 0.9, h: 1.5, l: 0.08, col: '#6a4a2e' }, [0, 0.75, h.d / 2 + 0.02]);
        box({ w: 0.7, h: 0.6, l: 0.06, col: '#ffe9a8', bucket: 1 }, [h.w * 0.3, h.h * 0.6, h.d / 2 + 0.02]);
        box({ w: 0.7, h: 0.6, l: 0.06, col: '#ffe9a8', bucket: 1 }, [-h.w * 0.3, h.h * 0.6, h.d / 2 + 0.02]);
        box({ w: 0.45, h: 1.2, l: 0.45, col: '#8a8f96' }, [h.w * 0.3, h.h + 1.2, -h.d * 0.2]);
      }
      // well
      add({ w: 1.6, h: 0.8, l: 1.6, c: 0.2, col: '#9aa0a8' }, [0, 0.4, 0]);
      add({ w: 1.2, h: 0.05, l: 1.2, col: '#3fa7ff', bucket: 0 }, [0, 0.78, 0]);
      add({ w: 0.12, h: 1.4, l: 0.12, col: '#6a4a2e' }, [-0.7, 1.1, 0]);
      add({ w: 0.12, h: 1.4, l: 0.12, col: '#6a4a2e' }, [0.7, 1.1, 0]);
      add({ w: 1.9, h: 0.5, l: 1.2, tt: 0.2, col: '#b5523b' }, [0, 2.0, 0]);
      // waypoint obelisk
      let [ox, oz] = at(L.obelisk.x, L.obelisk.z);
      add({ w: 1.4, h: 0.3, l: 1.4, c: 0.1, col: '#7a7f8a' }, [ox, 0.15, oz]);
      add({ w: 0.6, h: 2.6, l: 0.6, c: 0.08, tt: 0.55, col: '#5b5e6b' }, [ox, 1.6, oz]);
      add({ w: 0.36, h: 0.36, l: 0.36, c: 0.08, col: '#6fe3ff', bucket: 1 }, [ox, 3.2, oz], [0.6, 0.6, 0]);
      // fusion lab (domed hut with a glowing crystal)
      [ox, oz] = at(L.lab.x, L.lab.z);
      add({ w: 4, h: 2.4, l: 3.2, c: 0.3, col: '#d8d0e8' }, [ox, 1.2, oz]);
      add({ w: 4.4, h: 1.2, l: 3.6, c: 0.5, tt: 0.5, col: '#7a5ab0' }, [ox, 3.0, oz]);
      add({ w: 0.6, h: 1.2, l: 0.6, tt: 0.2, col: '#d07bff', bucket: 1 }, [ox, 4.1, oz]);
      add({ w: 1.0, h: 1.6, l: 0.08, col: '#4a3a6a' }, [ox, 0.8, oz + 1.62]);
      // forge
      [ox, oz] = at(L.forge.x, L.forge.z);
      add({ w: 2.2, h: 1.2, l: 1.6, c: 0.1, col: '#6a6e76' }, [ox, 0.6, oz]);
      add({ w: 1.2, h: 0.3, l: 0.8, col: '#ff7a2f', bucket: 1 }, [ox, 1.2, oz]);
      add({ w: 0.6, h: 2.2, l: 0.6, col: '#5a5e66' }, [ox - 0.7, 2.0, oz - 0.4]);
      add({ w: 0.9, h: 0.5, l: 0.5, c: 0.08, col: '#3a3e46' }, [ox + 1.4, 0.55, oz + 0.6]);
      add({ w: 0.4, h: 0.3, l: 0.3, col: '#3a3e46' }, [ox + 1.4, 0.15, oz + 0.6]);
      // merchant stall
      [ox, oz] = at(L.stall.x, L.stall.z);
      add({ w: 2.6, h: 0.9, l: 1.2, c: 0.05, col: '#a8743b' }, [ox, 0.45, oz]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add({ w: 0.1, h: 2.2, l: 0.1, col: '#6a4a2e' }, [ox + sx * 1.2, 1.1, oz + sz * 0.55]);
      add({ w: 2.9, h: 0.25, l: 1.5, c: 0.05, col: '#e85a4a' }, [ox, 2.25, oz]);
      add({ w: 2.9, h: 0.26, l: 0.5, col: '#f2efe6' }, [ox, 2.26, oz]);
      for (let i = 0; i < 4; i++) add({ w: 0.25, h: 0.25, l: 0.25, c: 0.05, col: ['#ff5a6a', '#5ab4ff', '#ffd166', '#5fd068'][i] }, [ox - 0.9 + i * 0.6, 1.02, oz]);
      // lamps
      for (const lp of L.lamps) {
        const [lx, lz] = at(lp.x, lp.z);
        add({ w: 0.12, h: 1.9, l: 0.12, col: '#3b3f46' }, [lx, 0.95, lz]);
        add({ w: 0.3, h: 0.35, l: 0.3, c: 0.04, col: '#ffcf6a', bucket: 1 }, [lx, 2.05, lz]);
      }
    });
  }
  function buildRuin(world, s) {
    const L = world.ruinLayout(s);
    return build((gb, add) => {
      add({ w: 18, h: 0.08, l: 18, c: 3, col: '#9a958a' }, [0, 0.04, 0]);
      for (const p of L.pillars) {
        add({ w: 0.9, h: p.h, l: 0.9, c: 0.08, col: '#b8b2a4' }, [p.x - s.x, p.h / 2, p.z - s.z]);
        if (p.h > 2.4) add({ w: 1.2, h: 0.3, l: 1.2, c: 0.05, col: '#a8a294' }, [p.x - s.x, p.h + 0.15, p.z - s.z]);
      }
      for (const w of L.walls) add({ w: w.w, h: w.h, l: 0.6, c: 0.08, col: '#a39d90' }, [w.x - s.x, w.h / 2, w.z - s.z], [0, w.rot, 0]);
      add({ w: 0.9, h: 1.4, l: 0.3, c: 0.08, col: '#6a7a8a' }, [L.lore.x - s.x, 0.7, L.lore.z - s.z]);
      add({ w: 0.5, h: 0.5, l: 0.04, col: '#7af0ff', bucket: 1 }, [L.lore.x - s.x, 0.85, L.lore.z - s.z + 0.16]);
    });
  }
  function buildCamp(world, s) {
    const L = world.campLayout(s);
    return build((gb, add) => {
      add({ w: 14, h: 0.05, l: 14, c: 3, col: '#9a7a5a' }, [0, 0.025, 0]);
      for (const t of L.tents) add({ w: 2.4, h: 1.8, l: 2.6, tt: 0.08, c: 0.02, col: t.c }, [t.x - s.x, 0.9, t.z - s.z], [0, t.rot, 0]);
      for (let i = 0; i < 6; i++) { const a = i * 1.05; add({ w: 0.3, h: 0.2, l: 0.3, c: 0.05, col: '#7c828a' }, [Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7]); }
      add({ w: 0.6, h: 0.5, l: 0.6, tt: 0.2, col: '#ff9b2f', bucket: 1 }, [0, 0.3, 0]);
      add({ w: 0.3, h: 0.35, l: 0.3, tt: 0.2, col: '#fff2a8', bucket: 1 }, [0, 0.35, 0]);
    });
  }
  function buildCave(world, s) {
    return build((gb, add) => {
      add({ w: 6, h: 2.6, l: 4.5, c: 0.8, tt: 0.6, col: '#7c828a' }, [0, 1.3, -0.5]);
      add({ w: 3.5, h: 1.8, l: 3, c: 0.5, tt: 0.6, col: '#8d939b' }, [2.2, 0.9, 0.4]);
      add({ w: 2.2, h: 1.9, l: 0.3, c: 0.3, tt: 0.7, col: '#14161c' }, [0, 0.95, 1.75]);
      add({ w: 0.4, h: 0.4, l: 0.4, c: 0.05, col: '#6fe3ff', bucket: 1 }, [-1.8, 1.6, 1.2], [0.4, 0.4, 0]);
    });
  }
  function buildDungeon(world, s) {
    return build((gb, add) => {
      add({ w: 9, h: 0.3, l: 6, c: 0.1, col: '#5a5e6b' }, [0, 0.15, 0]);
      for (const sx of [-1, 1]) {
        add({ w: 1.2, h: 4.2, l: 1.2, c: 0.1, col: '#4a4d58' }, [sx * 2.2, 2.1, 1]);
        add({ w: 0.5, h: 0.5, l: 0.5, c: 0.1, col: '#ff5a3a', bucket: 1 }, [sx * 2.2, 4.5, 1]);
        add({ w: 0.9, h: 1.8, l: 0.06, col: '#8b2234' }, [sx * 2.2, 2.8, 1.62]);
      }
      add({ w: 5.6, h: 1.0, l: 1.4, c: 0.1, col: '#4a4d58' }, [0, 4.6, 1]);
      add({ w: 3.2, h: 3.4, l: 0.3, c: 0.1, col: '#0c0d12' }, [0, 1.85, 0.6]);
      add({ w: 7, h: 3.8, l: 3, c: 0.3, tt: 0.85, col: '#5a5e6b' }, [0, 1.9, -1.2]);
      add({ w: 0.7, h: 0.7, l: 0.12, c: 0.08, col: '#ffd166', bucket: 1 }, [0, 4.6, 1.75]);
    });
  }
  function buildShrine(world, s) {
    return build((gb, add) => {
      add({ w: 3, h: 0.3, l: 3, c: 0.2, col: '#7a7f8a' }, [0, 0.15, 0]);
      add({ w: 0.6, h: 2.6, l: 0.6, c: 0.08, tt: 0.55, col: '#5b5e6b' }, [0, 1.6, 0]);
      add({ w: 0.36, h: 0.36, l: 0.36, c: 0.08, col: '#6fe3ff', bucket: 1 }, [0, 3.2, 0], [0.6, 0.6, 0]);
    });
  }
  const STRUCT_BUILDERS = { village: buildVillage, ruin: buildRuin, camp: buildCamp, cave: buildCave, dungeon: buildDungeon, shrine: buildShrine };
  function structureGeo(world, s) {
    const fn = STRUCT_BUILDERS[s.type];
    return fn ? fn(world, s) : null;
  }

  // Small dynamic objects.
  const OBJECT_BUILDERS = {
    chest: (gb, add) => {
      add({ w: 0.9, h: 0.55, l: 0.62, c: 0.04, col: '#8a5a2b' }, [0, 0.28, 0]);
      add({ w: 0.92, h: 0.28, l: 0.64, c: 0.08, col: '#9a6a3b' }, [0, 0.69, 0]);
      add({ w: 0.94, h: 0.12, l: 0.66, col: '#c9a24a' }, [0, 0.55, 0]);
      add({ w: 0.16, h: 0.2, l: 0.06, col: '#f2c14e' }, [0, 0.52, 0.33]);
    },
    chestBig: (gb, add) => {
      add({ w: 1.3, h: 0.7, l: 0.85, c: 0.05, col: '#5a2a6a' }, [0, 0.35, 0]);
      add({ w: 1.32, h: 0.38, l: 0.87, c: 0.1, col: '#6a3a7a' }, [0, 0.89, 0]);
      add({ w: 1.34, h: 0.14, l: 0.89, col: '#f2c14e' }, [0, 0.7, 0]);
      add({ w: 0.22, h: 0.26, l: 0.06, col: '#ffe08a', bucket: 1 }, [0, 0.66, 0.45]);
    },
    chestOpen: (gb, add) => {
      add({ w: 0.9, h: 0.55, l: 0.62, c: 0.04, col: '#6a4a2b' }, [0, 0.28, 0]);
      add({ w: 0.92, h: 0.62, l: 0.12, c: 0.04, col: '#7a5a3b' }, [0, 0.85, -0.34], [-0.25, 0, 0]);
      add({ w: 0.8, h: 0.04, l: 0.5, col: '#2a1a10' }, [0, 0.54, 0]);
    },
    drop: (gb, add) => { add({ w: 0.36, h: 0.36, l: 0.36, c: 0.08, col: '#ffffff', bucket: 1 }, [0, 0.18, 0], [0.6, 0.6, 0]); },
    coin: (gb, add) => { add({ w: 0.28, h: 0.28, l: 0.08, c: 0.06, col: '#f2c14e', bucket: 1 }, [0, 0.2, 0]); },
    exitPortal: (gb, add) => {
      add({ w: 2.4, h: 0.15, l: 2.4, c: 0.3, col: '#6fe3ff', bucket: 1 }, [0, 0.08, 0]);
      add({ w: 1.6, h: 0.12, l: 1.6, c: 0.25, col: '#e8fbff', bucket: 1 }, [0, 0.16, 0]);
    },
    door: (gb, add) => { add({ w: 2, h: 2.4, l: 2, c: 0.05, col: '#6a2a2a' }, [0, 1.2, 0]); add({ w: 2.04, h: 0.3, l: 2.04, col: '#c9a24a' }, [0, 1.6, 0]); },
    spikes: (gb, add) => { for (let i = 0; i < 4; i++) add({ w: 0.25, h: 0.5, l: 0.25, tt: 0.1, col: '#b8bec6' }, [(i % 2 ? 0.4 : -0.4), 0.25, (i < 2 ? 0.4 : -0.4)]); add({ w: 1.9, h: 0.04, l: 1.9, col: '#4a3a3a' }, [0, 0.02, 0]); },
  };
  function objectGeo(type) {
    if (!cache.has('o:' + type)) cache.set('o:' + type, build(OBJECT_BUILDERS[type]));
    return cache.get('o:' + type);
  }

  // Floating "bound" weapons, tinted by rarity.
  function weaponGeo(base, rarity) {
    const key = 'w:' + base + rarity;
    if (cache.has(key)) return cache.get(key);
    const metal = { common: '#c8ced6', uncommon: '#a8e0b0', rare: '#a8c8f0', epic: '#d0b0f0', legendary: '#ffd27a' }[rarity] || '#c8ced6';
    const glow = (AM.RARITY[rarity] || AM.RARITY.common).color;
    const wood = '#7a5233';
    const geo = build((gb, add) => {
      switch (base) {
        case 'sword': add({ w: 0.08, h: 0.95, l: 0.03, tt: 0.6, col: metal }, [0, 0.55, 0]); add({ w: 0.34, h: 0.06, l: 0.08, col: glow }, [0, 0.07, 0]); add({ w: 0.06, h: 0.26, l: 0.06, col: wood }, [0, -0.1, 0]); break;
        case 'greataxe': add({ w: 0.07, h: 1.2, l: 0.07, col: wood }, [0, 0.3, 0]); add({ w: 0.5, h: 0.42, l: 0.04, tt: 1.4, col: metal }, [0.22, 0.75, 0]); add({ w: 0.08, h: 0.1, l: 0.08, col: glow }, [0, 0.95, 0]); break;
        case 'hammer': add({ w: 0.07, h: 1.0, l: 0.07, col: wood }, [0, 0.3, 0]); add({ w: 0.52, h: 0.28, l: 0.28, c: 0.04, col: metal }, [0, 0.82, 0]); add({ w: 0.54, h: 0.06, l: 0.3, col: glow }, [0, 0.82, 0]); break;
        case 'spear': add({ w: 0.05, h: 1.5, l: 0.05, col: wood }, [0, 0.45, 0]); add({ w: 0.12, h: 0.32, l: 0.03, tt: 0.1, col: metal }, [0, 1.35, 0]); add({ w: 0.1, h: 0.06, l: 0.1, col: glow }, [0, 1.18, 0]); break;
        case 'daggers': for (const s of [-1, 1]) { add({ w: 0.06, h: 0.45, l: 0.02, tt: 0.4, col: metal }, [s * 0.14, 0.32, 0], [0, 0, s * 0.3]); add({ w: 0.16, h: 0.04, l: 0.05, col: glow }, [s * 0.1, 0.08, 0], [0, 0, s * 0.3]); } break;
        case 'bow': add({ w: 0.05, h: 0.5, l: 0.05, col: wood }, [0, 0.62, 0.12], [0.35, 0, 0]); add({ w: 0.05, h: 0.5, l: 0.05, col: wood }, [0, 0.18, 0.12], [-0.35, 0, 0]); add({ w: 0.01, h: 0.85, l: 0.01, col: '#eeeeee' }, [0, 0.4, -0.02]); add({ w: 0.07, h: 0.1, l: 0.07, col: glow }, [0, 0.4, 0.2]); break;
        case 'staff': add({ w: 0.06, h: 1.3, l: 0.06, col: wood }, [0, 0.35, 0]); add({ w: 0.22, h: 0.22, l: 0.22, c: 0.06, col: glow, bucket: 1 }, [0, 1.1, 0], [0.6, 0.6, 0]); break;
        default: add({ w: 0.2, h: 0.2, l: 0.2, col: metal }, [0, 0.3, 0]);
      }
    });
    cache.set(key, geo);
    return geo;
  }

  Object.assign(R, { propGeo, structureGeo, objectGeo, weaponGeo, PROP_TYPES: Object.keys(PROP_BUILDERS), ORE_COL });
})(typeof window !== 'undefined' ? window : globalThis);
