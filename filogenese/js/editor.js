/* Filogênese — editor de criaturas: corpo, partes por categoria, pele e prévia animada, com orçamento de DNA. */
(function (FG) {
  'use strict';
  const U = FG.U, G = FG.Game, UI = FG.UI, Parts = FG.Parts, Species = FG.Species, Draw = FG.Draw, Creature = FG.Creature;
  const T = (k, a, b) => FG.T(k, a, b);
  const ic = UI.ic, esc = UI.esc;
  const TABS = ['body'].concat(Parts.CATS, ['skin']);
  const HEADS = ['round', 'long', 'wide', 'wedge', 'flat'];
  const PATTERNS = ['plain', 'spots', 'patches', 'stripes', 'rings', 'dorsal'];
  const FOCUS = { mouth: 'head', eyes: 'head', horn: 'head', adorn: 'head', voice: 'head', gland: 'head', tail: 'tail', back: 'mid', arms: 'arms', feet: 'feet' };
  const btn = (act, label, cls, icon, attr) => `<button class="btn ${cls || ''}" data-act="${act}" type="button" ${attr || ''}>${icon ? ic(icon) : ''}<span>${esc(label)}</span></button>`;

  function statChips(p) {
    let h = '';
    for (const k in p.st) {
      const v = p.st[k];
      if (k === 'diet') h += `<span>${ic(v === 'H' ? 'leaf' : v === 'C' ? 'meat' : 'mouth')}${esc(T('diet.' + v))}</span>`;
      else if (k === 'hp') h += `<span>${ic('heart')}+${v}</span>`;
      else if (k === 'thorns') h += `<span>${ic('shield')}${esc(T('ed.thorns'))}</span>`;
      else h += `<span>${ic(k)}${v}</span>`;
    }
    return h;
  }

  /** Miniatura de uma parte: a criatura atual com a parte equipada, com zoom na região. */
  function thumb(cv, g, cat, id, level) {
    const t = Parts.cloneGenome(g);
    t.parts[cat] = id;
    if (cat === 'feet' && t.legs.pairs === 0) t.legs.pairs = 2;
    const sp = Species.makePlayer('t', t, level);
    Draw.portrait(cv, sp, { angle: FOCUS[cat] === 'tail' ? 2.6 : -0.45, focus: FOCUS[cat], shadow: false });
  }

  UI.register('editor', {
    dismiss: false,
    close(d) { cancelAnimationFrame(d.raf); d.raf = 0; },
    build(root, d) {
      const create = d.mode === 'create';
      if (!d.g) {
        d.orig = Parts.cloneGenome(create ? d.genome : G.playerSp.genome);
        d.g = Parts.cloneGenome(d.orig);
        d.name = create ? d.name : FG.spName(G.playerSp);
        d.level = create ? 1 : G.level;
        d.budget = create ? d.budget : G.dna + Parts.cost(d.orig);
        d.unlocked = create ? new Set(Parts.starterUnlocks()) : G.unlocked;
        d.tab = 'body'; d.walk = true; d.demo = 0;
      }
      const sp = Species.makePlayer(d.name, d.g, d.level);
      const base = Species.makePlayer('b', d.orig, d.level).stats;
      root.innerHTML = `<div class="ed">
        <div class="ed-top"><h2>${esc(T(create ? 'ed.create' : 'ed.evolve'))}</h2>
          <input type="text" id="edName" maxlength="18" value="${esc(d.name)}" autocomplete="off" spellcheck="false" aria-label="${esc(T('ng.name'))}">
          <div class="ed-dna" id="edDna"></div></div>
        <div class="ed-prev"><canvas id="edCv"></canvas><div class="ed-summary" id="edSum"></div>
          <div class="ed-anim">
            <button type="button" data-act="walk" title="${esc(T('ed.walk'))}">${ic('pause')}</button>
            <button type="button" data-act="demoS" title="${esc(T('ed.demoS'))}">${ic('heart')}</button>
            <button type="button" data-act="demoC" title="${esc(T('ed.demoC'))}">${ic('bite')}</button>
          </div><div class="ed-stats" id="edStats"></div></div>
        <div class="ed-side"><div class="ed-tabs" id="edTabs"></div><div class="ed-body" id="edBody"></div></div>
        <div class="ed-foot"><span class="hint" id="edHint"></span>${btn('undo', T('ed.undo'), 'ghost small')}${btn('cancel', T(create ? 'ui.back' : 'ed.cancel'), 'ghost small')}${btn('ok', T(create ? 'ed.begin' : 'ed.confirm'), 'mint', 'check', 'id="edOk"')}</div></div>`;
      const $ = (s) => root.querySelector(s);
      const cv = $('#edCv'), ctx = cv.getContext('2d');
      const c = new Creature(sp, 60, 0, { angle: Math.PI / 2 });

      const changed = () => { sp.genome = d.g; Species.refresh(sp); renderStats(); };
      function renderStats() {
        const st = sp.stats, cost = Parts.cost(d.g), left = d.budget - cost;
        const row = (k, cls) => `<div class="stat" title="${esc(T('ab.' + k))}"><span>${ic(k)}<span class="lb">${esc(T('ab.' + k))}</span></span>${UI.pips(st[k], cls, base[k])}</div>`;
        $('#edStats').innerHTML = Parts.SOCIAL.map((k) => row(k, '')).join('') + Parts.COMBAT.map((k) => row(k, 'cmb')).join('') + ['speed', 'jump', 'swim', 'sense'].map((k) => row(k, 'mov')).join('');
        $('#edSum').innerHTML = `<span class="tag ${st.diet}">${ic(st.diet === 'H' ? 'leaf' : st.diet === 'C' ? 'meat' : 'mouth')}${esc(T('diet.' + st.diet))}</span><span class="tag">${esc(T('n.' + sp.niche))}</span><span class="tag">${ic('heart')}${st.hp}${st.hp !== base.hp ? ` (${st.hp > base.hp ? '+' : ''}${st.hp - base.hp})` : ''}</span><span class="tag">${ic('bolt')}${st.moveSpeed}</span>`;
        const dn = $('#edDna');
        dn.className = 'ed-dna' + (left < 0 ? ' over' : '');
        dn.innerHTML = ic('dna') + `<span>${left} DNA</span><small class="dim" style="font-weight:600">(${esc(T('ed.cost'))} ${cost})</small>`;
        $('#edOk').disabled = left < 0;
        $('#edHint').textContent = left < 0 ? T('ed.over', -left) : T('ed.hint.' + (d.tab === 'body' || d.tab === 'skin' ? d.tab : 'parts'));
      }
      function renderTabs() {
        $('#edTabs').innerHTML = TABS.map((t) => `<button class="chip ${d.tab === t ? 'on' : ''}" data-act="tab" data-t="${t}" type="button">${esc(T('cat.' + t))}</button>`).join('');
      }
      function slider(key, label, min, max, step, val) {
        return `<div class="set-row"><label>${esc(T(label))}</label><div class="ctl"><input type="range" data-g="${key}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${esc(T(label))}"></div></div>`;
      }
      function renderBody() {
        const g = d.g, body = $('#edBody');
        if (d.tab === 'body') {
          body.innerHTML = `<h3>${esc(T('ed.h.body'))}</h3>
            ${slider('size', 'ed.size', 0.75, (1.05 + 0.09 * d.level).toFixed(2), 0.01, g.size)}${slider('segs', 'ed.segs', 6, 14, 1, g.segs)}${slider('len', 'ed.len', 0.85, 1.2, 0.01, g.len)}
            ${slider('prof0', 'ed.front', 0.7, 1.6, 0.01, g.prof[0])}${slider('prof1', 'ed.mid', 0.7, 1.6, 0.01, g.prof[1])}${slider('prof2', 'ed.rear', 0.7, 1.6, 0.01, g.prof[2])}${slider('tailLen', 'ed.tail', 0.15, 0.5, 0.01, g.tailLen)}
            <h3>${esc(T('ed.h.head'))}</h3><div class="chips" style="margin-bottom:8px">${HEADS.map((h) => `<button class="chip ${g.head.shape === h ? 'on' : ''}" data-act="head" data-k="${h}" type="button">${esc(T('head.' + h))}</button>`).join('')}</div>
            ${slider('hsize', 'ed.hsize', 0.85, 1.3, 0.01, g.head.size)}${slider('eyePairs', 'ed.eyes', 1, 3, 1, g.eyePairs)}
            <h3>${esc(T('ed.h.legs'))}</h3>${slider('pairs', 'ed.pairs', 0, 4, 1, g.legs.pairs)}${slider('leglen', 'ed.leglen', 0.6, 1.6, 0.01, g.legs.len)}
            <p class="dim" style="margin-top:10px">${esc(T('ed.body.d'))}</p>`;
        } else if (d.tab === 'skin') {
          const col = (k, label) => {
            const c0 = g.skin[k];
            return `<h3>${esc(T(label))} <span style="display:inline-block;width:1.1em;height:1.1em;border-radius:50%;vertical-align:-0.2em;background:${U.hsl(c0)};border:2px solid #fff" data-sw="${k}"></span></h3>
              <div class="set-row"><label>${esc(T('ed.hue'))}</label><div class="ctl"><input type="range" data-c="${k}:0" min="0" max="359" step="1" value="${Math.round(c0[0])}" style="background:linear-gradient(90deg,red,yellow,lime,cyan,blue,magenta,red);border-radius:8px" aria-label="${esc(T('ed.hue'))}"></div></div>
              <div class="set-row"><label>${esc(T('ed.sat'))}</label><div class="ctl"><input type="range" data-c="${k}:1" min="8" max="92" step="1" value="${Math.round(c0[1])}" aria-label="${esc(T('ed.sat'))}"></div></div>
              <div class="set-row"><label>${esc(T('ed.lum'))}</label><div class="ctl"><input type="range" data-c="${k}:2" min="16" max="86" step="1" value="${Math.round(c0[2])}" aria-label="${esc(T('ed.lum'))}"></div></div>`;
          };
          body.innerHTML = `<h3>${esc(T('ed.pattern'))}</h3><div class="chips" style="margin-bottom:8px">${PATTERNS.map((p) => `<button class="chip ${g.skin.pattern === p ? 'on' : ''}" data-act="pat" data-k="${p}" type="button">${esc(T('pat.' + p))}</button>`).join('')}</div>
            ${col('c1', 'ed.c1')}${col('c2', 'ed.c2')}${col('c3', 'ed.c3')}<div style="margin-top:12px">${btn('rskin', T('ed.rskin'), 'ghost small')}</div>`;
        } else {
          const cat = d.tab, cur = g.parts[cat];
          const list = Parts.inCat(cat).slice().sort((a, b) => a.tier - b.tier || a.cost - b.cost);
          let h = `<p class="dim">${esc(T('cat.' + cat + '.d'))}</p><div class="part-grid">`;
          if (!Parts.REQUIRED[cat]) h += `<button class="part none ${cur ? '' : 'on'}" data-act="part" data-id="" type="button">${ic('close')}<b>${esc(T('ed.none'))}</b></button>`;
          for (const p of list) {
            const lock = !d.unlocked.has(p.id);
            h += `<button class="part ${cur === p.id ? 'on' : ''} ${lock ? 'locked' : ''}" data-act="part" data-id="${p.id}" type="button"><canvas width="232" height="160" data-thumb="${p.id}"></canvas><span class="cost">${lock ? ic('lock') : ic('dna')}${p.cost}</span><b>${esc(T('p.' + p.id))}</b><small>${statChips(p)}</small></button>`;
          }
          body.innerHTML = h + '</div>';
          body.querySelectorAll('canvas[data-thumb]').forEach((tc) => thumb(tc, g, cat, tc.dataset.thumb, d.level));
        }
        body.scrollTop = 0;
        renderStats();
      }
      renderTabs(); renderBody();

      root.addEventListener('input', (e) => {
        const t = e.target, g = d.g;
        if (t.id === 'edName') { d.name = t.value.slice(0, 18); return; }
        if (t.dataset.g) {
          const k = t.dataset.g, v = +t.value;
          if (k === 'size') g.size = v; else if (k === 'segs') g.segs = v | 0; else if (k === 'len') g.len = v;
          else if (k === 'prof0') g.prof[0] = v; else if (k === 'prof1') g.prof[1] = v; else if (k === 'prof2') g.prof[2] = v;
          else if (k === 'tailLen') g.tailLen = v; else if (k === 'hsize') g.head.size = v; else if (k === 'eyePairs') g.eyePairs = v | 0;
          else if (k === 'pairs') g.legs.pairs = v | 0; else if (k === 'leglen') g.legs.len = v;
          changed();
        } else if (t.dataset.c) {
          const [k, i] = t.dataset.c.split(':');
          g.skin[k][+i] = +t.value;
          const sw = root.querySelector(`[data-sw="${k}"]`); if (sw) sw.style.background = U.hsl(g.skin[k]);
          changed();
        }
      });
      const finish = () => {
        const name = (d.name || '').trim() || 'Criatura', left = d.budget - Parts.cost(d.g);
        if (left < 0) return;
        if (create) FG.Main.startNew({ seed: d.setup.seed, slot: d.setup.slot, diff: d.setup.diff, name, genome: d.g, dna: left });
        else UI.fade(() => { UI.close('editor'); G.evolve(d.g, name, left); });
      };
      UI.acts(root, {
        tab: (b) => { d.tab = b.dataset.t; renderTabs(); renderBody(); },
        head: (b) => { d.g.head.shape = b.dataset.k; changed(); renderBody(); },
        pat: (b) => { d.g.skin.pattern = b.dataset.k; changed(); renderBody(); },
        rskin: () => {
          const h = Math.random() * 360;
          d.g.skin = { pattern: PATTERNS[1 + ((Math.random() * 5) | 0)], c1: [h, 35 + Math.random() * 40, 38 + Math.random() * 24], c2: [(h + [28, -32, 160, 185][(Math.random() * 4) | 0] + 360) % 360, 45 + Math.random() * 30, Math.random() < 0.6 ? 24 + Math.random() * 12 : 66 + Math.random() * 12], c3: [(h + 150 + Math.random() * 60) % 360, 70 + Math.random() * 20, 52 + Math.random() * 14] };
          d.g.seed = (Math.random() * 4294967296) >>> 0;
          changed(); renderBody();
        },
        part: (b) => {
          const id = b.dataset.id || null, cat = d.tab;
          if (id && !d.unlocked.has(id)) { UI.toast(T('ed.locked'), 'warn', 'lock'); if (FG.Audio) FG.Audio.sfx('deny'); return; }
          d.g.parts[cat] = id;
          changed();
          root.querySelectorAll('.part').forEach((p) => p.classList.toggle('on', (p.dataset.id || null) === id));
          // mostra a parte em ação
          const demo = { mouth: 'bite', voice: 'sing', adorn: 'charm', tail: 'charm', horn: 'pose', arms: 'strike', gland: 'spit', back: 'pose' }[cat];
          if (demo && id) c.play(demo, 1.1);
        },
        walk: (b) => { d.walk = !d.walk; b.innerHTML = ic(d.walk ? 'pause' : 'play'); },
        demoS: () => { c.play(Parts.SOCIAL[d.demo++ % 4], 1.3); if (FG.Audio) FG.Audio.voice(sp.voice, 'sing'); },
        demoC: () => { c.play(['bite', 'strike', 'spit', 'roar'][d.demo++ % 4], 0.6); },
        undo: () => { d.g = Parts.cloneGenome(d.orig); changed(); renderBody(); },
        cancel: () => {
          if (create) return UI.fade(() => UI.close('editor'));
          UI.fade(() => { UI.close('editor'); G.cancelEvolve(); });
        },
        ok: finish,
      });

      // ---- prévia animada ----
      let last = performance.now();
      cancelAnimationFrame(d.raf);
      const frame = (now) => {
        d.raf = requestAnimationFrame(frame);
        if (!cv.isConnected) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = Math.max(2, Math.round(r.width * dpr)), H = Math.max(2, Math.round(r.height * dpr));
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
        const R = 14 + c.bp.bodyLen * 0.24;
        if (d.walk && !(c.anim && ['sing', 'dance', 'charm', 'pose', 'roar'].includes(c.anim.name))) {
          const a = Math.atan2(c.y, c.x), rad = Math.hypot(c.x, c.y), ta = a + Math.PI / 2 + U.clamp((rad - R) * 0.03, -1.2, 1.2);
          c.mx = Math.cos(ta); c.my = Math.sin(ta); c.speedMul = 0.5;
        } else { c.mx = c.my = 0; }
        c.update(dt, null);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
        const view = R * 2 + c.bp.bodyLen * 1.05 + c.bp.legLen * 1.3 + 20, k = Math.min(W / view, H * 0.82 / view);
        ctx.setTransform(k, 0, 0, k, W / 2, H * 0.4);
        Draw.creature(ctx, c, {});
      };
      d.raf = requestAnimationFrame(frame);
    },
  });
})(window.FG = window.FG || {});
