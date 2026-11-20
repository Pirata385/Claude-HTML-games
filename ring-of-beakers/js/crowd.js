// crowd.js — the neighbours who come to watch a bout: eight people from the game's own world (drawn
// like every person in it), four outside each wall of the pit. Those on the left root for the bird
// that starts on the left, those on the right for the other. They follow the bout: arms up and
// jumping when their bird lands a big one, a fist pumped for a small one, hands on the head when
// their bird takes one or goes down, ducking back from a bird slammed into their wall, clapping
// between rounds, and dancing (or holding their heads) at the end. In between they watch, pump a
// fist or clap now and then, more as the house warms up.
// Who comes: mainland neighbours who are at home (not in your truck), or whoever keeps their place
// now; strangers make up the numbers. make/update/react are DOM-free (tested in node).
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp } = RB.core;
  const PER_SIDE = 4;
  // how much an act outranks another (a new act only takes over one it outranks or one that is ending)
  const RANK = { idle: 0, clap: 1, pump: 2, cheer: 3, groan: 3, shock: 4 };

  function guests(S, world, r, n) {
    const out = [];
    if (S && world && world.npcs && world.site) {
      const pool = RB.state.mainlanders(world).map((b) => { const st = S.npc && S.npc[b.id]; return st && st.gone && !st.sub ? null : RB.npc.current(S, b); }).filter(Boolean);
      r.shuffle(pool);
      out.push(...pool.slice(0, n));
    }
    while (out.length < n) {
      const sex = r.chance(0.5) ? 'M' : 'F';
      out.push({ name: RB.npc.randomName(r, sex), g: RB.npc.personGenome(r, sex), clothes: RB.npc.clothes(r, r.chance(0.3) ? r.pick(['cowboy', 'bandana']) : null) });
    }
    return out;
  }

  // The eight for one bout. W: half the pit's width; L: the bout's length unit. A person is drawn at
  // their own size, but never taller than about two bird-lengths (next to a quail the house would
  // otherwise be all knees).
  function make(seed, W, L, S, world) {
    const r = new Rng(seed >>> 0 || 1);
    const people = guests(S, world, r, PER_SIDE * 2).map((n, i) => {
      const side = i < PER_SIDE ? -1 : 1, P = RB.pheno.express(n.g);
      const b = RB.pose.bounds(P, RB.pose.animPose(P, { x: 0, y: 0, f: 1 })), h = b.y1 - b.y0, s = Math.min(1, (L * 1.9) / h);
      return {
        name: n.name, P, clothes: n.clothes || null, hat: n.hat || null, s, w: (b.x1 - b.x0) * s, h: h * s,
        side, fan: side < 0 ? 0 : 1, f: -side, x: 0, hand: r.chance(0.5) ? 0 : 1,
        excit: r.range(0.7, 1.3), ph: r.range(0, 6.28), act: 'idle', actT: 0, hop: 0, lean: 0,
      };
    });
    // in a line on each side, from the wall outwards
    for (const sd of [-1, 1]) {
      let x = W + L * 0.5;
      for (const p of people.filter((q) => q.side === sd)) { x += p.w * 0.5; p.x = sd * x; x += p.w * 0.5 + L * 0.18; }
    }
    return { people, t: 0, W, L, r, reach: Math.max(...people.map((p) => Math.abs(p.x) + p.w / 2)) };
  }

  function act(p, what, dur) {
    if (p.act !== 'idle' && p.actT > 0.25 && RANK[what] < RANK[p.act]) return;
    p.act = what; p.actT = dur;
  }

  // The bout's events, as the eight see them.
  function react(cr, e, fight) {
    const F = fight.fighters, r = cr.r;
    for (const p of cr.people) {
      if (e.type === 'hit') {
        const frac = e.dmg / F[1 - e.side].hpMax, big = frac > 0.12 || e.crit || e.fly;
        if (p.fan === e.side) { if (r.chance(clamp((frac * 5 + (e.crit ? 0.3 : 0) + (e.fly ? 1 : 0)) * p.excit, 0.15, 1))) act(p, big ? 'cheer' : 'pump', 0.7 + Math.min(1.3, frac * 5)); }
        else if (big && r.chance(0.6)) act(p, 'groan', 1 + frac * 3);
      } else if (e.type === 'down') act(p, p.fan !== e.side ? 'cheer' : 'groan', 1.6 + r.next());
      else if (e.type === 'wall') { if (Math.sign(p.x) === Math.sign(e.x)) act(p, 'shock', 1.2 + r.next() * 0.4); else act(p, p.fan !== e.side ? 'cheer' : 'groan', 1.3); }
      else if (e.type === 'flykick') { if (p.fan === e.side && r.chance(0.7)) act(p, 'pump', 0.8); }
      else if (e.type === 'round') act(p, 'clap', 1.5 + r.next());
      else if (e.type === 'end') act(p, p.fan === e.winner ? 'cheer' : r.chance(0.5) ? 'groan' : 'clap', 4 + r.next() * 2);
      else if (e.type === 'flee') act(p, p.fan === e.side ? 'groan' : 'pump', 1.5);
    }
  }

  // heat: how worked up the house is (0 quiet .. 2 roaring)
  function update(cr, dt, heat) {
    cr.t += dt;
    const t = cr.t, k = Math.min(1, dt * 10);
    for (const p of cr.people) {
      p.actT -= dt;
      if (p.actT <= 0 && p.act !== 'idle') p.act = 'idle';
      if (p.act === 'idle' && cr.r.chance(dt * 0.07 * p.excit * (1 + 2 * (heat || 0)))) act(p, cr.r.chance(0.5) ? 'pump' : 'clap', 0.8 + cr.r.next() * 0.6);
      const jump = p.act === 'cheer' ? Math.abs(Math.sin(t * 7 * p.excit + p.ph)) * 0.16 : p.act === 'pump' ? Math.abs(Math.sin(t * 8 + p.ph)) * 0.04 : 0;
      p.hop += (jump * p.h - p.hop) * Math.min(1, dt * 20);
      p.lean += ((p.act === 'shock' ? p.side * 0.12 * p.h : 0) - p.lean) * k; // a step back from a bird hitting their wall
    }
  }

  // A person's pose for what they are doing (the game's own standing pose, arms moved).
  function poseOf(p, t) {
    const P = p.P, pose = RB.pose.animPose(P, { x: 0, y: 0, f: p.f, time: t + p.ph * 3 });
    const s = Math.sin(t * 8 * p.excit + p.ph), A = P.armL, cheering = p.act !== 'idle' && p.act !== 'clap';
    if (pose.arms) {
      const hand = (i, dx, dy) => { const a = pose.arms[i]; a.x = a.sx + p.f * dx * A; a.y = a.sy + dy * A; };
      const k = pose.neck.length, hx = pose.neck[k - 2], hy = pose.neck[k - 1];
      switch (p.act) {
        case 'cheer': hand(0, 0.28 + 0.12 * s, -0.9); hand(1, -0.18 - 0.12 * s, -0.9); break;
        case 'pump': hand(p.hand, 0.22, s > 0 ? -0.95 : -0.5); break;
        case 'clap': { const c = Math.abs(Math.sin(t * 9 + p.ph)) * 0.2; hand(0, 0.55, -0.3); hand(1, 0.55 + c, -0.3); break; }
        case 'groan': for (const a of pose.arms) { a.x = hx - p.f * P.HR * (a.side ? 0.1 : 0.45); a.y = hy - P.HR * 0.7; } break;
        case 'shock': hand(0, 0.5, -0.75); hand(1, -0.3, -0.85); break;
        default: break;
      }
    }
    if (cheering) pose.beakOpen = 1;
    if (p.act === 'groan' || p.act === 'shock') pose.eye = 'scared';
    else if (p.act === 'idle' && (t * 0.7 + p.ph) % 4 < 0.12) pose.eye = 'blink';
    return pose;
  }

  // The eight, in world units; x0..x1 is the part on screen.
  function draw(ctx, cr, x0, x1) {
    for (const p of cr.people) {
      if (p.x + p.w < x0 || p.x - p.w > x1) continue;
      RB.art.drawShadow(ctx, p.x, 0, p.w * 0.45);
      ctx.save(); ctx.translate(p.x + p.lean, -p.hop); ctx.scale(p.s, p.s);
      RB.art.drawCreature(ctx, p.P, poseOf(p, cr.t), { clothes: p.clothes, hat: p.hat });
      ctx.restore();
    }
  }

  RB.crowd = { make, update, react, draw, poseOf, PER_SIDE };
  if (typeof module !== 'undefined') module.exports = RB.crowd;
})();
