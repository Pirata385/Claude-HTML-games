// Amalgamations — HUD: bars, minimap, power buttons (procedural icons with cooldown sweeps), touch controls,
// interaction prompt, damage numbers, toasts, loot feed, nameplates, boss bar and quest tracker.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const $ = (s, r) => (r || document).querySelector(s);
  const H = {};

  // ---------- power icons ----------
  function glyph(ctx, shape, s, col) {
    ctx.save();
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const c = s / 2;
    ctx.beginPath();
    switch (shape) {
      case 'projectile': ctx.arc(c + s * 0.1, c - s * 0.1, s * 0.16, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(c - s * 0.3, c + s * 0.3); ctx.lineTo(c - s * 0.02, c + s * 0.02); ctx.moveTo(c - s * 0.32, c + s * 0.1); ctx.lineTo(c - s * 0.12, c - s * 0.02); ctx.stroke(); break;
      case 'nova': ctx.arc(c, c, s * 0.12, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(c, c, s * 0.3, 0, 7); ctx.stroke(); break;
      case 'chain': ctx.moveTo(c - s * 0.28, c - s * 0.3); ctx.lineTo(c + s * 0.05, c - s * 0.05); ctx.lineTo(c - s * 0.08, c + s * 0.05); ctx.lineTo(c + s * 0.28, c + s * 0.3); ctx.stroke(); break;
      case 'cone': ctx.moveTo(c - s * 0.3, c + s * 0.25); ctx.lineTo(c + s * 0.3, c - s * 0.3); ctx.lineTo(c + s * 0.3, c + s * 0.15); ctx.closePath(); ctx.fill(); break;
      case 'dash': for (let i = 0; i < 2; i++) { ctx.moveTo(c - s * 0.25 + i * s * 0.2, c - s * 0.22); ctx.lineTo(c - s * 0.02 + i * s * 0.2, c); ctx.lineTo(c - s * 0.25 + i * s * 0.2, c + s * 0.22); } ctx.stroke(); break;
      case 'heal': ctx.fillRect(c - s * 0.07, c - s * 0.26, s * 0.14, s * 0.52); ctx.fillRect(c - s * 0.26, c - s * 0.07, s * 0.52, s * 0.14); break;
      case 'blink': ctx.arc(c, c, s * 0.25, 0.5, 5.2); ctx.stroke(); ctx.beginPath(); ctx.arc(c + s * 0.18, c - s * 0.12, s * 0.07, 0, 7); ctx.fill(); break;
      case 'beam': ctx.lineWidth = s * 0.14; ctx.moveTo(c - s * 0.3, c + s * 0.3); ctx.lineTo(c + s * 0.3, c - s * 0.3); ctx.stroke(); break;
      case 'meteor': ctx.arc(c + s * 0.1, c + s * 0.1, s * 0.14, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(c - s * 0.3, c - s * 0.3); ctx.lineTo(c, c); ctx.moveTo(c - s * 0.1, c - s * 0.32); ctx.lineTo(c + s * 0.08, c - s * 0.06); ctx.stroke(); break;
      case 'summon': for (const [x, y, r] of [[0, 0.1, 0.13], [-0.18, -0.1, 0.07], [0, -0.2, 0.07], [0.18, -0.1, 0.07]]) { ctx.moveTo(c + x * s + r * s, c + y * s); ctx.arc(c + x * s, c + y * s, r * s, 0, 7); } ctx.fill(); break;
      case 'shield': ctx.moveTo(c, c - s * 0.3); ctx.lineTo(c + s * 0.25, c - s * 0.2); ctx.lineTo(c + s * 0.2, c + s * 0.12); ctx.lineTo(c, c + s * 0.3); ctx.lineTo(c - s * 0.2, c + s * 0.12); ctx.lineTo(c - s * 0.25, c - s * 0.2); ctx.closePath(); ctx.fill(); break;
      case 'zone': for (let a = 0; a < 12; a += 0.3) { const r = s * 0.02 * a; const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r; if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); break;
      case 'trap': for (let i = 0; i < 3; i++) { ctx.moveTo(c - s * 0.3 + i * s * 0.2, c + s * 0.2); ctx.lineTo(c - s * 0.2 + i * s * 0.2, c - s * 0.25); ctx.lineTo(c - s * 0.1 + i * s * 0.2, c + s * 0.2); } ctx.stroke(); break;
      case 'boomerang': ctx.moveTo(c - s * 0.28, c - s * 0.15); ctx.quadraticCurveTo(c, c + s * 0.4, c + s * 0.28, c - s * 0.15); ctx.stroke(); break;
      case 'buff': for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; ctx.moveTo(c + Math.cos(a) * s * 0.12, c + Math.sin(a) * s * 0.12); ctx.lineTo(c + Math.cos(a) * s * 0.3, c + Math.sin(a) * s * 0.3); } ctx.stroke(); break;
      case 'storm': ctx.arc(c - s * 0.08, c - s * 0.1, s * 0.13, 0, 7); ctx.arc(c + s * 0.1, c - s * 0.12, s * 0.15, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c - s * 0.06, c + s * 0.15); ctx.lineTo(c + s * 0.05, c + s * 0.15); ctx.lineTo(c - s * 0.03, c + s * 0.32); ctx.stroke(); break;
      default: ctx.arc(c, c, s * 0.2, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function drawPowerIcon(cv, id) {
    const spec = AM.powerSpec(id), s = cv.width, ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, s, s);
    const colA = AM.ELEMENTS[spec.elements[0]].color, colB = AM.ELEMENTS[spec.elements[spec.elements.length - 1]].color;
    const bg = (col) => { const g = ctx.createRadialGradient(s * 0.35, s * 0.3, s * 0.05, s / 2, s / 2, s * 0.7); g.addColorStop(0, AM.shade(col, 0.15)); g.addColorStop(1, AM.shade(col, -0.35)); return g; };
    ctx.save(); ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 1, 0, 7); ctx.clip();
    ctx.fillStyle = bg(colA); ctx.fillRect(0, 0, s, s);
    if (spec.fused) { ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(s, s); ctx.lineTo(0, s); ctx.closePath(); ctx.fillStyle = bg(colB); ctx.fill(); }
    ctx.restore();
    glyph(ctx, spec.shape, s, 'rgba(255,255,255,0.95)');
    if (spec.fused) {
      const pb = AM.POWERS[spec.parts[1]];
      ctx.save(); ctx.translate(s * 0.58, s * 0.58); glyph(ctx, pb.shape, s * 0.4, 'rgba(20,20,30,0.75)'); ctx.restore();
      ctx.strokeStyle = spec.color; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - s * 0.05, 0, 7); ctx.stroke();
    } else { ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 1, 0, 7); ctx.stroke(); }
  }
  H.drawPowerIcon = drawPowerIcon;

  // ---------- build ----------
  H.init = function (G) {
    H.G = G;
    H.root = $('#hud');
    H.numbersEl = $('#numbers');
    H.nums = [];
    for (let i = 0; i < 48; i++) { const d = document.createElement('div'); d.className = 'num'; d.style.display = 'none'; H.numbersEl.appendChild(d); H.nums.push({ el: d, t: 0, life: 0 }); }
    H.tagsEl = $('#tags');
    H.tags = [];
    H.mini = $('#minimap'); H.miniCtx = H.mini.getContext('2d');
    H.terrain = document.createElement('canvas'); H.terrain.width = H.terrain.height = 96;
    H.terrainAt = { x: 1e9, z: 1e9, t: 0 };
    H.powerBtns = [...document.querySelectorAll('.pbtn')].sort((a, b) => a.dataset.act.localeCompare(b.dataset.act));
    H.lastPowers = '';
    H.feedEl = $('#feed'); H.toastEl = $('#toasts');
    H.v = new THREE.Vector3();
    H.fps = { t: 0, n: 0, v: 0 };
  };
  H.show = function (on) { H.root.style.display = on ? 'block' : 'none'; };
  H.setTouch = function (on) { document.body.classList.toggle('touch', !!on); };

  H.refreshPowers = function () { H.lastPowers = ''; };
  function updatePowers(G) {
    const st = G.state, p = G.player, slots = p.stats.powerSlots;
    const key = st.powers.equipped.join(',') + '|' + slots;
    if (key !== H.lastPowers) {
      H.lastPowers = key;
      H.powerBtns.forEach((b, i) => {
        const id = st.powers.equipped[i];
        b.style.display = i < slots ? '' : 'none';
        b.classList.toggle('empty', !id);
        const cv = b.querySelector('canvas');
        if (id) drawPowerIcon(cv, id); else cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
        b.title = id ? AM.powerSpec(id).name : 'Empty slot';
      });
    }
    H.powerBtns.forEach((b, i) => {
      const id = st.powers.equipped[i];
      if (!id) return;
      const spec = AM.powerSpec(id);
      const cd = p.cd.powers[id] || 0;
      const total = spec.cd * (1 - p.stats.cdr);
      const sweep = b.querySelector('.cd');
      const k = cd > 0 ? cd / total : 0;
      sweep.style.background = k > 0 ? `conic-gradient(rgba(10,12,20,0.72) ${k * 360}deg, transparent 0deg)` : 'none';
      b.querySelector('.cdt').textContent = cd > 0.05 ? (cd >= 1 ? Math.ceil(cd) : cd.toFixed(1)) : '';
      b.classList.toggle('noenergy', p.energy < spec.energy);
    });
  }

  // ---------- per-frame ----------
  // Cached element lookups and writes: only touch the DOM when a value changes.
  const elCache = {}, valCache = {};
  const el = (id) => elCache[id] || (elCache[id] = document.getElementById(id));
  const setW = (id, pct) => { const v = Math.round(pct * 10) / 10; if (valCache[id] !== v) { valCache[id] = v; el(id).style.width = v + '%'; } };
  const setT = (id, t) => { if (valCache['t' + id] !== t) { valCache['t' + id] = t; el(id).textContent = t; } };
  H.update = function (G, dt) {
    const p = G.player, st = G.state;
    if (!p) return;
    setW('hp-fill', 100 * Math.max(0, p.hp) / p.maxHp);
    setT('hp-text', `${AM.fmt(Math.max(0, p.hp))} / ${AM.fmt(p.maxHp)}`);
    setW('sh-fill', p.shield > 0 ? Math.min(100, 100 * p.shield / p.maxHp) : 0);
    setW('en-fill', 100 * p.energy / p.stats.maxEnergy);
    setW('xp-fill', 100 * st.xp / AM.xpToNext(st.level));
    setT('lvl', String(st.level));
    setT('pname', st.formName);
    setT('gold', AM.fmt(st.gold));
    setT('potions', String(st.inv.cons.potion || 0));
    const pts = el('pts'); setT('pts', st.points > 0 ? String(st.points) : '');
    const ptsShow = st.points > 0 ? '' : 'none'; if (pts.style.display !== ptsShow) pts.style.display = ptsShow;
    // statuses
    const sts = Object.keys(p.status).filter((k) => p.status[k] && p.status[k].t > 0);
    const buffs = Object.keys(p.buffs);
    const stKey = sts.join(',') + '|' + buffs.join(',');
    if (stKey !== H.stKey) { H.stKey = stKey; el('statuses').innerHTML = sts.map((s) => `<span class="st bad">${s}</span>`).join('') + buffs.map((b) => `<span class="st good">${b.replace(/_fx|mini/, '')}</span>`).join(''); }
    updatePowers(G);
    // info
    H.infoT = (H.infoT || 0) - dt;
    if (H.infoT <= 0) {
      H.infoT = 0.3;
      const L = G.level;
      const bi = AM.BIOMES[L.biomeAt(p.x, p.z)];
      const danger = G.mode === 'interior' ? G.interior.s.level : G.world.dangerAt(p.x, p.z);
      const dEl = el('danger');
      setT('danger', 'Danger ' + danger);
      dEl.className = danger > st.level + 4 ? 'red' : danger > st.level + 1 ? 'orange' : 'green';
      el('biome').textContent = G.mode === 'interior' ? G.interior.s.name : bi.name;
      const hours = Math.floor(((G.state.time * 24) + 6) % 24), mins = Math.floor((((G.state.time * 24) + 6) % 1) * 60);
      el('clock').textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${G.isNight ? '☾' : '☀'}  ·  ${Math.round(p.x)}, ${Math.round(p.z)}`;
      H.questTracker(G);
    }
    H.minimap(G, dt);
    // interaction prompt
    const it = G.focus;
    const ib = el('interact-btn'), ip = el('prompt');
    const show = (e, v) => { if (e.style.display !== v) e.style.display = v; };
    if (it) {
      const label = G.interactLabel(it);
      setT('interact-btn', label); show(ib, '');
      const html = G.gather ? `${label}… ${Math.round(G.gather.t / G.gather.need * 100)}%` : `<b>F</b> ${label}`;
      if (valCache.prompt !== html) { valCache.prompt = html; ip.innerHTML = html; }
      show(ip, document.body.classList.contains('touch') ? 'none' : '');
    } else { show(ib, 'none'); show(ip, 'none'); }
    // boss bar
    const boss = G.entities.find((e) => e.rank === 'boss' && !e.dead && AM.dist(e.x, e.z, p.x, p.z) < 22);
    const bb = el('bossbar');
    if (boss) { show(bb, ''); setT('boss-name', `${boss.name} · Lv ${boss.level}`); setW('boss-fill', 100 * boss.hp / boss.maxHp); }
    else show(bb, 'none');
    H.updateNumbers(G, dt);
    H.updateTags(G, dt);
    // fps
    H.fps.t += dt; H.fps.n++;
    if (H.fps.t >= 0.5) { H.fps.v = Math.round(H.fps.n / H.fps.t); H.fps.t = 0; H.fps.n = 0; const f = el('fps'); f.style.display = G.settings.showFps ? '' : 'none'; if (G.settings.showFps) f.textContent = `${H.fps.v} fps · ${G.renderer.info.render.calls} calls · ${Math.round(G.renderScale * 100)}%`; }
  };

  H.questTracker = function (G) {
    const st = G.state;
    const goal = G.prog.currentGoal();
    const qs = st.quests.active;
    let html = '';
    if (goal && AM.GOALS.indexOf(goal) < 11) html += `<div class="qt goal"><b>Goal:</b> ${goal.title}${goal.hint ? `<br><small>${goal.hint}</small>` : ''}</div>`;
    for (const q of qs.slice(0, 3)) html += `<div class="qt ${q.done ? 'done' : ''}">${q.done ? '✔ ' : ''}${q.title} <span>${q.done ? 'turn in' : `${q.have}/${q.need}`}</span></div>`;
    if (html !== H.qtHtml) { H.qtHtml = html; $('#tracker').innerHTML = html; }
  };
  H.refreshGoal = function () { H.qtHtml = null; };

  // ---------- minimap ----------
  H.minimap = function (G, dt) {
    H.miniT = (H.miniT || 0) - dt;
    if (H.miniT > 0) return;
    H.miniT = 0.12;
    const p = G.player, c = H.miniCtx, W = H.mini.width;
    const scale = W / 96; // 96 m across
    const T = H.terrain, tc = T.getContext('2d');
    if (AM.dist(p.x, p.z, H.terrainAt.x, H.terrainAt.z) > 5 || G.time - H.terrainAt.t > 3 || H.terrainAt.mode !== G.mode) {
      H.terrainAt = { x: p.x, z: p.z, t: G.time, mode: G.mode };
      const img = tc.createImageData(96, 96);
      for (let j = 0; j < 96; j += 2) for (let i = 0; i < 96; i += 2) {
        const wx = p.x - 48 + i, wz = p.z - 48 + j;
        let col;
        if (G.mode === 'interior') col = G.interior.pointBlocked(wx, wz) ? [30, 28, 34] : [120, 112, 100];
        else {
          const w = G.level.waterAt(wx, wz);
          const b = AM.BIOMES[G.level.biomeAt(wx, wz)];
          col = w === 2 ? (b.id === 'volcanic' ? [255, 110, 30] : [40, 110, 170]) : w === 1 ? [80, 160, 200] : AM.hexToRgb(b.ground[0]).map((v) => v * 255);
        }
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const k = ((j + dy) * 96 + i + dx) * 4; img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255; }
      }
      tc.putImageData(img, 0, 0);
    }
    c.save();
    c.clearRect(0, 0, W, W);
    c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, 7); c.clip();
    c.translate(W / 2, W / 2);
    c.rotate(G.camYaw);
    c.scale(scale, scale);
    c.drawImage(T, H.terrainAt.x - p.x - 48, H.terrainAt.z - p.z - 48);
    const dot = (x, z, col, r) => { c.fillStyle = col; c.fillRect(x - p.x - r / 2, z - p.z - r / 2, r, r); };
    if (G.mode === 'play') {
      for (const s of G.world.structuresNear(p.x, p.z, 60)) {
        if (s.type === 'chest' && !p.stats.chestSense) continue;
        if (s.type === 'chest' && G.state.opened.has('c:' + s.id)) continue;
        const col = { village: '#ffe08a', ruin: '#c8c0b0', cave: '#2a2a30', dungeon: '#ff5a5a', camp: '#d08a4a', chest: '#f2c14e', shrine: '#6fe3ff' }[s.type];
        dot(s.x, s.z, '#000', s.type === 'village' ? 6 : 4.2); dot(s.x, s.z, col, s.type === 'village' ? 4.5 : 3);
      }
    }
    for (const e of G.entities) {
      if (e.dead || e === p) continue;
      dot(e.x, e.z, e.kind === 'npc' ? '#7af0ff' : e.team === 0 ? '#c8a0ff' : e.rank === 'boss' ? '#ff2a2a' : e.rank === 'elite' ? '#ffb020' : '#ff6a5a', e.rank === 'boss' ? 4 : 2.4);
    }
    if (G.mode === 'interior' && G.interior) dot(G.interior.exit.x, G.interior.exit.z, '#6fe3ff', 3.5);
    c.restore();
    // quest marker arrows
    const tq = G.state.quests.active.find((q) => q.tracked && q.x != null && !q.done) || G.state.quests.active.find((q) => q.x != null && !q.done);
    if (tq && G.mode === 'play') {
      const dx = tq.x - p.x, dz = tq.z - p.z, th = G.camYaw;
      const x = W / 2 + (dx * Math.cos(th) - dz * Math.sin(th)) * scale;
      const y = W / 2 + (dx * Math.sin(th) + dz * Math.cos(th)) * scale;
      const k = Math.hypot(x - W / 2, y - W / 2), lim = W / 2 - 8;
      const qx = k > lim ? W / 2 + (x - W / 2) * lim / k : x, qy = k > lim ? W / 2 + (y - W / 2) * lim / k : y;
      c.fillStyle = '#ffd23f'; c.strokeStyle = '#000'; c.lineWidth = 2;
      c.beginPath(); c.arc(qx, qy, 5, 0, 7); c.fill(); c.stroke();
    }
    // player arrow (always points "up" relative to facing)
    c.save(); c.translate(W / 2, W / 2); c.rotate(-(p.yaw - G.camYaw) + Math.PI);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke();
    c.restore();
  };

  // ---------- damage numbers ----------
  H.number = function (x, y, z, text, type, element) {
    const n = H.nums.find((k) => k.t >= k.life) || H.nums[0];
    n.x = x + (Math.random() - 0.5) * 0.5; n.y = y; n.z = z; n.t = 0; n.life = type === 'crit' ? 1.0 : 0.8;
    n.el.textContent = text;
    n.el.className = 'num ' + type;
    if (type === 'dmg' && element && AM.ELEMENTS[element]) n.el.style.color = AM.ELEMENTS[element].color; else n.el.style.color = '';
    n.el.style.display = 'block';
  };
  H.updateNumbers = function (G, dt) {
    const v = H.v, cam = G.camera, W = root.innerWidth, Hh = root.innerHeight;
    for (const n of H.nums) {
      if (n.t >= n.life) { if (n.el.style.display !== 'none') n.el.style.display = 'none'; continue; }
      n.t += dt;
      v.set(n.x, n.y + n.t * 1.4, n.z).project(cam);
      if (v.z > 1) { n.el.style.opacity = 0; continue; } // behind the perspective camera
      const k = n.t / n.life;
      n.el.style.transform = `translate(${(v.x + 1) / 2 * W}px, ${(1 - v.y) / 2 * Hh}px) translate(-50%,-50%) scale(${k < 0.15 ? 0.6 + k * 4 : 1.2 - k * 0.3})`;
      n.el.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    }
  };

  // ---------- nameplates and emotes ----------
  H.emote = function (e, text) { e.emote = { text, t: 1.2 }; };
  H.updateTags = function (G, dt) {
    const v = H.v, cam = G.camera, W = root.innerWidth, Hh = root.innerHeight, p = G.player;
    let i = 0;
    const want = [];
    for (const e of G.entities) {
      if (e.dead || e === p) continue;
      if (e.emote) { e.emote.t -= dt; if (e.emote.t <= 0) e.emote = null; }
      const d = AM.dist(e.x, e.z, p.x, p.z);
      const show = (e.kind === 'npc' && d < 14) || ((e.rank === 'elite' || e.quest) && d < 22) || e.emote || (e.team === 1 && e.hp < e.maxHp && d < 18);
      if (show) want.push(e);
    }
    want.sort((a, b) => AM.dist(a.x, a.z, p.x, p.z) - AM.dist(b.x, b.z, p.x, p.z));
    for (const e of want.slice(0, 14)) {
      let t = H.tags[i];
      if (!t) { t = document.createElement('div'); t.className = 'tag'; t.innerHTML = '<div class="tn"></div><div class="tb"><i></i></div>'; H.tagsEl.appendChild(t); H.tags.push(t); }
      i++;
      v.set(e.x, (e.genome.height + 0.5) * e.scale + 0.3, e.z).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) { t.style.display = 'none'; continue; }
      t.style.display = 'block';
      t.style.transform = `translate(${(v.x + 1) / 2 * W}px, ${(1 - v.y) / 2 * Hh}px) translate(-50%,-100%)`;
      const name = e.emote ? e.emote.text : e.kind === 'npc' ? `${e.name}` : `${e.rank === 'elite' ? '★ ' : ''}${e.affix ? e.affix.name + ' ' : ''}${e.name} · ${e.level}`;
      const tn = t.firstChild;
      if (tn.textContent !== name) tn.textContent = name;
      t.className = 'tag ' + (e.emote ? 'emote' : e.kind === 'npc' ? 'npc' : e.rank === 'elite' ? 'elite' : '');
      const bar = t.lastChild;
      bar.style.display = e.team === 1 && !e.emote ? '' : 'none';
      bar.firstChild.style.width = (100 * e.hp / e.maxHp) + '%';
    }
    for (; i < H.tags.length; i++) H.tags[i].style.display = 'none';
  };

  // ---------- toasts and feed ----------
  H.toast = function (text, kind) {
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || 'info');
    d.textContent = text;
    H.toastEl.appendChild(d);
    while (H.toastEl.children.length > 4) H.toastEl.firstChild.remove();
    setTimeout(() => d.classList.add('out'), 2600);
    setTimeout(() => d.remove(), 3200);
  };
  H.feed = function (text, color) {
    const d = document.createElement('div');
    d.className = 'feedline'; d.textContent = text; d.style.color = color || '#fff';
    H.feedEl.appendChild(d);
    while (H.feedEl.children.length > 6) H.feedEl.firstChild.remove();
    setTimeout(() => d.remove(), 3500);
  };

  AM.HUD = H;
})(typeof window !== 'undefined' ? window : globalThis);
