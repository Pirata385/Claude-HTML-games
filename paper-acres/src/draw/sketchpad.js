/* Sketchpad: draw with pencil or pen; finished strokes snap into ASCII live (same matcher as the world).
 * Then pick a word (ranked by shape) and place the drawing in front of you. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const esc = (s) => PA.U.esc(s);

  /** Convert world-px strokes inside a cols x rows cell box to ASCII text rows (2 chars per cell, like the world). */
  function toAscii(strokes, cols, rows) {
    const M = PA.Matcher, D = 2, cw = cols * D, ch = rows * D;
    const cv = toAscii.cv || (toAscii.cv = document.createElement('canvas'));
    cv.width = cw * M.SX; cv.height = ch * M.SY;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    const sx = M.SX * D / C.CELL_W, sy = M.SY * D / C.CELL_H;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1 / sy; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const s of strokes) { ctx.moveTo(s[0].x, s[0].y); for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y); if (s.length === 1) ctx.lineTo(s[0].x + 0.5, s[0].y); }
    ctx.stroke();
    const W = cv.width, H = cv.height, data = ctx.getImageData(0, 0, W, H).data;
    const dk = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) dk[i] = 255 - data[i * 4];
    const on = (x, y) => { const i = y * W + x, d = dk[i]; if (d <= 96) return 0; const L = x ? dk[i - 1] : 0, R = x < W - 1 ? dk[i + 1] : 0, U = y ? dk[i - W] : 0, Dn = y < H - 1 ? dk[i + W] : 0; return ((d > L && d >= R) || (d > U && d >= Dn)) ? 1 : 0; };
    const out = [];
    for (let r = 0; r < ch; r++) {
      let line = '';
      for (let c = 0; c < cw; c++) {
        let key = 0;
        for (let yy = 0; yy < M.SY; yy++) for (let xx = 0; xx < M.SX; xx++) if (on(c * M.SX + xx, r * M.SY + yy)) key |= 1 << (yy * M.SX + xx);
        line += M.classify(key);
      }
      out.push(line);
    }
    return out;
  }

  const Sketch = PA.Sketch = {
    toAscii,
    cols: 16, rows: 10,
    open(game) {
      if (this.el || !game.state) return;
      const s = game.state;
      this.game = game;
      this.cols = s.flags.padBig ? 24 : 16; this.rows = s.flags.padBig ? 14 : 10;
      this.strokes = []; this.medium = 'pencil'; this.tool = 'draw'; this.cur = null;
      PA.Input.blocked = true; PA.Input.clearAll();
      const el = document.createElement('div');
      el.id = 'sketch';
      el.innerHTML = `<div class="sk">
        <div class="sk-top"><b>sketchpad</b><span class="sk-note">draw a thing (never a creature), then name it</span><button data-a="close">x</button></div>
        <div class="sk-main">
          <div class="sk-pad"><canvas></canvas><pre class="sk-ascii"></pre></div>
          <div class="sk-side">
            <div class="sk-tools"><button data-t="pencil" class="on">pencil</button><button data-t="pen">pen</button><button data-t="erase">eraser</button><button data-a="undo">undo</button><button data-a="clear">clear</button></div>
            <div class="sk-ink"></div>
            <div class="sk-words"></div>
          </div>
        </div></div>`;
      document.getElementById('ui').appendChild(el);
      this.el = el;
      this.cv = el.querySelector('canvas'); this.pre = el.querySelector('.sk-ascii');
      this.layout();
      el.querySelector('[data-a=close]').onclick = () => this.close();
      el.querySelector('[data-a=undo]').onclick = () => { this.strokes.pop(); this.refresh(); };
      el.querySelector('[data-a=clear]').onclick = () => { this.strokes = []; this.refresh(); };
      el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => {
        const t = b.dataset.t;
        if (t === 'erase') this.tool = 'erase'; else { this.tool = 'draw'; this.medium = t; }
        el.querySelectorAll('[data-t]').forEach((q) => q.classList.toggle('on', q === b));
        this.refresh();
      }; });
      const pad = el.querySelector('.sk-pad');
      const pt = (e) => { const r = this.cv.getBoundingClientRect(); return { x: PA.U.clamp((e.clientX - r.left) / this.k, 0, this.cols * C.CELL_W), y: PA.U.clamp((e.clientY - r.top) / this.k, 0, this.rows * C.CELL_H) }; };
      pad.onpointerdown = (e) => {
        e.preventDefault(); pad.setPointerCapture(e.pointerId);
        const p = pt(e);
        if (this.tool === 'erase') { this.eraseAt(p); this.erasing = true; return; }
        this.cur = [p]; this.drawLive();
        PA.Bus.emit('pencil', { on: true });
      };
      pad.onpointermove = (e) => {
        const p = pt(e);
        if (this.erasing) { this.eraseAt(p); return; }
        if (!this.cur) return;
        const l = this.cur[this.cur.length - 1], d = Math.hypot(p.x - l.x, p.y - l.y);
        if (d < 1.5) return;
        this.cur.push(p); this.drawLive();
        PA.Bus.emit('pencil', { on: true, speed: d });
      };
      const up = () => {
        this.erasing = false;
        if (!this.cur) return;
        if (this.cur.length === 1) this.cur.push({ x: this.cur[0].x + 0.6, y: this.cur[0].y + 0.6 });
        this.strokes.push(this.cur); this.cur = null;
        PA.Bus.emit('pencil', { on: false });
        this.refresh();
      };
      pad.onpointerup = up; pad.onpointercancel = up;
      this.key = (e) => { if (e.code === 'Escape') { e.stopPropagation(); this.close(); } if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { this.strokes.pop(); this.refresh(); } };
      window.addEventListener('keydown', this.key, true);
      this.onResize = () => this.layout();
      window.addEventListener('resize', this.onResize);
      this.refresh();
    },
    close() {
      if (!this.el) return;
      if (this.contest && !this.submitted) this.contest = null;
      window.removeEventListener('keydown', this.key, true);
      window.removeEventListener('resize', this.onResize);
      this.el.remove(); this.el = null;
      PA.Input.blocked = false; PA.Input.clearAll();
    },
    layout() {
      const main = this.el.querySelector('.sk-main');
      const wide = window.innerWidth > window.innerHeight * 1.15;
      main.classList.toggle('tall', !wide);
      const maxW = wide ? window.innerWidth * 0.62 : window.innerWidth * 0.92;
      const maxH = wide ? window.innerHeight * 0.78 : window.innerHeight * 0.5;
      this.k = Math.min(maxW / (this.cols * C.CELL_W), maxH / (this.rows * C.CELL_H));
      const W = Math.floor(this.cols * C.CELL_W * this.k), H = Math.floor(this.rows * C.CELL_H * this.k);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.cv.width = W * dpr; this.cv.height = H * dpr; this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
      this.cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      this.pre.style.fontSize = (C.CELL_H * this.k / 2) + 'px';
      this.pre.style.lineHeight = (C.CELL_H * this.k / 2) + 'px';
      this.pre.style.letterSpacing = ((C.CELL_W * this.k / 2) - (C.CELL_H * this.k / 2) * 0.6) + 'px';
      this.drawLive();
    },
    drawLive() {
      const ctx = this.cv.getContext('2d'), W = this.cols * C.CELL_W * this.k, H = this.rows * C.CELL_H * this.k;
      ctx.clearRect(0, 0, W, H);
      // grid dots: one per world cell
      ctx.fillStyle = C.INK;
      for (let y = 1; y < this.rows; y++) for (let x = 1; x < this.cols; x++) ctx.fillRect(x * C.CELL_W * this.k - 0.5, y * C.CELL_H * this.k - 0.5, 1, 1);
      if (!this.cur) return;
      ctx.strokeStyle = C.INK; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (this.medium === 'pencil') ctx.setLineDash([5, 3]); else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(this.cur[0].x * this.k, this.cur[0].y * this.k);
      for (const p of this.cur) ctx.lineTo(p.x * this.k, p.y * this.k);
      ctx.stroke(); ctx.setLineDash([]);
    },
    eraseAt(p) {
      const before = this.strokes.length;
      this.strokes = this.strokes.filter((s) => !s.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 8));
      if (this.strokes.length !== before) { PA.Bus.emit('erase'); this.refresh(); }
    },
    refresh() {
      if (!this.el) return;
      this.drawLive();
      this.pre.textContent = toAscii(this.strokes, this.cols, this.rows).join('\n');
      const g = this.game, s = g.state;
      const lead = PA.Ink.available(s, g.inv, 'pencil'), ink = PA.Ink.available(s, g.inv, 'pen');
      this.el.querySelector('.sk-ink').innerHTML = `lead ${lead}  |  ink ${ink}<br><span class="muted">${this.medium === 'pen' ? 'pen: permanent' : 'pencil: fades after 3 days, can be erased'}</span>`;
      const wl = this.el.querySelector('.sk-words');
      if (!PA.Ink.valid(this.strokes)) { wl.innerHTML = '<p class="muted">Draw something on the page.</p>'; return; }
      if (this.contest) {
        wl.innerHTML = '<button class="word best" data-submit>submit to the judges</button>';
        wl.querySelector('[data-submit]').onclick = () => { const f = this.contest, st = this.strokes; this.contest = null; this.close(); f(st); };
        return;
      }
      const ranked = PA.Shapes.rank(PA.Shapes.features(this.strokes), s.words);
      const have = this.medium === 'pen' ? ink : lead;
      wl.innerHTML = '<p class="muted">What is it?</p>' + ranked.map((r, i) => {
        const w = PA.Words.get(r.id), cost = PA.Ink.cost(this.strokes, r.id);
        return `<button class="word${i === 0 ? ' best' : ''}" data-w="${r.id}" ${cost > have ? 'disabled' : ''}>${esc(w.name)} <span>${cost}</span></button>`;
      }).join('') + (s.words.length < PA.Words.ALL.length ? `<p class="muted">${PA.Words.ALL.length - s.words.length} more words to learn in Marginton.</p>` : '');
      wl.querySelectorAll('[data-w]').forEach((b) => { b.onclick = () => this.choose(b.dataset.w); });
    },
    choose(wordId) {
      const strokes = this.strokes.map((st) => st.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })));
      const medium = this.medium, cost = PA.Ink.cost(strokes, wordId);
      this.close();
      PA.Drawn.beginPlacement(this.game, { strokes, word: wordId, medium, cost });
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sketch;
})(typeof window !== 'undefined' ? window : globalThis);
