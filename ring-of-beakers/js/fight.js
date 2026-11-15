// fight.js — a bout between two ragdolls. Each fighter has a small brain that picks actions from
// what its body can do; damage comes from real contacts (speed of the beak, spur or fist at the
// moment it lands, sharpness, mass, where it lands). Stamina and morale decide who lasts.
// Deterministic for a given seed and fixed step, so it runs headless for odds and tests. No DOM.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp } = RB.core;
  const PH = RB.physics;
  const DT = 1 / 120;
  const CMD_CD = { sic: 8, back: 6, whistle: 10 };
  const BASE = { beak: 6, foot: 9, fist: 5, wing: 5, body: 2.5 };
  const REF = { beak: 430, foot: 560, fist: 560, wing: 420, body: 200 }; // a typical landing speed for each weapon
  const KNOCK = { beak: 0.2, foot: 0.45, fist: 0.3, wing: 0.7, body: 0.9 };
  const LOC = { head: 1.7, neck: 1.35, body: 1, leg: 0.7 };
  const COST = { peck: 4.5, kick: 10, punch: 5, buffet: 6, shove: 7, dodge: 5 };

  class Fight {
    // o: { a, b: { P, name, auto (AI trainer; default true), bond (0..1), gear: { spurs, helmet, scarf }, hpFrac, fired (chili) },
    //      mode: 'pit' | 'push' | 'aerial', seed, timeLimit }
    constructor(o) {
      this.mode = o.mode || 'pit';
      this.rng = new Rng(o.seed || 1);
      this.world = new PH.World();
      this.t = 0; this.acc = 0; this.over = false; this.result = null; this.outro = 0; this.done = false;
      this.events = []; this.hitStop = 0; this.timeLimit = o.timeLimit || 60; this.touching = false;
      const Pa = o.a.P, Pb = o.b.P;
      const L = (this.L = Math.max(Pa.TL + Pa.NL + Pa.LLv, Pb.TL + Pb.NL + Pb.LLv));
      const W = (this.W = clamp(4.2 * L, 170, 950));
      const w = this.world;
      this.outY = Infinity; this.platforms = [];
      let startX = W * 0.5;
      if (this.mode === 'push') {
        const wp = W * 0.62, D = Math.max(L, Pa.rest * 1.4, Pb.rest * 1.4);
        this.platforms.push(w.box(-wp, 0, wp, 600));
        w.box(-W * 4, D, W * 4, 600);
        this.edge = wp; this.outY = D * 0.3; this.drop = D; startX = wp * 0.55;
      } else if (this.mode === 'aerial') {
        const D = Math.max(L * 1.3, Pa.rest * 1.6, Pb.rest * 1.6), pw = W * 0.34, gap = W * 0.2, th = Math.max(14, L * 0.12);
        this.platforms.push(w.box(-gap / 2 - pw, 0, -gap / 2, th), w.box(gap / 2, 0, gap / 2 + pw, th));
        w.box(-W * 4, D, W * 4, 600);
        this.edge = gap / 2 + pw; this.gap = gap; this.outY = D * 0.3; this.drop = D; startX = gap / 2 + pw * 0.6;
      } else {
        w.box(-W * 4, 0, W * 4, 600);
        w.box(-W * 4, -L * 12, -W, 0); w.box(W, -L * 12, W * 4, 0);
        this.edge = W;
      }
      this.fighters = [this.mkFighter(0, o.a, -startX, 1), this.mkFighter(1, o.b, startX, -1)];
      this.fighters[0].tg = this.targets(this.fighters[1].rag); this.fighters[1].tg = this.targets(this.fighters[0].rag);
      w.solvers.push(this);
    }

    mkFighter(side, o, x, f) {
      const P = o.P, rng = this.rng;
      const rag = new RB.creature.Rag(this.world, P, x, 0, f);
      rag.fists = P.armL > 0;
      const g = this.world.g;
      const peckR = P.NL + P.HR + P.BL + 0.2 * P.TL, kickR = 0.4 * P.LL + 0.95 * P.jumpV * P.jumpV / g;
      const wPeck = P.peckSharp * BASE.beak * (P.hasBeak ? 1 : 0.6), wKick = P.kickSharp * BASE.foot * 0.55, wPunch = P.punchSharp * BASE.fist * 1.1;
      const wWing = P.wingSharp * BASE.wing;
      const best = Math.max(wPeck, wKick, wPunch, wWing);
      const prefer = best === wKick ? kickR * 0.7 : best === wPunch ? (P.armL + 0.2 * P.TL) * 0.8 : best === wWing ? P.WL * 0.45 : peckR * 0.8;
      return { side, P, rag, name: o.name || '', hp: P.hpMax * (o.hpFrac === undefined ? 1 : o.hpFrac), hpMax: P.hpMax, stam: P.stamMax, stamMax: P.stamMax,
        morale: o.gear && o.gear.scarf ? 100 : 55 + 45 * P.courage, cd: 0.4 + rng.next() * 0.5, think: rng.next() * 0.2, turnT: 0, want: 0, resting: false, flee: false, fleeT: 0,
        frenzy: o.fired ? 6 : 0, backoff: 0, focusNext: false, cmdCd: { sic: 0, back: 0, whistle: 0 }, auto: o.auto !== false, bond: o.bond || 0, gear: o.gear || {},
        dmg: 0, downs: 0, hits: 0, stag: 0, lastHurt: -9, trainerT: 1 + rng.next(), peckR, kickR, wPeck, wKick, wPunch, wWing, prefer, tg: null };
    }
    targets(fr) {
      const head = { x: 0, y: 0 }, body = { x: 0, y: 0 };
      return {
        head: () => { head.x = fr.head.x; head.y = fr.head.y; return head; },
        body: () => { body.x = fr.C.x * 0.6 + fr.H.x * 0.4; body.y = fr.C.y * 0.6 + fr.H.y * 0.4; return body; },
      };
    }

    // Body-against-body collisions, on every solver iteration.
    solve() {
      const A = this.fighters[0].rag, B = this.fighters[1].rag, ra = A.P.TD / 2, rb = B.P.TD / 2;
      let touch = false;
      if (PH.resolveParticleCapsule(A.H, ra, B.H, B.C, rb)) touch = true;
      if (PH.resolveParticleCapsule(A.C, ra, B.H, B.C, rb)) touch = true;
      if (PH.resolveParticleCapsule(B.H, rb, A.H, A.C, ra)) touch = true;
      if (PH.resolveParticleCapsule(B.C, rb, A.H, A.C, ra)) touch = true;
      PH.resolveParticleCapsule(A.head, A.P.HR, B.H, B.C, rb);
      PH.resolveParticleCapsule(B.head, B.P.HR, A.H, A.C, ra);
      PH.resolveParticles(A.head, B.head, A.P.HR, B.P.HR);
      if (touch) this.touching = true;
    }

    update(frameDt) {
      if (this.done) return;
      if (this.hitStop > 0) { this.hitStop -= frameDt; return; }
      this.acc = Math.min(this.acc + frameDt, 0.1);
      while (this.acc >= DT && !this.done) { this.step(); this.acc -= DT; if (this.hitStop > 0) break; }
    }

    step() {
      const a = this.fighters[0], b = this.fighters[1];
      this.t += DT;
      if (!this.over) {
        this.brain(a, b); this.brain(b, a);
        if (a.auto) this.trainer(a, b);
        if (b.auto) this.trainer(b, a);
      } else this.outroBrain();
      a.rag.control(DT); b.rag.control(DT);
      this.touching = false;
      this.world.step(DT);
      a.rag.post(); b.rag.post();
      if (!this.over) { this.weapons(a, b); this.weapons(b, a); }
      this.upkeep(a); this.upkeep(b);
      if (!this.over) this.checkEnd();
      else { this.outro += DT; if (this.outro > 2.6) this.done = true; }
    }

    brain(me, foe) {
      const rag = me.rag, fr = foe.rag, P = me.P, rng = this.rng, st = rag.state;
      if (st === 'ko' || st === 'down' || st === 'rise') { rag.vxDes = 0; return; }
      const dx = fr.midX() - rag.midX(), dir = dx >= 0 ? 1 : -1;
      // face the foe (or away from it when running)
      const faceWant = me.flee ? -dir : dir;
      if (faceWant !== rag.f && !rag.act && st === 'stand') { me.turnT += DT; if (me.turnT > 0.15) { rag.flip(); me.turnT = 0; } } else me.turnT = 0;
      me.think -= DT;
      const gap = Math.abs(fr.C.x - rag.C.x) - foe.P.TD / 2;
      if (me.think <= 0) {
        me.think = (0.1 + 0.12 * rng.next()) / P.reflex;
        if (me.stam < 0.15 * me.stamMax) me.resting = true; else if (me.stam > 0.45 * me.stamMax) me.resting = false;
        // dodge an attack that is winding up
        const fa = fr.act;
        if (fa && fa.phase === 0 && !fa.seen && fa.type !== 'duck' && st === 'stand' && !rag.act) {
          fa.seen = true;
          if (me.stam >= COST.dodge && rng.chance(0.08 + 0.5 * P.cunning * Math.min(1, P.reflex))) {
            me.stam -= COST.dodge;
            if (rng.chance(0.5) && this.roomBehind(me, dir) > P.TL) rag.hop(-dir * P.jumpV * 0.5, -P.jumpV * 0.35); else rag.startDuck(0.3);
            this.events.push({ type: 'dodge', side: me.side });
          }
        }
        // attack
        if (me.cd <= 0 && !rag.act && rag.state === 'stand' && !me.resting && me.backoff <= 0 && !me.flee && rag.f === dir) this.attack(me, foe, gap, dir);
        // movement
        let want;
        if (me.flee) want = -1;
        else if (me.backoff > 0 || me.resting) want = gap < me.prefer * 1.8 + this.L * 0.4 ? -0.8 : 0;
        else if (gap > me.prefer) want = (0.55 + 0.45 * P.aggression) * (me.frenzy > 0 ? 1.3 : 1);
        else if (gap < me.prefer * 0.4 && rng.chance(0.3 + 0.5 * P.cunning)) want = -0.5;
        else want = rng.chance(0.2) ? rng.range(-0.25, 0.35) : 0;
        if (want < 0 && this.roomBehind(me, dir) < P.TL * 0.7) want = 0; // back to the wall or the edge
        if (want > 0 && this.mode !== 'pit' && this.roomAhead(me, dir) < P.TL * 0.4 && !this.samePlatform(me, foe)) want = 0;
        me.want = want;
      }
      const sp = P.speedMax * (me.stam < 0.1 * me.stamMax ? 0.55 : 1);
      rag.vxDes = rag.act && rag.act.type === 'shove' ? dir * sp : me.want * dir * sp;
      if (rag.act && rag.act.type === 'duck') rag.vxDes = 0;
    }
    // Free distance behind a fighter before a wall or an edge.
    roomBehind(me, dir) { const x = me.rag.midX(); return this.mode === 'aerial' ? this.aerialRoom(x, -dir) : dir > 0 ? x + this.edge : this.edge - x; }
    roomAhead(me, dir) { const x = me.rag.midX(); return this.mode === 'aerial' ? this.aerialRoom(x, dir) : dir > 0 ? this.edge - x : x + this.edge; }
    aerialRoom(x, dir) {
      for (const b of this.platforms) if (x >= b.x0 && x <= b.x1) return dir > 0 ? b.x1 - x : x - b.x0;
      return 0;
    }
    samePlatform(me, foe) {
      if (this.mode !== 'aerial') return true;
      return Math.sign(me.rag.midX()) === Math.sign(foe.rag.midX());
    }

    attack(me, foe, gap, dir) {
      const rag = me.rag, fr = foe.rag, P = me.P, rng = this.rng;
      const opts = [];
      const dHead = Math.hypot(fr.head.x - rag.C.x, fr.head.y - rag.C.y), b = me.tg.body(), dBody = Math.hypot(b.x - rag.C.x, b.y - rag.C.y) - foe.P.TD * 0.4;
      const headOk = dHead < me.peckR, bodyOk = dBody < me.peckR;
      if (headOk || bodyOk) opts.push(['peck', me.wPeck]);
      if (gap < me.kickR * 0.8 && rag.planted > 0) opts.push(['kick', me.wKick * (me.stam > COST.kick * 2 ? 1 : 0.4)]);
      if (rag.hands.length && gap < P.armL + 0.2 * P.TL) opts.push(['punch', me.wPunch]);
      if (me.wWing > 0 && gap < P.WL * 0.6) opts.push(['buffet', me.wWing]);
      if (gap < P.TD * 0.6 + 4) {
        let ws = 0.6 + 2 * clamp(P.massRel / foe.P.massRel - 1, 0, 1.5);
        if (this.mode !== 'pit' && this.roomBehind(foe, -dir) < this.L * 1.2) ws += 3;
        opts.push(['shove', ws]);
      }
      // cross a gap by leaping at the foe
      if (!opts.length && this.mode === 'aerial' && !this.samePlatform(me, foe) && this.roomAhead(me, dir) < P.TL && gap < me.kickR * 1.6) opts.push(['kick', 1]);
      if (!opts.length) return;
      const pick = rng.weighted(opts, (o) => o[1] * o[1])[0];
      const cost = COST[pick] / Math.pow(P.muscle, 0.3) * (me.frenzy > 0 ? 1.3 : 1);
      if (me.stam < cost) { me.resting = true; return; }
      let ok = false;
      const aimHead = me.focusNext || rng.chance(0.2 + 0.55 * P.focus);
      if (pick === 'peck') ok = rag.startPeck(headOk && (aimHead || !bodyOk) ? me.tg.head : me.tg.body, me.stam < 0.25 * me.stamMax ? 1.5 : 1);
      else if (pick === 'kick') ok = rag.startKick(aimHead && P.jumpV > 220 ? me.tg.head : me.tg.body);
      else if (pick === 'punch') ok = rag.startPunch(aimHead ? me.tg.head : me.tg.body);
      else if (pick === 'buffet') ok = rag.startBuffet();
      else ok = rag.startShove();
      if (!ok) return;
      me.stam -= cost;
      me.cd = (0.5 + 0.5 * rng.next()) / (P.reflex * (0.55 + 0.9 * P.aggression)) * (me.frenzy > 0 ? 0.5 : 1);
      this.events.push({ type: 'swing', side: me.side, how: pick });
    }

    // The corner: an AI trainer shouting the same three commands the player has.
    trainer(me, foe) {
      me.trainerT -= DT;
      if (me.trainerT > 0) return;
      const rng = this.rng;
      me.trainerT = 0.5 + rng.next() * 0.5;
      const foeDown = foe.rag.state === 'down' || foe.rag.state === 'rise';
      if (me.cmdCd.whistle <= 0 && (me.flee || me.morale < 18)) this.command(me.side, 'whistle');
      else if (me.cmdCd.sic <= 0 && me.stam > 0.4 * me.stamMax && (foeDown || foe.stam < 0.2 * foe.stamMax || rng.chance(0.08))) this.command(me.side, 'sic');
      else if (me.cmdCd.back <= 0 && (me.stam < 0.15 * me.stamMax || (me.hp < 0.3 * me.hpMax && rng.chance(0.3)))) this.command(me.side, 'back');
    }

    // cmd: 'sic' | 'back' | 'whistle' | 'towel'. Returns false if it could not be given.
    command(side, cmd) {
      const me = this.fighters[side];
      if (this.over) return false;
      if (cmd === 'towel') { this.finish(1 - side, 'towel'); return true; }
      if (me.cmdCd[cmd] > 0) return false;
      me.cmdCd[cmd] = CMD_CD[cmd];
      const obey = this.rng.chance(Math.min(0.97, 0.45 + 0.4 * me.P.focus + 0.25 * me.bond));
      this.events.push({ type: 'cmd', side, cmd, obey });
      if (!obey) return true;
      if (cmd === 'sic') { me.frenzy = 3.2; me.morale = Math.min(100, me.morale + 15); me.resting = false; me.backoff = 0; me.cd = Math.min(me.cd, 0.1); }
      else if (cmd === 'back') { me.backoff = 2.4; me.frenzy = 0; }
      else { me.focusNext = true; me.morale = Math.min(100, me.morale + 28); me.flee = false; me.fleeT = 0; if (me.rag.state === 'down') me.rag.downDur -= 0.5; }
      return true;
    }

    hitTest(rag, x, y, r) {
      const P = rag.P;
      let h = PH.circleCapsule(x, y, r, rag.head.x, rag.head.y, rag.head.x, rag.head.y, P.HR);
      if (h) return { part: 'head', p: rag.head };
      let prev = rag.C;
      for (let i = 0; i < rag.neck.length - 1; i++) {
        const p = rag.neck[i];
        if (PH.circleCapsule(x, y, r, prev.x, prev.y, p.x, p.y, P.NT / 2)) return { part: 'neck', p };
        prev = p;
      }
      if (PH.circleCapsule(x, y, r, prev.x, prev.y, rag.head.x, rag.head.y, P.NT / 2)) return { part: 'neck', p: rag.head };
      h = PH.circleCapsule(x, y, r, rag.H.x, rag.H.y, rag.C.x, rag.C.y, P.TD / 2);
      if (h) return { part: 'body', p: h.t > 0.5 ? rag.C : rag.H };
      for (const leg of rag.legs) {
        if (PH.circleCapsule(x, y, r, rag.ax(leg), rag.ay(leg), leg.foot.x, leg.foot.y, P.LT)) return { part: 'leg', p: rag.H };
      }
      return null;
    }

    weapons(att, def) {
      const rag = att.rag, w = rag.weapon, P = att.P;
      if (!w || !rag.act) return;
      let x, y, r, vx, vy;
      if (w === 'body') {
        if (!this.touching) return;
        const rel = Math.abs(rag.vx() - def.rag.vx()) + 60;
        this.onHit(att, def, w, { part: 'body', p: def.rag.C }, rel, rag.C.x + rag.f * P.TD / 2, rag.C.y, rag.f, -0.15);
        return;
      }
      if (w === 'beak') {
        if (P.hasBeak) { const tip = rag.beakTip(); x = tip.x; y = tip.y; r = Math.max(1.5, P.BD * 0.5); } else { x = rag.head.x; y = rag.head.y; r = P.HR * 0.9; }
        vx = rag.head.vx; vy = rag.head.vy;
      } else if (w === 'foot') { const F = rag.weaponLeg.foot; x = F.x; y = F.y; r = P.FL * 0.6 + P.LT * 1.5; vx = F.vx; vy = F.vy; }
      else if (w === 'wing') { x = rag.C.x + rag.f * (P.TD * 0.4 + P.WL * 0.4); y = rag.C.y - P.WL * 0.1; r = P.WL * 0.45; vx = rag.vx() + rag.f * 380 * P.muscle; vy = 60; }
      else { const p = rag.weaponHand.p; x = p.x; y = p.y; r = P.LT * 1.3; vx = p.vx; vy = p.vy; }
      const hit = this.hitTest(def.rag, x, y, r) || this.hitTest(def.rag, x - vx * DT * 0.5, y - vy * DT * 0.5, r);
      if (!hit) return;
      const rel = Math.hypot(vx - hit.p.vx, vy - hit.p.vy), sp = Math.hypot(vx, vy) || 1;
      this.onHit(att, def, w, hit, rel, x, y, vx / sp, vy / sp);
    }

    onHit(att, def, w, hit, rel, x, y, ux, uy) {
      const A = att.P, D = def.P, rng = this.rng;
      const sharp = w === 'beak' ? A.peckSharp : w === 'foot' ? A.kickSharp : w === 'fist' ? A.punchSharp : w === 'wing' ? A.wingSharp : 0.18;
      let dmg = BASE[w] * sharp * Math.pow(clamp(rel / REF[w], 0.25, 2.2), 1.1) * Math.pow(A.massRel, 0.38) * LOC[hit.part] * rng.range(0.85, 1.15) / Math.pow(D.hide, 0.6);
      const crit = hit.part === 'head';
      if (att.frenzy > 0) dmg *= 1.15;
      if (att.focusNext && w !== 'body') { if (crit) dmg *= 1.4; att.focusNext = false; }
      if (def.backoff > 0 || def.rag.guard) dmg *= 0.6;
      if (A.twoHeads && w === 'beak') dmg *= 1.25;
      if (att.gear.spurs && w === 'foot') dmg *= 1.2;
      if (def.gear.helmet && crit) dmg *= 0.75;
      def.hp -= dmg; att.dmg += dmg; att.hits++; def.lastHurt = this.t;
      att.rag.act.hit = true;
      const dv = Math.min(340, Math.pow(A.massRel, 0.9) * rel * KNOCK[w] / D.massRel);
      def.rag.push(ux * dv, clamp(uy * dv * 0.5 - (w === 'foot' ? dv * 0.12 : 0), -170, 140), crit ? 'head' : 'body');
      if (w === 'beak') { att.rag.head.vx *= -0.2; att.rag.head.vy *= -0.2; }
      def.stag += dv / (420 * D.balance);
      const big = dmg > 0.2 * def.hpMax, st = def.rag.state;
      if ((def.stag >= 1 || big) && st !== 'down' && st !== 'ko' && def.hp > 0) {
        def.stag = 0; def.downs++;
        def.rag.knockdown(0.6 + 0.7 * rng.next() + (big ? 0.4 : 0));
        this.events.push({ type: 'down', side: def.side });
      }
      const frac = dmg / def.hpMax * 100;
      def.morale -= frac * (1.5 - 1.1 * D.courage); att.morale = Math.min(100, att.morale + frac * 0.35);
      this.events.push({ type: 'hit', x, y, dmg, weapon: w, part: hit.part, crit, side: att.side });
      this.hitStop = clamp(dmg / def.hpMax * 0.6, 0.02, 0.12);
      if (def.hp <= 0) { def.hp = 0; def.rag.ko(); this.finish(att.side, 'ko'); }
    }

    upkeep(me) {
      const P = me.P, rag = me.rag;
      me.cd -= DT; me.frenzy = Math.max(0, me.frenzy - DT); me.backoff = Math.max(0, me.backoff - DT);
      me.cmdCd.sic = Math.max(0, me.cmdCd.sic - DT); me.cmdCd.back = Math.max(0, me.cmdCd.back - DT); me.cmdCd.whistle = Math.max(0, me.cmdCd.whistle - DT);
      me.stag = Math.max(0, me.stag - DT * 0.45);
      const sp = Math.abs(rag.vx()) / Math.max(1, P.speedMax);
      const regen = 5.5 * P.lungs * (me.backoff > 0 || me.resting ? 2.2 : 1) * (me.frenzy > 0 ? 0.5 : 1) - 2.5 * sp * sp;
      me.stam = clamp(me.stam + regen * DT, 0, me.stamMax);
      if (this.t - me.lastHurt > 2) me.morale = Math.min(100, me.morale + 2 * DT);
      if (!this.over && !me.flee && me.morale <= 0 && P.courage < 0.85) { me.flee = true; this.events.push({ type: 'flee', side: me.side }); }
      if (me.flee) me.fleeT += DT;
      rag.eye = rag.state === 'ko' ? 'ko' : me.flee ? 'scared' : rag.state === 'down' ? 'blink' : me.frenzy > 0 || (rag.act && rag.act.type !== 'duck') ? 'angry' : '';
    }

    checkEnd() {
      for (let s = 0; s < 2; s++) {
        const me = this.fighters[s];
        if (me.fleeT > 2.6) return this.finish(1 - s, 'fled');
        if (me.rag.midY() > this.outY) return this.finish(1 - s, 'ringout');
      }
      if (this.t >= this.timeLimit) {
        const a = this.fighters[0], b = this.fighters[1];
        const sa = a.dmg / b.hpMax * 100 + 8 * b.downs, sb = b.dmg / a.hpMax * 100 + 8 * a.downs;
        let win;
        if (Math.abs(sa - sb) > 0.5) win = sa > sb ? 0 : 1;
        else if (Math.abs(a.hp / a.hpMax - b.hp / b.hpMax) > 0.01) win = a.hp / a.hpMax > b.hp / b.hpMax ? 0 : 1;
        else win = this.rng.chance(0.5) ? 0 : 1;
        this.finish(win, 'decision');
      }
    }

    finish(winner, how) {
      if (this.over) return;
      this.over = true;
      const a = this.fighters[0], b = this.fighters[1];
      for (const f of this.fighters) { if (f.rag.act) f.rag.endAct(); f.rag.vxDes = 0; }
      this.result = { winner, how, t: this.t, hp: [a.hp / a.hpMax, b.hp / b.hpMax], dmg: [a.dmg, b.dmg], downs: [a.downs, b.downs], hits: [a.hits, b.hits] };
      this.events.push({ type: 'end', winner, how });
    }

    outroBrain() {
      const win = this.fighters[this.result.winner], lose = this.fighters[1 - this.result.winner];
      win.rag.vxDes = 0; lose.rag.vxDes = 0;
      const rag = win.rag;
      if (rag.state === 'stand') {
        rag.beakOpen = 0.9;
        if (Math.floor(this.outro * 2.5) !== Math.floor((this.outro - DT) * 2.5)) { rag.wingV = 14; if (win.P.jumpV > 60) { rag.hop(0, -win.P.jumpV * 0.4); } }
      }
    }

    // Run to the end without rendering. Returns the result.
    run(maxT) {
      const cap = (maxT || this.timeLimit + 5) / DT;
      for (let i = 0; i < cap && !this.over; i++) this.step();
      if (!this.over) this.checkEnd();
      return this.result;
    }
  }

  // Chance that a beats b, from n quick headless bouts.
  function estimate(a, b, mode, n, seed) {
    let wins = 0, total = 0;
    for (let i = 0; i < n; i++) {
      const r = new Fight({ a, b, mode, seed: (seed || 1) * 7919 + i * 104729 }).run();
      if (r) { total++; if (r.winner === 0) wins++; }
    }
    return total ? wins / total : 0.5;
  }

  RB.fight = { Fight, estimate, DT, CMD_CD };
})();
