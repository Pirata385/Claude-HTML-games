// Água-Tinta — world clock, weather and light (owner B). Pure (§5.2–5.4).
// state.world = { minutes (absolute game minutes since day 0 00:00), weather, slotEnd (absolute minute the current
// weather slot ends), forecast: [next 3 slots], rng (uint32 state of the weather stream) }.
(function (AQ) {
  'use strict';

  var U = AQ.util;
  var DAY = 1440;
  var PHASES = ['amanhecer', 'dia', 'entardecer', 'noite'];
  var START = { amanhecer: 300, dia: 420, entardecer: 1020, noite: 1140 };
  var SLOT_MIN = 180, SLOT_MAX = 360;

  var TRANSITIONS = {
    limpo: { limpo: 0.45, nublado: 0.40, chuva: 0.15, tempestade: 0 },
    nublado: { limpo: 0.35, nublado: 0.25, chuva: 0.30, tempestade: 0.10 },
    chuva: { limpo: 0.15, nublado: 0.35, chuva: 0.25, tempestade: 0.25 },
    tempestade: { limpo: 0.10, nublado: 0.30, chuva: 0.45, tempestade: 0.15 }
  };
  var WEATHER = ['limpo', 'nublado', 'chuva', 'tempestade'];
  var WEATHER_LIGHT = { limpo: 1, nublado: 0.8, chuva: 0.7, tempestade: 0.55 };
  var PHASE_LIGHT = { amanhecer: 0.6, dia: 1, entardecer: 0.6, noite: 0.25 };
  // Light keyframes over the day (minute-of-day, light): 30-minute blends centred on each phase boundary.
  var LK_M = [0, 285, 315, 405, 435, 1005, 1035, 1125, 1155, 1440];
  var LK_V = [0.25, 0.25, 0.6, 0.6, 1, 1, 0.6, 0.6, 0.25, 0.25];

  function W(state) {
    if (!state) state = AQ.state;
    if (state && state.world) return state.world;
    return state; // a bare world object is accepted too
  }

  function phaseOf(minutes) {
    var m = U.wrap(Math.floor(minutes), DAY);
    if (m >= 300 && m < 420) return 'amanhecer';
    if (m >= 420 && m < 1020) return 'dia';
    if (m >= 1020 && m < 1140) return 'entardecer';
    return 'noite';
  }

  function now(state) {
    var w = W(state);
    var total = w ? w.minutes : 0;
    var mod = U.wrap(Math.floor(total), DAY);
    return {
      minutes: mod,                   // minute of the day (0..1439)
      total: total,                   // absolute game minutes
      day: Math.floor(total / DAY),
      hour: Math.floor(mod / 60),
      minute: mod % 60,
      phase: phaseOf(total),
      weather: w ? w.weather : 'limpo'
    };
  }

  function rngFor(w, rng) {
    if (rng && typeof rng.next === 'function') return rng;
    return AQ.rng.create(w.rng >>> 0);
  }

  function roll(from, r) {
    var row = TRANSITIONS[from] || TRANSITIONS.limpo;
    var x = r.next(), acc = 0;
    for (var i = 0; i < WEATHER.length; i++) {
      acc += row[WEATHER[i]];
      if (x < acc) return WEATHER[i];
    }
    return from;
  }

  function ensure(w) {
    if (!Array.isArray(w.forecast)) w.forecast = [];
    if (WEATHER.indexOf(w.weather) < 0) w.weather = 'limpo';
    if (typeof w.minutes !== 'number' || !isFinite(w.minutes)) w.minutes = 330;
    if (typeof w.slotEnd !== 'number' || !isFinite(w.slotEnd)) w.slotEnd = w.minutes + 270;
  }

  // Advances the clock by `minutes`; rolls weather slots that end on the way. Coalesced events (one per kind).
  function advance(state, minutes, rng, emit) {
    var w = W(state), events = [];
    if (!w || !(minutes > 0)) return events;
    ensure(w);
    var own = !(rng && typeof rng.next === 'function');
    var r = rngFor(w, rng);
    var t0 = w.minutes, t1 = t0 + minutes;
    var phase0 = phaseOf(t0), hour0 = Math.floor(t0 / 60), weather0 = w.weather;
    while (w.forecast.length < 3) w.forecast.push(roll(w.forecast.length ? w.forecast[w.forecast.length - 1] : w.weather, r));
    var guard = 0;
    while (w.slotEnd <= t1 && guard++ < 10000) {
      w.weather = w.forecast.shift();
      w.forecast.push(roll(w.forecast[w.forecast.length - 1], r));
      w.slotEnd += r.irange(SLOT_MIN, SLOT_MAX);
    }
    w.minutes = t1;
    if (own) w.rng = r.getState();
    var phase1 = phaseOf(t1), hour1 = Math.floor(t1 / 60);
    if (hour1 !== hour0) events.push({ type: 'hour', hour: U.wrap(hour1, 24), day: Math.floor(t1 / DAY) });
    if (phase1 !== phase0 || minutes >= DAY) events.push({ type: 'phase', phase: phase1, prev: phase0 });
    if (w.weather !== weather0) events.push({ type: 'weather', weather: w.weather, prev: weather0 });
    if (AQ.store && AQ.store.markDirty && (!state || state === AQ.state)) {
      try { AQ.store.markDirty(); } catch (e) { /* ignore */ }
    }
    if (emit !== false && AQ.events) {
      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        if (ev.type === 'phase') AQ.events.emit('world:phase', { phase: ev.phase, prev: ev.prev });
        else if (ev.type === 'weather') AQ.events.emit('world:weather', { weather: ev.weather, prev: ev.prev });
        else AQ.events.emit('world:hour', { hour: ev.hour, day: ev.day });
      }
    }
    return events;
  }

  // tick(state, realSec, rng?) → events[]. 1 real second = MIN_PER_SEC game minutes.
  function tick(state, realSec, rng) {
    return advance(state, (realSec || 0) * AQ.world.MIN_PER_SEC, rng);
  }

  // minutesUntil(state, phase) → minutes to the next start of `phase` (0 if exactly at its start).
  function minutesUntil(state, phase) {
    var w = W(state);
    if (!w || START[phase] === undefined) return 0;
    var mod = U.wrap(w.minutes, DAY);
    return U.wrap(START[phase] - mod, DAY);
  }

  // advanceTo(state, phase) → minutes advanced (jumps to the next start of `phase`; weather slots advance too).
  function advanceTo(state, phase) {
    var m = minutesUntil(state, phase);
    if (m > 0) advance(state, m);
    return m;
  }

  // forecast(state, n=3) → weather[] for the next n slots (pre-rolled; extra slots are previewed without mutating).
  function forecast(state, n) {
    var w = W(state);
    var k = n === undefined ? 3 : n;
    if (!w) return [];
    var f = Array.isArray(w.forecast) ? w.forecast.slice(0, k) : [];
    if (f.length < k) {
      var r = AQ.rng.create(((w.rng >>> 0) ^ 0x5bd1e995) >>> 0);
      var last = f.length ? f[f.length - 1] : w.weather;
      while (f.length < k) { last = roll(last, r); f.push(last); }
    }
    return f;
  }

  function phaseLight(mod) {
    for (var i = 1; i < LK_M.length; i++) {
      if (mod <= LK_M[i]) {
        var a = LK_M[i - 1], b = LK_M[i];
        return LK_V[i - 1] + (LK_V[i] - LK_V[i - 1]) * (b > a ? (mod - a) / (b - a) : 0);
      }
    }
    return LK_V[LK_V.length - 1];
  }

  // light(state, zoneId, depthFrac) → 0..1 ambient light (phase × weather × depth fog).
  function light(state, zoneId, depthFrac) {
    var w = W(state);
    var mod = w ? U.wrap(w.minutes, DAY) : 720;
    var wl = WEATHER_LIGHT[w ? w.weather : 'limpo'] || 1;
    var d = U.clamp(depthFrac || 0, 0, 1);
    return U.clamp(phaseLight(mod) * wl * (1 - 0.55 * d), 0, 1);
  }

  // isDark(state, zoneId, depthFrac): the zone's dark rule (always below / night below), else ambient < .3.
  function isDark(state, zoneId, depthFrac) {
    var w = W(state);
    var d = U.clamp(depthFrac || 0, 0, 1);
    var z = AQ.zones && AQ.zones.get(zoneId);
    if (z && z.dark) {
      if (z.dark.always && d >= z.dark.below) return true;
      if (w && phaseOf(w.minutes) === 'noite') return d >= z.dark.nightBelow;
    }
    return light(state, zoneId, d) < 0.3;
  }

  // Stationary share of each weather (long run), from TRANSITIONS.
  function stationary() {
    var p = [0.25, 0.25, 0.25, 0.25];
    for (var it = 0; it < 200; it++) {
      var q = [0, 0, 0, 0];
      for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) q[j] += p[i] * TRANSITIONS[WEATHER[i]][WEATHER[j]];
      p = q;
    }
    var out = {};
    for (var k = 0; k < 4; k++) out[WEATHER[k]] = p[k];
    return out;
  }

  AQ.world = {
    MIN_PER_SEC: 1,
    DAY: DAY,
    PHASES: PHASES,
    PHASE_START: START,
    PHASE_LIGHT: PHASE_LIGHT,
    WEATHER_LIGHT: WEATHER_LIGHT,
    SLOT: [SLOT_MIN, SLOT_MAX],
    TRANSITIONS: TRANSITIONS,
    phaseOf: phaseOf,
    now: now,
    tick: tick,
    advance: advance,
    advanceTo: advanceTo,
    minutesUntil: minutesUntil,
    forecast: forecast,
    light: light,
    isDark: isDark,
    stationary: stationary
  };
})(window.AQ);
