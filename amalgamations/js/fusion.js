// Amalgamations — creature fusion.
// fuse(motherId, fatherId, variant) blends two base genomes into one creature genome.
// Deterministic: the same inputs always give the same creature. Parent order matters (A×B ≠ B×A),
// and every variant number is a different "mutation" of the same pair.
//
// The goal is fusions that read as both parents without following an obvious rule
// (never "head always from the father"). Steps: per-slot weighted choice by dominance with jitter,
// U-shaped proportion blending in log space, an anatomy pass that clamps ratios, extras placed into
// anchor slots, a readability check (each parent must contribute enough recognisable features),
// colour mixing in OKLab with a contrast fix, then stats, traits, basic attack and a portmanteau name.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});

  const ABSENT = 0.42;               // weight of "no feature" when a parent lacks an optional slot
  const READABLE = 2.6;              // minimum signature score per parent
  const ANCHOR_CAP = { headtop: 1, face: 1, back: 1, side: 1, aura: 1 };
  const MAX_EXTRAS = 3;
  const SLOTS = ['body', 'head', 'legs', 'arms', 'tail', 'wings'];

  const has = (base, slot) => {
    if (slot === 'head') return base.head && base.head.shape !== 'none';
    return !!base[slot];
  };
  const domW = (base, slot) => Math.pow(base.dom[slot] > 0 ? base.dom[slot] : ABSENT, 1.5);
  const copy = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));
  const vol = (b) => b.w * b.h * b.l;

  // Weighted choice between mother (0) and father (1) for a slot.
  function pick(rng, P, slot, mulM, mulF) {
    const wm = domW(P[0], slot) * (mulM == null ? 1 : mulM) * (0.55 + rng.next() * 0.9);
    const wf = domW(P[1], slot) * (mulF == null ? 1 : mulF) * (0.55 + rng.next() * 0.9);
    return rng.next() * (wm + wf) < wm ? 0 : 1;
  }

  function build(rng, P) {
    const g = { src: {} };
    const other = (i) => P[1 - i];

    // --- legs decide the posture ---
    const legsI = pick(rng, P, 'legs');
    g.src.legs = legsI;
    const legsBase = P[legsI];
    g.posture = legsBase.posture;
    g.hover = legsBase.hover || 0;
    g.legs = copy(legsBase.legs);
    const oLegs = other(legsI).legs;
    if (g.legs && oLegs) {
      const t = rng.ushape() * 0.5;
      g.legs.len = AM.logLerp(g.legs.len, oLegs.len, t);
      g.legs.thick = AM.logLerp(g.legs.thick, oLegs.thick, t);
      if (rng.chance(0.2) && oLegs.style !== 'hop' && g.legs.style !== 'hop') g.legs.style = oLegs.style;
      if (g.posture === 'quadruped' && oLegs.count >= 4 && oLegs.count !== g.legs.count && rng.chance(0.3)) {
        g.legs.count = Math.max(4, Math.round((g.legs.count + oLegs.count) / 4) * 2);
      }
    }

    // --- wings (can turn a walker into a flier) ---
    const wingsI = pick(rng, P, 'wings');
    g.src.wings = wingsI;
    g.wings = copy(P[wingsI].wings);
    if (g.wings && g.posture !== 'hover' && P[wingsI].posture === 'hover' && rng.chance(0.35)) {
      g.posture = 'hover';
      g.hover = P[wingsI].hover || 0.7;
    }

    // --- body ---
    const bodyI = pick(rng, P, 'body');
    g.src.body = bodyI;
    const B = P[bodyI].body, O = other(bodyI).body;
    const tb = rng.ushape() * 0.55;
    g.body = { shape: B.shape, w: AM.logLerp(B.w, O.w, tb), h: AM.logLerp(B.h, O.h, tb), l: AM.logLerp(B.l, O.l, tb) };
    // mass sits between the parents
    const target = AM.logLerp(vol(P[0].body), vol(P[1].body), rng.next());
    const s = AM.clamp(Math.cbrt(target / vol(g.body)), 0.75, 1.3);
    g.body.w *= s; g.body.h *= s; g.body.l *= s;
    g.neck = AM.lerp(P[bodyI].neck, other(bodyI).neck, rng.ushape() * 0.6);

    // --- head (shape) and eyes (face) ---
    const facelessMul = (i) => (!has(P[i], 'head') && has(other(i), 'head') && bodyI !== i ? 0.3 : 1);
    const headI = pick(rng, P, 'head', facelessMul(0), facelessMul(1));
    g.src.head = headI;
    const hb = P[headI].head, oh = other(headI).head;
    g.head = copy(hb);
    delete g.head.eyes;
    if (g.head.shape !== 'none' && oh.shape !== 'none') {
      const th = rng.ushape() * 0.4;
      g.head.w = AM.logLerp(hb.w, oh.w, th); g.head.h = AM.logLerp(hb.h, oh.h, th); g.head.l = AM.logLerp(hb.l, oh.l, th);
      if (oh.snout && (!hb.snout ? rng.chance(0.2) : rng.chance(0.3))) {
        g.head.snout = copy(oh.snout);
        if (oh.snout.shape === 'beak') g.head.jaw = false;
        else if (oh.jaw) g.head.jaw = true;
      }
    }
    const eyesOther = rng.chance(0.18 + 0.25 * (other(headI).dom.head || 0.4));
    const eyesI = eyesOther ? 1 - headI : headI;
    g.src.eyes = eyesI;
    g.eyes = copy(P[eyesI].head.eyes);

    // --- arms ---
    const armsMul = (i) => (P[i].arms && g.posture === 'quadruped' && /fist|stub/.test(P[i].arms.style) ? 0.5 : 1);
    const armsI = pick(rng, P, 'arms', armsMul(0), armsMul(1));
    g.src.arms = armsI;
    g.arms = copy(P[armsI].arms);
    if (g.arms && other(armsI).arms) {
      const t = rng.ushape() * 0.4;
      g.arms.len = AM.logLerp(g.arms.len, other(armsI).arms.len, t);
      g.arms.thick = AM.logLerp(g.arms.thick, other(armsI).arms.thick, t);
    }

    // --- tail ---
    const tailI = pick(rng, P, 'tail');
    g.src.tail = tailI;
    g.tail = copy(P[tailI].tail);
    if (g.tail && other(tailI).tail) g.tail.len = AM.logLerp(g.tail.len, other(tailI).tail.len, rng.ushape() * 0.45);

    // --- extras into anchor slots ---
    const pool = [];
    for (let i = 0; i < 2; i++) for (const e of P[i].extras) pool.push({ e, i, score: e.sig * (P[i].dom.extras || 0.5) * (0.6 + rng.next() * 0.8) });
    pool.sort((a, b) => b.score - a.score);
    const used = {};
    g.extras = [];
    for (const it of pool) {
      if (g.extras.length >= MAX_EXTRAS) break;
      const a = it.e.anchor;
      if ((used[a] || 0) >= (ANCHOR_CAP[a] || 1)) continue;
      if (!rng.chance(0.45 + 0.55 * (P[it.i].dom.extras || 0.5))) continue;
      used[a] = (used[a] || 0) + 1;
      g.extras.push({ kind: it.e.kind, anchor: a, sig: it.e.sig, src: it.i });
    }

    // --- colour, pattern, material (independent of anatomy) ---
    g.src.color = pick(rng, P, 'color');
    g.src.pattern = pick(rng, P, 'pattern');
    g.src.material = pick(rng, P, 'material');
    g.patchwork = P[0].material !== P[1].material && rng.chance(0.3);
    g._rng2 = rng.next();
    return g;
  }

  function scores(g, P) {
    const sc = [0, 0];
    for (const slot of SLOTS) {
      const i = g.src[slot];
      const base = P[i];
      const present = slot === 'head' ? g.head.shape !== 'none' : !!g[slot];
      if (present || has(base, slot) === false) sc[i] += (base.sig[slot] || 0) * (present ? 1 : 0.5);
    }
    for (const e of g.extras) sc[e.src] += e.sig;
    sc[g.src.color] += 0.6;
    sc[g.src.material] += 0.4;
    sc[g.src.pattern] += 0.3;
    if (g.src.eyes !== g.src.head) sc[g.src.eyes] += 0.5;
    return sc;
  }

  // Force a parent's most recognisable feature into the creature.
  function force(g, P, i) {
    const base = P[i];
    let best = null, bestSig = 0;
    for (const slot of ['wings', 'tail', 'arms', 'head', 'body', 'legs']) {
      if (!has(base, slot) || g.src[slot] === i) continue;
      if ((base.sig[slot] || 0) > bestSig) { bestSig = base.sig[slot]; best = slot; }
    }
    const topExtra = base.extras.slice().sort((a, b) => b.sig - a.sig)[0];
    if (topExtra && (!best || topExtra.sig >= bestSig)) {
      g.extras = g.extras.filter((e) => e.anchor !== topExtra.anchor);
      g.extras.push({ kind: topExtra.kind, anchor: topExtra.anchor, sig: topExtra.sig, src: i });
      if (g.extras.length > MAX_EXTRAS) g.extras.splice(0, g.extras.length - MAX_EXTRAS);
      return;
    }
    if (!best) return;
    g.src[best] = i;
    if (best === 'head') { const eyes = g.head.eyes; g.head = copy(base.head); delete g.head.eyes; void eyes; }
    else if (best === 'body') { const k = Math.cbrt(vol(g.body) / vol(base.body)); g.body = copy(base.body); g.body.w *= k; g.body.h *= k; g.body.l *= k; }
    else if (best === 'legs') { g.legs = copy(base.legs); g.posture = base.posture; g.hover = base.hover || 0; }
    else g[best] = copy(base[best]);
  }

  // Anatomy pass: keep proportions sane whatever the parents.
  function anatomy(g) {
    const b = g.body;
    // orient the body for the posture
    if (g.posture === 'biped' && b.l > b.h * 1.05) { const h = b.h; b.h = b.l * 0.88; b.l = Math.max(h, b.w * 0.7); }
    if (g.posture === 'quadruped' && b.h > b.l * 1.1) { const l = b.l; b.l = b.h; b.h = Math.max(l, b.w * 0.6); }
    if (g.posture === 'hop') { const m = (b.w + b.l) / 2; b.w = AM.lerp(b.w, m, 0.6); b.l = AM.lerp(b.l, m, 0.6); }
    for (const k of ['w', 'h', 'l']) b[k] = AM.clamp(b[k], 0.28, 1.45);
    const mx = Math.max(b.w, b.h, b.l), mn = Math.min(b.w, b.h, b.l);
    if (mx / mn > 3.4) { const f = Math.sqrt(mx / mn / 3.4); for (const k of ['w', 'h', 'l']) { if (b[k] === mx) b[k] /= f; if (b[k] === mn) b[k] *= f; } }
    g.neck = AM.clamp(g.neck, 0, 0.45);

    const h = g.head;
    if (h.shape !== 'none') {
      const bodyMax = Math.max(b.w, b.h, b.l);
      const hMax = Math.max(h.w, h.h, h.l);
      let f = 1;
      if (hMax > bodyMax * 0.85) f = (bodyMax * 0.85) / hMax;
      if (h.w > b.w * 1.25) f = Math.min(f, (b.w * 1.25) / h.w);
      if (hMax < Math.min(b.w, b.h) * 0.45) f = (Math.min(b.w, b.h) * 0.45) / hMax;
      if (h.shape === 'lid') { h.w = b.w * 1.02; h.l = b.l * 1.02; h.h = Math.min(h.h, b.h * 0.6); f = 1; }
      h.w *= f; h.h *= f; h.l *= f;
      if (h.snout) {
        const sf = AM.clamp(Math.max(h.w, h.h) / 0.42, 0.6, 1.5);
        h.snout.w = Math.min(h.snout.w * sf, h.w * 0.9);
        h.snout.h = Math.min(h.snout.h * sf, h.h * 0.85);
        h.snout.l = AM.clamp(h.snout.l * sf, 0.06, h.l * 1.1);
      }
    }
    // eyes scale to the face they sit on
    const faceSize = h.shape !== 'none' ? Math.min(h.w, h.h) : Math.min(b.w, b.h);
    const e = g.eyes;
    const maxEye = e.count === 1 ? faceSize * 0.42 : faceSize * (e.count > 2 ? 0.12 : 0.22);
    e.size = AM.clamp(e.size * AM.clamp(faceSize / 0.38, 0.7, 1.6), 0.03, maxEye);

    if (g.legs) {
      const L = g.legs;
      if (g.posture === 'biped') L.count = 2;
      if (g.posture === 'quadruped' && L.count < 4) L.count = 4;
      if (L.count % 2) L.count += 1;
      const maxLen = g.posture === 'biped' ? b.h * 1.0 + 0.1 : b.h * 1.1 + 0.25;
      L.len = AM.clamp(L.len, 0.1, maxLen);
      const perSide = Math.max(1, L.count / 2);
      const maxThick = g.posture === 'biped' ? b.w * 0.42 : Math.min(b.w * 0.4, (b.l / perSide) * 0.7);
      L.thick = AM.clamp(L.thick, 0.04, maxThick);
    } else if (g.posture === 'quadruped' || g.posture === 'biped') {
      g.posture = 'hover';
      g.hover = g.hover || 0.4;
    }
    if (g.posture === 'hover') g.hover = AM.clamp(g.hover || 0.4, 0.25, 1.0);
    if (g.arms) {
      g.arms.len = AM.clamp(g.arms.len, 0.15, b.h * 1.2 + 0.1);
      g.arms.thick = AM.clamp(g.arms.thick, 0.05, Math.min(b.w, b.h) * 0.42);
    }
    if (g.tail) {
      const maxT = g.posture === 'biped' ? b.h * 1.25 : b.l * 1.3;
      g.tail.len = AM.clamp(g.tail.len, 0.12, maxT);
      g.tail.segs = AM.clamp(g.tail.segs || 1, 1, 5);
    }
    if (g.wings) {
      const bs = Math.cbrt(vol(b));
      g.wings.span = AM.clamp(g.wings.span * AM.clamp(bs / 0.6, 0.7, 1.5), b.w * 1.25, b.w * 2.2 + 1.3);
    }
  }

  function palette(rng, g, P) {
    const ci = g.src.color, cs = P[ci].palette, co = P[1 - ci].palette;
    let primary = cs.primary;
    let secondary = rng.chance(0.6) ? co.primary : co.secondary;
    if (P[0] === P[1]) secondary = cs.secondary;
    let accent = rng.chance(0.5) ? AM.mixColor(cs.accent, co.accent, rng.ushape()) : (rng.chance(0.5) ? cs.accent : co.accent);
    secondary = AM.hueToward(secondary, primary, 0.12);
    const dl = AM.lightness(secondary) - AM.lightness(primary);
    if (Math.abs(dl) < 0.12) {
      const Lp = AM.lightness(primary);
      secondary = AM.setLightness(secondary, Lp > 0.55 ? Lp - 0.2 : Lp + 0.2);
    }
    if (Math.abs(AM.lightness(accent) - AM.lightness(primary)) < 0.08) accent = AM.shade(accent, AM.lightness(primary) > 0.5 ? -0.18 : 0.18);
    g.palette = { primary, secondary, accent, eye: P[g.src.eyes].palette.eye };
    g.pattern = P[g.src.pattern].pattern;
    if (g.pattern === 'solid' && P[1 - g.src.pattern].pattern !== 'solid' && rng.chance(0.4)) g.pattern = P[1 - g.src.pattern].pattern;
    g.material = P[g.src.material].material;
    g.limbMaterial = g.patchwork ? P[1 - g.src.material].material : g.material;
  }

  function attackFor(g, P, rng) {
    const valid = (a) => {
      switch (a) {
        case 'bite': return !!g.head.jaw;
        case 'peck': return !!(g.head.snout && g.head.snout.shape === 'beak');
        case 'tongue': return !!g.head.jaw;
        case 'sting': return !!(g.tail && g.tail.style === 'stinger');
        case 'ram': return g.extras.some((e) => /horn/.test(e.kind)) || g.body.shape === 'cone';
        case 'claw': return !!((g.arms && /pincer|claw/.test(g.arms.style)) || (g.legs && g.legs.style === 'claw'));
        default: return true;
      }
    };
    const cands = [0, 1].filter((i) => valid(P[i].attack));
    let i;
    if (cands.length === 2) i = rng.chance(0.5) ? 0 : 1;
    else if (cands.length === 1) i = cands[0];
    if (i != null) return { attack: P[i].attack, attackElement: P[i].attackElement || null };
    if (g.head.jaw) return { attack: 'bite', attackElement: null };
    if (g.head.snout && g.head.snout.shape === 'beak') return { attack: 'peck', attackElement: null };
    return { attack: 'slam', attackElement: null };
  }

  // ---------- names ----------
  // Every prefix of the mother's name is tried with every suffix of the father's name, and the
  // candidates are scored by simple English-like phonotactics (syllable boundaries, no awkward
  // consonant clusters or vowel collisions, a pleasant length, each part still recognisable).
  const isV = (c) => /[aeiouy]/.test(c || '');
  function nameScore(a, b, p, s) {
    const word = p + s, len = word.length;
    let sc = -Math.abs(len - 7) * 0.5;
    const j1 = p[p.length - 1], j2 = s[0];
    if (isV(j1) && isV(j2)) sc -= j1 === j2 ? 3 : 1.6;
    if (!isV(j1) && !isV(j2)) {
      if (j1 === j2) sc -= /[lst]/.test(j1) ? 0.6 : 2.2;
      if (!isV(s[1])) sc -= 3;
      if (!isV(p[p.length - 2])) sc -= 2.5;
    }
    const nextA = a[p.length];
    if (nextA !== undefined) sc += isV(j1) !== isV(nextA) ? 0.5 : -0.4;
    const prevB = b[b.length - s.length - 1];
    if (!isV(s[0]) && isV(s[1])) sc += 0.8;
    else if (isV(s[0]) && prevB && !isV(prevB)) sc += 0.3;
    if (p.length >= 3 || p === a) sc += 0.6;
    if (s.length >= 3) sc += 0.6;
    if (p.length / a.length < 0.34) sc -= 1;
    if (s.length / b.length < 0.34) sc -= 1;
    if (/(.)\1\1/.test(word) || /[^aeiouy]{4}/.test(word) || /[^aeiouy]{3}$/.test(word)) sc -= 4;
    if (/q(?!u)/.test(word)) sc -= 3;
    if (word === a || word === b || a.startsWith(word) || b.endsWith(word)) sc -= 6;
    return sc;
  }
  function portmanteau(a, b, rng) {
    a = a.toLowerCase().replace(/[^a-z]/g, ''); b = b.toLowerCase().replace(/[^a-z]/g, '');
    let best = null, bestSc = -Infinity;
    const maxP = a.length <= 5 ? a.length : a.length - 1;
    for (let i = 2; i <= maxP; i++) for (let j = 1; j <= b.length - 2; j++) {
      const p = a.slice(0, i), s = b.slice(j);
      const sc = nameScore(a, b, p, s) + rng.next() * 0.9;
      if (sc > bestSc) { bestSc = sc; best = p + s; }
    }
    const w = best || a + b;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  const nick = (base) => base.nick || base.name;

  // ---------- main ----------
  function fuse(motherId, fatherId, variant) {
    variant = variant | 0;
    const M = AM.BASES[motherId], F = AM.BASES[fatherId];
    if (!M || !F) throw new Error('Unknown base: ' + motherId + ' / ' + fatherId);
    const P = [M, F];
    let best = null, bestMin = -1, bestScores = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const rng = AM.makeRng(AM.hashStr(`${motherId}×${fatherId}:${variant}:${attempt}`));
      const g = build(rng, P);
      const sc = scores(g, P);
      const mn = Math.min(sc[0], sc[1]);
      if (mn > bestMin) { best = g; bestMin = mn; bestScores = sc; }
      if (motherId === fatherId || mn >= READABLE) break;
    }
    const g = best;
    if (motherId !== fatherId) {
      for (let i = 0; i < 2; i++) if (bestScores[i] < READABLE) force(g, P, i);
      // extras alone are not enough: each parent also gives at least one body part or the colours
      for (let i = 0; i < 2; i++) {
        if (!['body', 'head', 'legs', 'arms', 'tail', 'wings', 'color'].some((k) => g.src[k] === i)) g.src.color = i;
      }
    }
    const rng = AM.makeRng(AM.hashStr(`${motherId}×${fatherId}:${variant}:finish`));
    anatomy(g);
    palette(rng, g, P);

    // stats: separate blend per stat plus hybrid vigour
    const st = {};
    for (const k of ['hp', 'atk', 'def', 'energy']) st[k] = Math.round(AM.lerp(M.stats[k], F.stats[k], 0.25 + rng.next() * 0.5) * (motherId === fatherId ? 1 : 1.08));
    st.spd = AM.round2(AM.lerp(M.stats.spd, F.stats.spd, 0.25 + rng.next() * 0.5));
    g.stats = st;

    g.traits = motherId === fatherId ? [{ id: M.trait, str: 1 }] : [{ id: M.trait, str: 0.7 }, { id: F.trait, str: 0.7 }];
    const syn = AM.SYNERGIES.find((s) => (s.a === M.trait && s.b === F.trait) || (s.a === F.trait && s.b === M.trait));
    g.synergy = syn ? syn.id : null;
    Object.assign(g, attackFor(g, P, rng));

    g.parents = [motherId, fatherId];
    g.variant = variant;
    g.key = `${motherId}|${fatherId}|${variant}`;
    g.name = motherId === fatherId ? M.name : portmanteau(nick(M), nick(F), rng);
    g.subtitle = motherId === fatherId ? 'Pure ' + M.name : `${M.name} + ${F.name}`;
    g.from = {};
    for (const k of ['body', 'head', 'eyes', 'legs', 'arms', 'tail', 'wings', 'color', 'pattern', 'material']) g.from[k] = P[g.src[k]].id;
    delete g.src; delete g._rng2;
    // collision radius and rough height (used by gameplay and camera)
    const b = g.body;
    g.radius = AM.round2(Math.max(0.35, Math.max(b.w, b.l * 0.7) * 0.55));
    const legH = g.legs && g.posture !== 'hover' ? g.legs.len : 0;
    g.height = AM.round2(legH + b.h + (g.posture === 'hover' ? g.hover : 0) + (g.head.shape !== 'none' && g.posture === 'biped' ? g.head.h : 0));
    return g;
  }

  // Readability score of a finished genome (for tests and the Lab UI).
  function inheritance(g) {
    const counts = {};
    for (const k of ['body', 'head', 'legs', 'arms', 'tail', 'wings']) counts[g.from[k]] = (counts[g.from[k]] || 0) + 1;
    return counts;
  }

  Object.assign(AM, { fuse, portmanteau, fusionInheritance: inheritance, FUSION_READABLE: READABLE });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
