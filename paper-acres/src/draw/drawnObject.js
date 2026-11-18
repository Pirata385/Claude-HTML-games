/* Drawings made real: placement, Matter bodies shaped like the strokes, behaviours per word, fading, erasing. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const STATIC_AFTER_SETTLE = new Set(['static']);
  const DECOR = new Set(['chair', 'table', 'bed', 'lamp', 'painting', 'flower_pot', 'clock', 'sign']);

  /** Centre strokes on their bounding-box centre; returns {strokes, w, h}. */
  function normalize(strokes) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of strokes) for (const p of s) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { strokes: strokes.map((s) => s.map((p) => ({ x: Math.round((p.x - cx) * 10) / 10, y: Math.round((p.y - cy) * 10) / 10 }))), w: Math.max(4, x1 - x0), h: Math.max(4, y1 - y0) };
  }
  /** Ramer-Douglas-Peucker to keep physics parts few. */
  function simplify(pts, eps) {
    if (pts.length < 3) return pts;
    const a = pts[0], b = pts[pts.length - 1];
    let md = 0, mi = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      const d = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / l;
      if (d > md) { md = d; mi = i; }
    }
    if (md <= eps) return [a, b];
    return simplify(pts.slice(0, mi + 1), eps).slice(0, -1).concat(simplify(pts.slice(mi), eps));
  }
  function meanRadius(strokes) { let n = 0, s = 0; for (const st of strokes) for (const p of st) { s += Math.hypot(p.x, p.y); n++; } return n ? s / n : 10; }

  const Drawn = PA.Drawn = {
    live: [],   // {rec, body}
    zones: [],  // ladder / rope climbing zones {z, x0, x1, y0, y1}
    normalize, simplify,

    /* ---------------- placement ---------------- */
    beginPlacement(game, d) {
      const s = game.state, w = PA.Words.get(d.word);
      if (!PA.Ink.valid(d.strokes)) return;
      if (PA.Ink.available(s, game.inv, d.medium) < d.cost) { PA.UI.toast('Not enough ' + (d.medium === 'pen' ? 'ink' : 'lead') + '.'); return; }
      const n = normalize(d.strokes);
      if (w.body === 'item') {
        if (game.inv.free() === 0) { PA.UI.toast('Your bag is full.'); return; }
        PA.Ink.charge(s, game.inv, d.cost, d.medium);
        const rec = { id: 'd' + Date.now().toString(36), word: d.word, medium: d.medium, cost: d.cost, day: s.stats.days, strokes: n.strokes, w: n.w, h: n.h, item: true };
        s.drawings.push(rec);
        game.inv.add('drawn', 1, { drawing: rec.id, word: d.word, name: w.name, as: w.as, icon: '{' + w.name[0].toLowerCase() + '}', medium: d.medium, day: s.stats.days, water: w.as === 'can' ? 30 : undefined, lvl: 1 });
        s.stats.drawn = (s.stats.drawn || 0) + 1;
        PA.UI.toast('Your ' + w.name.toLowerCase() + ' pops off the page and into your bag!');
        PA.Bus.emit('drawn', { word: d.word });
        return;
      }
      const p = game.player;
      game.placing = { d, n, w, x: p.x + p.facing * (n.w / 2 + 24), z: p.z };
      PA.Input.clearAll();
      PA.UI.Place && PA.UI.Place.show(true);
      PA.UI.toast(PA.Touch.isTouch() ? 'Move it with the arrows, then place it.' : 'A/D move, W/S slice ahead/behind, E or click to place, Esc to cancel', 3500);
    },
    placementInput(game, inp) {
      const pl = game.placing; if (!pl) return;
      pl.hold = (pl.hold || 0) + 1;
      if (inp.moveX) pl.x += inp.moveX * 2.4;
      if (inp.upP) pl.z = Math.min(game.player.z + 1, Math.min(game.map.grid.d - 1, pl.z + 1));
      if (inp.downP) pl.z = Math.max(game.player.z - 1, Math.max(0, pl.z - 1));
      pl.x = PA.U.clamp(pl.x, pl.n.w / 2, game.map.grid.w * C.CELL_W - pl.n.w / 2);
      if (inp.pauseP || inp.menuP) return Drawn.cancelPlacement(game);
      if ((inp.useP || inp.interactP || inp.jumpP) && pl.hold > 6) Drawn.confirmPlacement(game);
    },
    cancelPlacement(game) { game.placing = null; PA.UI.Place && PA.UI.Place.show(false); PA.UI.toast('Put the drawing away.'); },
    ghostY(game, pl) {
      const g = game.map.grid, xc = Math.floor(pl.x / C.CELL_W);
      let top = g.h;
      for (let x = Math.floor((pl.x - pl.n.w / 2) / C.CELL_W); x <= Math.floor((pl.x + pl.n.w / 2) / C.CELL_W); x++) top = Math.min(top, g.surfaceY(x, pl.z));
      if (pl.w.id === 'balloon' || pl.w.id === 'lamp' || pl.w.id === 'painting') top = g.surfaceY(xc, pl.z);
      return top * C.CELL_H - pl.n.h / 2 - 6;
    },
    confirmPlacement(game) {
      const pl = game.placing, s = game.state;
      if (!PA.Ink.charge(s, game.inv, pl.d.cost, pl.d.medium)) { PA.UI.toast('Not enough ' + (pl.d.medium === 'pen' ? 'ink' : 'lead') + '.'); return Drawn.cancelPlacement(game); }
      const rec = { id: 'd' + Date.now().toString(36) + Math.floor(Math.random() * 99), map: game.map.id, z: pl.z, x: pl.x, y: Drawn.ghostY(game, pl), angle: 0,
        word: pl.w.id, medium: pl.d.medium, cost: pl.d.cost, day: s.stats.days, strokes: pl.n.strokes, w: pl.n.w, h: pl.n.h };
      game.placing = null;
      PA.UI.Place && PA.UI.Place.show(false);
      const finish = () => {
        s.drawings.push(rec);
        s.stats.drawn = (s.stats.drawn || 0) + 1;
        Drawn.spawn(game, rec);
        PA.Bus.emit('drawn', { word: rec.word });
        PA.UI.toast('The ' + pl.w.name.toLowerCase() + ' becomes real!');
      };
      if (rec.word === 'sign') {
        const t = (window.prompt('What does the sign say? (16 letters)', '') || '').slice(0, 16).replace(/[^\x20-\x7e]/g, '');
        rec.text = t; PA.Input.clearAll();
      }
      finish();
    },

    /* ---------------- bodies ---------------- */
    spawn(game, rec) {
      const w = PA.Words.get(rec.word); if (!w) return;
      const M = game.matter;
      const entry = { rec, body: null, w, still: 0, born: game.simTime || 0 };
      if (w.body === 'ladder' || w.body === 'rope') {
        Drawn.zones.push({ id: rec.id, z: rec.z, x0: rec.x - Math.max(10, rec.w / 2), x1: rec.x + Math.max(10, rec.w / 2), y0: rec.y - rec.h / 2, y1: rec.y + rec.h / 2 });
        Drawn.live.push(entry);
        return entry;
      }
      const opts = { friction: w.friction || 0.6, frictionStatic: 0.8, restitution: w.bounce || 0.05, density: w.density || 0.0025, collisionFilter: PA.filters.prop(rec.z), label: 'drawn' };
      let body;
      const round = ['round'].includes(w.dom) && rec.strokes.length <= 3;
      if (round || w.body === 'bomb' || w.body === 'balloon') body = M.add.circle(rec.x, rec.y, Math.max(6, meanRadius(rec.strokes)), opts);
      else {
        const parts = [];
        for (const st of rec.strokes) {
          const pts = simplify(st, 2.5);
          for (let i = 1; i < pts.length && parts.length < 28; i++) {
            const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.y - a.y);
            if (len < 2) continue;
            parts.push(M.bodies.rectangle(rec.x + (a.x + b.x) / 2, rec.y + (a.y + b.y) / 2, len + 4, 5, { angle: Math.atan2(b.y - a.y, b.x - a.x) }));
          }
        }
        if (!parts.length) parts.push(M.bodies.rectangle(rec.x, rec.y, 8, 8));
        body = M.body.create(Object.assign({ parts }, opts));
        M.world.add(body);
      }
      M.body.setAngle(body, rec.angle || 0);
      body.label = 'drawn'; body.drawn = entry;
      if (DECOR.has(rec.word)) body.isSensor = true;
      if (rec.static || w.body === 'spring' || DECOR.has(rec.word)) M.body.setStatic(body, true);
      if (w.body === 'balloon') body.ignoreGravity = true;
      if (w.body === 'seesaw') {
        M.body.setStatic(body, false);
        entry.pin = M.add.constraint(body, null, 0, 1, { pointB: { x: rec.x, y: rec.y }, pointA: { x: 0, y: 0 } });
        entry.pin.bodyB = null; entry.pin.pointB = { x: rec.x, y: rec.y };
      }
      entry.body = body;
      if (w.body === 'bomb') entry.fuse = rec.fuse != null ? rec.fuse : 2600;
      Drawn.live.push(entry);
      return entry;
    },
    /** Build bodies for the drawings of the map that was just loaded. */
    loadMap(game) {
      Drawn.clearBodies(game);
      for (const rec of game.state.drawings) if (!rec.item && rec.map === game.map.id) Drawn.spawn(game, rec);
    },
    clearBodies(game) {
      for (const e of Drawn.live) { if (e.body) game.matter.world.remove(e.body); if (e.pin) game.matter.world.removeConstraint(e.pin); }
      Drawn.live = []; Drawn.zones = [];
    },
    remove(game, e) {
      if (e.body) game.matter.world.remove(e.body);
      if (e.pin) game.matter.world.removeConstraint(e.pin);
      Drawn.live.splice(Drawn.live.indexOf(e), 1);
      Drawn.zones = Drawn.zones.filter((zz) => zz.id !== e.rec.id);
      const s = game.state; s.drawings.splice(s.drawings.indexOf(e.rec), 1);
    },
    /** Write live positions back into the records (before saving). */
    sync() {
      for (const e of Drawn.live) if (e.body) { e.rec.x = Math.round(e.body.position.x * 10) / 10; e.rec.y = Math.round(e.body.position.y * 10) / 10; e.rec.angle = Math.round(e.body.angle * 1000) / 1000; e.rec.static = !!e.body.isStatic && !e.dormant; if (e.fuse != null) e.rec.fuse = e.fuse; }
    },
    onLadder(z, x, y0, y1) { return Drawn.zones.some((q) => q.z === z && x >= q.x0 && x <= q.x1 && y1 >= q.y0 && y0 <= q.y1); },

    /* ---------------- per physics step ---------------- */
    step(game, dt) {
      const M = game.matter, g = game.map.grid, p = game.player;
      for (const e of [...Drawn.live]) {
        const b = e.body; if (!b) continue;
        const loaded = game.terrain.isLoaded(b.position.x, e.rec.z);
        if (!loaded && !b.isStatic) { M.body.setStatic(b, true); e.dormant = true; continue; }
        if (loaded && e.dormant) { M.body.setStatic(b, false); e.dormant = false; }
        const w = e.w;
        if (w.body === 'float' && !b.isStatic) {
          const cx = Math.floor(b.position.x / C.CELL_W), cy = Math.floor((b.position.y + e.rec.h * 0.25) / C.CELL_H);
          if (g.def(cx, cy, e.rec.z).water) {
            let top = cy; while (g.def(cx, top - 1, e.rec.z).water) top--;
            const target = top * C.CELL_H - e.rec.h * 0.15;
            M.body.setVelocity(b, { x: b.velocity.x * 0.96, y: PA.U.clamp((target - b.position.y) * 0.08, -2.5, 2.5) });
            M.body.setAngularVelocity(b, b.angularVelocity * 0.9 - b.angle * 0.02);
          }
        } else if (w.body === 'balloon' && !b.isStatic) {
          e.home = e.home != null ? e.home : b.position.y - 7 * C.CELL_H;
          M.body.setVelocity(b, { x: b.velocity.x * 0.97, y: PA.U.clamp((e.home - b.position.y) * 0.02, -1.2, 1.2) });
        } else if (w.body === 'spring') {
          if (p.standingOn === b && p.z === e.rec.z && p.vy >= -1) { p.setVel(p.vx, -13.5); PA.Bus.emit('boing'); e.squash = 1; }
        } else if (w.body === 'bomb' && e.fuse != null) {
          e.fuse -= dt;
          if (e.fuse <= 0) { Drawn.explode(game, e); continue; }
        }
        if (STATIC_AFTER_SETTLE.has(w.body) && !b.isStatic && !e.dormant) {
          e.still = b.speed < 0.08 && Math.abs(b.angularVelocity) < 0.004 ? e.still + 1 : 0;
          if (e.still > 40) { M.body.setStatic(b, true); PA.Bus.emit('settle'); }
        }
        if (b.position.y > g.h * C.CELL_H + 200) Drawn.remove(game, e);
      }
    },
    explode(game, e) {
      const b = e.body, M = game.matter, g = game.map.grid, z = e.rec.z, R = 80;
      for (const o of M.world.getAllBodies()) {
        if (o === b || o.isStatic || !(o.collisionFilter.category & (PA.sliceBit(z) | PA.actorBit(z)))) continue;
        const dx = o.position.x - b.position.x, dy = o.position.y - b.position.y, d = Math.hypot(dx, dy);
        if (d > R) continue;
        const k = (1 - d / R) * 14;
        M.body.setVelocity(o, { x: o.velocity.x + dx / (d || 1) * k, y: o.velocity.y + dy / (d || 1) * k - 3 });
      }
      const cx = Math.floor(b.position.x / C.CELL_W), cy = Math.floor(b.position.y / C.CELL_H);
      for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 4; x <= cx + 4; x++) {
        const t = g.get(x, y, z), d = PA.TILES[t];
        if (t === PA.T.ROCK || t === PA.T.WEED || t === PA.T.BRANCH || t === PA.T.FRAGILE || (d && d.breakable && d.breakable.tool === 'pickaxe' && game.map.kind === 'mine')) {
          if (d.breakable && d.breakable.drop && Math.random() < 0.5) game.inv.add(d.breakable.drop, 1);
          g.set(x, y, z, PA.T.AIR);
        }
      }
      const p = game.player;
      if (p.z === z && Math.hypot(p.x - b.position.x, p.feet - 30 - b.position.y) < 60 && PA.Combat) PA.Combat.hurtPlayer(game, 25, b.position.x);
      PA.Bus.emit('explode', { x: b.position.x, y: b.position.y, z });
      game.shake = 1;
      Drawn.remove(game, e);
    },
    eraseNear(game) {
      const p = game.player;
      let best = null, bd = 60;
      for (const e of Drawn.live) {
        if (e.rec.z !== p.z) continue;
        const x = e.body ? e.body.position.x : e.rec.x, y = e.body ? e.body.position.y : e.rec.y;
        const d = Math.hypot(x - (p.x + p.facing * 20), y - (p.feet - 30));
        if (d < bd + Math.max(e.rec.w, e.rec.h) / 2) { bd = d; best = e; }
      }
      if (!best) { PA.UI.toast('Nothing drawn here to erase.'); return false; }
      if (best.rec.medium === 'pen') { PA.UI.toast('Pen does not erase!'); return false; }
      PA.Ink.refund(game.state, best.rec);
      Drawn.remove(game, best);
      PA.UI.toast('Erased (half the lead came back).');
      PA.Bus.emit('erase');
      return true;
    },
    /** Pencil fades after 3 days (on the page and in your bag). */
    newDay(game) {
      const s = game.state, today = s.stats.days;
      const old = (r) => r.medium !== 'pen' && today - r.day >= 3;
      for (const e of [...Drawn.live]) if (old(e.rec)) Drawn.remove(game, e);
      const gone = s.drawings.filter(old).length;
      s.drawings = s.drawings.filter((r) => !old(r));
      let items = 0;
      game.inv.slots.forEach((sl, i) => { if (sl && sl.id === 'drawn' && sl.extra.medium !== 'pen' && today - sl.extra.day >= 3) { game.inv.slots[i] = null; items++; } });
      if (gone + items) PA.UI.toast((gone + items) + ' pencil drawing' + (gone + items > 1 ? 's' : '') + ' faded away overnight.', 3500);
      PA.Bus.emit('inv');
    },
    useItem(game, slot) {
      const ex = slot.extra || {};
      if (ex.as && ['hoe', 'can', 'axe', 'pickaxe'].includes(ex.as)) {
        if (game.player.action) return false;
        game.player.action = { kind: ex.as, t: 0, dur: 300, progress: 0, applied: false, lvl: 1, cost: 1 };
        return true;
      }
      if (ex.as === 'rod' && PA.Fishing) return PA.Fishing.cast(game, slot);
      if ((ex.as === 'sword' || ex.shield || ex.word === 'boomerang') && PA.Combat) return PA.Combat.swing(game, slot);
      if (ex.word === 'umbrella') { PA.UI.toast('Hold it while falling to glide; it keeps the rain off.'); return true; }
      if (ex.word === 'lantern') { PA.UI.toast('Your lantern lights up the night while you carry it.'); return true; }
      PA.UI.toast('A drawn ' + (ex.name || 'thing').toLowerCase() + '.');
      return false;
    },

    /* ---------------- drawing ---------------- */
    strokePath(ctx, strokes) {
      ctx.beginPath();
      for (const st of strokes) { ctx.moveTo(st[0].x, st[0].y); for (let i = 1; i < st.length; i++) ctx.lineTo(st[i].x, st[i].y); }
    },
    draw(R, z, p, st, game) {
      if (p.level < 0) return;
      const ctx = R.ctx, today = game.state.stats.days;
      R.use(p);
      for (const e of Drawn.live) {
        if (e.rec.z !== z) continue;
        const x = e.body ? e.body.position.x : e.rec.x, y = e.body ? e.body.position.y : e.rec.y, a = e.body ? e.body.angle : 0;
        if (x < st.wx0 - 200 || x > st.wx1 + 200) continue;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        if (e.squash > 0.02) { ctx.scale(1, 1 - e.squash * 0.35); e.squash *= 0.85; }
        ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (e.rec.medium !== 'pen') { const age = today - e.rec.day; ctx.setLineDash(age >= 2 ? [st.lw * 3, st.lw * 5] : age >= 1 ? [st.lw * 6, st.lw * 3] : []); }
        Drawn.strokePath(ctx, e.rec.strokes); ctx.stroke(); ctx.setLineDash([]);
        if (e.fuse != null && Math.floor(e.fuse / 200) % 2) { ctx.beginPath(); ctx.moveTo(0, -e.rec.h / 2); ctx.lineTo(4, -e.rec.h / 2 - 8); ctx.stroke(); }
        ctx.restore();
        if (e.rec.text && p.level <= 1) R.stampText(p.ox + (x - e.rec.text.length * C.CELL_W / 4) * p.scale, p.oy + (y - 4) * p.scale, e.rec.text, { style: 1 });
      }
      const pl = game.placing;
      if (pl && pl.z === z) {
        const y = Drawn.ghostY(game, pl);
        ctx.save(); ctx.translate(pl.x, y);
        ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink; ctx.setLineDash([st.lw * 2, st.lw * 4]);
        Drawn.strokePath(ctx, pl.n.strokes); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
      }
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Drawn;
})(typeof window !== 'undefined' ? window : globalThis);
