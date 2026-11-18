/* Title page: new notebook, continue (save slots), settings. The world idles behind it. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  PA.UI = PA.UI || {};
  const esc = (s) => PA.U.esc(s);
  PA.UI.Title = {
    init() {
      const el = document.createElement('div');
      el.id = 'title';
      el.innerHTML = `<div class="tpage">
        <h1>Paper Acres</h1>
        <p class="sub">a little farm in the margins of an old school notebook</p>
        <div class="tmenu">
          <button data-a="new">new notebook</button>
          <button data-a="continue">continue</button>
          <button data-a="stickman">stickman</button>
          <button data-a="settings">settings</button>
          <button data-a="about">about</button>
        </div>
        <div class="tpanel"></div>
        <p class="hint">desktop: A/D walk, W/S step into the page / out of it, Space jump, E act, Q draw<br>phone: stick to walk (flick up/down to step), buttons on the right</p>
      </div>`;
      document.getElementById('ui').appendChild(el);
      this.el = el;
      this.panel = el.querySelector('.tpanel');
      for (const b of el.querySelectorAll('.tmenu button')) b.onclick = () => this[b.dataset.a]();
      if (!PA.Save.list().length) el.querySelector('[data-a=continue]').disabled = true;
    },
    show(v) { this.el.classList.toggle('hidden', !v); if (v) { this.panel.innerHTML = ''; const c = this.el.querySelector('[data-a=continue]'); c.disabled = !PA.Save.list().length; } },
    new() {
      const used = new Set(PA.Save.list().map((s) => s.slot));
      let slot = 1; while (used.has(slot) && slot < 3) slot++;
      this.panel.innerHTML = `<form class="tform">
        <label>your name <input name="name" maxlength="14" value="Doodle" autocomplete="off"></label>
        <label>farm name <input name="farm" maxlength="18" value="Paper Acres" autocomplete="off"></label>
        <label>season length <select name="days"><option value="28">28 days</option><option value="14">14 days (shorter)</option></select></label>
        <label>stickman <button type="button" data-g>${PA.U.esc(PA.Stick.MODELS[PA.Stick.model(PA.settings.model)].name)} (${PA.U.esc(PA.Stick.MODELS[PA.Stick.model(PA.settings.model)].body)}) - change</button></label>
        <label>save slot <select name="slot">${[1, 2, 3].map((i) => `<option value="${i}" ${i === slot ? 'selected' : ''}>slot ${i}${used.has(i) ? ' (overwrite)' : ''}</option>`).join('')}</select></label>
        <button type="submit">start drawing</button>
      </form>`;
      const f = this.panel.querySelector('form');
      f.querySelector('[data-g]').onclick = () => PA.scene.openGallery();
      f.querySelectorAll('input').forEach((i) => { i.onfocus = () => { PA.Input.uiTyping = true; }; i.onblur = () => { PA.Input.uiTyping = false; }; });
      f.onsubmit = (e) => {
        e.preventDefault();
        const seed = (Math.random() * 4294967295) >>> 0;
        const st = PA.newState(seed, { name: f.name.value.trim() || 'Doodle', farm: f.farm.value.trim() || 'Paper Acres', seasonDays: +f.days.value });
        st.model = PA.Stick.model(PA.settings.model);
        PA.Input.uiTyping = false;
        PA.startGame(st, +f.slot.value, true);
      };
    },
    continue() {
      const list = PA.Save.list();
      this.panel.innerHTML = list.map((s) => `<div class="slot"><span>${esc(s.summary)}</span><button data-l="${s.slot}">load</button><button data-x="${s.slot}">export</button><button data-d="${s.slot}">delete</button></div>`).join('') +
        `<div class="slot"><button data-i="1">import a save (.json)</button></div>`;
      this.panel.querySelectorAll('[data-l]').forEach((b) => { b.onclick = () => { const st = PA.Save.read(+b.dataset.l); if (st) PA.startGame(st, +b.dataset.l, false); }; });
      this.panel.querySelectorAll('[data-d]').forEach((b) => { b.onclick = async () => { if (await PA.UI.confirm('Erase this notebook for good?', ['Erase', 'Keep']) === 0) { PA.Save.remove(+b.dataset.d); this.continue(); } }; });
      this.panel.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => { const j = PA.Save.exportJSON(+b.dataset.x); if (!j) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'paper-acres-slot' + b.dataset.x + '.json'; a.click(); }; });
      this.panel.querySelector('[data-i]').onclick = () => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
        inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then((t) => { const free = [1, 2, 3].find((i) => !PA.Save.read(i)) || 3; if (PA.Save.importJSON(free, t)) { PA.UI.toast('Imported into slot ' + free); this.continue(); } else PA.UI.toast('That file is not a Paper Acres save.'); }); };
        inp.click();
      };
    },
    stickman() { PA.scene.openGallery(); },
    settings() { if (PA.UI.Settings) PA.UI.Settings.render(this.panel); },
    about() {
      this.panel.innerHTML = `<p class="about">Everything here is drawn as lines and turned into letters by an ASCII renderer.<br>Grow crops, befriend Marginton, draw what you need (only things, never creatures), and mend the town's torn notebook.<br><br>Made with Phaser 3. Fonts: Courier Prime, Patrick Hand (OFL).</p>`;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
