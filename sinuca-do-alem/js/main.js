/* Sinuca do Além — partida: laço de quadros, entrada (toque, mouse, teclado), tela cheia e qualidade. */
(function (g) {
  'use strict';
  const SA = g.SA, G = SA.Game, Rn = SA.Render, UI = SA.UI, Au = SA.Audio;
  const cv = document.getElementById('cv');
  const QUAL = {
    low: { dprCap: 1, hatch: 900, parts: 90, vignette: false },
    med: { dprCap: 1.5, hatch: 1800, parts: 180, vignette: true },
    high: { dprCap: 2, hatch: 2600, parts: 260, vignette: true },
  };
  const coarse = g.matchMedia && g.matchMedia('(pointer: coarse)').matches;
  let autoLevel = coarse ? 'med' : 'high', last = 0, slowFrames = 0, frames = 0, drag = null, charging = false, chargeT = 0;

  // ---------- layout ----------
  SA.relayout = function () {
    const w = g.innerWidth, h = g.innerHeight, portrait = h > w * 1.05, s = G.settings, b = document.body;
    b.classList.toggle('portrait', portrait); b.classList.toggle('landscape', !portrait);
    b.classList.toggle('short', !portrait && h < 500); b.classList.toggle('lefty', !!s.lefty);
    Rn.setQuality(QUAL[s.quality === 'auto' ? autoLevel : s.quality] || QUAL.high);
    const side = !portrait && h < 500 ? 50 : 62;
    const ins = portrait ? { top: 104, bottom: 124, left: 4, right: 4 } : { top: 60, bottom: 8, left: side, right: side };
    if (s.control === 'classic') { if (s.lefty) ins.left += 44; else ins.right += 44; }
    Rn.resize(w, h, ins);
    if (G.run && G.T && G.T.target != null) UI.hud();
  };
  let rsT = 0;
  g.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(SA.relayout, 80); });
  g.addEventListener('orientationchange', () => setTimeout(SA.relayout, 250));

  // ---------- tela cheia ----------
  const de = document.documentElement;
  SA.canFullscreen = () => !!(de.requestFullscreen || de.webkitRequestFullscreen);
  SA.toggleFullscreen = function () {
    const cur = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (cur) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const p = (de.requestFullscreen || de.webkitRequestFullscreen).call(de, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { /* tela cheia indisponível */ }
  };
  document.addEventListener('fullscreenchange', () => setTimeout(SA.relayout, 120));

  // ---------- mira ----------
  const canAim = () => G.state === 'aim' && !G.paused && G.cueBall && G.cueBall.alive;
  function worldAngle(cx, cy) { const cb = G.cueBall, q = Rn.unproject(cx, cy); return Math.atan2(q.y - cb.y, q.x - cb.x); }
  function maxDrag() { return SA.clamp(Math.min(g.innerWidth, g.innerHeight) * 0.34, 120, 250); }
  function release() {
    if (G.aim.power >= 0.03) G.shoot(); else G.aim.power = 0;
  }
  cv.addEventListener('pointerdown', (e) => {
    Au.init();
    if (!canAim()) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
    if (G.settings.control === 'sling') drag = { id: e.pointerId, mode: 'sling', sx: e.clientX, sy: e.clientY };
    else if (e.pointerType === 'mouse') { G.aim.angle = worldAngle(e.clientX, e.clientY); drag = { id: e.pointerId, mode: 'charge' }; charging = true; chargeT = 0; } else drag = { id: e.pointerId, mode: 'rot', a0: worldAngle(e.clientX, e.clientY), base: G.aim.angle };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!canAim()) return;
    if (!drag) { if (G.settings.control === 'classic' && e.pointerType === 'mouse') G.aim.angle = worldAngle(e.clientX, e.clientY); return; }
    if (e.pointerId !== drag.id) return;
    if (drag.mode === 'sling') {
      const dx = drag.sx - e.clientX, dy = drag.sy - e.clientY, d = Math.hypot(dx, dy);
      if (d > 6) {
        // a direção na tela, a partir da branca, vira direção no plano do feltro
        const cb = G.cueBall, c0 = Rn.project(cb.x, cb.y, 0), q0 = Rn.unproject(c0[0] + (dx / d) * 90, c0[1] + (dy / d) * 90);
        G.aim.angle = Math.atan2(q0.y - cb.y, q0.x - cb.x);
      }
      G.aim.power = SA.clamp((d - 14) / maxDrag(), 0, 1);
    } else if (drag.mode === 'rot') {
      let da = worldAngle(e.clientX, e.clientY) - drag.a0;
      while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      G.aim.angle = drag.base + da;
    } else if (drag.mode === 'charge') G.aim.angle = worldAngle(e.clientX, e.clientY);
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const m = drag.mode; drag = null;
    if (m === 'charge') charging = false;
    if (!canAim()) return;
    if (m === 'sling' || m === 'charge') { if (e.type === 'pointercancel') G.aim.power = 0; else release(); }
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('wheel', (e) => { if (canAim()) { G.aim.angle += Math.sign(e.deltaY) * (e.shiftKey ? 0.001 : 0.005); e.preventDefault(); } }, { passive: false });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  // barra de força (modo mira + força)
  const track = document.getElementById('power-track');
  let pdrag = false;
  const setPower = (e) => { const r = track.getBoundingClientRect(); G.aim.power = SA.clamp((e.clientY - r.top) / r.height, 0, 1); };
  track.addEventListener('pointerdown', (e) => { Au.init(); if (!canAim()) return; pdrag = true; track.setPointerCapture(e.pointerId); setPower(e); });
  track.addEventListener('pointermove', (e) => { if (pdrag && canAim()) setPower(e); });
  track.addEventListener('pointerup', () => { if (pdrag) { pdrag = false; if (canAim()) release(); } });
  track.addEventListener('pointercancel', () => { pdrag = false; G.aim.power = 0; });

  // teclado
  g.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key;
    if (k === 'Escape' || k === 'p' || k === 'P') { if (UI.overlay) UI.back(); else UI.pause(); return; }
    if (k === 'f' || k === 'F') { SA.toggleFullscreen(); return; }
    if (k === 'Tab') { e.preventDefault(); document.getElementById('btn-fast').click(); return; }
    if (!canAim()) return;
    const st = e.shiftKey ? 0.0015 : 0.012;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { G.aim.angle += st; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { G.aim.angle -= st; e.preventDefault(); }
    else if (k === ' ' || k === 'Enter') { e.preventDefault(); if (!e.repeat && !charging) { charging = true; chargeT = 0; } }
    else if (k >= '1' && k <= '3') { const i = +k - 1; if (G.run.chalks[i]) { if (SA.Data.CHALKS[G.run.chalks[i]].instant) UI.toast('Giz de uso imediato: toque nele para usar.'); else G.useChalk(i); } }
  });
  g.addEventListener('keyup', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && charging && !drag) { charging = false; if (canAim()) release(); }
  });

  // ---------- laço ----------
  function frame(t) {
    requestAnimationFrame(frame);
    let dt = (t - last) / 1000; last = t;
    if (!(dt > 0)) return;
    if (dt > 0.25) dt = 0.016;
    // qualidade automática: se os quadros estiverem pesados, baixa um nível
    if (G.settings.quality === 'auto' && autoLevel !== 'low') {
      frames++;
      if (dt > 0.03) slowFrames++;
      if (frames >= 150) { if (slowFrames > 60) { autoLevel = autoLevel === 'high' ? 'med' : 'low'; SA.relayout(); } frames = 0; slowFrames = 0; }
    }
    dt = Math.min(dt, 0.05);
    if (charging && canAim()) { chargeT += dt; G.aim.power = 0.5 - 0.5 * Math.cos(chargeT * 2.4); } else if (charging && !canAim()) charging = false;
    if (!G.paused) G.update(dt);
    Rn.draw(G, G.paused ? 0 : dt);
    UI.frame(dt);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Au.suspend(true); if (G.run && G.state === 'aim') G.saveRun('table'); } else { Au.suspend(false); last = performance.now(); }
  });

  // ---------- partida ----------
  G.loadStore();
  Au.vol.master = G.settings.master; Au.vol.music = G.settings.music; Au.vol.sfx = G.settings.sfx;
  Rn.init(cv);
  UI.bind();
  SA.relayout();
  G.toMenu();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { Rn.fontsReady(); });
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  g.SA_DEBUG = SA;
})(window);
