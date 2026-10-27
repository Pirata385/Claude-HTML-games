// Boot and glue: the App object holds selection and interaction modes, turns player intent
// into simulation commands, runs the fixed-step loop (with render interpolation) and connects
// HUD, menus, audio and persistence.
(function (UB) {
  'use strict';
  const { TIME, BUILDINGS, POIS } = UB.DEF;
  const W = UB.World;
  const $ = (id) => document.getElementById(id);

  const App = {
    S: null, inGame: false, paused: false, speed: 1,
    touch: window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false,
    sel: { units: [], bld: 0, poi: 0, feat: null, zom: 0 },
    mode: null, box: null, hoverTile: null, confirmDemolish: 0, settings: null,
    demo: null, overAt: 0, prevPaused: false, lastIdle: 0,
  };
  UB.App = App;

  // ---- feedback ----------------------------------------------------------------------------------
  function cmd(c, at) {
    if (!App.S) return { ok: false };
    const r = UB.Game.command(App.S, c);
    if (r && r.ok) {
      if (at) UB.Render.ring(at.x, at.y, c.type === 'attack' || c.type === 'amove' ? '#ff6a5a' : '#7dff9a');
      UB.Audio.play('order');
    } else if (r && r.reason) {
      UB.HUD.toast(r.reason);
      UB.Audio.play('error');
    }
    return r || { ok: false };
  }
  App.cmd = cmd;

  // ---- selection ----------------------------------------------------------------------------------
  App.clearSel = function () { App.sel = { units: [], bld: 0, poi: 0, feat: null, zom: 0 }; App.confirmDemolish = 0; };
  App.selectUnits = function (ids) { App.clearSel(); App.sel.units = ids.slice(); };
  function selUnits() { return App.sel.units.map((id) => W.get(App.S, id)).filter((u) => u && !u.dead); }
  function pickAt(px, py) { return UB.Render.pick(App.S, px, py); }

  App.clickSelect = function (px, py, add) {
    const p = pickAt(px, py);
    if (p.kind === 'unit') {
      if (add) {
        const i = App.sel.units.indexOf(p.id);
        const ids = App.sel.units.slice();
        if (i >= 0) ids.splice(i, 1); else ids.push(p.id);
        App.selectUnits(ids);
      } else App.selectUnits([p.id]);
      UB.Audio.play('click');
      return;
    }
    if (add) return;
    App.clearSel();
    if (p.kind === 'zom') App.sel.zom = p.id;
    else if (p.kind === 'bld') App.sel.bld = p.id;
    else if (p.kind === 'poi') App.sel.poi = p.id;
    else if (p.kind === 'feat') App.sel.feat = { x: p.x, y: p.y };
  };
  App.tap = function (px, py) {
    const p = pickAt(px, py);
    if (App.sel.units.length && p.kind !== 'unit') { App.contextOrder(px, py, p); return; }
    if (p.kind === 'unit' && App.sel.units.length === 1 && App.sel.units[0] === p.id) return;
    App.clickSelect(px, py, false);
  };
  App.selectSameOnScreen = function () {
    const sz = UB.Render.size();
    const ids = App.S.units.filter((u) => !u.dead && !u.hidden).filter((u) => { const p = UB.Render.w2s(u.x, u.y); return p.x >= 0 && p.y >= 0 && p.x < sz.W && p.y < sz.H; }).map((u) => u.id);
    if (ids.length) App.selectUnits(ids);
  };
  App.boxPreview = function (x0, y0, x1, y1) { App.box = { x0, y0, x1, y1 }; };
  App.boxSelect = function (x0, y0, x1, y1, add) {
    App.box = null;
    const lx = Math.min(x0, x1), hx = Math.max(x0, x1), ly = Math.min(y0, y1), hy = Math.max(y0, y1);
    const ids = App.S.units.filter((u) => !u.dead && !u.hidden).filter((u) => {
      const p = UB.Render.w2s(u.x, u.y);
      return p.x >= lx - 4 && p.x <= hx + 4 && p.y - 12 >= ly - 14 && p.y - 12 <= hy + 14;
    }).map((u) => u.id);
    if (add) App.selectUnits([...new Set([...App.sel.units, ...ids])]);
    else if (ids.length) App.selectUnits(ids);
    else App.clearSel();
    if (ids.length) UB.Audio.play('click');
  };
  App.hover = function (px, py) {
    const g = UB.Render.s2w(px, py);
    App.hoverTile = { x: Math.floor(g.x), y: Math.floor(g.y) };
    if (App.mode && App.mode.kind === 'build' && !App.mode.dragging) setGhost(App.hoverTile.x, App.hoverTile.y);
    const cv = $('view');
    cv.classList.toggle('cmd', !!(App.sel.units.length || App.mode));
  };

  // Contextual order for the selected survivors, based on what is under the point.
  App.contextOrder = function (px, py, pre) {
    const S = App.S;
    const us = selUnits();
    if (!us.length) { App.clickSelect(px, py, false); return; }
    const ids = us.map((u) => u.id);
    const p = pre || pickAt(px, py);
    switch (p.kind) {
      case 'zom': { const z = W.get(S, p.id); cmd({ type: 'attack', ids, id: p.id }, z); return; }
      case 'poi': {
        const poi = W.get(S, p.id);
        if (!poi.discovered && !S.map.explored[poi.ey * S.map.w + poi.ex]) break;
        if (poi.searchesLeft <= 0 && !POIS[poi.type].nest) { cmd({ type: 'move', ids, x: poi.ex + 0.5, y: poi.ey + 0.5 }, { x: poi.ex + 0.5, y: poi.ey + 0.5 }); return; }
        cmd({ type: 'loot', ids, id: poi.id }, { x: poi.ex + 0.5, y: poi.ey + 0.5 });
        return;
      }
      case 'feat': cmd({ type: 'gather', ids, x: p.x, y: p.y }, { x: p.x + 0.5, y: p.y + 0.5 }); return;
      case 'bld': {
        const b = W.get(S, p.id);
        const at = { x: b.tx + b.w / 2, y: b.ty + b.h / 2 };
        if (b.built < 1) { cmd({ type: 'repair', ids, id: b.id }, at); return; }
        if (b.type === 'tower') { cmd({ type: 'garrison', ids, id: b.id }, at); return; }
        if (b.type === 'garden' || b.type === 'workshop') { cmd({ type: 'work', ids, id: b.id }, at); return; }
        if (b.type === 'infirmary') { cmd({ type: 'patient', ids, id: b.id }, at); return; }
        if (b.hp < b.maxHp) { cmd({ type: 'repair', ids, id: b.id }, at); return; }
        if (b.type === 'hq' || b.type === 'depot') { cmd({ type: 'return', ids }, at); return; }
        break;
      }
      default: break;
    }
    const g = p.kind === 'ground' ? p : UB.Render.s2w(px, py);
    cmd({ type: 'move', ids, x: g.x, y: g.y }, g);
  };
  App.amoveAt = function (px, py) {
    const g = UB.Render.s2w(px, py);
    const ids = selUnits().map((u) => u.id);
    App.mode = null;
    if (ids.length) cmd({ type: 'amove', ids, x: g.x, y: g.y }, g);
  };

  // ---- squads ----------------------------------------------------------------------------------------
  let lastSquad = { n: 0, t: 0 };
  App.squadButton = function (n, set) {
    const S = App.S;
    if (!S) return;
    if (n === 'all') { App.selectUnits(S.units.filter((u) => !u.dead && !u.inside).map((u) => u.id)); return; }
    if (n === 'idle') { App.action('idle'); return; }
    n = +n;
    if (set) {
      if (!App.sel.units.length) { UB.HUD.toast('Selecione sobreviventes primeiro.'); return; }
      cmd({ type: 'squad', ids: App.sel.units, n });
      UB.HUD.toast(`Esquadrão ${n} definido (${App.sel.units.length}).`);
      return;
    }
    const ids = (S.squads[n] || []).filter((id) => W.get(S, id));
    if (!ids.length) { UB.HUD.toast(`Esquadrão ${n} vazio. Selecione e use Ctrl+${n} ou o botão “Esq. ${n}”.`); return; }
    const now = performance.now();
    App.selectUnits(ids);
    if (lastSquad.n === n && now - lastSquad.t < 400) { const u = W.get(S, ids[0]); App.focus(u.x, u.y); }
    lastSquad = { n, t: now };
  };

  // ---- build mode ----------------------------------------------------------------------------------
  App.lineCapable = () => App.mode && App.mode.kind === 'build' && BUILDINGS[App.mode.type].size === 1;
  App.startBuild = function (type) {
    const S = App.S;
    const def = BUILDINGS[type];
    if (def.requires && !S.unlocked[def.requires]) { UB.HUD.toast(`Requer ${UB.DEF.BLUEPRINTS[def.requires]} — encontre explorando.`); UB.Audio.play('error'); return; }
    App.mode = { kind: 'build', type, size: def.size, line: false, tiles: [], a: null, b: null };
    App.clearSel();
    UB.HUD.showBuild(false);
    updatePlaceBar();
    if (App.hoverTile && !App.touch) setGhost(App.hoverTile.x, App.hoverTile.y);
    else {
      const c = UB.Render.camTile();
      setGhost(Math.floor(c.x), Math.floor(c.y));
    }
  };
  function updatePlaceBar() {
    const m = App.mode;
    if (!m || m.kind !== 'build') { UB.HUD.place(null); return; }
    const def = BUILDINGS[m.type];
    const n = m.tiles.filter((t) => t.ok).length;
    let info = `<b>${def.name}</b> ${UB.HUD.costHTML(App.S, def.levels[0].cost)}`;
    if (m.line) info += ` · ${m.a ? (m.b ? `${n} peças` : 'toque no fim da linha') : 'toque no início da linha'}`;
    else if (!App.touch) info += def.size === 1 ? ' · arraste para fazer uma linha · botão direito cancela' : ' · Shift mantém o modo · botão direito cancela';
    UB.HUD.place(info);
    $('placeOk').hidden = !App.touch;
    $('placeLine').hidden = !App.touch || def.size > 1;
    $('placeLine').classList.toggle('sel', !!m.line);
  }
  function origin(tx, ty) {
    const s = App.mode.size;
    return { x: tx - Math.floor((s - 1) / 2), y: ty - Math.floor((s - 1) / 2) };
  }
  function setGhost(tx, ty) {
    const m = App.mode;
    const o = origin(tx, ty);
    const ok = UB.Buildings.canPlace(App.S, m.type, o.x, o.y).ok && UB.Eco.can(App.S, BUILDINGS[m.type].levels[0].cost);
    m.tiles = [{ x: o.x, y: o.y, ok }];
    m.ghost = o;
  }
  function setLine(a, b) {
    const m = App.mode;
    const cost = BUILDINGS[m.type].levels[0].cost;
    const left = Object.assign({}, App.S.res);
    m.tiles = UB.Buildings.lineTiles(a.x, a.y, b.x, b.y).map(([x, y]) => {
      let ok = UB.Buildings.canPlace(App.S, m.type, x, y).ok;
      if (ok) for (const k in cost) if ((left[k] || 0) < cost[k]) ok = false;
      if (ok) for (const k in cost) left[k] -= cost[k];
      return { x, y, ok };
    });
  }
  App.lineDrag = function (a, b) { App.mode.dragging = true; App.mode.a = a; App.mode.b = b; setLine(a, b); updatePlaceBar(); };
  App.lineCommit = function () {
    const m = App.mode;
    m.dragging = false;
    if (!m.a) return;
    if (m.a.x === m.b.x && m.a.y === m.b.y) cmd({ type: 'build', build: m.type, x: m.a.x, y: m.a.y }, { x: m.a.x + 0.5, y: m.a.y + 0.5 });
    else cmd({ type: 'buildLine', build: m.type, x0: m.a.x, y0: m.a.y, x1: m.b.x, y1: m.b.y }, { x: m.b.x + 0.5, y: m.b.y + 0.5 });
    m.a = m.b = null;
    if (App.hoverTile) setGhost(App.hoverTile.x, App.hoverTile.y);
  };
  App.placeAtCursor = function (px, py, keep) {
    const g = UB.Render.s2w(px, py);
    const o = origin(Math.floor(g.x), Math.floor(g.y));
    const r = cmd({ type: 'build', build: App.mode.type, x: o.x, y: o.y }, { x: o.x + App.mode.size / 2, y: o.y + App.mode.size / 2 });
    if (r.ok && App.mode.size > 1 && !keep) App.cancelMode();
    else if (App.mode) setGhost(Math.floor(g.x), Math.floor(g.y));
  };
  App.touchPlace = function (px, py) {
    const m = App.mode;
    const g = UB.Render.s2w(px, py);
    const t = { x: Math.floor(g.x), y: Math.floor(g.y) };
    if (m.line) {
      if (!m.a || m.b) { m.a = t; m.b = null; setGhost(t.x, t.y); }
      else { m.b = t; setLine(m.a, m.b); }
    } else setGhost(t.x, t.y);
    updatePlaceBar();
  };
  App.ghostNear = function (px, py) {
    const m = App.mode;
    if (!m || !m.ghost || m.line) return false;
    const c = UB.Render.w2s(m.ghost.x + m.size / 2, m.ghost.y + m.size / 2);
    return Math.hypot(px - c.x, py - c.y) < 18 + m.size * 8;
  };
  App.ghostTo = function (px, py) { const g = UB.Render.s2w(px, py); setGhost(Math.floor(g.x), Math.floor(g.y)); };
  App.confirmPlace = function () {
    const m = App.mode;
    if (!m) return;
    if (m.line && m.a && m.b) {
      cmd({ type: 'buildLine', build: m.type, x0: m.a.x, y0: m.a.y, x1: m.b.x, y1: m.b.y }, { x: m.b.x + 0.5, y: m.b.y + 0.5 });
      m.a = m.b = null; m.tiles = [];
    } else if (m.ghost) {
      const r = cmd({ type: 'build', build: m.type, x: m.ghost.x, y: m.ghost.y }, { x: m.ghost.x + m.size / 2, y: m.ghost.y + m.size / 2 });
      if (r.ok && m.size > 1) { App.cancelMode(); return; }
      setGhost(m.ghost.x + (m.size === 1 ? 1 : 0), m.ghost.y);
    }
    updatePlaceBar();
  };
  App.toggleLine = function () { const m = App.mode; if (!m) return; m.line = !m.line; m.a = m.b = null; m.tiles = []; if (!m.line && m.ghost) setGhost(m.ghost.x, m.ghost.y); updatePlaceBar(); };
  App.cancelMode = function () { App.mode = null; UB.HUD.place(null); $('view').classList.remove('cmd'); };
  App.toggleBuild = function () {
    if (App.mode) App.cancelMode();
    UB.HUD.showBuild($('buildMenu').hidden);
  };

  // ---- panel actions ------------------------------------------------------------------------------------
  function freeUnits(pred) {
    const S = App.S;
    const hq = W.hq(S);
    return S.units.filter((u) => !u.dead && !u.inside && !u.order && W.inTerritory(S, u.x, u.y) && (!pred || pred(u)))
      .sort((a, b) => (hq ? UB.U.dist2(a.x, a.y, hq.tx, hq.ty) - UB.U.dist2(b.x, b.y, hq.tx, hq.ty) : 0));
  }
  App.action = function (act, arg) {
    const S = App.S;
    if (!S) return;
    const ids = App.sel.units.slice();
    const b = App.sel.bld ? W.get(S, App.sel.bld) : null;
    if (act !== 'demolish') App.confirmDemolish = 0;
    switch (act) {
      case 'amove': if (ids.length) { App.mode = { kind: 'amove' }; UB.HUD.toast(App.touch ? 'Toque no destino.' : 'Clique no destino.'); } break;
      case 'hold': cmd({ type: 'hold', ids }); break;
      case 'return': cmd({ type: 'return', ids }); break;
      case 'release': cmd({ type: 'release', ids }); break;
      case 'exit': cmd({ type: 'release', ids }); break;
      case 'setSquad': cmd({ type: 'squad', ids, n: +arg }); UB.HUD.toast(`Esquadrão ${arg} definido.`); break;
      case 'deselect': App.clearSel(); break;
      case 'equip': if (ids.length === 1) cmd({ type: 'equip', id: ids[0], weapon: arg }); break;
      case 'pickUnit': App.selectUnits([+arg]); break;
      case 'upgrade': if (b) cmd({ type: 'upgrade', id: b.id }); break;
      case 'repair': if (b) cmd({ type: 'repair', id: b.id }); break;
      case 'demolish':
        if (!b) break;
        if (App.confirmDemolish === b.id || b.built < 1) { cmd({ type: 'demolish', id: b.id }); App.clearSel(); }
        else App.confirmDemolish = b.id;
        break;
      case 'toggle': if (b) cmd({ type: 'toggle', id: b.id }); break;
      case 'evict': if (b) cmd({ type: 'evict', id: b.id }); break;
      case 'assign': {
        if (!b) break;
        const u = freeUnits((x) => x.role !== 'scout')[0] || freeUnits()[0];
        if (!u) { UB.HUD.toast('Ninguém livre na base.'); break; }
        cmd({ type: 'work', ids: [u.id], id: b.id });
        break;
      }
      case 'garrisonSel': {
        if (!b) break;
        let us = ids.length ? ids : freeUnits((x) => x.ammo > 0 && x.weapon !== 'bat').map((u) => u.id);
        if (!us.length) { UB.HUD.toast('Ninguém livre com munição.'); break; }
        cmd({ type: 'garrison', ids: us, id: b.id });
        break;
      }
      case 'patientSel': {
        if (!b) break;
        const us = S.units.filter((u) => !u.dead && !u.inside && (u.infected >= 0 || u.hp < u.maxHp * 0.7)).sort((p, q) => (q.infected >= 0) - (p.infected >= 0) || p.hp - q.hp).map((u) => u.id);
        if (!us.length) { UB.HUD.toast('Ninguém precisa de tratamento.'); break; }
        cmd({ type: 'patient', ids: us, id: b.id });
        break;
      }
      case 'craft': if (b) cmd({ type: 'craft', id: b.id, item: arg }); break;
      case 'autoRepair': cmd({ type: 'autoRepair', value: !S.autoRepair }); break;
      case 'sendSquad': if (App.sel.poi) { const p = W.get(S, App.sel.poi); cmd({ type: 'loot', ids: S.squads[arg] || [], id: p.id }, { x: p.ex + 0.5, y: p.ey + 0.5 }); } break;
      case 'gatherIdle': {
        const f = App.sel.feat;
        if (!f) break;
        const us = freeUnits().slice(0, 2).map((u) => u.id);
        if (!us.length) { UB.HUD.toast('Ninguém livre na base.'); break; }
        cmd({ type: 'gather', ids: us, x: f.x, y: f.y }, { x: f.x + 0.5, y: f.y + 0.5 });
        break;
      }
      case 'openBuild': App.toggleBuild(); break;
      case 'selectAll': App.squadButton('all'); break;
      case 'idle': {
        const list = S.units.filter((u) => !u.dead && !u.inside && !u.order && (!u.task || u.task.type === 'idle'));
        if (!list.length) { UB.HUD.toast('Ninguém ocioso.'); break; }
        App.lastIdle = (App.lastIdle + 1) % list.length;
        const u = list[App.lastIdle];
        App.selectUnits([u.id]);
        App.focus(u.x, u.y);
        break;
      }
      case 'goBase': { const hq = W.hq(S); if (hq) App.focus(hq.tx + 1.5, hq.ty + 1.5); break; }
      case 'skipDay': cmd({ type: 'skipDay' }); break;
      default: break;
    }
  };

  App.focus = function (x, y) { UB.Render.centerOn(x, y); };
  App.escape = function () {
    if (App.mode) { App.cancelMode(); return; }
    if (!$('buildMenu').hidden) { UB.HUD.showBuild(false); return; }
    if (App.sel.units.length || App.sel.bld || App.sel.poi || App.sel.feat || App.sel.zom) { App.clearSel(); return; }
    App.openPause();
  };

  // ---- time controls & menus ---------------------------------------------------------------------------
  App.togglePause = function () { App.paused = !App.paused; UB.HUD.toast(App.paused ? 'Pausado — dê ordens com calma.' : 'Continuando.', 1200); };
  App.setSpeed = function (s) { App.speed = s; };
  App.cycleSpeed = function () { App.speed = App.speed >= 3 ? 1 : App.speed + 1; };
  App.menuOpen = () => UB.Menus.isOpen();
  App.closeMenus = function () { UB.Menus.back(); };
  App.openPause = function () {
    if (!App.inGame || (App.S && App.S.over)) return;
    App.prevPaused = App.paused;
    App.paused = true;
    const S = App.S;
    $('pauseInfo').textContent = `Dia ${S.day} · ${S.nights} noites · seed “${S.seed}”`;
    UB.Menus.show('scrPause');
  };
  App.resumeFromMenu = function () { App.paused = App.prevPaused; };

  function enterGame(S) {
    App.S = S;
    App.inGame = true;
    App.paused = false;
    App.speed = 1;
    App.overAt = 0;
    App.clearSel();
    App.cancelMode();
    UB.Render.resetWorld();
    UB.HUD.reset();
    $('hud').hidden = false;
    UB.HUD.showBuild(false);
    const hq = W.hq(S);
    if (hq) UB.Render.centerOn(hq.tx + 1.5, hq.ty + 3);
    UB.Menus.hideAll();
  }
  App.startNew = function (seed, difficulty) {
    UB.Menus.show('loading');
    $('loadFill').style.width = '60%';
    setTimeout(() => {
      const S = UB.Game.newGame({ seed, difficulty });
      enterGame(S);
      UB.Menus.autosave();
    }, 30);
  };
  App.loadState = function (str) {
    const S = UB.Game.deserialize(str);
    enterGame(S);
    UB.HUD.toast(`Dia ${S.day} carregado.`);
  };
  App.quitToMenu = function () {
    if (App.S && !App.S.over) UB.Menus.autosave();
    App.inGame = false;
    App.S = null;
    $('hud').hidden = true;
    UB.Render.resetWorld();
    UB.Menus.hideAll();
    UB.Menus.refreshMain();
    UB.Menus.show('scrMain');
  };

  App.applySettings = function () {
    const s = App.settings;
    UB.Audio.setVolumes({ master: s.master, sfx: s.sfx, amb: s.amb });
    UB.Render.setQuality(s.quality);
    UB.Render.setShake(s.shake);
    document.documentElement.style.setProperty('--ui', s.ui);
    $('fps').hidden = !s.fps;
  };

  // ---- main loop -------------------------------------------------------------------------------------------
  let last = 0, acc = 0, hudT = 0, sndT = 0, fpsT = 0, frames = 0;
  function loop(now) {
    const realDt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    UB.Input.update(realDt);
    const S = App.S;
    if (App.inGame && S) {
      let fxDt = 0;
      if (!App.paused && !UB.Menus.isOpen() && !S.over) {
        acc += realDt * App.speed;
        fxDt = realDt * App.speed;
        let n = 0;
        while (acc >= TIME.TICK && n < 8) {
          for (const u of S.units) { u._px = u.x; u._py = u.y; }
          for (const z of S.zombies) { z._px = z.x; z._py = z.y; }
          UB.Game.tick(S);
          acc -= TIME.TICK;
          n++;
        }
        if (n >= 8) acc = 0;
      } else if (S.over) fxDt = realDt;
      UB.Render.consume(S, UB.Audio.onEvent);
      UB.Render.clampCam(S);
      const selUnitsArr = selUnits();
      UB.Render.frame(S, App.paused || UB.Menus.isOpen() ? 1 : acc / TIME.TICK, fxDt, {
        sel: App.sel, selSet: new Set(App.sel.units), selUnits: selUnitsArr, showPaths: App.settings.paths,
        ghost: App.mode && App.mode.kind === 'build' ? { tiles: App.mode.tiles, size: App.mode.size, type: App.mode.type } : null,
        hoverTile: App.touch ? null : App.hoverTile, box: App.box, selZombie: App.sel.zom,
      });
      // Drop selections that no longer exist.
      if (App.sel.units.length && selUnitsArr.length !== App.sel.units.length) App.sel.units = selUnitsArr.map((u) => u.id);
      if (App.sel.bld && !W.get(S, App.sel.bld)) App.sel.bld = 0;
      if (App.sel.zom && !W.get(S, App.sel.zom)) App.sel.zom = 0;
      if (now - hudT > 100) { hudT = now; UB.HUD.update(S, now); }
      if (now - sndT > 250) {
        sndT = now;
        UB.Audio.ambience(S, true);
        if (fxDt) {
          UB.Audio.groans(S);
          const w = S.units.find((u) => !u.dead && !u.hidden && u.workT && S.time - u.workT < 0.3 && u.working && (u.working.type === 'build' || u.working.type === 'repair'));
          if (w) UB.Audio.play('hammer', w);
        }
      }
      if (S._autosave) { S._autosave = false; UB.Menus.autosave(); }
      if (S.over && !App.overAt) App.overAt = now;
      if (App.overAt && now - App.overAt > 2500 && !UB.Menus.isOpen()) { App.overAt = Infinity; UB.Menus.gameOver(S); }
    } else if (App.demo) {
      // Main menu backdrop: the city at night, slowly drifting.
      const D = App.demo;
      const t = now / 1000;
      UB.Render.centerOn(D.base.x + Math.cos(t * 0.05) * 14, D.base.y + Math.sin(t * 0.05) * 14);
      UB.Render.frame(D, 1, realDt, {});
      if (now - sndT > 500) { sndT = now; UB.Audio.ambience(null, false); }
    }
    frames++;
    if (now - fpsT > 1000) { $('fps').textContent = `${frames} fps · ${S ? S.zombies.length : 0} zumbis`; frames = 0; fpsT = now; }
    requestAnimationFrame(loop);
  }

  // ---- boot ----------------------------------------------------------------------------------------------------
  function boot() {
    App.settings = UB.Menus.loadSettings();
    UB.Render.init($('view'));
    UB.HUD.init();
    UB.Input.init($('view'));
    UB.Menus.init();
    if (window.innerWidth <= 720 || window.innerHeight <= 520) $('miniWrap').classList.add('closed');
    App.applySettings();
    window.addEventListener('resize', () => UB.Render.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && App.inGame && App.settings.autopause && !UB.Menus.isOpen()) App.openPause();
    });
    window.addEventListener('pointerdown', () => UB.Audio.init(), { once: true });
    // Pre-bake common sprites with a progress bar, then show the menu over a demo city.
    const jobs = [];
    for (const role of Object.keys(UB.DEF.ROLES)) for (const w of ['pistol', 'shotgun', 'bat']) for (let f = 0; f < 4; f++) for (let d = 0; d < 4; d++) jobs.push(() => UB.Render.sprite(`s:${role}:${w}:${f}:${d}:${0}`, () => UB.Models.survivor(role, w, f, 0).rotate(d)));
    for (const t of ['walker', 'runner']) for (let v = 0; v < 3; v++) for (let f = 0; f < 4; f++) for (let d = 0; d < 4; d++) jobs.push(() => UB.Render.sprite(`z:${t}:${v}:${f}:${d}`, () => UB.Models.zombie(t, v, f).rotate(d)));
    jobs.push(() => {
      const D = UB.Game.newGame({ seed: 'cidade-morta' });
      D.map.explored.fill(1);
      D._vis.fill(1);
      D.clock = { phase: 'night', t: 40 };
      App.demo = D;
    });
    let k = 0;
    const step = () => {
      const t0 = performance.now();
      while (k < jobs.length && performance.now() - t0 < 25) jobs[k++]();
      $('loadFill').style.width = `${Math.round((k / jobs.length) * 100)}%`;
      if (k < jobs.length) requestAnimationFrame(step);
      else {
        UB.Menus.show('scrMain');
        requestAnimationFrame(loop);
      }
    };
    requestAnimationFrame(step);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(globalThis.UB = globalThis.UB || {});
