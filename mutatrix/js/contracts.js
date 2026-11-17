/* Mutatrix: encomendas de clientes (geração sempre cumprível e avaliação). Lógica pura. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});
  const { RNG, Data, Words, Subject } = MX;

  const SEVI = Object.fromEntries(Data.SEVS.map((s, i) => [s.id, i]));

  function tierFor(rep) { return rep < 4 ? 1 : rep < 10 ? 2 : 3; }

  function reqText(r) {
    switch (r.t) {
      case 'host': return 'Espécie: ' + Data.HOST[r.host].name;
      case 'theme': return 'Ao menos uma mutação de tema ' + Data.THEME[r.theme].name;
      case 'sevMin': return r.n > 1 ? 'Pelo menos ' + r.n + ' mutações ' + Data.SEV[r.sev].name + 's ou mais graves' : 'Pelo menos uma mutação ' + Data.SEV[r.sev].name + ' ou mais grave';
      case 'sevMax': return r.sev === 'destrutiva' ? 'Nenhuma mutação Destrutiva' : 'Nenhuma mutação Perigosa ou Destrutiva';
      case 'count': return 'Pelo menos ' + r.n + ' mutações diferentes';
      case 'biz': return 'Bizarrice de pelo menos ' + r.v;
      case 'instabMax': return 'Instabilidade abaixo de ' + r.v + '%';
      case 'instabMin': return 'Instabilidade acima de ' + r.v + '% (viva, por pouco)';
      case 'synergy': return 'Sinergia: ' + Data.SYNERGY[r.id].name;
      case 'synergyAny': return 'Qualquer sinergia';
      case 'arch': return 'Mutação: ' + Data.ARCHS[r.arch].noun;
      case 'group': return 'Ao menos uma mutação de ' + Data.GROUP_NAME[r.group].toLowerCase();
      default: return '?';
    }
  }

  function check(r, s) {
    switch (r.t) {
      case 'host': return s.host === r.host;
      case 'theme': return s.mutations.some((m) => m.theme === r.theme);
      case 'sevMin': return Subject.countBySev(s, SEVI[r.sev]) >= r.n;
      case 'sevMax': return Subject.countBySev(s, SEVI[r.sev]) === 0;
      case 'count': return s.mutations.length >= r.n;
      case 'biz': return s.biz >= r.v;
      case 'instabMax': return s.instab < r.v;
      case 'instabMin': return s.instab > r.v;
      case 'synergy': return s.synergies.includes(r.id);
      case 'synergyAny': return s.synergies.length > 0;
      case 'arch': return s.mutations.some((m) => m.arch === r.arch);
      case 'group': return s.mutations.some((m) => m.group === r.group);
      default: return false;
    }
  }

  function difficulty(r) {
    switch (r.t) {
      case 'host': return 0;
      case 'theme': return 15;
      case 'sevMin': return 18 * r.n + SEVI[r.sev] * 18;
      case 'sevMax': return 12;
      case 'count': return 10 * r.n;
      case 'biz': return Math.round(r.v * 0.6);
      case 'instabMax': return 20;
      case 'instabMin': return 45;
      case 'synergy': return 45;
      case 'synergyAny': return 30;
      case 'arch': return 40;
      case 'group': return 10;
      default: return 0;
    }
  }

  // Verificação conservadora de que os requisitos não se contradizem e cabem no que o jogador tem.
  function feasible(c, state) {
    const all = c.reqs.concat(c.bonus);
    const themes = new Set(state.unlocked.themes);
    const host = c.host ? Data.HOST[c.host] : Data.HOST.robo;
    let minCount = 1;
    let mild = false, needDanger = -1;
    for (const r of all) {
      if (r.t === 'theme' && !themes.has(r.theme)) return false;
      if (r.t === 'synergy') { const sy = Data.SYNERGY[r.id]; if (!themes.has(sy.a) || !themes.has(sy.b)) return false; minCount = Math.max(minCount, 2); }
      if (r.t === 'count') minCount = Math.max(minCount, r.n);
      if (r.t === 'sevMin') { needDanger = Math.max(needDanger, SEVI[r.sev]); minCount = Math.max(minCount, r.n); }
      if (r.t === 'sevMax') mild = SEVI[r.sev];
    }
    const themeReqs = all.filter((r) => r.t === 'theme').length;
    minCount = Math.max(minCount, themeReqs);
    if (mild !== false && needDanger >= mild) return false;
    const instabMax = all.find((r) => r.t === 'instabMax');
    const instabMin = all.find((r) => r.t === 'instabMin');
    if (instabMax && instabMin && instabMax.v - instabMin.v < 15) return false;
    if (instabMax) {
      const per = 8 * host.tol * 0.75 * 0.75;
      if (minCount * per > instabMax.v - 6) return false;
      if (needDanger >= 2 && 22 * host.tol * 0.75 * 0.75 > instabMax.v - 6) return false;
    }
    const biz = all.find((r) => r.t === 'biz');
    if (biz && mild !== false && biz.v > 70) return false;
    return true;
  }

  function generate(rng, state, seq) {
    const tier = Math.min(tierFor(state.rep), rng.weighted([1, 2, 3], (t) => (t > tierFor(state.rep) ? 0 : t === tierFor(state.rep) ? 3 : 1)));
    const themes = state.unlocked.themes.slice();
    for (let attempt = 0; attempt < 40; attempt++) {
      const first = rng.pick(Words.CLIENT_FIRST);
      let prof = rng.pick(Words.PROFESSIONS);
      if (prof.hard && tier < 2) prof = Words.PROFESSIONS[0];
      const profThemes = prof.themes.filter((t) => themes.includes(t));
      const pickTheme = (avoid) => {
        const pool = (profThemes.length && rng.chance(0.75) ? profThemes : themes).filter((t) => !avoid.includes(t));
        return pool.length ? rng.pick(pool) : null;
      };
      const host = rng.pick(Data.HOSTS).id;
      const reqs = [{ t: 'host', host }];
      const usedThemes = [];
      const addTheme = () => { const t = pickTheme(usedThemes); if (t) { usedThemes.push(t); reqs.push({ t: 'theme', theme: t }); } };
      addTheme();
      const extras = [];
      if (tier === 1) {
        extras.push(rng.pick([
          { t: 'sevMin', sev: 'bizarra', n: 1 }, { t: 'count', n: 2 }, { t: 'group', group: rng.pick(Data.GROUPS) }, { t: 'biz', v: 20 + rng.int(0, 2) * 5 },
        ]));
      } else if (tier === 2) {
        if (rng.chance(0.5)) addTheme();
        extras.push(rng.pick([
          { t: 'sevMin', sev: 'perigosa', n: 1 }, { t: 'count', n: 3 }, { t: 'biz', v: 40 + rng.int(0, 6) * 5 },
          { t: 'group', group: rng.pick(Data.GROUPS) }, { t: 'sevMin', sev: 'bizarra', n: 2 }, { t: 'arch', arch: rng.pick(Data.ARCH).id },
        ]));
      } else {
        const syns = Data.SYNERGIES.filter((s) => themes.includes(s.a) && themes.includes(s.b));
        if (syns.length && rng.chance(0.55)) reqs.push({ t: 'synergy', id: rng.pick(syns).id });
        else addTheme();
        extras.push(rng.pick([
          { t: 'arch', arch: rng.pick(Data.ARCH).id }, { t: 'biz', v: 80 + rng.int(0, 8) * 5 }, { t: 'instabMin', v: 70 },
          { t: 'sevMin', sev: 'destrutiva', n: 1 }, { t: 'count', n: 5 }, { t: 'sevMin', sev: 'perigosa', n: 2 },
        ]));
        if (rng.chance(0.4)) extras.push({ t: 'group', group: rng.pick(Data.GROUPS) });
      }
      for (const e of extras) reqs.push(e);
      if (prof.mild) reqs.push({ t: 'sevMax', sev: 'perigosa', n: 0 });
      else if (rng.chance(0.2) && tier < 3) reqs.push({ t: 'sevMax', sev: 'destrutiva', n: 0 });

      const bonus = [];
      const nb = rng.int(tier === 1 ? 0 : 1, 2);
      const bonusPool = [
        { t: 'instabMax', v: rng.pick([40, 50, 60]) }, { t: 'synergyAny' }, { t: 'group', group: rng.pick(Data.GROUPS) },
        { t: 'count', n: 3 + tier }, { t: 'biz', v: 30 + tier * 25 },
      ];
      const tb = pickTheme(usedThemes);
      if (tb) bonusPool.push({ t: 'theme', theme: tb });
      for (const b of rng.shuffle(bonusPool)) {
        if (bonus.length >= nb) break;
        if (reqs.some((r) => r.t === b.t && (r.group === b.group || b.t === 'count' || b.t === 'biz'))) continue;
        bonus.push(b);
      }

      const c = { id: seq || 1, tier, host, reqs, bonus };
      if (!feasible(c, state)) continue;
      const base = 40 + tier * 35 + reqs.reduce((a, r) => a + difficulty(r), 0);
      c.reward = Math.round(base / 5) * 5;
      c.bonusReward = bonus.map((b) => Math.max(15, Math.round((difficulty(b) * 0.8 + 10) / 5) * 5));
      c.rep = tier;
      c.client = {
        name: first.w + ' ' + rng.pick(Words.CLIENT_LAST),
        title: prof[first.g], g: first.g, seed: rng.u32(),
      };
      c.letter = rng.pick(Words.GREETINGS) + ' ' + rng.pick(prof.motives) + ' ' + rng.pick(Words.CLOSINGS);
      return c;
    }
    // Reserva: sempre cumprível.
    const host = rng.pick(Data.HOSTS).id;
    return {
      id: seq || 1, tier: 1, host, reqs: [{ t: 'host', host }, { t: 'count', n: 1 }], bonus: [], reward: 45, bonusReward: [], rep: 1,
      client: { name: 'Anônimo', title: 'Cliente Misterioso', g: 'm', seed: rng.u32() },
      letter: 'Qualquer coisa serve. Não pergunte por quê.',
    };
  }

  function evaluate(c, s) {
    const reqs = c.reqs.map((r) => ({ text: reqText(r), ok: !!s && check(r, s) }));
    const bonus = c.bonus.map((r, i) => ({ text: reqText(r), ok: !!s && check(r, s), reward: c.bonusReward[i] }));
    const ok = !!s && s.alive && reqs.every((r) => r.ok);
    const reward = c.reward + bonus.reduce((a, b) => a + (b.ok ? b.reward : 0), 0);
    return { ok, reqs, bonus, reward, allBonus: bonus.length > 0 && bonus.every((b) => b.ok) };
  }

  MX.Contracts = { tierFor, reqText, check, feasible, generate, evaluate, difficulty };
  if (typeof module === 'object' && module.exports) module.exports = MX.Contracts;
})(typeof window !== 'undefined' ? window : globalThis);
