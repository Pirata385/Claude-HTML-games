/* The Inkwell: entering, ladders between floors, the elevator, digging ore, and the dark. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const Mine = PA.Mine = {
    async enter(game) {
      const s = game.state;
      let floor = 1;
      if (s.flags.elevator && s.mine.deepest >= 5) {
        const opts = ['Floor 1'];
        for (let f = 5; f <= Math.min(30, s.mine.deepest); f += 5) opts.push('Floor ' + f);
        opts.push('Cancel');
        const i = await PA.UI.confirm('The mine elevator hums. Which floor?', opts);
        if (i === opts.length - 1) return;
        floor = i === 0 ? 1 : i * 5;
      }
      Mine.go(game, floor);
    },
    go(game, floor) {
      const s = game.state;
      game.pageTurn(() => {
        const m = PA.Gen.mineFloor(s.seed, floor);
        game.maps.mine = m;
        s.forage = s.forage.filter((f) => f.map !== 'mine').concat(m.forage || []);
        s.mine.deepest = Math.max(s.mine.deepest, floor);
        game.loadMap('mine', m.spots.entry.x, m.spots.entry.z, 1);
        PA.UI.toast(m.boss ? 'Floor ' + floor + '... something big is here.' : 'The Inkwell, floor ' + floor, 2500);
      });
    },
    leave(game) {
      const d = game.maps.overworld.doors.find((q) => q.to === 'mine');
      game.state.forage = game.state.forage.filter((f) => f.map !== 'mine');
      game.goTo('overworld', d.x, d.z - 1, 1);
    },
    /** Ladders: E / step-forward near them. Returns true when handled. */
    checkLadders(game, inp) {
      const m = game.map; if (m.kind !== 'mine' || !(inp.interactP || inp.upP)) return false;
      const p = game.player, cx = Math.floor(p.x / C.CELL_W);
      for (const pr of m.props) {
        if (pr.type !== 'mineLadder' || Math.abs(cx - pr.x) > 2 || Math.abs(p.z - pr.z) > 1) continue;
        inp.interactP = false; inp.upP = false;
        if (pr.up) Mine.leave(game); else Mine.go(game, m.floor + 1);
        return true;
      }
      return false;
    },
    /** Pickaxe in the mine: break the rock in front of you (at body height, then below). */
    dig(game, x, z, lvl) {
      if (game.map.kind !== 'mine') return false;
      const g = game.map.grid, p = game.player, feet = Math.floor((p.feet - 1) / C.CELL_H);
      const cells = [[x, feet], [x, feet - 1], [x, feet - 2], [x, feet + 1], [Math.floor(p.x / C.CELL_W), feet + 1]];
      for (const [cx, cy] of cells) {
        const t = g.get(cx, cy, z), d = PA.TILES[t];
        if (!d || !d.breakable || d.breakable.tool !== 'pickaxe' || cy >= g.h - 2) continue;
        const key = cx + ',' + cy + ',' + z;
        game.map.tileHp = game.map.tileHp || {};
        const hp = (game.map.tileHp[key] != null ? game.map.tileHp[key] : Math.ceil(d.breakable.hp / 3)) - (1 + lvl);
        game.map.tileHp[key] = hp;
        if (hp <= 0) {
          g.set(cx, cy, z, PA.T.AIR);
          if (d.breakable.drop) game.inv.add(d.breakable.drop, 1);
          if (t === PA.T.STONE && Math.random() < 0.08) game.inv.add('clay', 1);
          PA.Bus.emit('break', { tile: t });
        } else PA.Bus.emit('chip');
        return true;
      }
      return false;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
