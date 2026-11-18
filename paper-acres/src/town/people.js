/* Townsfolk in the world: they follow their routines, walk between slices, and are drawn as stick figures
 * with their own accessories (the ASCII renderer converts them like everything else). */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const SPEED = 1.15; // px per physics step

  /** Hats, hair, glasses, beards and canes in thin pencil lines, sized to the big round head. */
  function accessories(ctx, j, look, f, lw, solidBody) {
    const X = (q) => q.x * f, h = j.head, RX = PA.Stick.HEAD.rx, RY = PA.Stick.HEAD.ry, x = X(h), top = h.y - RY;
    ctx.beginPath();
    switch (look.hat) {
      case 'top': ctx.rect(x - 6, top - 11, 12, 10); ctx.moveTo(x - RX + 1, top - 1); ctx.lineTo(x + RX - 1, top - 1); break;
      case 'cap': ctx.moveTo(x - RX * 0.75, top + 3); ctx.quadraticCurveTo(x, top - 6, x + RX * 0.75, top + 3); ctx.lineTo(x + (RX * 0.75 + 7) * f, top + 3); break;
      case 'straw': ctx.moveTo(x - RX - 4, top + 2); ctx.lineTo(x + RX + 4, top + 2); ctx.moveTo(x - 6, top + 2); ctx.quadraticCurveTo(x, top - 8, x + 6, top + 2); break;
      case 'bucket': ctx.moveTo(x - RX, top + 3); ctx.lineTo(x - 6, top - 5); ctx.lineTo(x + 6, top - 5); ctx.lineTo(x + RX, top + 3); break;
      case 'beret': ctx.ellipse(x + 2 * f, top, RX * 0.85, 3, 0.2 * f, 0, Math.PI * 2); break;
      default:
    }
    if (look.hair === 'bun') { ctx.moveTo(x - RX * 0.45 * f + 3.5, top - 2); ctx.arc(x - RX * 0.45 * f, top - 2, 3.5, 0, Math.PI * 2); }
    if (look.hair === 'bow') { ctx.moveTo(x - 3 * f, top); ctx.lineTo(x - 10 * f, top - 5); ctx.lineTo(x - 10 * f, top + 3); ctx.closePath(); }
    if (look.glasses) { ctx.moveTo(x + 3 * f + 2.6, h.y - 1); ctx.arc(x + 3 * f, h.y - 1, 2.6, 0, Math.PI * 2); }
    if (look.beard) { ctx.moveTo(x - RX * 0.5, h.y + RY * 0.4); ctx.quadraticCurveTo(x + 2 * f, h.y + RY + 6, x + RX * 0.7 * f, h.y + RY * 0.4); }
    if (look.mustache) { ctx.moveTo(x + 2 * f, h.y + RY * 0.3); ctx.lineTo(x + RX * 0.8 * f, h.y + RY * 0.4); }
    // clothes only on the far, pencil-line figures: the thin solid body stays a plain stick figure
    if (look.skirt && !solidBody) { ctx.moveTo(j.hip.x * f - 2, j.hip.y - 3); ctx.lineTo(j.hip.x * f - 9, j.hip.y + 10); ctx.lineTo(j.hip.x * f + 9, j.hip.y + 10); ctx.lineTo(j.hip.x * f + 2, j.hip.y - 3); }
    if (look.apron && !solidBody) { ctx.moveTo(j.chest.x * f + 3 * f, j.chest.y + 3); ctx.lineTo(j.hip.x * f + 5 * f, j.hip.y + 6); }
    if (look.coat && !solidBody) { ctx.moveTo(j.chest.x * f - 3, j.chest.y + 2); ctx.lineTo(j.hip.x * f - 8, j.hip.y + 8); ctx.moveTo(j.chest.x * f + 3, j.chest.y + 2); ctx.lineTo(j.hip.x * f + 8, j.hip.y + 8); }
    if (look.scarf && !solidBody) { ctx.moveTo(j.chest.x * f - 4, j.chest.y - 1); ctx.lineTo(j.chest.x * f + 4, j.chest.y - 1); ctx.lineTo(j.chest.x * f - 3 * f, j.chest.y + 9); }
    if (look.cane) { ctx.moveTo(j.handR.x * f, j.handR.y); ctx.lineTo(j.handR.x * f + 2 * f, 0); }
    ctx.lineWidth = lw; ctx.stroke();
  }

  const NPCs = PA.NPCs = {
    actors: [],
    init(game) {
      NPCs.actors = PA.NPC_DATA.map((n) => ({ n, map: null, x: 0, z: 0, facing: 1, state: 'idle', anim: Math.random(), lastJ: null, talkT: 0 }));
      NPCs.place(game, true);
    },
    ctx(s) { return { season: s.season, day: s.day, weather: s.weather, seasonDays: s.seasonDays }; },
    /** Put everyone where their routine says (teleport). */
    place(game, all) {
      const s = game.state;
      for (const a of NPCs.actors) {
        const loc = PA.Dialogue.whereAt(a.n, s.time, NPCs.ctx(s));
        if (all || a.map !== game.map.id || loc.map !== game.map.id) { a.map = loc.map; a.x = (loc.x + 0.5) * C.CELL_W; a.z = loc.z; a.keeper = !!loc.keeper; }
      }
    },
    step(game, dt) {
      const s = game.state; if (!s) return;
      const ctx = NPCs.ctx(s), here = game.map.id;
      for (const a of NPCs.actors) {
        const loc = PA.Dialogue.whereAt(a.n, s.time, ctx);
        a.keeper = !!loc.keeper;
        if (a.talkT > 0) { a.talkT -= dt; a.state = 'talk'; a.anim += dt / 900; continue; }
        if (loc.map !== a.map) {
          // off-screen moves are instant; on-screen they walk out of view first (door or page edge)
          if (a.map !== here || (a.walkOut = (a.walkOut || 0) + dt) > 2500) { a.map = loc.map; a.x = (loc.x + 0.5) * C.CELL_W; a.z = loc.z; a.walkOut = 0; a.lastJ = null; continue; }
        }
        if (a.map !== here) continue;
        const tx = (loc.x + 0.5) * C.CELL_W + (loc.keeper ? 0 : Math.sin((s.time + a.n.id.length * 37) / 23) * 14);
        const g = game.map.grid;
        if (a.z !== loc.z && (a.stepT = (a.stepT || 0) + dt) > 380) {
          a.stepT = 0;
          const nz = a.z + Math.sign(loc.z - a.z), cx = Math.floor(a.x / C.CELL_W);
          if (Math.abs(g.surfaceY(cx, nz) - g.surfaceY(cx, a.z)) <= 1 && g.get(cx, g.surfaceY(cx, nz) - 2, nz) !== PA.T.WALL) a.z = nz;
        }
        const dx = tx - a.x;
        if (Math.abs(dx) > 2) { a.x += Math.sign(dx) * Math.min(Math.abs(dx), SPEED * dt / 16.7); a.facing = Math.sign(dx); a.state = 'walk'; a.anim += SPEED * dt / 300; }
        else { a.state = 'idle'; a.anim += dt / 2400; if (game.player.z === a.z && Math.abs(game.player.x - a.x) < 60) a.facing = Math.sign(game.player.x - a.x) || a.facing; }
        if (a.anim > 1) a.anim -= 1;
      }
    },
    near(game, range) {
      const p = game.player;
      let best = null, bd = range || 34;
      for (const a of NPCs.actors) {
        if (a.map !== game.map.id || (a.z !== p.z && a.z !== p.z + 1)) continue;
        const d = Math.abs(a.x - p.x) + (a.z !== p.z ? 8 : 0);
        if (d < bd) { bd = d; best = a; }
      }
      return best;
    },
    talkNear(game) {
      const actor = NPCs.near(game, 40);
      if (!actor) return false;
      actor.talkT = 2500;
      if (PA.Contest.offer(game, actor)) return true;
      PA.UI.Talk.open(game, actor);
      return true;
    },
    birthdayOn(season, day) { const n = PA.NPC_DATA.find((q) => q.birthday[0] === season && q.birthday[1] === day); return n ? n.name : null; },
    draw(R, z, p, st, game) {
      if (p.level < 0 || p.level > 3) return;
      const ctx = R.ctx, g = game.map.grid;
      R.use(p);
      for (const a of NPCs.actors) {
        if (a.map !== game.map.id || a.z !== z) continue;
        if (a.x < st.wx0 - 40 || a.x > st.wx1 + 40) continue;
        const look = a.n.look, k = PA.Stick.SCALE * (look.h || 1);
        // short folk (children) hold their arms steeper so the short arms still read as two lines
        const target = PA.Stick.rig(a.state, a.anim, (look.h || 1) < 0.9 ? { armX: 11, armY: 11 } : {});
        a.lastJ = PA.Stick.blend(a.lastJ, target, a.lastJ ? 0.25 : 1);
        const feet = g.surfaceY(Math.floor(a.x / C.CELL_W), z) * C.CELL_H - 1;
        const gx = p.level === 0 ? PA.Stick.snapX(a.x) : a.x;
        ctx.save(); ctx.translate(gx, feet); ctx.scale(k, k);
        const mi = (PA.NPC_DATA.indexOf(a.n) + 1) % PA.Stick.MODELS.length; // every townsfolk wears a different model
        let head = null;
        const lw = R.lw(p, 1.0) / k, solid = p.level === 0 ? PA.Ascii.solidFor(mi) : null;
        head = PA.Stick.draw(ctx, a.lastJ, a.facing, { ink: st.ink, paper: st.paper, lw, halo: p.level === 0 ? R.lw(p, 3.5) / k : 0, solid, model: mi });
        ctx.strokeStyle = st.ink;
        accessories(ctx, Object.assign({}, a.lastJ, { head: head || a.lastJ.head }), look, a.facing < 0 ? -1 : 1, lw, !!solid);
        ctx.restore();
        // name tag when you are close
        const pl = game.player;
        if (p.level <= 1 && Math.abs(pl.x - a.x) < 90 && Math.abs(pl.z - z) <= 1) {
          // one row above the top of the head that was drawn
          const top = feet + (head ? head.y : a.lastJ.head.y) * k - Math.max(PA.Stick.HEAD.ry * k, 15);
          const name = a.n.name, sx = p.ox + a.x * p.scale - (name.length * R.cellW) / 2, sy = p.oy + (top - 12) * p.scale;
          R.stampText(sx, sy, name, { style: 1, pri: 3 });
        }
      }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
