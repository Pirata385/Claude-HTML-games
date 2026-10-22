// In-battle HUD: health bars, status chips, floor label, touch controls with
// cooldown rings (or a slot bar on desktop), banners and tutorial tips.
(function (XS) {
  'use strict';

  const { el, esc } = XS.Cards;
  const STATUS_CHIPS = {
    freeze: ['❄', '#bff4ff', 'Congelado'], chill: ['❆', '#8fd8ff', 'Gelo'], stun: ['✦', '#ffe86a', 'Atordoado'], burn: ['♨', '#ff8a2a', 'Queimando'],
    poison: ['☣', '#8be04a', 'Envenenado'], mark: ['◎', '#ff6ac0', 'Marcado'], timeslow: ['⌛', '#b8c0e0', 'Atrasado'], shield: ['⬡', '#e8fbff', 'Escudo'], haste: ['»', '#ffd166', 'Acelerado'], root: ['⛓', '#ecd8b0', 'Enraizado'], blind: ['☀', '#ffe8ff', 'Ofuscado'],
  };

  class HUD {
    constructor(root, settings) {
      this.settings = settings;
      this.root = el('div', 'hud hidden');
      this.root.innerHTML = `
        <div class="hud-top">
          <div class="me"><div class="me-name"></div><div class="hpbar big"><b class="hp"></b><i class="sh"></i><span></span></div><div class="chips"></div></div>
          <div class="floor-label"></div>
          <button class="pause-btn" type="button" aria-label="${XS.S.pause}">❚❚</button>
        </div>
        <div class="hud-foes"></div>
        <canvas class="minimap" width="2" height="2" aria-hidden="true"></canvas>
        <div class="tip hidden"></div>
        <div class="banner hidden"><div class="b1"></div><div class="b2"></div></div>
        <div class="touch">
          <div class="joy-zone"><div class="joy-base"><div class="joy-knob"></div></div></div>
          <div class="btns">
            <button type="button" class="btn-pow" data-slot="0"><canvas width="16" height="16"></canvas><i class="cd"></i><em></em></button>
            <button type="button" class="btn-pow" data-slot="1"><canvas width="16" height="16"></canvas><i class="cd"></i><em></em></button>
            <button type="button" class="btn-pow" data-slot="2"><canvas width="16" height="16"></canvas><i class="cd"></i><em></em></button>
            <button type="button" class="btn-atk" aria-label="${XS.S.basic}">⚔</button>
            <button type="button" class="btn-dodge" aria-label="${XS.S.dodge}">↯<i class="cd"></i></button>
          </div>
        </div>
        <div class="slots">
          <div class="slot" data-slot="0"><canvas width="16" height="16"></canvas><i class="cd"></i><kbd>1</kbd></div>
          <div class="slot" data-slot="1"><canvas width="16" height="16"></canvas><i class="cd"></i><kbd>2</kbd></div>
          <div class="slot" data-slot="2"><canvas width="16" height="16"></canvas><i class="cd"></i><kbd>3</kbd></div>
          <div class="slot mini"><span>⚔</span><kbd>Clique</kbd></div>
          <div class="slot mini"><span>↯</span><i class="cd"></i><kbd>Espaço</kbd></div>
        </div>
        <div class="fps hidden"></div>`;
      root.appendChild(this.root);
      const q = (s) => this.root.querySelector(s);
      this.els = {
        meName: q('.me-name'), hp: q('.me .hp'), sh: q('.me .sh'), hpText: q('.me .hpbar span'), chips: q('.me .chips'),
        floor: q('.floor-label'), pause: q('.pause-btn'), foes: q(".hud-foes"), tip: q('.tip'), banner: q('.banner'),
        touch: q('.touch'), joyZone: q('.joy-zone'), joyBase: q('.joy-base'), joyKnob: q('.joy-knob'),
        attack: q('.btn-atk'), dodge: q('.btn-dodge'), dodgeCd: q('.btn-dodge .cd'),
        powers: [...this.root.querySelectorAll('.btn-pow')], slots: [...this.root.querySelectorAll('.slot[data-slot]')],
        slotDodgeCd: q('.slot.mini:last-child .cd'), fps: q('.fps'), minimap: q('.minimap'),
      };
      this.bannerT = 0;
      this.lastChips = '';
      this.applySettings();
    }

    applySettings() {
      const s = this.settings;
      this.root.classList.toggle('lefty', !!s.leftHanded);
      this.root.style.setProperty('--bs', s.buttonSize);
      this.root.style.setProperty('--bo', s.buttonOpacity);
      this.els.fps.classList.toggle('hidden', !s.showFps);
      const fixed = s.joystick === 1;
      this.els.joyBase.classList.toggle('fixed', fixed);
      if (fixed) { this.els.joyBase.style.left = ''; this.els.joyBase.style.top = ''; }
    }

    setMode(mode) {
      this.root.classList.toggle('mode-touch', mode === 'touch');
      this.root.classList.toggle('mode-kb', mode !== 'touch');
    }

    show(battle, plan) {
      this.battle = battle;
      this.root.classList.remove('hidden');
      const p = battle.player;
      this.els.meName.textContent = p.name;
      const type = plan.type === 'guardian' ? XS.t('guardian', { n: plan.floor }) : plan.type === 'melee' ? XS.S.melee : XS.S.duel;
      this.els.floor.innerHTML = `${XS.t('floor', { n: plan.floor })}<small>${esc(type)}</small>`;
      this.els.foes.innerHTML = '';
      this.foeEls = battle.fighters.filter((f) => !f.isPlayer).map((f) => {
        const row = el('div', 'foe', `<span>${esc(f.name)}</span><div class="hpbar"><b class="hp"></b><i class="sh"></i></div>`);
        row.style.setProperty('--team', XS.TEAM_COLORS[1 + (f.team % 4)]);
        this.els.foes.appendChild(row);
        return { f, row, hp: row.querySelector('.hp'), sh: row.querySelector('.sh') };
      });
      p.powers.forEach((slot, i) => {
        for (const holder of [this.els.powers[i], this.els.slots[i]]) {
          const cv = holder.querySelector('canvas');
          const g = cv.getContext('2d');
          g.clearRect(0, 0, 16, 16);
          g.drawImage(XS.icons.power(slot.def, { codes: this.settings.elementCodes }), 0, 0);
          holder.style.setProperty('--glow', slot.def.ramp[2]);
          holder.title = slot.def.name;
        }
      });
      this.els.powers.forEach((b, i) => b.classList.toggle('hidden', !p.powers[i]));
      this.els.slots.forEach((b, i) => b.classList.toggle('hidden', !p.powers[i]));
      this.wasReady = p.powers.map(() => false);
      // Minimap in the camera's orientation: one pixel per column, a diamond.
      const w = battle.world, cv = this.els.minimap;
      cv.width = w.W + w.D; cv.height = Math.ceil((w.W + w.D) / 2) + 1;
      this.mm = { ver: -1, t: 0, base: null };
    }

    drawMinimap(dt) {
      const b = this.battle, w = b.world, mm = this.mm, cv = this.els.minimap;
      if ((mm.t -= dt) > 0) return;
      mm.t = 0.2;
      if (!mm.base || (w.version !== mm.ver && (mm.rebuilt || 0) + 0.6 < b.time)) {
        mm.ver = w.version; mm.rebuilt = b.time;
        mm.base = mm.base || XS.gfx.makeCanvas(cv.width, cv.height);
        const g = mm.base.getContext('2d'), img = g.createImageData(cv.width, cv.height), px = img.data;
        const mats = b.arena.theme.mats, base = XS.Arena.BASE;
        const rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
        const floor = rgb(XS.color.darken(mats.floorA.color, 0.15)), high = rgb(XS.color.lighten(mats.wall.color, 0.15)), pit = rgb(XS.color.darken(mats.sub.color, 0.45));
        for (let y = 0; y < w.D; y++) for (let x = 0; x < w.W; x++) {
          const t = w.colTop[x + y * w.W];
          if (!t) continue;
          const c = t > base + 1 ? high : t < base ? pit : floor;
          const i = ((x + y) >> 1) * cv.width + (x - y + w.D - 1);
          px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 235;
        }
        g.putImageData(img, 0, 0);
      }
      const g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(mm.base, 0, 0);
      for (const f of b.fighters) {
        if (!f.alive) continue;
        const sx = Math.round(f.x - f.y + w.D - 1), sy = Math.round((f.x + f.y) / 2);
        const s = f.isPlayer ? 5 : 4;
        g.fillStyle = '#000'; g.fillRect(sx - s / 2 - 1, sy - s / 2 - 1, s + 2, s + 2);
        g.fillStyle = f.isPlayer ? XS.TEAM_COLORS[0] : XS.TEAM_COLORS[1 + (f.team % 4)];
        g.fillRect(sx - s / 2, sy - s / 2, s, s);
      }
    }

    hide() { this.root.classList.add('hidden'); this.tip(null); }

    banner(main, sub = '', ms = 1400) {
      const b = this.els.banner;
      b.querySelector('.b1').textContent = main;
      b.querySelector('.b2').textContent = sub;
      b.classList.remove('hidden');
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      this.bannerT = ms / 1000;
    }

    tip(text) {
      const t = this.els.tip;
      if (!text) { t.classList.add('hidden'); this.tipText = null; return; }
      if (this.tipText === text) return;
      this.tipText = text;
      t.textContent = text;
      t.classList.remove('hidden');
    }

    update(dt, aiming, fps) {
      const b = this.battle;
      if (!b) return;
      if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) this.els.banner.classList.add('hidden');
      const p = b.player;
      const k = Math.max(0, p.hp / p.maxHp);
      this.els.hp.style.width = (k * 100).toFixed(1) + '%';
      this.els.hp.classList.toggle('low', k < 0.3);
      this.els.sh.style.width = Math.min(100, (p.st.shield / p.maxHp) * 100).toFixed(1) + '%';
      this.els.hpText.textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;
      const chips = XS.Status.labels(p).join(',');
      if (chips !== this.lastChips) {
        this.lastChips = chips;
        this.els.chips.innerHTML = XS.Status.labels(p).map((s) => `<i style="--c:${STATUS_CHIPS[s][1]}" title="${STATUS_CHIPS[s][2]}">${STATUS_CHIPS[s][0]}</i>`).join('');
      }
      for (const fe of this.foeEls) {
        const kk = Math.max(0, fe.f.hp / fe.f.maxHp);
        fe.hp.style.width = (kk * 100).toFixed(1) + '%';
        fe.sh.style.width = Math.min(100, (fe.f.st.shield / fe.f.maxHp) * 100).toFixed(1) + '%';
        fe.row.classList.toggle('dead', !fe.f.alive);
        fe.row.classList.toggle('enraged', !!fe.f.enraged);
      }
      p.powers.forEach((slot, i) => {
        const frac = slot.def.cooldown ? slot.cd / slot.def.cooldown : 0;
        const ready = slot.cd <= 0;
        for (const h of [this.els.powers[i], this.els.slots[i]]) {
          h.style.setProperty('--p', (frac * 360).toFixed(0) + 'deg');
          h.classList.toggle('ready', ready);
          h.classList.toggle('aiming', !!(aiming && aiming.slot === i));
          h.classList.toggle('cancel', !!(aiming && aiming.slot === i && aiming.cancel));
        }
        const label = this.els.powers[i].querySelector('em');
        label.textContent = ready ? '' : Math.ceil(slot.cd);
        if (ready && !this.wasReady[i]) { this.els.powers[i].classList.remove('flash'); void this.els.powers[i].offsetWidth; this.els.powers[i].classList.add('flash'); }
        this.wasReady[i] = ready;
      });
      const dk = p.dodge.cd / 1.5;
      this.els.dodgeCd.style.setProperty('--p', (dk * 360).toFixed(0) + 'deg');
      if (this.els.slotDodgeCd) this.els.slotDodgeCd.style.setProperty('--p', (dk * 360).toFixed(0) + 'deg');
      this.els.dodge.classList.toggle('ready', p.dodge.cd <= 0);
      if (fps != null && this.settings.showFps) this.els.fps.textContent = fps + ' FPS';
      this.drawMinimap(dt);
    }
  }

  XS.HUD = HUD;
})(globalThis.XS = globalThis.XS || {});
