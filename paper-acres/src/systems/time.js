/* Clock, calendar and weather. Day runs 6:00 (360) to 2:00 (1560 = pass out). */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const DAY_START = 360, PASS_OUT = 1560;
  const Time = PA.Time = {
    DAY_START, PASS_OUT,
    /** Advance by real ms; returns events {passOut, hour}. */
    tick(s, realMs, msPerMin) {
      const before = s.time;
      s.time = Math.min(PASS_OUT, s.time + realMs / (msPerMin || 700));
      const ev = {};
      if (Math.floor(s.time / 60) !== Math.floor(before / 60)) ev.hour = Math.floor(s.time / 60);
      if (s.time >= PASS_OUT && before < PASS_OUT) ev.passOut = true;
      return ev;
    },
    newDay(s) {
      const r = { seasonChanged: false, yearChanged: false };
      s.day++;
      s.stats.days = (s.stats.days || 0) + 1;
      if (s.day > s.seasonDays) {
        s.day = 1; s.season++; r.seasonChanged = true;
        if (s.season > 3) { s.season = 0; s.year++; r.yearChanged = true; }
      }
      s.time = DAY_START;
      s.weather = s.tomorrow || Time.weatherFor(s.seed, s.year, s.season, s.day);
      if (s.day === 1) s.weather = 'sun';
      s.tomorrow = Time.weatherFor(s.seed, s.year, s.season, s.day + 1 > s.seasonDays ? 1 : s.day + 1);
      return r;
    },
    weatherFor(seed, year, season, day) {
      if (day === 1) return 'sun';
      const r = PA.RNG.hash3(year, season, day, seed ^ 0x5EA7) / 4294967296;
      if (season === 3) return r < 0.3 ? 'snow' : r < 0.38 ? 'wind' : 'sun';
      if (season === 1) return r < 0.12 ? 'rain' : r < 0.18 ? 'storm' : 'sun';
      if (season === 2) return r < 0.22 ? 'rain' : r < 0.4 ? 'wind' : 'sun';
      return r < 0.24 ? 'rain' : r < 0.3 ? 'storm' : r < 0.36 ? 'wind' : 'sun';
    },
    /** 0 in daylight, 1 at night; dithered ramp 18:00 -> 20:30. */
    darkness(t) {
      if (t < 18 * 60) return 0;
      if (t > 20.5 * 60) return 1;
      return (t - 18 * 60) / (2.5 * 60);
    },
    seasonName(s) { return PA.SEASONS[s.season]; },
    dateText(s) { const n = PA.SEASONS[s.season]; return n[0].toUpperCase() + n.slice(1) + ' ' + s.day + ', Y' + s.year; },
    weekday(s) { return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][(s.day - 1) % 7]; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Time;
})(typeof window !== 'undefined' ? window : globalThis);
