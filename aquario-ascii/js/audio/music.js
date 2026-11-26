// Água-Tinta — music, fight layer, reel and ambience (owner E), §13. Plays the recorded loops of AQ.AUDIO_MANIFEST:
// one theme per mood (title, map, the five waters, aquarium, ending) plus a night take of each water (also used in
// storms), crossfaded on every change; day↔night swaps keep the musical position. Fights add the water's fight stem
// (drums + driving bass, same tempo, loop dividing the theme's, started in phase) whose level and brightness follow
// the line tension while the theme loses its low end. Jingles dip the music. The reel loop speeds up with the
// reel; ambience loops (waves, rain, storm rumble) follow scene/weather, muffled underwater; bubbles pop now and then.
(function (AQ) {
  'use strict';

  var A = AQ.audio = AQ.audio || {};
  var MAN = AQ.AUDIO_MANIFEST || {};
  var M = A.music = {};
  var ZONES = { baia: 1, recife: 1, kelp: 1, mar: 1, abismo: 1 };
  var AMB = ['amb-water', 'amb-rain', 'amb-storm'];

  var started = false, timer = 0, nodes = null;
  var mood = 'title', want = null, cur = null;
  var night = false, storm = false;
  var tension = null, fightOn = false, boss = false, frenzy = false, fightV = null;
  var reelV = null;
  var amb = { zone: 'baia', underwater: 0, weather: 'limpo', phase: 'dia', scene: 'title' };
  var ambV = {};
  var nextBloop = 0, nextCreak = 0, lastTry = 0;

  function wa() { return A.webaudio && A.webaudio(); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function musicDest() { return nodes ? nodes.themeHp : 'music'; }

  // ---------------------------------------------------------------- themes
  function themeId() {
    var m = MAN['theme-' + mood] ? mood : 'baia';
    if (ZONES[m] && (night || storm) && MAN['theme-' + m + '-night']) return 'theme-' + m + '-night';
    return 'theme-' + m;
  }
  function loopLen(e) { return (e.loopEnd || e.duration) - (e.loopStart || 0); }
  function update() {
    if (!started) return;
    var id = themeId();
    if (want === id) return;
    want = id;
    A.need(id).then(function () { if (want === id) switchTo(id); }, function () { /* missing file: stay silent */ });
  }
  function switchTo(id) {
    if (cur && cur.id === id && !cur.ended) return;
    var e = MAN[id], prev = cur && !cur.ended ? cur : null, t = A.now() + 0.03, off;
    // day ↔ night takes of a water share tempo and length: carry on from the same bar
    if (prev && wa() && prev.entry.bpm === e.bpm && Math.abs(loopLen(prev.entry) - loopLen(e)) < 0.01) off = (e.loopStart || 0) + prev.phase(t);
    var fade = prev ? 1.6 : 0.8;
    var v = A.play(id, { bus: musicDest(), loop: true, offset: off, at: t, fade: fade, gain: themeGain() });
    if (!v) return;
    cur = v;
    if (prev) prev.stop(fade);
    if (fightOn) startFight();
  }

  // ---------------------------------------------------------------- fight layer
  function fightLevel() {
    if (!fightOn) return 0;
    var T = tension === null ? 0.3 : tension;
    return clamp((T - 0.12) / 0.55, 0, 1);
  }
  function themeGain() { return 1 - 0.15 * fightLevel(); }
  function stemId() {
    if (!ZONES[mood]) return null;
    var n = 'fight-' + mood + '-night';
    if ((night || storm) && MAN[n]) return n;
    return MAN['fight-' + mood] ? 'fight-' + mood : null;
  }
  // the stem must share the theme's tempo and fit a whole number of times in its loop
  function inSync(stem, theme) {
    if (!theme || stem.bpm !== theme.bpm) return false;
    var r = loopLen(theme) / loopLen(stem);
    return Math.abs(r - Math.round(r)) < 0.002;
  }
  function startFight() {
    if (!wa() || !nodes) return;          // html fallback: separate elements cannot be kept in sync — no stem
    var id = stemId();
    if (!id) return;
    if (fightV && !fightV.ended && fightV.id === id && fightV.theme === cur) return;
    A.need(id).then(function () {
      if (!fightOn || !cur || cur.ended || !inSync(MAN[id], cur.entry)) return;
      if (fightV && !fightV.ended && fightV.id === id && fightV.theme === cur) return;
      var e = MAN[id], t = A.now() + 0.05;
      var v = A.play(id, { bus: nodes.fightLp, loop: true, offset: (e.loopStart || 0) + (cur.phase(t) % loopLen(e)), at: t });
      if (!v) return;
      if (fightV) fightV.stop(0.25);
      fightV = v;
      v.theme = cur;
      applyTension();
    }, function () { /* no stem */ });
  }
  function stopFight() {
    if (fightV) { fightV.stop(1.2); fightV = null; }
    applyTension();
  }
  function applyTension() {
    var f = fightLevel();
    if (cur && !cur.ended) cur.setGain(themeGain(), 0.3);
    if (!nodes) return;
    A.ramp(nodes.fightG.gain, Math.max(0.0001, f), 0.2);
    A.ramp(nodes.fightLp.frequency, 380 + 17000 * f * f, 0.2);   // more tension → brighter, fuller drums
    A.ramp(nodes.themeHp.frequency, 10 + 170 * f, 0.4);          // the theme yields its bass / kick to the stem
  }

  // ---------------------------------------------------------------- ambience
  function ambTargets() {
    var sc = amb.scene, w = amb.weather, quiet = sc === 'aquarium' || sc === 'title' || sc === 'ending';
    var under = clamp(amb.underwater || 0, 0, 1), stormy = w === 'tempestade' && !quiet;
    var water = sc === 'aquarium' ? 0.12 : sc === 'title' ? 0.26 : sc === 'ending' ? 0.15 : 0.34;
    if (w === 'tempestade') water *= 1.5;
    var rain = quiet ? 0 : w === 'chuva' ? 0.1 : w === 'tempestade' ? 0.17 : 0;
    return { 'amb-water': water, 'amb-rain': rain * (1 - under * 0.7), 'amb-storm': stormy ? 1 : 0 };
  }
  function applyAmbience() {
    if (!started) return;
    var T = ambTargets();
    AMB.forEach(function (id) {
      var lvl = T[id], v = ambV[id];
      if (v && v.ended) v = ambV[id] = null;
      if (lvl > 0.001) {
        if (v) { v.setGain(lvl, 0.8); return; }
        var e = MAN[id];
        if (!e || !A.has(id)) return;
        var L = loopLen(e), off = (e.loopStart || 0) + Math.random() * L * 0.9;
        ambV[id] = A.play(id, { bus: 'amb', loop: true, offset: off, gain: lvl, fade: 1.5 });
      } else if (v) { v.stop(2.5); ambV[id] = null; }
    });
    if (wa()) {
      var under = clamp(amb.underwater || 0, 0, 1);
      A.ramp(A.bus.ambLp.frequency, under > 0.02 ? 3200 - under * 2500 : 20000, 0.3);
    }
  }

  // ---------------------------------------------------------------- 10 Hz housekeeping: bubbles, line creaks
  function tick() {
    if (!A.ready || (wa() && A.ctx.state !== 'running')) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    var t = A.now();
    if (fightOn) {
      var T = tension === null ? 0.3 : tension;
      if (T > 0.7 && t > nextCreak) {
        if (Math.random() < (T - 0.6) * 0.9) A.sfx('tension', { vol: 0.35 + (T - 0.7) });
        nextCreak = t + 0.35 + Math.random() * 0.6;
      }
    }
    if (t > nextBloop) {
      var under = amb.underwater || 0, rateB = amb.scene === 'aquarium' ? 1.4 : (0.25 + under * 0.8) * (frenzy ? 2 : 1);
      if (amb.scene !== 'title' || Math.random() < 0.5) A.sfx('bloop', { vol: (0.35 + under * 0.4) * 0.8, pitch: 0.65 + Math.random() * 0.85, noVary: true });
      nextBloop = t + (1.5 + Math.random() * 4.5) / rateB;
    }
    // the ambience may have been asked for before its file was ready
    for (var i = 0; i < AMB.length; i++) if (!ambV[AMB[i]] && ambTargets()[AMB[i]] > 0.001 && A.has(AMB[i])) { applyAmbience(); break; }
    // a theme that was not decoded / loaded in time: try again every 2 s
    if (want && (!cur || cur.ended || cur.id !== want) && t - lastTry > 2) { lastTry = t; want = null; update(); }
  }

  // ---------------------------------------------------------------- API used by audio.js
  M.start = function () {
    if (started) return;
    started = true;
    if (wa()) {
      var c = A.ctx;
      nodes = {};
      nodes.themeHp = c.createBiquadFilter();
      nodes.themeHp.type = 'highpass'; nodes.themeHp.frequency.value = 10; nodes.themeHp.Q.value = 0.6;
      nodes.themeHp.connect(A.bus.musicDuck);
      nodes.fightG = c.createGain();
      nodes.fightG.gain.value = 0.0001;
      nodes.fightG.connect(A.bus.musicDuck);
      nodes.fightLp = c.createBiquadFilter();
      nodes.fightLp.type = 'lowpass'; nodes.fightLp.frequency.value = 400; nodes.fightLp.Q.value = 0.7;
      nodes.fightLp.connect(nodes.fightG);
    }
    nextBloop = A.now() + 2;
    timer = setInterval(function () { try { tick(); } catch (e) { /* audio never throws */ } }, 100);
    M.refresh();
  };
  M.setMood = function (name) {
    mood = name || 'title';
    M.refresh();
  };
  M.refresh = function () {
    var ph = AQ.ui && AQ.ui.dom ? AQ.ui.dom.worldNow().phase : 'dia';
    night = ph === 'noite' && !!ZONES[mood];
    storm = amb.weather === 'tempestade' && amb.scene !== 'aquarium' && amb.scene !== 'title' && amb.scene !== 'ending';
    update();
    applyAmbience();
  };
  M.setAmbience = function (a) {
    for (var k in a) amb[k] = a[k];
    storm = amb.weather === 'tempestade' && amb.scene !== 'aquarium' && amb.scene !== 'title' && amb.scene !== 'ending';
    update();
    applyAmbience();
  };
  M.setTension = function (v) { tension = v; if (started) applyTension(); };
  // reel loop: 16 clicks/s at rate 1 → about 13 to 21 clicks/s with the reel speed
  M.setReel = function (on, speed) {
    if (!started) return;
    if (reelV && reelV.ended) reelV = null;
    var rate = 0.8 + 0.5 * clamp(speed || 0, 0, 1);
    if (on) {
      if (reelV) reelV.setRate(rate, 0.05);
      else reelV = A.play('reel-loop', { bus: 'sfx', loop: true, rate: rate, fade: 0.02 });
    } else if (reelV) { reelV.stop(0.05); reelV = null; }
  };
  M.fight = function (on, isBoss) {
    fightOn = !!on;
    boss = !!isBoss && fightOn;
    if (!started) return;
    if (fightOn) startFight(); else stopFight();
    applyTension();
  };
  M.frenzy = function (on) { frenzy = !!on; };
  // dip the music briefly under a jingle
  M.duck = function (sec) {
    if (A.mode === 'html') { if (A.htmlDuck) A.htmlDuck(sec); return; }
    if (!wa()) return;
    var g = A.bus.musicDuck.gain, t = A.now();
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.4, t + 0.04);
    g.setTargetAtTime(1, t + (sec || 0.8), 0.3);
  };
  // legendary nearby: low brass swell on a tritone with bells
  M.omen = function () { A.sfx('omen'); };
  M.stop = function () { clearInterval(timer); timer = 0; started = false; };
  M.current = function () { return cur && !cur.ended ? cur.id : null; };
  M.stem = function () { return fightV && !fightV.ended ? fightV.id : null; };
  M.ambience = function () { return AMB.filter(function (id) { return ambV[id] && !ambV[id].ended; }); };
  M.isBoss = function () { return boss; };
})(window.AQ);
