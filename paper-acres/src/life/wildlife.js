/* Wild critters around the player (drawn as outlines), and the crow rule for crops. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const W = PA.Wildlife = {
    list: [],
    /** Crops crows will eat tonight: only on farms of 16+ crops, never within 8 cells of a scarecrow (+-1 slice). */
    crowTargets(crops, objects, rnd) {
      if (crops.length < 16) return [];
      const scares = objects.filter((o) => o.id === 'scarecrow' || (o.word === 'scarecrow'));
      return crops.filter((c) => !scares.some((s) => s.map === c.map && Math.abs(s.z - c.z) <= 1 && Math.abs(s.x - c.x) <= 8) && rnd() < 0.012);
    },
    kindsFor(zone, season, time, weather) {
      const day = time < 19 * 60, wet = weather === 'rain' || weather === 'storm';
      const k = [];
      if (zone === 'forest' || zone === 'meadow') { k.push('rabbit', 'bird'); if (zone === 'forest' && !wet) k.push('deer'); }
      if (zone === 'farm') k.push('bird', 'crow');
      if (zone === 'town') k.push('bird');
      if (day && !wet && (season === 0 || season === 1)) k.push('butterfly');
      if ((season === 0 || season === 1) && zone === 'forest') k.push('frog');
      if (season === 3) return k.filter((q) => q !== 'butterfly' && q !== 'frog');
      return k;
    },
    step(game, dt) {
      const s = game.state;
      if (!s || game.map.kind !== 'overworld') { W.list = []; return; }
      const p = game.player, g = game.map.grid;
      const zone = (game.map.zones.find((z) => p.x / C.CELL_W >= z.x0 && p.x / C.CELL_W < z.x1) || {}).name || 'farm';
      W.list = W.list.filter((a) => Math.abs(a.x - p.x) < 900 && !a.gone);
      if (W.list.length < 6 && Math.random() < dt / 2500) {
        const kinds = W.kindsFor(zone, s.season, s.time, s.weather);
        if (kinds.length) {
          const kind = kinds[Math.floor(Math.random() * kinds.length)];
          const x = p.x + (Math.random() < 0.5 ? -1 : 1) * (300 + Math.random() * 350), z = PA.U.clamp(p.z + Math.floor(Math.random() * 4) - 1, 0, g.d - 1);
          const cx = Math.floor(x / C.CELL_W);
          if (!g.def(cx, g.surfaceY(cx, z) - 1, z).water || kind === 'bird') W.list.push({ kind, x, z, y: 0, vx: 0, vy: 0, t: Math.random() * 6, fly: kind === 'butterfly' ? 20 + Math.random() * 30 : 0, facing: 1 });
        }
      }
      for (const a of W.list) {
        a.t += dt / 1000;
        const cx = Math.floor(a.x / C.CELL_W), ground = g.surfaceY(cx, a.z) * C.CELL_H - 1.6;
        const near = Math.abs(a.x - p.x) < 70 && Math.abs(a.z - p.z) <= 1;
        if (a.kind === 'bird' || a.kind === 'crow') {
          if (near && !a.scared) { a.scared = true; a.vx = Math.sign(a.x - p.x || 1) * 3; a.vy = -2.5; PA.Bus.emit('flap'); }
          if (a.scared) { a.x += a.vx * dt / 16.7; a.fly += -a.vy * dt / 16.7; if (a.fly > 400) a.gone = true; }
          else if (Math.random() < dt / 1500) a.facing = -a.facing;
        } else if (a.kind === 'butterfly') {
          a.x += Math.sin(a.t * 0.9) * 0.6 * dt / 16.7; a.fly = 30 + Math.sin(a.t * 2.3) * 14;
        } else {
          const speed = a.kind === 'deer' ? 3.4 : a.kind === 'rabbit' ? 2.6 : 1.4;
          if (near) { a.vx = Math.sign(a.x - p.x || 1) * speed; a.scared = 1.5; }
          if (a.scared > 0) { a.scared -= dt / 1000; a.x += a.vx * dt / 16.7; a.hop = Math.abs(Math.sin(a.t * 9)) * (a.kind === 'deer' ? 6 : 10); }
          else { a.hop = 0; if (Math.random() < dt / 2600) { a.vx = (Math.random() - 0.5) * speed * 0.5; } a.x += a.vx * 0.3 * dt / 16.7; }
          if (a.vx) a.facing = Math.sign(a.vx);
        }
        a.ground = ground;
      }
    },
    draw(R, z, p, st) {
      if (p.level < 0 || p.level > 2) return;
      const ctx = R.ctx;
      R.use(p);
      ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink; ctx.fillStyle = st.paper; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const a of W.list) {
        if (a.z !== z || a.ground == null) continue;
        ctx.save(); ctx.translate(a.x, a.ground - (a.fly || 0) - (a.hop || 0)); ctx.scale(a.facing || 1, 1);
        ctx.beginPath();
        const flap = Math.sin(a.t * 14) * 4;
        switch (a.kind) {
          case 'bird': case 'crow': {
            const k = a.kind === 'crow' ? 1.4 : 1;
            if (a.scared) { ctx.moveTo(-8 * k, -flap); ctx.quadraticCurveTo(-3 * k, -6 * k, 0, -2); ctx.quadraticCurveTo(3 * k, -6 * k, 8 * k, -flap); }
            else { ctx.ellipse(0, -5 * k, 5 * k, 3.5 * k, 0, 0, Math.PI * 2); ctx.moveTo(4 * k, -6 * k); ctx.lineTo(8 * k, -5 * k); ctx.moveTo(-1, -2); ctx.lineTo(-1, 0); }
            break;
          }
          case 'butterfly': ctx.ellipse(-3, -2, 3, 4 + flap * 0.4, -0.4, 0, Math.PI * 2); ctx.moveTo(6, -2); ctx.ellipse(3, -2, 3, 4 + flap * 0.4, 0.4, 0, Math.PI * 2); break;
          case 'rabbit': ctx.ellipse(0, -6, 7, 5, 0, 0, Math.PI * 2); ctx.moveTo(9, -12); ctx.arc(6, -12, 3, 0, Math.PI * 2); ctx.moveTo(6, -15); ctx.lineTo(5, -23); ctx.moveTo(8, -15); ctx.lineTo(9, -22); break;
          case 'frog': ctx.ellipse(0, -4, 6, 4, 0, 0, Math.PI * 2); ctx.moveTo(5, -8); ctx.arc(3, -8, 2, 0, Math.PI * 2); ctx.moveTo(-5, -1); ctx.lineTo(-9, 0); break;
          case 'deer': ctx.ellipse(0, -26, 14, 7, 0, 0, Math.PI * 2); for (const lx of [-9, -5, 6, 10]) { ctx.moveTo(lx, -20); ctx.lineTo(lx + (a.hop ? 3 : 0), 0); } ctx.moveTo(12, -30); ctx.lineTo(16, -40); ctx.lineTo(22, -38); ctx.moveTo(16, -40); ctx.lineTo(14, -48); ctx.moveTo(16, -40); ctx.lineTo(20, -47); break;
          default:
        }
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = W;
})(typeof window !== 'undefined' ? window : globalThis);
