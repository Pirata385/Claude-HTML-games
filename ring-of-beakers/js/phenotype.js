// phenotype.js — genome -> body. Decodes the traits, applies sex and age, and derives the
// geometry (in world units, a hen is about 45 tall), colours and fight statistics. No DOM.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const G = RB.genome;
  const { clamp, clamp01, lerp, smooth, hsl } = RB.core;
  const DEG = Math.PI / 180;

  // colour ramps as [h, s, l] stops
  const BEAK_RAMP = [[0, 0, 0.1], [0.6, 0.08, 0.42], [0.13, 0.75, 0.6], [0.07, 0.9, 0.55], [0.98, 0.75, 0.55]];
  const LEG_RAMP = [[0, 0, 0.12], [0.6, 0.06, 0.45], [0.13, 0.7, 0.58], [0.07, 0.85, 0.55], [0.96, 0.6, 0.7]];
  const EYE_RAMP = [[0, 0, 0.08], [0.07, 0.7, 0.3], [0.09, 0.9, 0.5], [0.11, 0.95, 0.55], [0.15, 0.95, 0.6]];
  function ramp(stops, v) {
    const f = clamp01(v) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), k = f - i;
    const a = stops[i], b = stops[i + 1];
    let dh = b[0] - a[0]; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
    return [a[0] + dh * k, lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  }
  const css = (c) => hsl(c[0], c[1], c[2]);
  const shade = (c, dl, ds) => [c[0], clamp01(c[1] + (ds || 0)), clamp01(c[2] + dl)];

  const PATTERNS = ['pied', 'barred', 'solid', 'speckled', 'laced'];
  // How the bill's shape changes a peck: toothy jaws bite hardest, a spoon barely hurts.
  const SHAPE_BITE = { spoon: 0.75, down: 0.95, up: 0.9, crossed: 0.9, casque: 1.1, skimmer: 0.95, sword: 1.2, jaws: 1.45, snout: 1.3 };
  const COMBS = ['casque', 'knob', 'single', 'rose', 'pea'];
  const bucket = (v) => (v < 0.18 ? 0 : v < 0.36 ? 1 : v < 0.64 ? 2 : v < 0.82 ? 3 : 4);
  const WEIGHT_CLASSES = [['Gnat', 0.15], ['Fly', 0.5], ['Feather', 1.5], ['Light', 4], ['Middle', 12], ['Heavy', 50], ['Titan', Infinity]];
  function weightClass(kg) { for (let i = 0; i < WEIGHT_CLASSES.length; i++) if (kg < WEIGHT_CLASSES[i][1]) return i; return WEIGHT_CLASSES.length - 1; }

  // o: { age (days; default adult), train: { muscle, lungs, reflex, courage } as 0..0.15 bonuses, cond (0..1 condition) }
  function express(g, o) {
    o = o || {};
    const t = {}, sw = {};
    for (const def of G.TRAIT_LIST) { if (def.shape) continue; if (def.switch) sw[def.id] = G.switchOn(g, def.id); else t[def.id] = G.traitValue(g, def.id); }
    const male = g.sex === 'M';
    if (!male) {
      t.comb *= 0.45; t.wattle *= 0.5; t.spur *= 0.3; t.tailLen *= t.tailLen > 1.3 ? 0.6 : 0.85; t.tailFan *= 0.7; t.size *= 0.93;
      t.aggression = Math.max(0, t.aggression - 0.08);
    } else t.aggression = Math.min(1, t.aggression + 0.05);

    const lifespan = Math.round(t.lifespan);
    const growDays = Math.max(1, Math.round(2.2 / t.growth));
    const age = o.age === undefined ? growDays : o.age;
    const grow = clamp01(age / growDays), k = 1 - grow;
    const elder = clamp01((age - lifespan * 0.8) / Math.max(1, lifespan * 0.2));
    const stage = grow < 0.5 ? 'chick' : grow < 1 ? 'young' : elder > 0 ? 'elder' : 'adult';
    const train = o.train || {};
    const cond = o.cond === undefined ? 1 : o.cond;

    const bodyLen = t.bodyLen * lerp(1, 0.82, k), bodyDepth = t.bodyDepth * lerp(1, 1.2, k);
    const neckLen = t.neckLen * lerp(1, 0.6, k), headRel = t.headSize * lerp(1, 1.45, k);
    const beakLen = t.beakLen * lerp(1, 0.75, k), legLen = t.legLen * lerp(1, 0.75, k);
    const wingSize = t.wingSize * lerp(1, 0.4, k), tailLen = t.tailLen * lerp(1, 0.15, k);
    const comb = t.comb * grow * grow, wattle = t.wattle * grow * grow, spur = t.spur * grow * grow, crest = t.crest * lerp(0.3, 1, grow);
    const S = t.size * (sw.gigas ? 1.45 : 1) * (sw.nana ? 0.62 : 1) * lerp(0.42, 1, grow);

    const P = { g, sex: g.sex, t, sw, age, grow, elder, stage, lifespan, growDays, S };
    P.person = sw.bare && sw.arms && beakLen < 0.2;
    P.twoHeads = !!(sw.twoHeadsA && sw.twoHeadsB);
    P.legPairs = sw.legsExtra ? 2 : 1;
    // geometry
    P.TL = 26 * S * bodyLen; P.TD = 19 * S * bodyDepth;
    P.posture = t.posture; P.pitch = lerp(8, 82, t.posture) * DEG;
    P.chest = t.chest;
    P.NL = 13 * S * neckLen; P.NT = 6.5 * S * t.neckThick;
    P.HR = 5.2 * S * headRel;
    if (P.person) P.NL = Math.max(P.NL, P.HR * 1.4); // a person's head sits on a neck, above the shoulders
    P.BL = 7 * S * beakLen * Math.sqrt(headRel); P.BD = 3.6 * S * t.beakDepth * Math.sqrt(headRel);
    P.hook = t.beakHook; P.flat = t.beakFlat; P.pouch = t.pouch; P.hasBeak = beakLen >= 0.15;
    // the bill's shape (genome.js): a spoon, a sickle, crossed tips, a casque, toothy jaws...
    P.shape = P.hasBeak && !P.person ? G.billShape(g) : 'plain';
    if (P.shape === 'sword') { P.BL *= 1.7; P.BD *= 0.6; } // a needle longer than the bird
    else if (P.shape === 'snout') { P.BL *= 1.15; P.BD *= 0.85; } // long and narrow, like a crocodile's
    // Legs run from the torso axis: LLv is the visible (genetic) leg below the belly, LL the whole strut.
    P.LLv = 21 * S * legLen; P.LL = P.LLv + 0.42 * P.TD; P.shin = t.shin; P.LT = 2.4 * S * t.legThick; P.FL = 7.5 * S * t.footSize;
    P.talon = t.talon; P.spur = spur; P.web = t.web;
    P.WL = 21 * S * wingSize; P.wingPoint = t.wingPoint;
    P.tailL = 15 * S * tailLen; P.tailFan = t.tailFan; P.tailUp = t.tailUp;
    P.armL = sw.arms ? 15 * S * t.armLen * (P.person ? 1.45 : 1) : 0;
    P.comb = comb; P.combType = COMBS[bucket(t.combType)]; P.wattle = wattle; P.crest = crest; P.bareHead = t.bareHead;
    P.eye = t.eyeSize; P.pattern = PATTERNS[bucket(t.pattern)]; P.patContrast = t.patContrast; P.belly = t.belly; P.sheen = t.sheen;
    P.stanceT = lerp(0.44, 0.06, smooth(t.posture));
    P.rest = 0.86 * P.LLv + 0.42 * P.TD;
    P.hsMax = Math.min(0.6 * P.LLv, 0.92 * Math.sqrt(P.LL * P.LL - P.rest * P.rest)); // longest half stride
    P.neckK = P.NL < 9 ? 1 : P.NL < 34 ? 2 : 3;
    const al = lerp(58, 88, t.posture), c = t.neckCurve;
    P.neckAng = (P.neckK === 1 ? [al] : P.neckK === 2 ? [al + 38 * c, al - 34 * c] : [al + 62 * c, al - 8 * c, al - 55 * c]).map((a) => a * DEG);
    P.tailAng = lerp(-25, 85, t.tailUp) * DEG;

    // colours
    const hue = G.hueValue(g);
    let sat = t.sat, lit = t.lit, h = hue;
    if (!sw.bare && k > 0) { lit = lerp(lit, 0.78, 0.55 * k); sat = lerp(sat, 0.55, 0.4 * k); h = lerp(h, 0.13, 0.5 * k); }
    if (elder > 0) sat *= 1 - 0.3 * elder;
    const body = [h, sat, lit];
    const col = { body,
      wing: [h + t.hueWing * grow, sat * 0.95, clamp(lit + t.litWing * grow, 0.05, 0.96)],
      tail: [h + t.hueTail, sat, clamp(lit + t.litTail, 0.05, 0.96)],
      head: [h + t.hueHead * grow, sat, clamp(lit + t.litHead * grow, 0.05, 0.96)],
      belly: [h, sat * 0.4, lerp(lit, 0.92, 0.75)],
      accent: [h + 0.33 + t.hueHead, 0.8, 0.45],
      comb: [t.combHue, 0.78, 0.47],
      skin: [t.combHue + 0.03, 0.5, 0.62],
      beak: ramp(BEAK_RAMP, t.beakTone), leg: ramp(LEG_RAMP, t.legTone), iris: ramp(EYE_RAMP, t.eyeTone),
      pat: [h, sat * 0.8, lit > 0.42 ? clamp01(lit - 0.12 - 0.3 * t.patContrast) : clamp01(lit + 0.14 + 0.3 * t.patContrast)],
    };
    // colour morphs: a dominant black and a recessive white, over whatever the colour genes say
    const white = sw.leucistic && !sw.bare, black = sw.melanic && !sw.bare && !white;
    if (white || black) {
      const L = white ? 0.94 : 0.1, Sa = white ? 0.04 : 0.28;
      col.body = [h, Sa, L]; col.wing = [col.wing[0], Sa, white ? 0.88 : 0.13]; col.tail = [col.tail[0], Sa, white ? 0.9 : 0.08];
      if (t.bareHead <= 0.5) col.head = [col.head[0], Sa, white ? 0.95 : 0.12];
      col.belly = [h, Sa * 0.5, white ? 0.98 : 0.17]; col.pat = [h, Sa, white ? 0.83 : 0.24];
    }
    if (sw.bare) { col.skin = body; col.hair = col.head; }
    P.col = col;
    if (black) P.sheen = Math.max(P.sheen, 0.55);
    P.css = {};
    for (const key of Object.keys(col)) P.css[key] = css(col[key]);
    P.css.bodyDark = css(shade(body, -0.1)); P.css.wingDark = css(shade(col.wing, -0.1)); P.css.legDark = css(shade(col.leg, -0.12));
    P.css.tailDark = css(shade(col.tail, -0.09)); P.css.wingTip = css(shade(col.wing, -0.16)); P.css.beakDark = css(shade(col.beak, -0.12));
    P.css.skinDark = css(shade(col.skin, -0.1));

    // physiology
    const ageF = (1 - 0.25 * elder) * lerp(0.55, 1, grow);
    P.muscle = t.muscle * ageF * (1 + (train.muscle || 0));
    P.reflex = t.reflex * ageF * (1 + (train.reflex || 0));
    P.lungs = t.lungs * (1 - 0.25 * elder) * (1 + (train.lungs || 0));
    P.bone = t.bone; P.hide = t.hide;
    P.aggression = t.aggression; P.courage = clamp01(t.courage + (train.courage || 0)); P.focus = t.focus; P.cunning = t.cunning;
    P.massRel = Math.pow(S, 2.6) * bodyLen * Math.pow(bodyDepth, 1.3) * t.bone;
    P.weightKg = 2.0 * Math.pow(S, 3) * bodyLen * bodyDepth * t.bone * (0.7 + 0.3 * legLen * t.legThick);
    P.weightClass = weightClass(P.weightKg);
    P.hpMax = 100 * Math.pow(P.massRel, 0.4) * Math.sqrt(t.bone) * Math.pow(t.hide, 0.8) * (1 - 0.2 * elder) * lerp(0.5, 1, grow) * lerp(0.6, 1, cond);
    P.stamMax = 100 * P.lungs;
    P.peckSharp = P.hasBeak
      ? (0.42 + 0.55 * t.beakHook + 0.4 * Math.min(beakLen, 2) / 2 * (1 - t.beakFlat)) * (1 - 0.55 * t.beakFlat) * (sw.teeth ? 1.25 : 1) * (0.75 + 0.25 * t.beakDepth) * (SHAPE_BITE[P.shape] || 1)
      : 0.22;
    P.kickSharp = 0.3 + 0.8 * spur + 0.9 * t.talon;
    P.punchSharp = sw.arms ? 0.5 + 0.35 * t.talon : 0;
    P.wingSharp = P.WL > 4 ? (0.25 + 0.5 * Math.min(2.2, wingSize)) * Math.sqrt(t.bone) : 0; // a wing buffet is blunt but heavy
    const tMin = (0.055 + 0.035 * Math.sqrt(P.LLv / 22)) / P.reflex;
    P.swingMin = tMin;
    P.speedMax = P.hsMax / (0.95 * tMin) * Math.pow(P.muscle, 0.6) / Math.pow(bodyDepth, 0.3) * (P.legPairs > 1 ? 1.15 : 1);
    P.jumpV = 300 * Math.pow(P.muscle, 0.8) * Math.pow(legLen, 0.35) * Math.pow(S, 0.3) / (Math.pow(bodyDepth, 0.4) * Math.pow(t.bone, 0.3) * Math.pow(P.massRel, 0.12));
    P.wingLoad = P.massRel > 0 ? (wingSize * S) * (wingSize * S) / P.massRel : 0;
    P.flapV = Math.min(420, 150 * Math.sqrt(P.wingLoad) * Math.sqrt(P.muscle) * Math.sqrt(S));
    P.canFly = P.wingLoad >= 1.2 && grow >= 1;
    P.balance = Math.sqrt(t.footSize) * Math.pow(t.legThick, 0.3) * (P.legPairs > 1 ? 1.5 : 1) / (1 + 0.25 * Math.max(0, legLen - 1)) * Math.pow(P.reflex, 0.3);
    P.traction = 0.75 + 0.25 * t.footSize + 0.2 * t.talon;
    P.peckReach = P.NL + P.HR + P.BL;
    P.rate = {
      power: Math.round(100 * clamp01(Math.max(P.peckSharp, P.kickSharp * 0.9, P.punchSharp, P.wingSharp * 0.8) * P.muscle * Math.pow(P.massRel, 0.2) / 2.6)),
      speed: Math.round(100 * clamp01(P.speedMax / 620)),
      tough: Math.round(100 * clamp01(P.hpMax / 330)),
      stamina: Math.round(100 * clamp01((P.stamMax - 40) / 130)),
      guts: Math.round(100 * P.courage),
      wits: Math.round(50 * (P.focus + P.cunning)),
      fury: Math.round(100 * P.aggression),
    };
    P.voice = { pitch: clamp(520 / Math.pow(S, 0.9), 90, 2600) * Math.pow(2, (t.voicePitch - 0.5) * 1.2), rasp: t.voiceRasp, len: t.voiceLen };
    P.species = RB.species ? RB.species.classify(g) : null;
    // what kind of call it makes (the audio picks the sound): a cross has the calls of both kinds
    P.voice.kind = P.person ? 'human' : P.species ? P.species.id : 'chicken';
    P.voice.kind2 = !P.person && P.species && !P.species.pure ? P.species.second : null;
    // list of visible oddities, for the info card and for pricing
    P.odd = [];
    if (sw.teeth && P.hasBeak) P.odd.push('teeth');
    if (sw.arms && !P.person) P.odd.push('arms');
    if (sw.bare && !P.person) P.odd.push('bare skin');
    if (P.twoHeads) P.odd.push('two heads');
    if (sw.glow) P.odd.push('glow');
    if (sw.tailBone && P.tailL > 4) P.odd.push('bony tail');
    if (sw.gigas) P.odd.push('giant');
    if (sw.nana) P.odd.push('dwarf');
    if (sw.cyclops) P.odd.push('one eye');
    if (sw.legsExtra) P.odd.push('four legs');
    if (sw.sail && !P.person) P.odd.push('back sail');
    if (white) P.odd.push('white morph');
    if (black) P.odd.push('black morph');
    return P;
  }

  RB.pheno = { express, weightClass, WEIGHT_CLASSES, PATTERNS, COMBS, ramp, SHAPE_BITE };
})();
