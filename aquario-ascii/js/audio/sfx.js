// Água-Tinta — sound effects (owner E), §13. Plays the recorded SFX / jingles of AQ.AUDIO_MANIFEST by name
// (the names the game always used: 'cast', 'bite', 'catch', 'uiTap', …). opts: {vol, pitch, pan}.
// A repeated effect gets a small random playbackRate change so it never sounds machine-identical; jingles keep
// their pitch and dip the music for their `duck` seconds. Voice caps: per name and overall (oldest is cut).
(function (AQ) {
  'use strict';

  var A = AQ.audio = AQ.audio || {};
  var MAN = AQ.AUDIO_MANIFEST || {};
  var last = Object.create(null);
  var live = [];
  var CAP_NAME = 4, CAP_ALL = 24;
  var GAP = { uiTap: 0.03, coin: 0.07 };

  function prune() {
    var k = 0;
    for (var i = 0; i < live.length; i++) if (!live[i].ended && !live[i].stopping) live[k++] = live[i];
    live.length = k;
  }

  // sfx(name, opts?{vol, pitch, pan, noVary})
  A.sfx = function (name, opts) {
    if (!A.ready) return;
    if (A.mode === 'webaudio' && (!A.ctx || A.ctx.state !== 'running')) return;
    var e = MAN[name];
    if (!e || (e.kind !== 'sfx' && e.kind !== 'jingle') || !A.has(name)) return;
    var t = A.now(), prev = last[name];
    if (prev && t - prev < (GAP[name] || 0.04)) return;
    last[name] = t;
    var o = opts || {};
    try {
      if (e.duck && A.music && A.music.duck) A.music.duck(e.duck);
      prune();
      var same = 0, oldest = -1, i;
      for (i = 0; i < live.length; i++) if (live[i].id === name) { same++; if (oldest < 0) oldest = i; }
      if (same >= CAP_NAME && oldest >= 0) live.splice(oldest, 1)[0].stop(0.03);
      if (live.length >= CAP_ALL) live.shift().stop(0.03);
      var spread = prev && t - prev < 1.5 ? 0.045 : 0.02;
      var rate = (o.pitch || 1) * (e.kind === 'jingle' || o.noVary ? 1 : 1 + (Math.random() * 2 - 1) * spread);
      var v = A.play(name, { bus: 'sfx', gain: o.vol === undefined ? 1 : o.vol, rate: rate, pan: o.pan });
      if (v) live.push(v);
    } catch (err) { /* never throw from audio */ }
  };
  A.sfxLive = function () { prune(); return live.length; };
})(window.AQ);
