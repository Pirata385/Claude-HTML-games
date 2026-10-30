// World interaction: gathering resource nodes, camp stations, cave stairs and shafts,
// Echo Stones, the Wayshrine and the isles, the Sealed Core Gate and the recall channel.
import { NODES } from '../data/nodes.js';
import { MATERIALS, SHARDS } from '../data/materials.js';
import { ZONES } from '../data/zones.js';
import { LORE, LUME_LINES } from '../data/lore.js';
import { canGather, gatherDamage, rollYield } from '../systems/gathering.js';
import { gatherXp } from '../systems/progression.js';
import { addStack } from '../systems/inventory.js';
import { canEnter, isleList, openGate, ownedSigils } from '../systems/travel.js';
import { startRun, nextFloor, endRun } from '../systems/run.js';
import { F } from './grid.js';

const REACH = 2.6, NODE_REACH = 1.9;

export class Interaction {
  constructor(game) {
    this.g = game;
    this.items = [];
    this.nodeHp = new Map();
    this.swingCd = 0;
    this.respawnT = 0;
    this.focus = null;
    this.recall = null;
    game.bus.on('playerHurt', () => { if (this.recall) { this.recall = null; game.ui?.toast('Recall interrupted.', 'warn'); } });
    // The Warden's key unlocks the stair; a fallen ruler opens the way out.
    game.bus.on('kill', ({ enemy }) => {
      const z = game.zone;
      if (game.profile.run) game.profile.run.kills++;
      if (enemy.def.keyCarrier && z.exit?.locked) this.unlockStair('You take the Warden\'s key. The stair is open.');
    });
    game.bus.on('bossDefeated', ({ def }) => {
      const z = game.zone;
      if (z.type !== 'dimension' || def.zone !== z.id) return;
      if (z.exit?.locked) this.unlockStair('The Jailer\'s keys are yours. The stair is open, and a portal leads home.');
      this.openExitPortal();
    });
    game.bus.on('playerDeath', () => { this.recall = null; });
  }

  get zstate() { return this.g.profile.zones[this.g.zone.id]; }

  onZoneEnter() {
    const g = this.g, z = g.zone;
    this.nodeHp.clear();
    this.recall = null;
    // Restore depleted nodes from the save.
    const st = this.zstate;
    st.nodes ||= {};
    z.nodes.forEach((n, i) => {
      const at = st.nodes[n.id];
      if (at && at > g.profile.playTime) g.view.nodes.setDepleted(i, true);
      else if (at) delete st.nodes[n.id];
    });
    this.items = [];
    const add = (o) => this.items.push({ r: REACH, ...o });
    if (z.type === 'island') {
      const s = z.base.stations;
      add({ id: 'forge', x: s.forge.x, z: s.forge.z, label: 'Use the Forge', act: () => g.ui.openMenu('craft', { atForge: true }) });
      add({ id: 'altar', x: s.altar.x, z: s.altar.z, label: 'Altar of Paths', act: () => g.ui.altar() });
      add({ id: 'bed', x: s.bed.x, z: s.bed.z, label: 'Rest and save', act: () => this.rest() });
      add({ id: 'lume', x: s.lume.x, z: s.lume.z, label: 'Talk to Lume', act: () => this.talkLume() });
      add({ id: 'beacon', x: s.beacon.x, z: s.beacon.z, label: 'The Beacon', act: () => g.ui.dialog({ title: 'The Beacon', text: 'Its light keeps creatures out of the camp. Nothing that hops or shambles will cross into it.' }) });
      add({ id: 'cave', x: z.caveMouth.x, z: z.caveMouth.z, r: 3.4, label: 'Enter the Hollow Deep', act: () => this.travel('cave_1') });
      const w = z.base.wayshrine;
      if (w) add({ id: 'wayshrine', x: w.x, z: w.z, r: 3, label: 'The Wayshrine', act: () => this.wayshrine() });
    } else if (z.type === 'isle') {
      add({ id: 'return', x: z.landing.x, z: z.landing.z, r: 3, label: 'Return to Dawnreach', act: () => this.travel('island') });
    } else if (z.type === 'dimension') {
      add({ id: 'back', x: z.entry.x, z: z.entry.z, r: 2.6, label: 'The way back (ends the run)', act: () => this.confirmLeave() });
      if (z.exit?.type === 'stair') add({ id: 'stair', x: z.exit.x, z: z.exit.z, r: 2.8, label: () => (z.exit.locked ? 'Locked stair: the Warden has the key' : `Stair to floor ${g.profile.run.floor + 1}`), act: () => this.stair() });
      for (const l of z.levers || []) add({ id: l.id, x: l.x, z: l.z, r: 2.2, label: () => (l.pulled ? 'Lever (pulled)' : 'Pull the lever'), act: () => this.pullLever(l) });
    } else {
      const layer = z.layer;
      add({ id: 'up', x: z.entry.x, z: z.entry.z, r: 2.8, label: layer === 1 ? 'Climb back to Dawnreach' : `Climb to ${ZONES[`cave_${layer - 1}`].name}`, act: () => this.travel(layer === 1 ? 'island' : `cave_${layer - 1}`, 'fromBelow') });
      if (z.exit.type === 'shaft') {
        const next = ZONES[`cave_${layer + 1}`];
        add({ id: 'down', x: z.exit.x, z: z.exit.z, r: 2.8, label: () => (g.profile.level >= next.levelReq ? `Descend to ${next.name}` : `Descend (requires level ${next.levelReq})`), act: () => this.travel(next.id) });
      } else if (z.exit.type === 'gate') {
        add({ id: 'gate', x: z.exit.x, z: z.exit.z, r: 4.5, label: () => (g.profile.flags?.gateOpen ? 'Enter the Core' : 'The Sealed Core Gate'), act: () => this.readGate() });
      } else {
        add({ id: 'heart', x: z.exit.x, z: z.exit.z, r: 4.5, label: z.exit.type === 'core' ? 'The Singular Heart' : 'The Heart Seal', act: () => this.readHeart() });
      }
    }
    for (const p of z.pois) if (p.type === 'lore') add({ id: `lore:${p.id}`, x: p.x, z: p.z, label: () => (g.profile.lore.includes(p.id) ? 'Echo Stone (read)' : 'Read the Echo Stone'), act: () => this.readLore(p.id) });
  }

  // ------------------------------------------------------------------ portals and dimension runs
  // An Emblem opens a portal in front of you. Returns why it cannot, or null.
  openPortal(dimId) {
    const g = this.g, p = g.player;
    if (g.zone.type === 'dimension') return 'Portals cannot be opened inside a dimension.';
    const gate = canEnter(g.profile, dimId);
    if (!gate.ok) return gate.reason;
    if (g.spawner.boss?.engaged) return 'Not while a boss is upon you.';
    const x = p.x + Math.sin(p.yaw) * 3, z = p.z + Math.cos(p.yaw) * 3;
    const i = Math.floor(x), j = Math.floor(z);
    if (!g.grid.walkable(i, j) || g.grid.has(i, j, F.ARENA | F.WATER)) return 'There is no room for a portal there. Face open ground.';
    this.closePortal();
    g.portal = { dim: dimId, x: i + 0.5, z: j + 0.5, y: g.grid.height(i, j), t: 60 };
    g.view.setPortal(g.portal, ZONES[dimId].palette.accent || '#c48cff');
    this.items.push({ id: 'portal', x: g.portal.x, z: g.portal.z, r: 2.4, label: `Enter ${ZONES[dimId].name}`, act: () => this.enterPortal() });
    g.ui.toast(`A portal to ${ZONES[dimId].name} opens. It will stay for a minute.`, 'good');
    g.bus.emit('sfx', { id: 'portal' });
    return null;
  }
  closePortal() {
    const g = this.g;
    g.portal = null;
    g.view?.setPortal(null);
    this.items = this.items.filter((it) => it.id !== 'portal');
  }
  enterPortal() {
    const g = this.g, P = g.portal;
    if (!P) return;
    const from = { zone: g.zone.id, x: P.x, z: P.z };
    this.closePortal();
    startRun(g.profile, P.dim, from);
    g.ui.fadeTravel(() => { g.enterZone(P.dim); g.save('dimension'); });
  }
  // The exit portal at a fallen ruler's feet.
  openExitPortal() {
    const g = this.g, a = g.zone.arena;
    g.portalOut = { x: a.x, z: a.z, y: a.h };
    g.view.setPortal(g.portalOut, '#ffe9a8');
    this.items.push({ id: 'exitPortal', x: a.x, z: a.z, r: 2.6, label: 'Step through the portal home', act: () => this.leaveRun('complete') });
  }
  unlockStair(msg) {
    const g = this.g;
    g.zone.exit.locked = false;
    g.view.rebuildStructures?.();
    g.ui.toast(msg, 'good', 5);
    g.fx.column(g.zone.exit.x, g.zone.exit.h, g.zone.exit.z, '#ffcf6a', 20, 0.8);
    g.bus.emit('sfx', { id: 'unlock' });
  }
  stair() {
    const g = this.g;
    if (g.zone.exit.locked) { g.ui.toast('The stair is locked. The Gaol Warden carries the key.', 'warn'); g.bus.emit('sfx', { id: 'denied' }); return; }
    const run = g.profile.run;
    g.ui.dialog({ title: `Floor ${run.floor}`, portrait: 'echo', text: `The stair goes down to floor ${run.floor + 1}. ${(run.floor + 1) % 5 === 0 ? 'The Iron-Hand Jailer waits on the next floor.' : 'The gaol grows harder with every floor.'} You can also climb out now and keep everything you found. Your deepest floor is remembered.`,
      buttons: [{ label: `Descend to floor ${run.floor + 1}`, primary: true, action: () => this.descend() }, { label: 'Leave with your loot', action: () => this.leaveRun('leave') }, { label: 'Not yet' }] });
  }
  descend() {
    const g = this.g;
    if (!g.profile.run || g.zone.exit?.locked) return;
    nextFloor(g.profile.run);
    g.ui.fadeTravel(() => { g.enterZone(g.zone.id); g.save('floor'); });
  }
  confirmLeave() {
    const g = this.g;
    g.ui.dialog({ title: 'The way back', portrait: 'echo', text: 'Step back through and this run ends here. You keep everything you found, but the dimension forgets the way you came.',
      buttons: [{ label: 'Leave the dimension', primary: true, action: () => this.leaveRun('leave') }, { label: 'Stay' }] });
  }
  // Ends the run and returns to where the portal was opened.
  leaveRun(outcome) {
    const g = this.g;
    const sum = endRun(g.profile, outcome);
    if (!sum) return;
    const back = sum.returnTo && ZONES[sum.returnTo.zone]?.type !== 'dimension' ? sum.returnTo : { zone: 'island' };
    g.ui.fadeTravel(() => {
      g.enterZone(back.zone, back.x != null ? { x: back.x, z: back.z } : null);
      g.save('run');
      const def = ZONES[sum.dim];
      g.ui.toast(outcome === 'complete' ? `${def.name} cleared.` : def.rule === 'keys' ? `You climb out of floor ${sum.floor} of the Endless Dungeon.` : `You leave ${def.name}.`, 'good', 5);
    });
  }
  // Twin Slimes: a lever opens a gate in the other lane.
  pullLever(l) {
    const g = this.g, z = g.zone;
    if (l.pulled) return;
    l.pulled = true;
    const gate = z.gates.find((gt) => gt.id === l.gate);
    gate.open = true;
    for (const k of gate.cells) z.grid.flags[k] &= ~F.OBSTACLE;
    g.enemies.flow.valid = false;
    g.view.rebuildStructures?.();
    g.ui.toast(`Somewhere in the ${gate.lane} lane, a gate of gel melts away.`, 'good');
    g.bus.emit('sfx', { id: 'unlock' });
  }

  // Arrival points when moving between zones.
  travel(zoneId, how) {
    const g = this.g;
    const gate = canEnter(g.profile, zoneId);
    if (!gate.ok) { g.ui.toast(gate.reason, 'warn'); g.bus.emit('sfx', { id: 'denied' }); return; }
    let arrival = null;
    if (zoneId === 'island' && g.zone.type === 'isle') {
      const z = g.getZone('island'), w = z.base.wayshrine;
      const spot = this.openNear(z, Math.floor(w.x), Math.floor(w.z), 2);
      arrival = { x: spot[0] + 0.5, z: spot[1] + 0.5, yaw: Math.atan2(spot[0] + 0.5 - w.x, spot[1] + 0.5 - w.z) };
    } else if (zoneId === 'island' && g.zone.type === 'cave') {
      const z = g.getZone('island'), cm = z.caveMouth;
      const yaw = Math.atan2(z.base.x - cm.x, z.base.z - cm.z);
      arrival = { x: cm.x + Math.sin(yaw) * 3, z: cm.z + Math.cos(yaw) * 3, yaw };
    } else if (how === 'fromBelow') {
      const z = g.getZone(zoneId), ex = z.exit;
      const spot = this.openNear(z, ex.i, ex.j, 3);
      arrival = { x: spot[0] + 0.5, z: spot[1] + 0.5, yaw: Math.atan2(spot[0] - ex.i, spot[1] - ex.j) };
    }
    g.ui.fadeTravel(() => {
      g.enterZone(zoneId, arrival);
      g.save('travel');
    });
  }

  openNear(z, i0, j0, rmin) {
    const grid = z.grid;
    for (let r = rmin; r < rmin + 6; r++) for (let a = 0; a < 16; a++) {
      const i = Math.round(i0 + Math.cos((a / 16) * Math.PI * 2) * r), j = Math.round(j0 + Math.sin((a / 16) * Math.PI * 2) * r);
      if (grid.walkable(i, j) && !grid.has(i, j, F.HAZARD)) return [i, j];
    }
    return [z.spawn.x - 0.5, z.spawn.z - 0.5];
  }

  rest() {
    const g = this.g, p = g.player;
    p.hp = g.stats.maxHp; p.res = g.stats.resourceMax;
    p.statuses.clear();
    g.save('bed');
    g.ui.toast('Rested. Your progress is saved.', 'good');
    g.bus.emit('sfx', { id: 'rest' });
  }

  talkLume() {
    const g = this.g, p = g.profile;
    let text;
    if (!p.flags?.metLume) { (p.flags ||= {}).metLume = true; text = LUME_LINES.first; }
    else if (ownedSigils(p).length === 4 && !p.flags.gateOpen) text = LUME_LINES.sigilsHint;
    else if (p.level >= 66 && !p.flags.gateOpen && !Object.keys(p.zones).some((id) => id.startsWith('isle_'))) text = LUME_LINES.isleHint;
    else if (p.lore.includes('lore_seal') && !p.flags.gateOpen) text = LUME_LINES.gateHint;
    else if (SHARDS.every((s) => (p.inv.stacks[s] || 0) > 0) && !p.zones.cave_9) text = LUME_LINES.heartHint;
    else if (p.level >= 100 && p.flags.gateOpen && !Object.keys(p.dims || {}).length) text = LUME_LINES.emblemHint;
    else if (p.level >= 3 && !p.zones.cave_1) text = LUME_LINES.caveHint;
    else if (g.dayNight.phase === 'night') text = LUME_LINES.night;
    else text = LUME_LINES.greet[Math.floor(g.time) % LUME_LINES.greet.length] + ' ' + LUME_LINES.day;
    g.ui.dialog({ title: 'Lume, the Beacon Keeper', text, portrait: 'lume' });
    if (!p.lore.includes('lore_beacon') && p.flags.metLume) this.learn('lore_beacon', false);
  }

  learn(id, show = true) {
    const g = this.g, p = g.profile;
    if (p.lore.includes(id)) return false;
    p.lore.push(id);
    const lvl = ZONES[LORE[id].zone]?.levelReq || 1;
    g.grantXp(40 + lvl * 25, null);
    g.bus.emit('lore', { id });
    if (!show) g.ui.toast(`New lore: ${LORE[id].title}`, 'good');
    return true;
  }

  readLore(id) {
    const g = this.g;
    const isNew = this.learn(id);
    g.ui.dialog({ title: LORE[id].title, text: LORE[id].text, sub: isNew ? 'Recorded in your Journal.' : null, portrait: 'echo' });
    g.bus.emit('sfx', { id: 'lore' });
  }

  // The Wayshrine: a standing stone that remembers the old sea roads to the four isles.
  wayshrine() {
    const g = this.g;
    const list = isleList(g.profile);
    const lines = list.map((x) => `${x.hasSigil ? '✦' : '·'} ${x.name} (${x.subtitle}): level ${x.levelReq}. ${x.boss} keeps the ${MATERIALS[x.sigil].name}.`);
    const buttons = list.map((x) => ({ label: x.ok ? `Sail to ${x.name}` : `${x.name} (level ${x.levelReq})`, action: () => this.travel(x.id) }));
    buttons.push({ label: 'Stay', primary: true });
    g.ui.dialog({ title: 'The Wayshrine', text: `The old sea roads still answer the stone. Touch a rune and the current will carry you.\n\n${lines.join('\n\n')}`, buttons, portrait: 'echo' });
  }

  readGate() {
    const g = this.g, p = g.profile;
    this.learn('lore_seal', false);
    if (p.flags?.gateOpen) { this.travel('cave_8'); return; }
    const have = ownedSigils(p);
    if (have.length === 4) {
      g.ui.dialog({ title: 'The Sealed Core Gate', portrait: 'echo', text: 'The four sockets glow as you come near. The sigils in your pack are warm.', buttons: [
        { label: 'Set the four sigils', primary: true, action: () => {
          openGate(p);
          g.view.setGateOpen?.(true);
          g.cam.shake(1.2);
          g.bus.emit('sfx', { id: 'tremor' });
          g.ui.banner('The Sealed Core Gate opens', 'Dawn and dusk wait below.', 'boss');
          g.bus.emit('gateOpened', {});
          g.save('gate');
        } },
        { label: 'Not yet' },
      ] });
      return;
    }
    const names = have.map((s) => MATERIALS[s].name);
    g.ui.dialog({ title: 'The Sealed Core Gate', text: `${LORE.lore_seal.text}\n\nFour sockets wait: Wind, Tide, Flame and Stone. Their sigils lie on the elemental isles, beyond Dawnreach's horizon. The Wayshrine in camp knows the way.${names.length ? `\n\nYou carry: ${names.join(', ')}.` : ''}`, portrait: 'echo' });
  }

  readHeart() {
    const g = this.g, p = g.profile;
    // In the Singular Heart itself, the heart is the end of the road.
    if (g.zone.exit.type === 'core') {
      this.learn('lore_choice', false);
      g.ui.dialog({ title: 'The Singular Heart', portrait: 'echo', text: 'Singularita grows here like coral, in every colour at once, humming the shape of every possible thing. It does not want anything from you. If you mine it and bring it to the Forge, it will become whatever you ask, and remember two other shapes besides.' });
      return;
    }
    const have = SHARDS.filter((s) => (p.inv.stacks[s] || 0) > 0);
    if (have.length === SHARDS.length) {
      g.ui.dialog({ title: 'The Heart Seal', portrait: 'echo', text: 'The five shards hum against each other and against the seal. The seal remembers being one piece, and opens.',
        buttons: [{ label: 'Enter the Singular Heart', primary: true, action: () => this.travel('cave_9') }, { label: 'Not yet' }] });
      return;
    }
    g.ui.dialog({ title: 'The Heart Seal', portrait: 'echo', text: `A second seal, older than the gate and woven of both lights at once, with five keyholes that are not quite holes. Its keys are the Fracture Shards held by the rulers of the five dimensions; Emblems crafted at the Forge open the way to them.${have.length ? `\n\nYou carry ${have.length} of the five shards.` : ''}` });
  }

  // Nearest interactable or resource node in reach.
  scan() {
    const g = this.g, p = g.player;
    let best = null, bd = Infinity;
    for (const it of this.items) {
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d < it.r && d < bd) { bd = d; best = { kind: 'item', it, label: typeof it.label === 'function' ? it.label() : it.label }; }
    }
    if (best) return best;
    const st = this.zstate;
    const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
    let bn = -1, bs = -Infinity;
    const nodes = g.zone.nodes;
    const pi = Math.floor(p.x), pj = Math.floor(p.z);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (Math.abs(n.i - pi) > 3 || Math.abs(n.j - pj) > 3) continue;
      if (st.nodes[n.id]) continue;
      const dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz);
      if (d > NODE_REACH + 0.5 * (n.scale || 1)) continue;
      const score = (dx * f.x + dz * f.z) / (d || 1) - d * 0.5;
      if (score > bs) { bs = score; bn = i; }
    }
    if (bn < 0) return null;
    const n = nodes[bn], nd = NODES[n.node];
    const ok = nd.tide === 'low' && g.grid.has(n.i, n.j, F.WATER) ? { ok: false, reason: 'Under the tide. Wait for low water.' } : canGather(g.profile.inv, nd);
    const verb = nd.tool === 'axe' ? 'Chop' : 'Mine';
    return { kind: 'node', index: bn, n, nd, ok, label: ok.ok ? `${verb} ${nd.name}` : ok.reason };
  }

  gather(target) {
    const g = this.g, p = g.player;
    const { n, nd, index } = target;
    const ok = target.ok;
    if (!ok.ok) { g.ui.toast(ok.reason, 'warn'); g.bus.emit('sfx', { id: 'denied' }); this.swingCd = 0.6; return; }
    p.yaw = Math.atan2(n.x - p.x, n.z - p.z);
    p.kit.play(nd.tool === 'axe' ? 'slash' : 'overhead', 0.32);
    this.swingCd = 0.45 / g.stats.attackSpeed;
    const hp = (this.nodeHp.get(index)?.hp ?? nd.hp) - gatherDamage(ok.tool, g.stats.gatherPower);
    this.nodeHp.set(index, { hp, t: g.time });
    g.view.nodes.hit(index);
    const mat = MATERIALS[nd.material];
    g.fx.burst(n.x, n.h + 0.9, n.z, 6, { color: nd.tool === 'axe' ? '#c9a46a' : mat.color, speed: 3, up: 3, life: 0.5, size: 0.12 });
    g.bus.emit('sfx', { id: nd.tool === 'axe' ? 'chop' : 'pick', x: n.x, z: n.z });
    p.combatT = Math.min(p.combatT, 99);
    if (hp > 0) return;
    // Depleted: collect the yield.
    this.nodeHp.delete(index);
    const amount = rollYield(nd, g.stats.luck, g.rng);
    addStack(g.profile.inv, nd.material, amount);
    g.profile.stats.gathered[nd.material] = (g.profile.stats.gathered[nd.material] || 0) + amount;
    g.overlay.text(n.x, n.h + 2.2, n.z, `+${amount} ${mat.name}`, 'loot');
    g.fx.burst(n.x, n.h + 0.8, n.z, 16, { color: mat.color, speed: 4, up: 4 });
    g.view.nodes.setDepleted(index, true);
    this.zstate.nodes[n.id] = g.profile.playTime + nd.respawn;
    g.grantXp(gatherXp(nd.xp, g.profile.level), null);
    g.bus.emit('gathered', { node: n.node, material: nd.material, n: amount, x: n.x, z: n.z });
    g.bus.emit('itemGained', { id: nd.material, n: amount, source: 'gather' });
  }

  update(dt) {
    const g = this.g, p = g.player;
    this.swingCd -= dt;
    // Respawn nodes.
    this.respawnT -= dt;
    if (this.respawnT <= 0) {
      this.respawnT = 1;
      const st = this.zstate;
      g.zone.nodes.forEach((n, i) => { const at = st.nodes[n.id]; if (at && at <= g.profile.playTime) { delete st.nodes[n.id]; g.view.nodes.setDepleted(i, false); } });
      for (const [k, v] of this.nodeHp) if (g.time - v.t > 10) this.nodeHp.delete(k);
    }
    // An unused portal fades after a minute.
    if (g.portal && (g.portal.t -= dt) <= 0) { this.closePortal(); g.ui.toast('The portal closes.', 'warn'); }
    // Recall channel.
    if (this.recall) {
      this.recall.t += dt;
      if (Math.hypot(p.x - this.recall.x, p.z - this.recall.z) > 1.2) { this.recall = null; g.ui.toast('Recall cancelled: you moved.', 'warn'); }
      else if (this.recall.t >= this.recall.dur) {
        this.recall = null;
        if (g.profile.run) endRun(g.profile, 'fail');
        g.ui.fadeTravel(() => { g.enterZone('island', null); g.save('recall'); });
      }
    }
    g.ui?.channel(this.recall ? 'Returning to camp…' : null, this.recall ? this.recall.t / this.recall.dur : 0);
    if (!p.alive || g.inputBlocked) { this.focus = null; g.ui?.prompt(null); return; }
    this.focus = this.scan();
    g.ui?.prompt(this.focus ? this.focus.label : null, this.focus?.kind === 'node' && !this.focus.ok.ok);
    const inp = g.input;
    if (this.focus?.kind === 'item' && inp.wasPressed('interact')) { this.focus.it.act(); g.bus.emit('sfx', { id: 'ui' }); }
    else if (this.focus?.kind === 'node' && (inp.wasPressed('interact') || (inp.isDown('interact') && this.swingCd <= 0)) && this.swingCd <= 0) this.gather(this.focus);
    if (inp.wasPressed('recall')) this.startRecall();
  }

  startRecall() {
    const g = this.g, p = g.player;
    if (g.zone.type === 'island' && Math.hypot(p.x - g.zone.base.x, p.z - g.zone.base.z) < g.zone.base.r) { g.ui.toast('You are already in camp.'); return; }
    if (this.recall) { this.recall = null; return; }
    this.recall = { t: 0, dur: 6, x: p.x, z: p.z };
    g.bus.emit('sfx', { id: 'recall' });
  }
}
