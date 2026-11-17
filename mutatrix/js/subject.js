/* Mutatrix: cobaias (criação, injeção, rejeição, instabilidade, sinergias e colapso). Lógica pura. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});
  const { RNG, Data, Words, Mutations } = MX;

  const BASE = {
    rato: [
      { fur: '#f4f4f4', belly: '#e3d9cf', ear: '#ff77a8', eye: '#b13e53', nose: '#ff77a8' },
      { fur: '#c9a27e', belly: '#ecd8bd', ear: '#ff99bb', eye: '#1a1c2c', nose: '#ff77a8' },
      { fur: '#94b0c2', belly: '#d6e2ea', ear: '#ff99bb', eye: '#1a1c2c', nose: '#ff77a8' },
      { fur: '#e8c99a', belly: '#f7e6c8', ear: '#ff77a8', eye: '#1a1c2c', nose: '#ff77a8' },
    ],
    robo: [
      { plate: '#94b0c2', plate2: '#566c86', heart: '#ff77a8', eye: '#ffcd75' },
      { plate: '#e0b35f', plate2: '#a87b3a', heart: '#ff77a8', eye: '#73eff7' },
      { plate: '#ef7d57', plate2: '#b13e53', heart: '#ff77a8', eye: '#73eff7' },
      { plate: '#4fb8a8', plate2: '#257179', heart: '#ff77a8', eye: '#ffcd75' },
    ],
    planta: [
      { pot: '#ef7d57', pot2: '#b13e53', leaf: '#38b764', leaf2: '#257179', bulb: '#a7f070' },
      { pot: '#3b5dc9', pot2: '#29366f', leaf: '#38b764', leaf2: '#257179', bulb: '#ff77a8' },
      { pot: '#ffcd75', pot2: '#ef7d57', leaf: '#5cc96c', leaf2: '#2c8a50', bulb: '#ffaad4' },
      { pot: '#f4f4f4', pot2: '#94b0c2', leaf: '#38b764', leaf2: '#257179', bulb: '#ffe066' },
    ],
    ameba: [
      { gel: '#73eff7', core: '#257179', spot: '#f4f4f4' },
      { gel: '#a7f070', core: '#38b764', spot: '#f4f4f4' },
      { gel: '#c9a8f0', core: '#8a5cc9', spot: '#f4f4f4' },
      { gel: '#ffaad4', core: '#ff77a8', spot: '#f4f4f4' },
    ],
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function makeName(hostId, rng) {
    if (hostId === 'robo') {
      return rng.pick(Words.ROBOT_MODELS) + '-' + rng.int(10, 99) + ' ' + rng.pick(Words.SUBJECT_NAMES.robo.concat(Words.SUBJECT_NAMES.comum.slice(0, 10)));
    }
    const pool = Words.SUBJECT_NAMES[hostId].concat(Words.SUBJECT_NAMES.comum);
    const base = rng.pick(pool);
    if (rng.chance(0.55)) return rng.pick(rng.chance(0.5) ? Words.TITLES_M : Words.TITLES_F) + ' ' + base;
    return base;
  }

  function create(hostId, seed, seq) {
    const rng = RNG.make('subj:' + hostId + ':' + seed);
    const host = Data.HOST[hostId];
    const pal = rng.pick(BASE[hostId]);
    const base = Object.assign({}, pal, {
      size: rng.range(0.92, 1.08),
      a: rng.range(0, 1), b: rng.range(0, 1), c: rng.range(0, 1),
      leaves: rng.int(3, 5), lens: rng.chance(0.5) ? 1 : 2, antenna: rng.chance(0.6),
      phase: rng.range(0, Math.PI * 2),
    });
    return {
      id: seq || 1, host: host.id, seed: String(seed), name: makeName(hostId, rng), trait: rng.pick(Words.TRAITS),
      base, mutations: [], synergies: [], instab: 0, doses: 0, biz: 0, alive: true, collapse: null, uidSeq: 1,
    };
  }

  function affinity(host, themeId) {
    if (host.likes.includes(themeId)) return 0.75;
    if (host.dislikes.includes(themeId)) return 1.3;
    return 1;
  }

  function rejectChance(subject, virus) {
    const host = Data.HOST[subject.host];
    let p = 0.05 + subject.doses * 0.006;
    for (const s of virus.design.slots) {
      if (!s) continue;
      if (host.dislikes.includes(s.theme)) p += 0.06 * s.pot;
      else if (host.likes.includes(s.theme)) p -= 0.02 * s.pot;
    }
    return clamp(p, 0.02, 0.5);
  }

  function themesPresent(subject) {
    const set = new Set();
    for (const m of subject.mutations) set.add(m.theme);
    return set;
  }

  function computeBiz(subject) {
    let b = subject.mutations.length * 2 + subject.synergies.length * 15;
    for (const m of subject.mutations) b += Data.SEVS[m.sevIdx].biz * (1 + 0.3 * ((m.level || 1) - 1));
    return Math.round(b);
  }

  function instabFor(subject, m, capsidId) {
    const host = Data.HOST[subject.host];
    const cap = Data.CAPSID[capsidId] || Data.CAPSIDS[0];
    return Data.SEVS[m.sevIdx].instab * host.tol * affinity(host, m.theme) * cap.stab;
  }

  // Estimativa (para o painel) de quanto a cepa somaria de instabilidade, sem rejeição nem sinergias.
  function estimate(subject, virus) {
    if (!subject || !virus) return 0;
    const host = Data.HOST[subject.host];
    const cap = Data.CAPSID[virus.capsid];
    let total = 0;
    for (const vm of virus.mutations) {
      const exists = subject.mutations.some((m) => m.arch === vm.arch && m.theme === vm.theme);
      total += Data.SEV[vm.sev].instab * host.tol * affinity(host, vm.theme) * cap.stab * (exists ? 0.6 : 1);
    }
    return Math.round(total);
  }

  function pickCollapse(subject, rng) {
    const present = themesPresent(subject);
    return rng.weighted(Data.COLLAPSES, (c) => {
      let w = 1;
      for (const t of present) w += c.themes[t] || 0;
      return c.w * w * (c.hosts[subject.host] || 1);
    });
  }

  function payout(subject) { return Math.round(15 + subject.biz * 1.2); }

  // Aplica o vírus na cobaia (muta o objeto) e devolve o que aconteceu, na ordem em que deve ser mostrado.
  function inject(subject, virus) {
    const rng = RNG.make('inj:' + subject.seed + ':' + subject.doses + ':' + virus.key);
    const before = subject.instab;
    const res = { rejected: false, added: [], intensified: [], synergies: [], events: [], collapse: null, instabBefore: before, instabDelta: 0, warn: 0 };
    subject.doses++;
    if (rng.chance(rejectChance(subject, virus))) {
      res.rejected = true;
      subject.instab = clamp(subject.instab + 2, 0, 200);
      res.instabDelta = subject.instab - before;
      return res;
    }
    const partScale = (Data.CAPSID[virus.capsid] || {}).partScale || 1;
    let total = 0;
    for (const vm of virus.mutations) {
      const m = Mutations.instantiate(vm, subject.host, { name: subject.name, partScale, uid: subject.uidSeq++ });
      const existing = subject.mutations.find((x) => x.arch === m.arch && x.theme === m.theme);
      let add = instabFor(subject, m, virus.capsid);
      if (existing) {
        Mutations.intensify(existing, m.sev);
        add *= 0.6;
        res.intensified.push(existing);
        if (m.render.event) res.events.push({ event: m.render.event, theme: m.theme, mutation: existing });
      } else {
        subject.mutations.push(m);
        res.added.push(m);
        if (m.render.event) res.events.push({ event: m.render.event, theme: m.theme, mutation: m });
      }
      total += add;
    }
    const present = themesPresent(subject);
    for (const syn of Data.SYNERGIES) {
      if (present.has(syn.a) && present.has(syn.b) && !subject.synergies.includes(syn.id)) {
        subject.synergies.push(syn.id);
        res.synergies.push(syn);
        total += syn.instab;
      }
    }
    subject.instab = clamp(subject.instab + total, 0, 200);
    res.instabDelta = subject.instab - before;
    subject.biz = computeBiz(subject);
    if (before < 85 && subject.instab >= 85) res.warn = 85;
    else if (before < 60 && subject.instab >= 60) res.warn = 60;
    if (subject.instab >= 100) {
      const c = pickCollapse(subject, rng);
      subject.alive = false;
      subject.collapse = c.id;
      res.collapse = { id: c.id, name: c.name, desc: Mutations.fill(c.desc, { c: subject.name }), payout: payout(subject) };
    }
    return res;
  }

  function stabilize(subject, amount) {
    subject.instab = Math.max(0, subject.instab - (amount || 25));
    return subject.instab;
  }

  function countBySev(subject, minSevIdx) {
    return subject.mutations.filter((m) => m.sevIdx >= minSevIdx).length;
  }

  MX.Subject = { BASE, create, affinity, rejectChance, inject, estimate, stabilize, computeBiz, themesPresent, countBySev, payout, makeName };
  if (typeof module === 'object' && module.exports) module.exports = MX.Subject;
})(typeof window !== 'undefined' ? window : globalThis);
