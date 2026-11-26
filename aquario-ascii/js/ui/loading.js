// Água-Tinta — loading screen (owner A). Shown at boot instead of jumping to the title: the ASCII logo,
// "loading sounds 23/58" and an ASCII progress bar while AQ.audio.load() fetches / decodes the sound files, then
// [ Tap to start ]. That tap / click / key press is a real user activation: inside it AQ.audio.start() creates and
// resumes the AudioContext (mobile autoplay policy), plays a silent <audio> (iOS silent switch) and the title music
// starts. Never blocks the game: failed files or a load stalled for 15 s still let the player start, and loading
// carries on in the background. ?autostart=1 starts without waiting for the tap (automated tests).
(function (AQ) {
  'use strict';

  var STALL_MS = 15000, BAR = 24;
  var MODS = { Shift: 1, Control: 1, Alt: 1, AltGraph: 1, Meta: 1, OS: 1, CapsLock: 1, NumLock: 1, ScrollLock: 1, Fn: 1, Tab: 1 };

  function t(k, v) { return AQ.i18n ? AQ.i18n.t(k, v) : k; }
  function el(tag, cls) { var n = document.createElement(tag); n.className = cls; return n; }
  function rep(c, n) { return new Array(Math.max(0, n) + 1).join(c); }
  function width(ls) { return ls.reduce(function (m, s) { return Math.max(m, s.length); }, 0); }
  function logos() {
    var lg = AQ.art && AQ.art.logo, out = [];
    if (lg && Array.isArray(lg.wide) && lg.wide.length) out.push(lg.wide.map(String));
    if (lg && Array.isArray(lg.tall) && lg.tall.length) {
      var tall = lg.tall;
      if (Array.isArray(tall[0])) { var flat = []; tall.forEach(function (b, i) { if (i) flat.push(''); b.forEach(function (l) { flat.push(String(l)); }); }); tall = flat; }
      out.push(tall);
    }
    out.push([t('ui.title.name')]);
    return out;
  }

  AQ.loading = {
    // run() → Promise, resolved inside the start gesture (after AQ.audio.start()).
    run: function () {
      return new Promise(function (resolve) {
        var root = document.getElementById('boot');
        var auto = false;
        try { auto = /[?&]autostart=1\b/.test(window.location.search); } catch (e) { auto = false; }
        var touch = !!(AQ.display && AQ.display.isTouch);
        var st = { done: 0, total: 0, failed: 0 }, finished = false, shown = false, begun = false, lastProg = Date.now();
        var stallT = 0;

        if (!root) { begin(); return; }
        root.textContent = '';
        root.classList.add('aq-load');
        var logo = el('pre', 'aq-load-logo'), wave = el('div', 'aq-load-wave'), msg = el('div', 'aq-load-msg');
        var bar = el('pre', 'aq-load-bar'), go = el('button', 'aq-load-go'), note = el('div', 'aq-load-note');
        logo.setAttribute('aria-label', t('ui.title.name'));
        msg.setAttribute('aria-live', 'polite');
        go.type = 'button';
        go.hidden = true;
        root.appendChild(logo); root.appendChild(wave); root.appendChild(msg); root.appendChild(bar); root.appendChild(go); root.appendChild(note);
        if (AQ.audio && AQ.audio.mode === 'none') note.textContent = t('ui.load.noAudio');
        else if (AQ.audio && AQ.audio.mode === 'html') note.textContent = t('ui.load.fallback');

        // the widest logo that fits (64 or 27 columns of a ~0.6 em monospace cell), font scaled to the viewport
        function layout() {
          var w = window.innerWidth || 360, h = window.innerHeight || 640;
          var fs = Math.max(12, Math.min(18, Math.floor(Math.min(w / 30, h / 24))));
          root.style.fontSize = fs + 'px';
          var opts = logos(), pick = opts[opts.length - 1], lfs = fs;
          for (var i = 0; i < opts.length; i++) {
            var cols = width(opts[i]), rows = opts[i].length;
            var f = Math.min(fs * 1.25, (w - 40) / (cols * 0.6), (h * 0.36) / (rows * 1.12));
            if (f >= 11 || i === opts.length - 1) { pick = opts[i]; lfs = Math.max(8, Math.floor(f)); break; }
          }
          logo.textContent = pick.join('\n');
          logo.style.fontSize = lfs + 'px';
          var waveCols = Math.floor(Math.min(width(pick) * lfs * 0.6, w - 40) / (fs * 0.6));
          wave.textContent = rep('~ ~~  ~~~ ~ ', Math.ceil(waveCols / 12)).slice(0, waveCols);
        }
        function render() {
          var f = st.total ? st.done / st.total : 1, n = Math.round(f * BAR);
          msg.textContent = finished && !st.failed ? t('ui.load.ready') : t('ui.load.sounds', { n: st.done, total: st.total });
          bar.textContent = '[' + rep('#', n) + rep('.', BAR - n) + ']';
        }
        function label() { return touch ? t('ui.load.tap') : t('ui.load.click'); }
        function showGo(why) {
          if (why === 'partial') note.textContent = t('ui.load.partial', { n: st.failed });
          else if (why === 'slow' && !finished) note.textContent = t('ui.load.slow');
          go.textContent = finished || why !== 'slow' ? label() : t('ui.load.stalled');
          if (shown) return;
          shown = true;
          go.hidden = false;
          arm();
          try { go.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
          if (auto) begin();
        }

        // the start gesture: touchend / click / key (not pointerdown: iOS does not unlock audio there)
        function onAct(ev) {
          if (begun) return;
          if (ev.type === 'keydown' && (MODS[ev.key] || /^F\d{1,2}$/.test(ev.key) || ev.repeat)) return;
          if (ev.cancelable) ev.preventDefault();   // touchend: no synthetic click lands on the title menu
          ev.stopPropagation();
          begin();
        }
        function arm() {
          window.addEventListener('touchend', onAct, { capture: true, passive: false });
          window.addEventListener('click', onAct, true);
          window.addEventListener('keydown', onAct, true);
        }
        function disarm() {
          window.removeEventListener('touchend', onAct, { capture: true, passive: false });
          window.removeEventListener('click', onAct, true);
          window.removeEventListener('keydown', onAct, true);
        }
        function swallowClicks(ms) {
          function eat(ev) { ev.preventDefault(); ev.stopPropagation(); }
          window.addEventListener('click', eat, true);
          setTimeout(function () { window.removeEventListener('click', eat, true); }, ms);
        }
        function begin() {
          if (begun) return;
          begun = true;
          disarm();
          clearInterval(stallT);
          window.removeEventListener('resize', layout);
          try { if (AQ.audio && AQ.audio.start) AQ.audio.start(); } catch (e) { console.warn('[AQ.loading] audio start failed:', e); }
          swallowClicks(450);
          resolve();
        }

        layout();
        window.addEventListener('resize', layout);
        render();
        if (!AQ.audio || !AQ.audio.load) { finished = true; render(); showGo(''); return; }
        AQ.audio.load(function (p) { st = p; lastProg = Date.now(); render(); }).then(function (r) {
          finished = true;
          st = { done: r.total, total: r.total, failed: r.failed };
          render();
          showGo(r.failed && AQ.audio.mode !== 'none' ? 'partial' : '');
        }, function () { finished = true; render(); showGo(''); });
        stallT = setInterval(function () { if (!finished && Date.now() - lastProg > STALL_MS) showGo('slow'); }, 1000);
        if (auto) begin();
      });
    }
  };
})(window.AQ);
