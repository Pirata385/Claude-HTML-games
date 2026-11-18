/* Fishing: cast into water ahead (same slice or the slice behind), wait for the bite, then the reel minigame. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  // [id, waters, seasons, [fromMin, toMin], difficulty 1..5]
  const FISH = [
    ['minnow', ['creek', 'lake'], [0, 1, 2, 3], [360, 1560], 1], ['perch', ['lake'], [0, 2, 3], [360, 1200], 2], ['sardine', ['creek'], [0, 1, 2], [360, 1080], 1],
    ['catfish', ['lake', 'mine'], [0, 2], [360, 1560], 4], ['trout', ['creek'], [0, 1], [360, 1140], 3], ['carp', ['lake'], [0, 1, 2, 3], [360, 1560], 1],
    ['pike', ['lake'], [1, 3], [360, 1560], 3], ['eel', ['lake', 'mine'], [0, 2, 3], [960, 1560], 3], ['bream', ['creek'], [0, 1, 2, 3], [1080, 1560], 2],
    ['sunfish', ['lake', 'creek'], [0, 1], [360, 1140], 1], ['inkfish', ['mine'], [0, 1, 2, 3], [360, 1560], 5], ['koi', ['lake'], [0, 1, 2, 3], [360, 480], 5],
  ];
  const F = PA.Fishing = {
    FISH,
    pick(water, season, time, rnd) {
      const ok = FISH.filter((f) => f[1].includes(water) && f[2].includes(season) && time >= f[3][0] && time <= f[3][1]);
      const pool = ok.length ? ok : FISH.filter((f) => f[1].includes(water));
      const w = pool.map((f) => 6 - f[4]);
      let r = rnd() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i][0]; }
      return pool[0][0];
    },
    waterAhead(game) {
      const p = game.player, g = game.map.grid;
      for (const dz of [0, 1]) for (let dx = 1; dx <= 4; dx++) {
        const x = Math.floor((p.x + p.facing * dx * C.CELL_W) / C.CELL_W), z = p.z + dz;
        for (let y = g.surfaceY(x, z) - 3; y < g.h; y++) if (g.def(x, y, z).water) return { x, y, z, water: game.map.kind === 'mine' ? 'mine' : x > 330 ? 'lake' : 'creek' };
      }
      return null;
    },
    cast(game, slot) {
      if (F.active) return false;
      const w = F.waterAhead(game);
      if (!w) { PA.UI.toast('Face the water to fish (the creek, the lake, or mine pools).'); return false; }
      game.state.energy = Math.max(0, game.state.energy - 4);
      const bait = game.inv.count('bait') > 0;
      F.active = { w, t: 0, bite: 1200 + Math.random() * (bait ? 3000 : 5000), hooked: false, bait };
      game.player.action = { kind: 'rod', t: 0, dur: 99999, progress: 0.75, applied: true };
      PA.Bus.emit('cast');
      return true;
    },
    step(game, dt, inp) {
      const a = F.active; if (!a || a.reel) return;
      a.t += dt;
      if (!a.hooked && a.t >= a.bite) { a.hooked = true; a.hookT = 0; PA.Bus.emit('bite'); }
      if (a.hooked) {
        a.hookT += dt;
        if (inp && inp.useP) { F.reel(game); return; }
        if (a.hookT > 1100) { PA.UI.toast('It got away...'); F.stop(game); }
      } else if (inp && inp.useP && a.t > 300) { F.stop(game); }
    },
    stop(game) { F.active = null; game.player.action = null; },
    /** The reel minigame: keep the [=] bar on the fish by holding use/jump. */
    reel(game) {
      const a = F.active, s = game.state;
      const fish = F.pick(a.w.water, s.season, s.time, Math.random);
      const diff = FISH.find((f) => f[0] === fish)[4];
      a.reel = true;
      if (a.bait) game.inv.remove('bait', 1);
      const H = 18;
      let barY = 10, barV = 0, fishY = 9, fishV = 0, prog = 0.3, last = performance.now(), done = false;
      const el = document.createElement('div');
      el.className = 'modal'; el.innerHTML = '<div class="card"><p>Reel it in! Hold use / jump / tap.</p><pre class="reel"></pre></div>';
      document.getElementById('ui').appendChild(el);
      PA.Input.blocked = true;
      let hold = false;
      const dn = () => { hold = true; }, up = () => { hold = false; };
      el.addEventListener('pointerdown', dn); el.addEventListener('pointerup', up);
      const kd = (e) => { if (['Space', 'KeyJ', 'KeyF', 'KeyE'].includes(e.code)) { hold = true; e.preventDefault(); } };
      const ku = (e) => { if (['Space', 'KeyJ', 'KeyF', 'KeyE'].includes(e.code)) hold = false; };
      window.addEventListener('keydown', kd, true); window.addEventListener('keyup', ku, true);
      const pre = el.querySelector('.reel');
      const finish = (ok) => {
        done = true; el.remove(); PA.Input.blocked = false; PA.Input.clearAll();
        window.removeEventListener('keydown', kd, true); window.removeEventListener('keyup', ku, true);
        F.stop(game);
        if (ok) { if (game.inv.add(fish, 1) === 0) { PA.UI.toast('Caught a ' + PA.Items.get(fish).name + '!'); PA.Bus.emit('catch'); } else PA.UI.toast('Your bag is full. You let it go.'); }
        else PA.UI.toast('The line snapped!');
      };
      const tick = (now) => {
        if (done) return;
        const dt = Math.min(50, now - last) / 16.7; last = now;
        barV += (hold ? -0.35 : 0.3) * dt; barV *= 0.9; barY = PA.U.clamp(barY + barV * dt, 0, H - 4);
        if (Math.random() < 0.03 * diff * dt) fishV = (Math.random() - 0.5) * (0.6 + diff * 0.45);
        fishY = PA.U.clamp(fishY + fishV * dt, 0, H - 1);
        const over = fishY >= barY - 0.5 && fishY <= barY + 3.5;
        prog = PA.U.clamp(prog + (over ? 0.006 : -0.005 - diff * 0.0012) * dt, 0, 1);
        const rows = [];
        for (let y = 0; y < H; y++) {
          const inBar = y >= barY && y < barY + 4;
          const f = Math.round(fishY) === y ? '<>' : '  ';
          const pr = y >= H - Math.round(prog * H) ? '#' : '.';
          rows.push('|' + (inBar ? '[' + f + ']' : ' ' + f + ' ') + '|  ' + pr);
        }
        pre.textContent = rows.join('\n');
        if (prog >= 1) return finish(true);
        if (prog <= 0) return finish(false);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    /** The line from the rod tip to the bobber. */
    draw(R, z, p, st, game) {
      const a = F.active;
      if (!a || game.player.z !== z) return;
      const pl = game.player, ctx = R.ctx;
      R.use(p);
      const tipX = pl.x + pl.facing * 28, tipY = pl.feet - 70, bx = (a.w.x + 0.5) * C.CELL_W, by = a.w.y * C.CELL_H + 2 + (a.hooked ? Math.sin(performance.now() / 60) * 3 : 0);
      ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink;
      ctx.beginPath(); ctx.moveTo(pl.x + pl.facing * 8, pl.feet - 40); ctx.lineTo(tipX, tipY);
      ctx.moveTo(tipX, tipY); ctx.quadraticCurveTo((tipX + bx) / 2, Math.max(tipY, by) + 10, bx, by - 4);
      ctx.moveTo(bx + 3, by - 4); ctx.arc(bx, by - 4, 3, 0, Math.PI * 2);
      ctx.stroke();
      if (a.hooked) R.stamp(p.ox + bx * p.scale, p.oy + (by - 30) * p.scale, '!', { pri: 4, style: 1 });
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = F;
})(typeof window !== 'undefined' ? window : globalThis);
