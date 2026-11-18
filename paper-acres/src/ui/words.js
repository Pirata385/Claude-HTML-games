/* Words tab and the touch placement bar. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  PA.UI = PA.UI || {};
  const esc = (s) => PA.U.esc(s);
  const DESC = {
    structure: 'falls, settles and becomes solid', physics: 'a physical object', tool: 'goes into your bag as a tool', combat: 'goes into your bag for the mine', home: 'decoration',
    ladder: 'climbable', rope: 'climbable', boat: 'floats on water', raft: 'floats on water', balloon: 'floats up and hovers', spring: 'bounces you high', bomb: 'explodes after a moment',
    umbrella: 'glide while falling', lantern: 'light at night', sign: 'write your own words', seesaw: 'tilts on a pivot', lamp: 'light at night', sprinkler: 'waters crops around it each morning', scarecrow: 'keeps crows away',
  };
  PA.UI.Words = {
    render(el) {
      const s = PA.scene.state;
      el.innerHTML = '<p class="muted">Draw with Q (or the draw button). Pencil fades after 3 days; pen is permanent. Learn new words from word cards (Ada\'s shop, friends, the mine).</p>' +
        PA.Words.ALL.map((w) => { const k = s.words.includes(w.id); return `<div class="recipe"><b style="width:9em">${k ? esc(w.name) : '???'}</b><span class="req">${k ? esc(DESC[w.id] || DESC[w.cat]) + ' - x' + w.mult + ' ink' : 'not learned yet'}</span></div>`; }).join('');
    },
  };
  PA.UI.Place = {
    show(v) {
      if (!v) { if (this.el) this.el.remove(); this.el = null; return; }
      if (this.el || !PA.Touch.isTouch()) return;
      const el = document.createElement('div'); el.id = 'place';
      el.innerHTML = '<button data-m="-1">&lt;</button><button data-m="1">&gt;</button><button data-z="1">ahead</button><button data-z="-1">behind</button><button data-ok>place</button><button data-no>cancel</button>';
      document.getElementById('ui').appendChild(el); this.el = el;
      const g = () => PA.scene;
      el.querySelectorAll('[data-m]').forEach((b) => { let t = null; const step = () => { if (g().placing) g().placing.x += +b.dataset.m * 6; }; b.onpointerdown = (e) => { e.preventDefault(); step(); t = setInterval(step, 60); }; b.onpointerup = b.onpointercancel = () => clearInterval(t); });
      el.querySelectorAll('[data-z]').forEach((b) => { b.onclick = () => { const pl = g().placing; if (!pl) return; const pz = g().player.z; pl.z = PA.U.clamp(pl.z + +b.dataset.z, Math.max(0, pz - 1), Math.min(g().map.grid.d - 1, pz + 1)); }; });
      el.querySelector('[data-ok]').onclick = () => { if (g().placing) PA.Drawn.confirmPlacement(g()); };
      el.querySelector('[data-no]').onclick = () => { if (g().placing) PA.Drawn.cancelPlacement(g()); };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
