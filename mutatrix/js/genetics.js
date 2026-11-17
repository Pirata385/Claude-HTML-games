/* Mutatrix: síntese de vírus a partir da receita (capsídeo, reagentes, mostradores, semente) e códigos de cepa. Lógica pura. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});
  const { RNG, Data, Words } = MX;

  const MAX_SLOTS = 6;
  const SEV_IDS = Data.SEVS.map((s) => s.id);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function emptyDesign(seed) {
    return { capsid: 'icosaedro', slots: [null, null, null, null, null, null], virulence: 35, chaos: 15, seed: seed || 'GENE5' };
  }

  function normalizeDesign(d) {
    const slots = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const s = d && d.slots ? d.slots[i] : null;
      slots.push(s && Data.THEME[s.theme] ? { theme: s.theme, pot: clamp(Math.round(s.pot || 1), 1, 3) } : null);
    }
    let seed = RNG.normalizeB32(d && d.seed).replace(/[^0-9A-Z]/g, '').slice(0, 5);
    while (seed.length < 5) seed += '0';
    return {
      capsid: d && Data.CAPSID[d.capsid] ? d.capsid : 'icosaedro',
      slots,
      virulence: clamp(Math.round((d && d.virulence) || 0), 0, 100),
      chaos: clamp(Math.round((d && d.chaos) || 0), 0, 100),
      seed,
    };
  }

  function designKey(d) {
    return [d.capsid, d.slots.map((s) => (s ? s.theme + s.pot : '-')).join(','), d.virulence, d.chaos, d.seed].join('|');
  }

  function severityFromScore(s) {
    if (s < 0.45) return 'inofensiva';
    if (s < 0.85) return 'bizarra';
    if (s < 1.3) return 'perigosa';
    return 'destrutiva';
  }

  // design -> vírus. Retorna null se a fita estiver vazia.
  function synthesize(designIn) {
    const d = normalizeDesign(designIn);
    const filled = d.slots.filter(Boolean);
    if (!filled.length) return null;
    const key = designKey(d);
    const rng = RNG.make('virus:' + key);
    const cap = Data.CAPSID[d.capsid];
    const chaos = clamp(d.chaos + cap.chaos, 0, 100);

    const themeW = {};
    for (const s of filled) themeW[s.theme] = (themeW[s.theme] || 0) + Math.pow(s.pot, 1.3);
    const themeList = Object.keys(themeW).map((id) => ({ id, w: themeW[id] }));

    let count = 1 + (filled.length >= 3 ? 1 : 0) + (filled.length >= 5 ? 1 : 0);
    if (rng.chance(chaos / 300)) count++;
    count = Math.min(count, 4);

    const used = new Set();
    const mutations = [];
    for (let i = 0; i < count; i++) {
      const wild = rng.chance((chaos / 100) * 0.45);
      const themeId = wild ? rng.pick(Data.THEMES).id : rng.weighted(themeList).id;
      const theme = Data.THEME[themeId];
      const group = rng.weighted(Data.GROUPS, (g) => cap.bias[g] * theme.bias[g]);
      let arch = rng.weighted(Data.ARCH, (a) => (a.group !== group || used.has(a.id) ? 0 : 1 + (a.themes.includes(themeId) ? 2.5 : 0)));
      if (!arch) arch = rng.weighted(Data.ARCH, (a) => (used.has(a.id) ? 0 : 1)) || Data.ARCH[0];
      used.add(arch.id);
      const potBonus = ((themeW[themeId] || 1) - 1) * 0.06;
      let score = (d.virulence / 100) * 1.25 + cap.sev + arch.sev + potBonus + rng.range(-0.35, 0.35) + (wild ? 0.1 : 0);
      if (cap.destroy && rng.chance(0.25)) score += 0.4;
      const sev = severityFromScore(score);
      mutations.push({ theme: themeId, group: arch.group, arch: arch.id, sev, seed: rng.u32(), wild });
    }

    const top = themeList.slice().sort((a, b) => b.w - a.w);
    const c1 = Data.THEME[top[0].id];
    const c2 = Data.THEME[(top[1] || top[0]).id];
    const visual = {
      capsid: d.capsid,
      color: c1.color, color2: c2.color, accent: c1.color2,
      spikes: rng.int(7, 14), spikeLen: rng.range(0.25, 0.5), wobble: rng.range(0.4, 1.4),
      dots: rng.int(3, 9), rot: rng.range(0, Math.PI * 2), seed: rng.u32(),
    };

    // nome: "Cepa KX-77, Soluço Estelar"
    const tag = RNG.B32[10 + rng.int(0, 21)] + RNG.B32[10 + rng.int(0, 21)] + '-' + rng.int(10, 99);
    const noun = rng.pick(Words.VIRUS_NOUNS);
    let adj;
    if (rng.chance(0.4)) adj = noun.g === 'm' ? c1.adj.ms : c1.adj.fs;
    else { const a = rng.pick(Words.VIRUS_ADJS); adj = a[noun.g]; }
    const nick = noun.w + ' ' + adj;

    return {
      key, code: encode(d), design: d, tag, nick, name: 'Cepa ' + tag + ', ' + nick,
      mutations, visual, capsid: d.capsid, chaos,
    };
  }

  // ---------------------------------------------------------------- códigos de cepa
  // 2 bits versão, 3 capsídeo, 6x(4 tema + 2 potência), 7 virulência, 7 caos, 25 semente = 80 bits + 10 de verificação.
  function seedToInt(seed) {
    let v = 0;
    for (const ch of seed) v = v * 32 + Math.max(0, RNG.B32.indexOf(ch));
    return v;
  }
  function intToSeed(v) {
    let s = '';
    for (let i = 0; i < 5; i++) { s = RNG.B32[v % 32] + s; v = Math.floor(v / 32); }
    return s;
  }
  function pack(d) {
    let x = 1n; // versão
    const push = (val, bits) => { x = (x << BigInt(bits)) | BigInt(val); };
    push(Data.CAPSIDS.findIndex((c) => c.id === d.capsid), 3);
    for (const s of d.slots) {
      push(s ? Data.THEMES.findIndex((t) => t.id === s.theme) + 1 : 0, 4);
      push(s ? s.pot : 0, 2);
    }
    push(d.virulence, 7);
    push(d.chaos, 7);
    push(seedToInt(d.seed), 25);
    return x;
  }
  function checksum(x) { return RNG.hash32('mx' + x.toString(36)) % 1024; }

  function encode(designIn) {
    const d = normalizeDesign(designIn);
    const x = (pack(d) << 10n) | BigInt(checksum(pack(d)));
    let s = '';
    let v = x;
    for (let i = 0; i < 18; i++) { s = RNG.B32[Number(v & 31n)] + s; v >>= 5n; }
    return 'MX-' + s.slice(0, 6) + '-' + s.slice(6, 12) + '-' + s.slice(12);
  }

  function decode(code) {
    let s = RNG.normalizeB32(code);
    if (s.startsWith('MX')) s = s.slice(2);
    if (s.length !== 18 || /[^0-9A-Z]/.test(s)) return null;
    let x = 0n;
    for (const ch of s) {
      const i = RNG.B32.indexOf(ch);
      if (i < 0) return null;
      x = (x << 5n) | BigInt(i);
    }
    const sum = Number(x & 1023n);
    let body = x >> 10n;
    if (checksum(body) !== sum) return null;
    const take = (bits) => { const v = Number(body & ((1n << BigInt(bits)) - 1n)); body >>= BigInt(bits); return v; };
    const seed = intToSeed(take(25));
    const chaos = take(7);
    const virulence = take(7);
    const slots = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const pot = take(2);
      const t = take(4);
      slots.unshift(t > 0 && t <= Data.THEMES.length && pot > 0 ? { theme: Data.THEMES[t - 1].id, pot } : null);
    }
    const capIdx = take(3);
    const version = Number(body);
    if (version !== 1 || !Data.CAPSIDS[capIdx] || virulence > 100 || chaos > 100) return null;
    return normalizeDesign({ capsid: Data.CAPSIDS[capIdx].id, slots, virulence, chaos, seed });
  }

  // ---------------------------------------------------------------- previsão do analisador
  // Nível 1: temas e quantidade. Nível 2: + grupo e classe. Nível 3: + mutação exata.
  function predict(virus, level) {
    if (!virus) return [];
    return virus.mutations.map((m) => {
      const t = Data.THEME[m.theme];
      const a = Data.ARCHS[m.arch];
      const sev = Data.SEV[m.sev];
      return {
        theme: m.wild && level < 3 ? null : t,
        themeName: m.wild && level < 3 ? 'Desconhecido' : t.name,
        group: level >= 2 ? Data.GROUP_NAME[m.group] : null,
        sev: level >= 2 ? sev : null,
        arch: level >= 3 ? a.noun : null,
        wild: m.wild,
      };
    });
  }

  MX.Genetics = { MAX_SLOTS, SEV_IDS, emptyDesign, normalizeDesign, designKey, synthesize, encode, decode, predict, severityFromScore };
  if (typeof module === 'object' && module.exports) module.exports = MX.Genetics;
})(typeof window !== 'undefined' ? window : globalThis);
