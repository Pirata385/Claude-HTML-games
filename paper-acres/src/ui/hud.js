/* HUD: date/time/weather/gold (top-left), energy/health bars (top-right). All text, two colours. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  PA.UI = PA.UI || {};
  const bar = (v, max, n) => { const k = Math.round(PA.U.clamp(v / max, 0, 1) * n); return '[' + '#'.repeat(k) + '-'.repeat(n - k) + ']'; };
  PA.UI.HUD = {
    init() {
      const ui = document.getElementById('ui');
      const el = document.createElement('div');
      el.id = 'hud';
      el.innerHTML = '<div class="hud-l"><div class="hud-date"></div><div class="hud-time"></div><div class="hud-gold"></div></div><div class="hud-r"><div class="hud-en"></div><div class="hud-hp"></div><div class="hud-ink"></div></div>';
      ui.appendChild(el);
      this.el = el;
      this.q = (s) => el.querySelector(s);
      this.last = '';
    },
    show(v) { if (this.el) this.el.classList.toggle('hidden', !v); },
    update(s) {
      if (!this.el || !s) return;
      const key = [s.day, s.season, Math.floor(s.time / 10), s.weather, s.gold, Math.round(s.energy), Math.round(s.hp), s.ink.graphite, s.ink.ink].join('|');
      if (key === this.last) return;
      this.last = key;
      this.q('.hud-date').textContent = PA.Time.weekday(s) + '. ' + PA.Time.dateText(s);
      this.q('.hud-time').textContent = PA.U.fmtTime(s.time) + '  ' + PA.Weather.icon(s.weather);
      this.q('.hud-gold').textContent = '$ ' + s.gold + 'g';
      this.q('.hud-en').textContent = 'energy ' + bar(s.energy, s.maxEnergy, 10);
      this.q('.hud-hp').textContent = 'health ' + bar(s.hp, s.maxHp, 10);
      this.q('.hud-ink').textContent = 'lead ' + s.ink.graphite + '  ink ' + s.ink.ink;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
