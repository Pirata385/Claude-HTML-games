// fight.js — a bout between two ragdolls. Each fighter has a small brain that picks actions from
// what its body can do; damage comes from real contacts (speed of the beak, spur or fist at the
// moment it lands, sharpness, mass, where it lands). Stamina and morale decide who lasts.
// Every bout is fought in a walled pit: nobody falls out. Each arena adds its own twist instead
// (see TWISTS). Deterministic for a given seed and fixed step, so it runs headless for odds and
// tests. No DOM.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp } = RB.core;
  const PH = RB.physics;
  const DT = 1 / 120;
  const CMD_CD = { sic: 8, back: 6, whistle: 10 };
  const BASE = { beak: 6, foot: 9, fist: 5, wing: 5, body: 2.5 };
  const REF = { beak: 430, foot: 560, fist: 560, wing: 420, body: 200 }; // a typical landing speed for each weapon
  // The pace of a bout: one scale on every blow, the same for both birds (so it never changes who is
  // likelier to win), set per weight class so that a bout lasts about twenty-five seconds on average.
  // Small birds land light blows on light bodies and big ones hit hard and fast, so each class has its
  // own (Gnat to Titan); a bout between classes takes the mean of the two. TUNE.damage scales them all.
  const PACE = [7, 1.5, 0.9, 1.02, 0.64, 0.54, 0.68];
  const TUNE = { damage: 1 };
  const paceOf = (P) => PACE[P.weightClass] || 1;
  const KNOCK = { beak: 0.2, foot: 0.45, fist: 0.3, wing: 0.7, body: 0.9 };
  const LOC = { head: 1.7, neck: 1.35, body: 1, leg: 0.7 };
  const COST = { peck: 4.5, kick: 10, punch: 5, buffet: 6, shove: 7, dodge: 5 };

  // What each arena does in place of ring-outs. [name, what it does]
  const TWISTS = {
    pit: ['Pit fight', 'A plain walled pit.'],
    grain: ['Grain toss', 'The crowd tosses grain into the pit: a fighter that gets to it first eats and gets its wind back.'],
    mud: ['Mud pit', 'A bog in the middle of the ring: slow going in it, and easy to knock off your feet.'],
    wind: ['Wind tunnel', 'Big fans blow gusts across the ring, one way then the other: light birds get pushed about.'],
    dark: ['Lights out', 'Now and then the lights go out: big eyes and a steady head still find their mark.'],
    rounds: ['Three rounds', 'Best of three rounds with a breather between them: a knockout (or a bird that runs) takes the round, time decides it on points, and the beaten bird gets up for the next.'],
  };
  const LEGACY = { push: 'mud', aerial: 'wind' }; // the old falling modes

  class Fight {
    // o: { a, b: { P, name, auto (AI trainer; default true), bond (0..1), gear: { spurs, helmet, scarf }, hpFrac, fired (chili) },
    //      mode: a twist from TWISTS (default 'pit'), seed, timeLimit }
    constructor(o) {
      this.mode = LEGACY[o.mode] || (TWISTS[o.mode] ? o.mode : 'pit');
      this.rng = new Rng(o.seed || 1);
      this.world = new PH.World();
      this.t = 0; this.acc = 0; this.over = false; this.result = null; this.outro = 0; this.done = false;
      this.events = []; this.hitStop = 0; this.timeLimit = o.timeLimit || 60; this.touching = false;
      this.pace = TUNE.damage * Math.sqrt(paceOf(o.a.P) * paceOf(o.b.P));
      const Pa = o.a.P, Pb = o.b.P;
      const L = (this.L = Math.max(Pa.TL + Pa.NL + Pa.LLv, Pb.TL + Pb.NL + Pb.LLv));
      const W = (this.W = clamp(4.2 * L, 170, 950));
      const w = this.world;
      // the pit: a floor and two walls
      w.box(-W * 4, 0, W * 4, 600);
      w.box(-W * 4, -L * 12, -W, 0); w.box(W, -L * 12, W * 4, 0);
      this.edge = W;
      const startX = W * 0.5;
      // the twist's own state (numbers drawn from their own stream, so a plain pit fights as before)
      this.tr = new Rng(((o.seed || 1) ^ 0x7157) >>> 0);
      if (this.mode === 'grain') { this.grain = []; this.grainT = 4 + this.tr.next() * 3; }
      else if (this.mode === 'mud') this.mudW = W * 0.34;
      else if (this.mode === 'wind') { this.gust = 0; this.gustDir = this.tr.chance(0.5) ? 1 : -1; this.windT = 4; this.gustOn = false; }
      else if (this.mode === 'dark') { this.dark = 0; this.darkT = 5 + this.tr.next() * 2; this.darkOn = false; }
      else if (this.mode === 'rounds') { this.round = 1; this.roundLen = o.roundLen || 30; this.roundT0 = 0; this.breakUntil = 0; this.roundDmg = [0, 0]; this.roundsWon = [0, 0]; }
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
      // Long-legged waders and stilt-walkers (herons, flamingos, cranes, storks, spoonbills, ibises,
      // avocets, the secretary bird...): legs long for the body, and a leap that carries far past a
      // standing kick. They should not fight by leaping about; they keep a flying kick for when the foe
      // falls back (see brain).
      const standR = 0.45 * P.LL + 0.25 * P.TL, leggy = P.legPairs === 1 && P.LLv / P.TL >= 1.25 && kickR / standR >= 3.5;
      return { side, P, rag, name: o.name || '', hp: P.hpMax * (o.hpFrac === undefined ? 1 : o.hpFrac), hpMax: P.hpMax, stam: P.stamMax, stamMax: P.stamMax,
        morale: o.gear && o.gear.scarf ? 100 : 55 + 45 * P.courage, cd: 0.4 + rng.next() * 0.5, think: rng.next() * 0.2, turnT: 0, want: 0, resting: false, flee: false, fleeT: 0,
        frenzy: o.fired ? 6 : 0, backoff: 0, focusNext: false, cmdCd: { sic: 0, back: 0, whistle: 0 }, auto: o.auto !== false, bond: o.bond || 0, gear: o.gear || {},
        dmg: 0, downs: 0, hits: 0, stag: 0, lastHurt: -9, trainerT: 1 + rng.next(), peckR, kickR, wPeck, wKick, wPunch, wWing, prefer, tg: null,
        standR, leggy, fly: null, flyCd: 1.5 + 2 * rng.next(), flyKicks: 0 };
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
        this.twist();
        this.brain(a, b); this.brain(b, a);
        // a gust carries a bird along whatever it wants to do: the lighter, the further
        if (this.gust > 0.01) for (const me of this.fighters) me.rag.vxDes += this.gustDir * this.gust * Math.min(me.P.speedMax * 0.9, 150 / Math.sqrt(me.P.massRel));
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
          if (me.stam >= COST.dodge && rng.chance((0.08 + 0.5 * P.cunning * Math.min(1, P.reflex)) * (this.dark > 0.5 ? this.sight(me) : 1))) {
            me.stam -= COST.dodge;
            // long legs leap far: a wader mostly ducks, and when it does hop back it is a short one
            const hopBack = rng.chance(me.leggy ? 0.2 : 0.5) && this.roomBehind(me, dir) > P.TL, hk = me.leggy ? 0.55 : 1;
            if (hopBack) rag.hop(-dir * P.jumpV * 0.5 * hk, -P.jumpV * 0.35 * hk); else rag.startDuck(0.3);
            this.events.push({ type: 'dodge', side: me.side });
          }
        }
        // The flying kick: when the foe falls back, a long-legged bird falls back a step too, then
        // throws itself at it feet first, with everything it has.
        // A bird that has gone down is given room to get up again: no blows, a step back. Only its
        // owner's "Sic 'em!" (frenzy) sends the other one in regardless.
        const sporting = (fr.state === 'down' || fr.state === 'rise' || fr.state === 'ko') && me.frenzy <= 0;
        const away = (fr.vx() * dir > 40 && fr.state === 'stand') || foe.want < -0.2 || foe.backoff > 0 || foe.flee;
        if (me.leggy && !sporting && !me.fly && me.flyCd <= 0 && away && st === 'stand' && !rag.act && !me.resting && !me.flee && me.backoff <= 0 && rag.f === dir
          && gap > me.standR * 1.6 && gap < me.kickR * 0.8 && me.stam > COST.kick * 3) { // from a few lengths off, not up close
          me.fly = { t: 0.28 + 0.14 * rng.next() };
          this.events.push({ type: 'flyready', side: me.side });
        }
        // attack
        if (!sporting && !me.fly && me.cd <= 0 && !rag.act && rag.state === 'stand' && !me.resting && me.backoff <= 0 && !me.flee && rag.f === dir) this.attack(me, foe, gap, dir);

        // movement
        let want;
        if (me.flee) want = -1;
        else if (me.backoff > 0 || me.resting) want = gap < me.prefer * 1.8 + this.L * 0.4 ? -0.8 : 0;
        else if (gap > me.prefer) want = (0.55 + 0.45 * P.aggression) * (me.frenzy > 0 ? 1.3 : 1);
        else if (gap < me.prefer * 0.4 && rng.chance(0.3 + 0.5 * P.cunning)) want = -0.5;
        else want = rng.chance(0.2) ? rng.range(-0.25, 0.35) : 0;
        // grain on the floor: a tired bird goes for it
        const g = this.grain && !me.flee ? this.nearGrain(rag.midX()) : null;
        if (g && (me.resting || me.backoff > 0 || me.stam < 0.6 * me.stamMax)) want = Math.sign(g.x - rag.midX()) * dir * 0.9;
        if (sporting && !me.flee) want = gap < me.prefer * 1.5 + foe.P.TL * 0.6 ? -0.5 : 0; // give it room
        if (want < 0 && this.roomBehind(me, dir) < P.TL * 0.7) want = 0; // back to the wall
        me.want = want;
      }
      if (me.fly) { // gathering for the flying kick: a step back, then the leap
        me.fly.t -= DT;
        me.want = this.roomBehind(me, dir) > P.TL * 0.7 ? -0.55 : 0;
        if (st !== 'stand' || me.flee) me.fly = null;
        else if (me.fly.t <= 0 && !rag.act && rag.planted > 0 && rag.f === dir) {
          me.fly = null;
          // aim where the foe is going (it is backing away), and at the body if it is a small one
          // the leap is judged by eye: a bird with less focus misjudges it more often
          const err = (rng.next() - 0.5) * foe.P.TL * 2.2 * (1.15 - P.focus);
          const aim = foe.P.TL < P.TL * 0.6 || rng.chance(0.55) ? me.tg.body : me.tg.head, lead = () => { const q = aim(); return { x: q.x + fr.vx() * 0.3 + err, y: q.y }; };
          if (rag.startKick(lead, 0.6)) { // a long, low leap rather than a high one
            rag.act.fly = true; rag.act.v *= 1.3;
            me.stam -= COST.kick * 1.6; me.flyCd = 5 + 4 * rng.next(); me.cd = Math.max(me.cd, 0.6); me.flyKicks++;
            this.events.push({ type: 'flykick', side: me.side });
          }
        }
      }
      const sp = P.speedMax * (me.stam < 0.1 * me.stamMax ? 0.55 : 1) * (this.inMud(rag) ? 0.55 : 1);
      rag.vxDes = rag.act && rag.act.type === 'shove' ? dir * sp : me.want * dir * sp;
      if (rag.act && rag.act.type === 'duck') rag.vxDes = 0;
    }

    // ---- the arenas' twists
    inMud(rag) { return this.mudW !== undefined && Math.abs(rag.midX()) < this.mudW; }
    nearGrain(x) { let best = null; for (const g of this.grain) if (g.y >= 0 && (!best || Math.abs(g.x - x) < Math.abs(best.x - x))) best = g; return best; }
    // How well a fighter sees with the lights out: big eyes and focus help (owls barely notice).
    sight(me) { return clamp(0.2 + 0.5 * (me.P.eye - 0.6) + 0.35 * me.P.focus, 0.15, 1); }
    twist() {
      const tr = this.tr, W = this.W, L = this.L;
      if (this.mode === 'grain') {
        this.grainT -= DT;
        if (this.grainT <= 0) { this.grainT = tr.range(7, 11); if (this.grain.length < 2) { this.grain.push({ x: tr.range(-W * 0.7, W * 0.7), y: -L * 1.8, vy: 0, life: 10 }); this.events.push({ type: 'grain' }); } }
        for (const g of this.grain) {
          g.life -= DT;
          if (g.y < 0) { g.vy += 1100 * DT; g.y = Math.min(0, g.y + g.vy * DT); continue; }
          for (const me of this.fighters) {
            const rag = me.rag;
            if (g.life <= 0 || (rag.state !== 'stand' && rag.state !== 'rise') || Math.abs(rag.midX() - g.x) > me.P.TD * 0.5 + me.P.NL * 0.4 + 8) continue;
            g.life = 0;
            me.stam = Math.min(me.stamMax, me.stam + 0.35 * me.stamMax); me.hp = Math.min(me.hpMax, me.hp + 0.04 * me.hpMax); me.morale = Math.min(100, me.morale + 10);
            rag.startPeck(() => ({ x: g.x, y: -2 }));
            this.events.push({ type: 'eat', side: me.side, x: g.x });
          }
        }
        this.grain = this.grain.filter((g) => g.life > 0);
      } else if (this.mode === 'wind') {
        this.windT -= DT;
        if (this.windT <= 0) {
          this.gustOn = !this.gustOn;
          if (this.gustOn) { this.windT = tr.range(2, 2.8); this.gustDir = -this.gustDir; this.events.push({ type: 'gust', dir: this.gustDir }); } else this.windT = tr.range(4, 6);
        }
        this.gust += ((this.gustOn ? 1 : 0) - this.gust) * Math.min(1, DT * 4);
        if (this.gust > 0.01) for (const me of this.fighters) {
          const a = this.gustDir * this.gust * 520 / Math.sqrt(me.P.massRel) * DT * (me.rag.state === 'stand' ? 0.6 : 1);
          for (const p of me.rag.parts) if (p.im > 0) p.vx += a;
        }
      } else if (this.mode === 'dark') {
        this.darkT -= DT;
        if (this.darkT <= 0) { this.darkOn = !this.darkOn; this.darkT = this.darkOn ? tr.range(3, 4.5) : tr.range(5, 7); this.events.push({ type: this.darkOn ? 'dark' : 'light' }); }
        this.dark += ((this.darkOn ? 1 : 0) - this.dark) * Math.min(1, DT * (this.darkOn ? 6 : 3));
      } else if (this.mode === 'rounds') {
        if (this.t >= this.breakUntil && this.t - this.roundT0 >= this.roundLen) this.endRound(); // time: on points
      }
    }
    // Time left on the clock: of this round in a bout of rounds, else of the bout.
    timeLeft() { return this.roundsWon ? Math.max(0, this.roundLen - Math.max(0, this.t - this.roundT0)) : Math.max(0, this.timeLimit - this.t); }
    // A round ends (w: who took it, -1 for nobody; how: 'ko', 'fled' or, by default, on points).
    // Best of three: two rounds won take the bout; otherwise both get a breather, the beaten bird gets
    // back up with some of its health, and the next round starts.
    endRound(w, how) {
      if (w === undefined) { const d = this.roundDmg; w = Math.abs(d[0] - d[1]) < 0.5 ? -1 : d[0] > d[1] ? 0 : 1; how = 'points'; }
      if (w >= 0) this.roundsWon[w]++;
      const rw = this.roundsWon;
      if (rw[0] >= 2 || rw[1] >= 2 || this.round >= 3) {
        let win = rw[0] !== rw[1] ? (rw[0] > rw[1] ? 0 : 1) : -1;
        if (win < 0) { const a = this.fighters[0], b = this.fighters[1], sa = a.dmg / b.hpMax, sb = b.dmg / a.hpMax; win = Math.abs(sa - sb) > 1e-3 ? (sa > sb ? 0 : 1) : this.rng.chance(0.5) ? 0 : 1; }
        this.finish(win, how === 'ko' && win === w ? 'ko' : how === 'fled' && win === w ? 'fled' : 'rounds');
        return;
      }
      this.round++; this.roundDmg = [0, 0];
      const BREAK = 3;
      this.breakUntil = this.t + BREAK; this.roundT0 = this.t + BREAK;
      for (const me of this.fighters) {
        me.backoff = BREAK; me.frenzy = 0; me.flee = false; me.fleeT = 0; me.fly = null;
        me.stam = Math.min(me.stamMax, me.stam + 0.5 * me.stamMax); me.morale = Math.max(me.morale, 50) + (me.side === w ? 25 : 10); me.morale = Math.min(100, me.morale);
        me.hp = Math.max(me.hp + 0.15 * me.hpMax, 0.35 * me.hpMax); me.hp = Math.min(me.hp, me.hpMax);
        const r = me.rag;
        if (r.state === 'ko') { r.dead = false; r.state = 'down'; r.stateT = 0; r.downDur = BREAK * 0.5; r.eye = 'blink'; } // knocked out: it comes round in the breather
      }
      this.events.push({ type: 'round', n: this.round, winner: w, how });
    }
    // Free distance behind or ahead of a fighter before a wall.
    roomBehind(me, dir) { const x = me.rag.midX(); return dir > 0 ? x + this.edge : this.edge - x; }
    roomAhead(me, dir) { const x = me.rag.midX(); return dir > 0 ? this.edge - x : x + this.edge; }

    attack(me, foe, gap, dir) {
      const rag = me.rag, fr = foe.rag, P = me.P, rng = this.rng;
      const opts = [];
      const dHead = Math.hypot(fr.head.x - rag.C.x, fr.head.y - rag.C.y), b = me.tg.body(), dBody = Math.hypot(b.x - rag.C.x, b.y - rag.C.y) - foe.P.TD * 0.4;
      const headOk = dHead < me.peckR, bodyOk = dBody < me.peckR;
      if (headOk || bodyOk) opts.push(['peck', me.wPeck]);
      // A kick reaches as far as a leap carries, and long legs leap a long way (a heron's or a
      // flamingo's from five body lengths off). From beyond a standing kick, that flying kick is for
      // birds that fight with their feet; the others mostly close in to peck instead (they used to
      // leap in from afar again and again, and seldom landed a blow).
      const standR = me.standR, restrain = me.wKick < me.wPeck || me.leggy; // peckers, and every long-legged wader
      if (gap < me.kickR * 0.8 && rag.planted > 0) opts.push(['kick', me.wKick * (me.stam > COST.kick * 2 ? 1 : 0.4) * (gap > standR && restrain ? (me.leggy ? 0.3 : 0.45) : 1)]);
      if (!headOk && !bodyOk && gap > standR && restrain) opts.push(['close', Math.max(me.wPeck, me.wPunch, me.leggy ? me.wKick * 0.7 : 0) * 0.45]);
      if (rag.hands.length && gap < P.armL + 0.2 * P.TL) opts.push(['punch', me.wPunch]);
      if (me.wWing > 0 && gap < P.WL * 0.6) opts.push(['buffet', me.wWing]);
      if (gap < P.TD * 0.6 + 4) opts.push(['shove', 0.6 + 2 * clamp(P.massRel / foe.P.massRel - 1, 0, 1.5) + (this.inMud(fr) ? 1.5 : 0)]);
      if (!opts.length) return;
      const pick = rng.weighted(opts, (o) => o[1] * o[1])[0];
      if (pick === 'close') { me.cd = 0.2 + 0.2 * rng.next(); return; } // step in, and think again in a moment
      const cost = COST[pick] / Math.pow(P.muscle, 0.3) * (me.frenzy > 0 ? 1.3 : 1);
      if (me.stam < cost) { me.resting = true; return; }
      let ok = false;
      const aimHead = me.focusNext || rng.chance(0.2 + 0.55 * P.focus);
      // with the lights out a blow goes where the bird thinks the other one is
      let tHead = me.tg.head, tBody = me.tg.body;
      if (this.dark > 0.5) {
        const miss = 1 - this.sight(me), jx = this.tr.range(-1, 1) * this.L * 0.45 * miss, jy = this.tr.range(-1, 1) * this.L * 0.25 * miss;
        const off = (fn) => () => { const p = fn(); return { x: p.x + jx, y: p.y + jy }; };
        tHead = off(tHead); tBody = off(tBody);
      }
      if (pick === 'peck') ok = rag.startPeck(headOk && (aimHead || !bodyOk) ? tHead : tBody, me.stam < 0.25 * me.stamMax ? 1.5 : 1);
      else if (pick === 'kick') { // a long-legged wader kicks with a little hop, not a great leap
        ok = rag.startKick(aimHead && P.jumpV > 220 ? tHead : tBody, me.leggy ? 0.45 : undefined);
        if (ok && me.leggy) rag.act.low = true;
      }
      else if (pick === 'punch') ok = rag.startPunch(aimHead ? tHead : tBody);
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
      else if (me.cmdCd.sic <= 0 && me.stam > 0.4 * me.stamMax && ((foeDown && rng.chance(0.12)) || foe.stam < 0.2 * foe.stamMax || rng.chance(0.08))) this.command(me.side, 'sic'); // a downed foe: mostly left to get up
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
      // a flying kick lands with the whole bird behind it, however gently the foot itself comes down
      const fly = w === 'foot' && !!(att.rag.act && att.rag.act.fly);
      if (fly) rel = Math.max(rel, REF.foot * 1.5);
      let dmg = BASE[w] * sharp * Math.pow(clamp(rel / REF[w], 0.25, 2.2), 1.1) * Math.pow(A.massRel, 0.38) * LOC[hit.part] * rng.range(0.85, 1.15) / Math.pow(D.hide, 0.6);
      const crit = hit.part === 'head';
      if (att.frenzy > 0) dmg *= 1.15;
      if (att.focusNext && w !== 'body') { if (crit) dmg *= 1.4; att.focusNext = false; }
      if (def.backoff > 0 || def.rag.guard) dmg *= 0.6;
      if (A.twoHeads && w === 'beak') dmg *= 1.25;
      if (att.gear.spurs && w === 'foot') dmg *= 1.2;
      if (def.gear.helmet && crit) dmg *= 0.75;
      // the newer fighting kit: small edges, one piece at a time
      if (att.gear.beakcap && w === 'beak') dmg *= 1.15;
      if (att.gear.wingwax && w === 'wing') dmg *= 1.2;
      if (att.gear.horseshoe && crit) dmg *= 1.15;
      if (def.gear.mail && !crit) dmg *= 0.85;
      if (fly) dmg *= 1.4;
      dmg *= this.pace;
      def.hp -= dmg; att.dmg += dmg; att.hits++; def.lastHurt = this.t;
      if (this.roundDmg) this.roundDmg[att.side] += dmg / def.hpMax * 100;
      att.rag.act.hit = true;
      const dv = Math.min(fly ? 420 : 340, Math.pow(A.massRel, 0.9) * rel * KNOCK[w] / D.massRel * (fly ? 1.4 : 1));
      def.rag.push(ux * dv, clamp(uy * dv * 0.5 - (w === 'foot' ? dv * 0.12 : 0), -170, 140), crit ? 'head' : 'body');
      if (w === 'beak') { att.rag.head.vx *= -0.2; att.rag.head.vy *= -0.2; }
      def.stag += dv / (420 * D.balance) * (this.inMud(def.rag) ? 1.6 : 1) * (def.gear.springs ? 0.8 : 1); // the mud takes your feet; spring boots keep them
      // A flying kick sends the foe limp through the air and into the wall behind it (same damage).
      if (fly) {
        const dirX = Math.sign(def.rag.midX() - att.rag.midX()) || att.rag.f, g = this.world.g, vy = 280, air = 2 * vy / g; // away from the kicker
        const dist = Math.max(10, this.edge - dirX * def.rag.midX());
        const vx = dirX * clamp(dist / (air * 0.55), 450, 1800);
        if (def.rag.state !== 'down' && def.rag.state !== 'ko') { def.downs++; this.events.push({ type: 'down', side: def.side }); }
        def.rag.knockdown(1.5 + 0.6 * rng.next()); def.stag = 0;
        for (const p of def.rag.parts) if (p.im > 0) { p.vx = vx; p.vy = -vy; }
        def.launch = { dir: dirX, t: 0 };
      }
      const big = dmg > 0.2 * def.hpMax, st = def.rag.state;
      if ((def.stag >= 1 || big) && st !== 'down' && st !== 'ko' && def.hp > 0) {
        def.stag = 0; def.downs++;
        def.rag.knockdown(0.6 + 0.7 * rng.next() + (big ? 0.4 : 0));
        this.events.push({ type: 'down', side: def.side });
      }
      const frac = dmg / def.hpMax * 100;
      def.morale -= frac * (1.5 - 1.1 * D.courage); att.morale = Math.min(100, att.morale + frac * 0.35);
      this.events.push({ type: 'hit', x, y, dmg, weapon: w, part: hit.part, crit, side: att.side, fly });
      this.hitStop = clamp(dmg / def.hpMax * 0.6, 0.02, 0.12);
      if (def.hp <= 0) { def.hp = 0; def.rag.ko(); if (this.roundsWon) this.endRound(att.side, 'ko'); else this.finish(att.side, 'ko'); }
    }

    upkeep(me) {
      const P = me.P, rag = me.rag;
      if (me.launch) { // flung by a flying kick: does it meet the wall?
        me.launch.t += DT;
        const d = me.launch.dir, hitWall = rag.parts.some((p) => p.x * d >= this.edge - (p.r || 2) - 1.5);
        if (hitWall) { this.events.push({ type: 'wall', side: me.side, x: d * this.edge, y: rag.midY(), dir: d }); me.launch = null; }
        else if (me.launch.t > 2.2) me.launch = null;
      }
      me.cd -= DT; me.flyCd -= DT; me.frenzy = Math.max(0, me.frenzy - DT); me.backoff = Math.max(0, me.backoff - DT);
      me.cmdCd.sic = Math.max(0, me.cmdCd.sic - DT); me.cmdCd.back = Math.max(0, me.cmdCd.back - DT); me.cmdCd.whistle = Math.max(0, me.cmdCd.whistle - DT);
      me.stag = Math.max(0, me.stag - DT * 0.45);
      const sp = Math.abs(rag.vx()) / Math.max(1, P.speedMax);
      const regen = 5.5 * P.lungs * (me.backoff > 0 || me.resting ? 2.2 : 1) * (me.frenzy > 0 ? 0.5 : 1) - 2.5 * sp * sp - (this.inMud(rag) ? 1.5 : 0);
      me.stam = clamp(me.stam + regen * DT * (regen > 0 && me.gear.flask ? 1.2 : 1), 0, me.stamMax);
      if (this.t - me.lastHurt > 2) me.morale = Math.min(100, me.morale + 2 * DT);
      if (!this.over && !me.flee && me.morale <= 0 && P.courage < 0.85) { me.flee = true; this.events.push({ type: 'flee', side: me.side }); }
      if (me.flee) me.fleeT += DT;
      rag.eye = rag.state === 'ko' ? 'ko' : me.flee ? 'scared' : rag.state === 'down' ? 'blink' : me.frenzy > 0 || (rag.act && rag.act.type !== 'duck') ? 'angry' : '';
    }

    checkEnd() {
      for (let s = 0; s < 2; s++) {
        const me = this.fighters[s];
        if (me.fleeT > 2.6) return this.roundsWon ? this.endRound(1 - s, 'fled') : this.finish(1 - s, 'fled');
      }
      if (!this.roundsWon && this.t >= this.timeLimit) {
        const a = this.fighters[0], b = this.fighters[1];
        if (this.roundsWon) this.endRound(); // the last round counts too
        const rw = this.roundsWon || [0, 0];
        const sa = a.dmg / b.hpMax * 100 + 8 * b.downs + 12 * rw[0], sb = b.dmg / a.hpMax * 100 + 8 * a.downs + 12 * rw[1];
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
      const cap = (maxT || (this.roundsWon ? 3 * (this.roundLen + 3) + 5 : this.timeLimit + 5)) / DT; // three rounds and their breathers
      for (let i = 0; i < cap && !this.over; i++) this.step();
      while (!this.over && this.roundsWon) this.endRound(); // rounds still to go are scored as they stand
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

  RB.fight = { Fight, estimate, DT, CMD_CD, TWISTS, TUNE, PACE };
})();
