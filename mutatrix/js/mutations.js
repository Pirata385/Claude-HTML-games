/* Mutatrix: transforma a mutação "crua" de um vírus numa mutação concreta para uma espécie. Lógica pura. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});
  const { RNG, Data } = MX;

  const SEV_INDEX = Object.fromEntries(Data.SEVS.map((s, i) => [s.id, i]));

  const HOST_SKIN_LINE = {
    rato: ['Na versão roedora, tudo veio coberto de pelo macio e cheiro de serragem.', 'O rato encarou a novidade com o bigode tremendo de emoção.', 'Veio peludinho, como tudo que nasce num rato.'],
    robo: ['Na versão robótica, a coisa veio com parafusos, cabos e um manual em húngaro.', 'Os servomotores rangeram em protesto, mas aceitaram a peça nova.', 'Saiu cromado, com garantia de três meses e um coração pulsando por trás.'],
    planta: ['Como é uma planta, tudo brotou com clorofila e cheiro de terra molhada.', 'A planta tratou a novidade como mais um galho, só que bem mais esquisito.', 'Brotou verdinho e com nervuras, como manda a botânica.'],
    ameba: ['Na ameba, tudo veio em gelatina translúcida que balança ao menor sopro.', 'A ameba absorveu a novidade e fez dela parte da gosma.', 'Ficou molenga e brilhante, como tudo que mora dentro de uma ameba.'],
  };

  function fill(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
  }

  function partCap(part) {
    return { eye: 8, tentacle: 6, wing: 4, horn: 4, spikes: 18, antenna: 5, mouth: 3, tail: 3, arms: 6, crystals: 9, flowers: 9, mushrooms: 7, fin: 4, lamp: 5 }[part] || 1;
  }

  // vm: { theme, group, arch, sev, seed, wild } vindo de Genetics.synthesize.
  // opts: { name (nome da cobaia), partScale (do capsídeo), uid }
  function instantiate(vm, hostId, opts) {
    opts = opts || {};
    const arch = Data.ARCHS[vm.arch];
    const theme = Data.THEME[vm.theme];
    const host = Data.HOST[hostId];
    const sevIdx = SEV_INDEX[vm.sev];
    const rng = RNG.make((vm.seed ^ RNG.hash32(hostId)) >>> 0);
    const partScale = opts.partScale || 1;

    const name = arch.noun + ' ' + (rng.chance(0.55) ? theme.adj[arch.g] : rng.pick(theme.comp));
    let n = 1;
    if (arch.count) {
      n = rng.int(arch.count[0], arch.count[1]);
      if (arch.count[1] > 1) n = Math.max(arch.count[0], Math.min(partCap(arch.part), Math.round(n * partScale)));
    }
    if (arch.beh === 'clones') n = rng.int(2, 4);
    const pattern = rng.pick(Data.PATTERNS);
    const vars = { c: opts.name || 'A cobaia', n, pat: pattern.name, part: theme.partName };
    let desc = fill(rng.pick(arch.desc), vars);
    // Frases que começam com o nome da cobaia ficam com inicial maiúscula mesmo quando o nome padrão é usado.
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
    desc += ' ' + rng.pick(theme.flavor);
    if (arch.group === 'parte') desc += ' ' + rng.pick(HOST_SKIN_LINE[host.id]);
    if (sevIdx >= 2) desc += ' ' + Data.DANGER_TEXT[theme.id];
    if (sevIdx === 3) desc += ' Ao surgir, provocou: ' + Data.EVENTS[theme.event].name + '.';

    const render = {
      seed: rng.u32(),
      color: theme.color,
      color2: theme.color2,
      size: rng.range(0.85, 1.2) * partScale * (1 + sevIdx * 0.07),
      wob: rng.range(0.6, 1.5),
    };
    if (arch.part) { render.part = arch.part; render.n = n; }
    if (arch.body) { render.body = arch.body; render.pattern = pattern.id; render.amount = rng.range(0.7, 1.15); }
    if (arch.beh) { render.beh = arch.beh; render.n = n; render.intensity = rng.range(0.7, 1.3); }
    if (sevIdx >= 2) render.danger = theme.danger;
    if (sevIdx === 3) render.event = theme.event;

    return {
      uid: opts.uid || 0,
      arch: arch.id, group: arch.group, theme: theme.id, sev: vm.sev, sevIdx,
      name, desc, n, wild: !!vm.wild, level: 1, render, born: 0,
    };
  }

  // Intensifica uma mutação já existente (mesmo arquétipo e tema).
  function intensify(m, incomingSev) {
    m.level = (m.level || 1) + 1;
    const r = m.render;
    if (r.part && partCap(r.part) > 1) { r.n = Math.min(partCap(r.part), r.n + 1); m.n = r.n; }
    r.size = Math.min(r.size * 1.12, 2.2);
    if (r.amount) r.amount = Math.min(r.amount * 1.12, 1.6);
    if (r.intensity) r.intensity = Math.min(r.intensity * 1.15, 2.2);
    const inc = SEV_INDEX[incomingSev];
    if (inc > m.sevIdx) { m.sevIdx = inc; m.sev = incomingSev; }
    return m;
  }

  MX.Mutations = { instantiate, intensify, SEV_INDEX, partCap, fill };
  if (typeof module === 'object' && module.exports) module.exports = MX.Mutations;
})(typeof window !== 'undefined' ? window : globalThis);
