// HUD, toasts, banners, dialogs, the boss bar, the death screen and the menu shell.
import { h, clear } from './dom.js';
import { CLASSES } from '../data/classes.js';
import { SKILLS } from '../data/skills.js';
import { STATUS } from '../data/status.js';
import { ZONES } from '../data/zones.js';
import { CONSUMABLES } from '../data/consumables.js';
import { count } from '../systems/inventory.js';
import { xpToNext, MAX_LEVEL } from '../systems/progression.js';
import { Minimap } from './minimap.js';
import { MENUS, MENU_TABS } from './menus/index.js';
import { TouchControls } from './touch.js';
import { fmt } from '../core/math.js';

const KEY_LABEL = (code) => (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('Space', 'Space');

export class UI {
  constructor(game) {
    this.g = game;
    this.root = document.getElementById('hud');
    this.menuRoot = document.getElementById('menu');
    this.dialogRoot = document.getElementById('dialog');
    this.root.hidden = false;
    this.textT = 0;
    this.toasts = [];
    this.build();
    this.minimap = new Minimap(game, this.el.mm);
    this.touch = new TouchControls(game, document.getElementById('touch'));
    this.menuOpen = null;
    this.dialogOpen = false;
    this.wire();
  }

  build() {
    const el = (this.el = {});
    const bar = (cls) => { const i = h('i'); const s = h('span'); const b = h('div', { class: `bar ${cls}` }, i, s); return { b, i, s }; };
    el.hp = bar('hp'); el.res = bar('res'); el.xp = bar('xp');
    el.shield = h('b', { class: 'shield' }); el.hp.b.append(el.shield);
    el.lvl = h('div', { class: 'lvl' });
    el.name = h('div', { class: 'pf-name' });
    el.statuses = h('div', { class: 'statuses' });
    el.points = h('button', { class: 'points', hidden: true, onclick: () => this.openMenu('character') });
    el.zone = h('div', { class: 'zone-name' });
    el.zoneSub = h('div', { class: 'zone-sub' });
    el.clock = h('div', { class: 'clock' });
    el.wave = h('div', { class: 'wave' });
    el.bbName = h('div', { class: 'bb-name' }); el.bbPhase = h('div', { class: 'bb-phase' });
    el.boss = bar('boss');
    el.bossbar = h('div', { class: 'bossbar', hidden: true }, el.bbName, el.boss.b, el.bbPhase);
    el.mm = h('canvas', { class: 'minimap', width: 180, height: 180 });
    el.objText = h('div', { class: 'obj-text' }); el.objProg = h('div', { class: 'obj-prog' }); el.objHint = h('div', { class: 'obj-hint' }); el.objNext = h('div', { class: 'obj-next' });
    el.obj = h('div', { class: 'hud-obj' }, h('div', { class: 'obj-title' }, 'Objective'), el.objText, el.objProg, el.objHint, el.objNext);
    el.prompt = h('div', { class: 'prompt', hidden: true });
    // On touch screens the prompt itself is the interact button (hold to keep gathering).
    el.prompt.addEventListener('pointerdown', (e) => { e.preventDefault(); this.g.input.press('interact'); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.prompt.addEventListener(ev, () => this.g.input.release('interact'));
    el.chanI = h('i'); el.chanS = h('span');
    el.channel = h('div', { class: 'channel', hidden: true }, el.chanS, h('div', { class: 'chan-bar' }, el.chanI));
    el.hotbar = h('div', { class: 'hotbar' });
    el.toasts = h('div', { class: 'toasts' });
    el.banner = h('div', { class: 'banner', hidden: true });
    el.cross = h('div', { class: 'crosshair' });
    el.fade = h('div', { class: 'fade' });
    el.death = h('div', { class: 'death', hidden: true });
    el.lockMark = h('div', { class: 'lock-mark', hidden: true });
    el.saved = h('div', { class: 'saved' }, 'Saved');
    this.root.append(
      h('div', { class: 'hud-tl' }, h('div', { class: 'pf' }, el.lvl, h('div', { class: 'pf-bars' }, el.name, el.hp.b, el.res.b, el.xp.b)), el.statuses, el.points),
      h('div', { class: 'hud-tc' }, el.zone, el.zoneSub, h('div', { class: 'tc-row' }, el.clock, el.wave), el.bossbar),
      h('div', { class: 'hud-tr' }, el.mm,
        h('div', { class: 'hud-buttons' },
          h('button', { class: 'hbtn', title: 'Menu (Tab)', onclick: () => this.openMenu('inventory') }, '☰'),
          h('button', { class: 'hbtn', title: 'Map (M)', onclick: () => this.openMenu('map') }, '⌖'),
          h('button', { class: 'hbtn', title: 'Crafting (C)', onclick: () => this.openMenu('craft') }, '⚒'))),
      el.obj,
      h('div', { class: 'hud-bottom' }, el.prompt, el.channel, el.hotbar),
      el.toasts, el.banner, el.cross, el.lockMark, el.death, el.fade, el.saved,
    );
    this.buildHotbar();
  }

  buildHotbar() {
    const g = this.g, el = this.el;
    clear(el.hotbar);
    this.slots = [];
    const kit = g.player.kit;
    const b = g.settings.controls.bindings;
    const slot = (key, id, label) => {
      const s = SKILLS[id];
      const cd = h('div', { class: 'cd' });
      const lock = h('div', { class: 'lock' });
      const node = h('div', { class: 'slot', title: s ? `${s.name}: ${s.desc}` : '' }, h('span', { class: 'ico' }, s ? s.icon : '·'), h('span', { class: 'key' }, label), cd, lock);
      el.hotbar.append(node);
      this.slots.push({ node, id, cd, lock, key });
    };
    slot('attack', kit.basic.id, 'LMB');
    slot('alt', kit.alt.id, 'RMB');
    g.profile.hotbars[g.profile.classId].forEach((id, k) => slot(`skill${k + 1}`, id, KEY_LABEL(b[`skill${k + 1}`])));
    const tonic = h('div', { class: 'slot tonic', title: 'Drink the best healing tonic' }, h('span', { class: 'ico' }, '❤'), h('span', { class: 'key' }, KEY_LABEL(b.tonic)), h('span', { class: 'count' }));
    tonic.addEventListener('click', () => g.input.press('tonic') || setTimeout(() => g.input.release('tonic'), 50));
    el.hotbar.append(tonic);
    this.tonicSlot = tonic;
    this.touch?.rebuild();
  }

  wire() {
    const g = this.g, bus = g.bus;
    bus.on('zoneEnter', ({ def }) => this.showZone(def));
    bus.on('levelUp', ({ level, unlocks }) => {
      this.banner(`Level ${level}`, unlocks.length ? `Unlocked: ${unlocks.map((u) => u.label).join(', ')}` : '+3 attribute points');
      this.buildHotbar();
    });
    bus.on('waveStart', ({ idx, total, phase }) => this.banner(phase === 'night' ? `Night wave ${idx + 1}` : `Wave ${idx + 1}`, `${total} creatures approach the island.`, 'wave'));
    bus.on('waveEnd', ({ cleared }) => { if (cleared) this.toast('Wave cleared!', 'good'); });
    bus.on('phase', ({ phase }) => this.toast(phase === 'night' ? 'Night falls. The Echoes rise.' : 'Dawn breaks over Dawnreach.', 'info'));
    bus.on('bossAppear', ({ def, arena }) => { this.banner(`${def.name} appears!`, `Seek them in the ${arena.name}.`, 'boss'); });
    bus.on('bossEngage', ({ def }) => this.bossIntro(def));
    bus.on('bossPhase', ({ phase }) => { this.phaseName = phase.name; });
    bus.on('bossReset', ({ def }) => this.toast(`${def.name} loses interest and recovers.`, 'warn'));
    bus.on('bossDefeated', ({ def, loot }) => {
      this.banner(`${def.name} defeated!`, `Loot: ${loot.join(', ')}`, 'boss');
      this.combatDialog = setTimeout(() => this.dialog({ title: def.name, text: `${def.defeat}\n\n${def.lore}`, portrait: 'boss', sub: 'Recorded in your Journal.' }), 2200);
    });
    bus.on('died', ({ lost }) => this.deathScreen(lost));
    bus.on('stats', () => this.dirty = true);
  }

  // ------------------------------------------------------------------ notices
  toast(msg, kind = 'info', life = 3.2) {
    const n = h('div', { class: `toast ${kind}` }, msg);
    this.el.toasts.append(n);
    while (this.el.toasts.children.length > 5) this.el.toasts.firstChild.remove();
    setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 400); }, life * 1000);
  }
  banner(title, sub = '', kind = '') {
    const b = this.el.banner;
    clear(b).append(h('div', { class: 'b-title' }, title), sub ? h('div', { class: 'b-sub' }, sub) : null);
    b.className = `banner ${kind}`;
    b.hidden = false;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.hidden = true; }, 3600);
  }
  showZone(def) {
    this.el.zone.textContent = def.name;
    this.el.zoneSub.textContent = def.subtitle || '';
    this.el.zone.classList.remove('flash'); void this.el.zone.offsetWidth; this.el.zone.classList.add('flash');
    this.minimap.setZone(this.g.zone);
    this.el.bossbar.hidden = true;
  }
  prompt(label, bad = false) {
    const p = this.el.prompt;
    if (!label) { p.hidden = true; this.touch?.setInteract(null); return; }
    const key = this.g.input.lastDevice === 'touch' ? '✋' : KEY_LABEL(this.g.settings.controls.bindings.interact);
    if (p.dataset.l !== label + bad) { clear(p).append(h('b', {}, key), ' ', label); p.dataset.l = label + bad; p.classList.toggle('bad', bad); }
    p.hidden = false;
    this.touch?.setInteract(label);
  }
  channel(label, frac) {
    const c = this.el.channel;
    if (!label) { c.hidden = true; return; }
    c.hidden = false; this.el.chanS.textContent = label; this.el.chanI.style.transform = `scaleX(${frac})`;
  }
  fadeTravel(fn) {
    const f = this.el.fade;
    f.classList.add('on');
    setTimeout(() => { try { fn(); } finally { setTimeout(() => f.classList.remove('on'), 120); } }, 380);
  }
  flashSaved() { const s = this.el.saved; s.classList.remove('on'); void s.offsetWidth; s.classList.add('on'); }

  bossIntro(def) {
    this.phaseName = def.phases[0].name;
    this.dialog({ title: def.name, sub: def.title, text: def.intro, portrait: 'boss', button: 'Fight!' });
    this.g.bus.emit('sfx', { id: 'bossIntro' });
  }

  deathScreen(lost) {
    const d = this.el.death;
    clear(d).append(h('div', { class: 'death-title' }, 'You fell'), h('p', {}, `The beacon calls you back. ${lost ? `Lost ${fmt(lost)} XP of progress toward the next level.` : ''}`),
      h('button', { class: 'btn primary big', onclick: () => { d.hidden = true; this.g.respawn(); } }, 'Return to the Beacon'));
    d.hidden = false;
    this.g.input.releasePointer();
  }

  // ------------------------------------------------------------------ dialogs
  dialog({ title, text, sub = null, portrait = null, button = 'Continue', buttons = null }) {
    const root = this.dialogRoot;
    this.g.paused = true;
    this.dialogOpen = true;
    this.g.input.releasePointer();
    this.g.input.clear();
    const close = () => { root.hidden = true; this.dialogOpen = false; this.g.paused = !!this.menuOpen; };
    const port = portrait ? h('div', { class: `portrait ${portrait}` }, portrait === 'lume' ? '◉' : portrait === 'boss' ? '☠' : '✦') : null;
    clear(root).append(h('div', { class: 'dlg' }, port, h('div', { class: 'dlg-body' },
      h('h3', {}, title), sub ? h('div', { class: 'dlg-sub' }, sub) : null,
      ...String(text).split('\n\n').map((p) => h('p', {}, p)),
      h('div', { class: 'row' }, ...(buttons || [{ label: button, primary: true }]).map((b) => h('button', { class: `btn${b.primary ? ' primary' : ''}`, onclick: () => { close(); b.action?.(); } }, b.label))))));
    root.hidden = false;
    root.querySelector('.btn')?.focus();
    this.closeDialog = close;
  }

  altar() {
    const g = this.g, p = g.profile;
    const buttons = Object.values(CLASSES).filter((c) => c.id !== p.classId).map((c) => ({ label: `Become ${c.name}`, action: () => {
      p.classId = c.id;
      g.setupClass();
      this.buildHotbar();
      this.banner(`You walk the path of the ${c.name}`, c.tagline);
      g.fx.column(g.player.x, g.player.ry, g.player.z, c.color, 30);
      g.save('class');
    } }));
    buttons.push({ label: 'Leave', primary: true });
    this.dialog({ title: 'Altar of Paths', text: `Here you may change your path. Each class keeps its own equipped gear; your level and attributes stay with you. To place your attribute points again, use a Reset Crystal from the Character tab.\n\nYou walk the path of the ${CLASSES[p.classId].name}.`, buttons, portrait: 'echo' });
  }

  // ------------------------------------------------------------------ menus
  openMenu(tab = 'inventory', opts = {}) {
    if (this.dialogOpen) return;
    const g = this.g;
    this.menuOpts = opts;
    g.paused = true;
    g.input.releasePointer();
    g.input.clear();
    this.menuOpen = tab;
    this.menuRoot.hidden = false;
    this.renderMenu();
    g.bus.emit('sfx', { id: 'ui' });
  }
  closeMenu() {
    this.menuOpen = null;
    this.menuRoot.hidden = true;
    clear(this.menuRoot);
    this.g.paused = this.dialogOpen;
    this.buildHotbar();
    this.g.bus.emit('sfx', { id: 'uiClose' });
  }
  renderMenu() {
    const tab = this.menuOpen;
    const body = h('div', { class: 'menu-body' });
    const tabs = h('div', { class: 'menu-tabs', role: 'tablist' }, MENU_TABS.map((t) => h('button', { class: `mtab${t.id === tab ? ' on' : ''}`, role: 'tab', 'aria-selected': String(t.id === tab), onclick: () => { this.menuOpen = t.id; this.renderMenu(); } }, h('span', { class: 'mi' }, t.icon), h('span', { class: 'ml' }, t.name))));
    clear(this.menuRoot).append(h('div', { class: 'menu-panel' },
      h('div', { class: 'menu-head' }, tabs, h('button', { class: 'menu-close', 'aria-label': 'Close', onclick: () => this.closeMenu() }, '✕')),
      body));
    MENUS[tab](this.g, body, this.menuOpts || {}, () => this.renderMenu());
  }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const g = this.g, p = g.player, st = g.stats, el = this.el;
    // Menu hotkeys.
    const inp = g.input;
    const keys = { menu: 'inventory', inventory: 'inventory', craft: 'craft', character: 'character', skills: 'skills', map: 'map', journal: 'journal' };
    for (const [a, tab] of Object.entries(keys)) if (inp.wasPressed(a)) { if (this.menuOpen === tab || (a === 'menu' && this.menuOpen)) this.closeMenu(); else if (!this.dialogOpen && p.alive) this.openMenu(tab); }
    if (inp.wasPressed('escape')) { if (this.dialogOpen) this.closeDialog?.(); else if (this.menuOpen) this.closeMenu(); else if (p.alive) this.openMenu('system'); }

    // Bars every frame.
    el.hp.i.style.transform = `scaleX(${Math.max(0, p.hp / st.maxHp)})`;
    el.shield.style.transform = `scaleX(${Math.min(1, (p.shield || 0) / st.maxHp)})`;
    el.res.i.style.transform = `scaleX(${Math.max(0, p.res / st.resourceMax)})`;
    const next = xpToNext(g.profile.level);
    el.xp.i.style.transform = `scaleX(${g.profile.level >= MAX_LEVEL ? 1 : g.profile.xp / next})`;
    this.updateBoss();
    this.updateLock();
    for (const s of this.slots) {
      const kit = p.kit;
      const sk = SKILLS[s.id];
      const frac = sk.kind === 'skill' || sk.id === 'as_mark' ? kit.cdFrac(s.id) : 0;
      s.cd.style.setProperty('--cd', `${Math.round(frac * 360)}deg`);
      s.cd.style.display = frac > 0 ? 'block' : 'none';
      const locked = !kit.unlocked(s.id);
      s.node.classList.toggle('locked', locked);
      s.node.classList.toggle('poor', !locked && p.res < (sk.cost || 0));
      s.node.classList.toggle('held', g.input.isDown(s.key));
      if (locked) s.lock.textContent = `Lv ${sk.unlock}`;
    }
    this.el.cross.hidden = !g.input.locked;
    // Text at ~10 Hz.
    this.textT -= dt;
    if (this.textT > 0) return;
    this.textT = 0.1;
    const c = CLASSES[g.profile.classId];
    el.lvl.textContent = g.profile.level;
    el.name.textContent = `${g.profile.name} · ${c.name}`;
    el.hp.s.textContent = `${Math.ceil(p.hp)} / ${st.maxHp}`;
    el.res.s.textContent = `${c.resource.name} ${Math.floor(p.res)}`;
    el.res.i.style.background = c.resource.color;
    el.points.hidden = !g.profile.attrPoints;
    el.points.textContent = `+${g.profile.attrPoints} points`;
    clear(el.statuses);
    for (const [id, s] of p.statuses.map) { const d = STATUS[id]; el.statuses.append(h('span', { class: `st${d.harmful ? ' bad' : ''}`, title: `${d.name}: ${d.desc}`, style: { color: d.color } }, d.icon, s.stacks > 1 ? h('sub', {}, s.stacks) : null, h('small', {}, Math.ceil(s.t)))); }
    if (g.zone.type === 'island') {
      const dn = g.dayNight;
      el.clock.textContent = `${dn.phase === 'day' ? '☀ Day' : '☾ Night'} · ${Math.ceil(dn.remaining / 60)} min left`;
    } else el.clock.textContent = `⛏ Layer ${g.zone.layer} · Lv ${ZONES[g.zone.id].band.join('–')}`;
    const w = g.spawner.wave;
    el.wave.textContent = w ? `Wave ${w.idx + 1} · ${g.enemies.count((e) => e.wave)} left` : '';
    el.wave.hidden = !w;
    const t = count(g.profile.inv, 'healing_tonic') + count(g.profile.inv, 'greater_healing_tonic');
    this.tonicSlot.querySelector('.count').textContent = t;
    this.tonicSlot.classList.toggle('locked', !t);
    const o = g.objectives.current;
    if (o) {
      el.objText.textContent = o.text;
      el.objProg.textContent = o.count > 1 ? `${Math.min(o.count, g.profile.objectives.progress)} / ${o.count}` : '';
      el.objHint.textContent = g.settings.ui.hints ? o.hint : '';
    } else { el.objText.textContent = 'The isles beyond await (Milestone 2).'; el.objProg.textContent = ''; el.objHint.textContent = 'Keep levelling, crafting and hunting bosses.'; }
    const nu = g.nextUnlock();
    el.objNext.textContent = nu ? `Next at Lv ${nu.level}: ${nu.entries.slice(0, 2).map((e) => e.label).join(', ')}` : '';
    this.minimap.draw();
  }

  updateBoss() {
    const g = this.g, bb = this.el.bossbar;
    const boss = g.enemies.list.find((e) => e.boss && e.alive && e.group.engaged);
    if (!boss) { bb.hidden = true; return; }
    const m = boss.group.members;
    const hp = m.reduce((a, x) => a + Math.max(0, x.alive ? x.hp : 0), 0), max = m.reduce((a, x) => a + x.maxHp, 0);
    bb.hidden = false;
    this.el.bbName.textContent = `${boss.bossDef.name} · Lv ${boss.level}`;
    this.el.boss.i.style.transform = `scaleX(${hp / max})`;
    this.el.boss.s.textContent = `${fmt(hp)} / ${fmt(max)}`;
    this.el.bbPhase.textContent = this.phaseName || '';
  }

  updateLock() {
    const g = this.g, t = g.lockTarget, m = this.el.lockMark;
    if (!t?.alive) { m.hidden = true; return; }
    const pr = g.overlay.project(t.x, t.ry + t.height * (t.scale || 1) * 0.6, t.z);
    if (!pr) { m.hidden = true; return; }
    m.hidden = false;
    m.style.transform = `translate(${pr[0]}px, ${pr[1]}px)`;
  }
}

export { CONSUMABLES };
