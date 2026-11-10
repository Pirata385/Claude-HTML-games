/* Filogênese — catálogo de partes do corpo e cálculo de atributos a partir do genoma. */
(function (FG) {
  'use strict';
  const U = FG.U;
  const defs = [];
  // id, categoria, nível (1-4), custo em DNA, atributos, visual
  const P = (id, cat, tier, cost, st, vis) => defs.push({ id, cat, tier, cost, st, vis });

  // ---- Bocas (definem a dieta: H herbívoro, C carnívoro, O onívoro) ----
  P('m_broto', 'mouth', 1, 0, { diet: 'H', bite: 1, sing: 1 }, { k: 'beak', s: 0.85 });
  P('m_ceifa', 'mouth', 2, 25, { diet: 'H', bite: 2, sing: 2 }, { k: 'beak', s: 1.15 });
  P('m_moedor', 'mouth', 3, 60, { diet: 'H', bite: 3, sing: 3 }, { k: 'muzzle', s: 1.1 });
  P('m_trombeta', 'mouth', 4, 110, { diet: 'H', bite: 2, sing: 5 }, { k: 'trumpet', s: 1.1 });
  P('m_dentilha', 'mouth', 1, 0, { diet: 'C', bite: 2, sing: 1 }, { k: 'fangs', s: 0.85 });
  P('m_rasgador', 'mouth', 2, 30, { diet: 'C', bite: 3, sing: 1 }, { k: 'fangs', s: 1.15 });
  P('m_tesoura', 'mouth', 3, 65, { diet: 'C', bite: 4, sing: 2 }, { k: 'mandibles', s: 1.1 });
  P('m_tritura', 'mouth', 4, 120, { diet: 'C', bite: 5, sing: 2 }, { k: 'maw', s: 1.25 });
  P('m_miuda', 'mouth', 1, 0, { diet: 'O', bite: 1, sing: 2 }, { k: 'snout', s: 0.85 });
  P('m_versatil', 'mouth', 2, 30, { diet: 'O', bite: 2, sing: 3 }, { k: 'snout', s: 1.15 });
  P('m_sugador', 'mouth', 3, 65, { diet: 'O', bite: 3, sing: 4 }, { k: 'proboscis', s: 1.0 });
  P('m_bocarra', 'mouth', 4, 115, { diet: 'O', bite: 4, sing: 4 }, { k: 'maw', s: 1.0 });

  // ---- Olhos (sentidos: alcance do radar e de detecção) ----
  P('e_conta', 'eyes', 1, 0, { sense: 1 }, { k: 'bead' });
  P('e_redondo', 'eyes', 1, 10, { sense: 2, charm: 1 }, { k: 'round' });
  P('e_fenda', 'eyes', 2, 25, { sense: 3, stealth: 1 }, { k: 'slit' });
  P('e_pedunculo', 'eyes', 3, 50, { sense: 4 }, { k: 'stalk' });
  P('e_lanterna', 'eyes', 3, 55, { sense: 3, charm: 2 }, { k: 'lantern' });
  P('e_composto', 'eyes', 4, 90, { sense: 5 }, { k: 'compound' });

  // ---- Pés (valem para todas as pernas) ----
  P('f_coto', 'feet', 1, 0, { speed: 1 }, { k: 'stub' });
  P('f_almofada', 'feet', 1, 10, { speed: 2, stealth: 2 }, { k: 'pad' });
  P('f_sapateador', 'feet', 1, 12, { speed: 1, dance: 2 }, { k: 'tapper' });
  P('f_casco', 'feet', 2, 25, { speed: 3, charge: 1 }, { k: 'hoof' });
  P('f_palmado', 'feet', 2, 25, { speed: 2, swim: 3, dance: 1 }, { k: 'web' });
  P('f_mola', 'feet', 2, 30, { speed: 3, jump: 3 }, { k: 'spring' });
  P('f_bailarino', 'feet', 2, 30, { speed: 2, dance: 3 }, { k: 'dancer' });
  P('f_pisao', 'feet', 2, 30, { speed: 1, dance: 1, pose: 1, hp: 18 }, { k: 'stomper' });
  P('f_veloz', 'feet', 3, 55, { speed: 4, strike: 1, stealth: 3 }, { k: 'talon' });
  P('f_nadadeira', 'feet', 3, 50, { speed: 2, swim: 5 }, { k: 'flipper' });
  P('f_saltador', 'feet', 3, 60, { speed: 3, jump: 5 }, { k: 'jumper' });
  P('f_compasso', 'feet', 3, 60, { speed: 3, dance: 4 }, { k: 'dancer' });
  P('f_corredor', 'feet', 4, 95, { speed: 5 }, { k: 'runner' });
  P('f_ritmo', 'feet', 4, 100, { speed: 3, dance: 5 }, { k: 'rhythm' });

  // ---- Braços (golpe) ----
  P('a_pinca', 'arms', 1, 12, { strike: 1 }, { k: 'pincer' });
  P('a_garra', 'arms', 2, 28, { strike: 2 }, { k: 'claw' });
  P('a_martelo', 'arms', 3, 60, { strike: 3, pose: 2 }, { k: 'hammer' });
  P('a_foice', 'arms', 3, 70, { strike: 4 }, { k: 'scythe' });
  P('a_laminas', 'arms', 4, 125, { strike: 5 }, { k: 'blades' });

  // ---- Chifres (investida e pose) ----
  P('h_galo', 'horn', 1, 12, { charge: 1 }, { k: 'bump' });
  P('h_nasal', 'horn', 2, 28, { charge: 2, pose: 1 }, { k: 'nasal' });
  P('h_galhada', 'horn', 3, 65, { charge: 2, pose: 4 }, { k: 'antlers' });
  P('h_ariete', 'horn', 3, 70, { charge: 4 }, { k: 'ram' });
  P('h_coroa', 'horn', 4, 110, { charge: 1, pose: 5, charm: 2 }, { k: 'crown' });
  P('h_tridente', 'horn', 4, 125, { charge: 5, pose: 2 }, { k: 'trident' });

  // ---- Caudas ----
  P('t_chicote', 'tail', 1, 10, { strike: 1 }, { k: 'whip' });
  P('t_leme', 'tail', 2, 22, { swim: 3 }, { k: 'rudder' });
  P('t_chocalho', 'tail', 2, 28, { sing: 2, pose: 2 }, { k: 'rattle' });
  P('t_leque', 'tail', 2, 30, { charm: 3 }, { k: 'fan' });
  P('t_clava', 'tail', 2, 35, { strike: 3 }, { k: 'club' });
  P('t_ferrao', 'tail', 3, 60, { spit: 2, strike: 2 }, { k: 'stinger' });
  P('t_estrela', 'tail', 3, 70, { strike: 4 }, { k: 'star' });
  P('t_aurora', 'tail', 4, 110, { charm: 5 }, { k: 'aurora' });

  // ---- Dorso ----
  P('b_juba', 'back', 2, 30, { charm: 2, pose: 2 }, { k: 'mane' });
  P('b_espinhos', 'back', 2, 30, { hp: 10, thorns: 1 }, { k: 'spikes' });
  P('b_vela', 'back', 2, 32, { pose: 3, charm: 1 }, { k: 'sail' });
  P('b_asinhas', 'back', 2, 35, { jump: 2, glide: 1, charm: 1 }, { k: 'winglets' });
  P('b_placas', 'back', 3, 60, { hp: 32, thorns: 1 }, { k: 'plates' });
  P('b_bulbos', 'back', 3, 65, { charm: 4 }, { k: 'bulbs' });
  P('b_asas', 'back', 4, 105, { jump: 4, glide: 3, charm: 2 }, { k: 'wings' });
  P('b_couraca', 'back', 4, 110, { hp: 60, thorns: 2 }, { k: 'carapace' });

  // ---- Glândulas (cuspe) ----
  P('g_saliva', 'gland', 1, 12, { spit: 1 }, { k: 'cheek', s: 0.7 });
  P('g_acida', 'gland', 2, 35, { spit: 3 }, { k: 'cheek', s: 1.0 });
  P('g_toxina', 'gland', 3, 70, { spit: 4 }, { k: 'cheek', s: 1.3 });
  P('g_canhao', 'gland', 4, 120, { spit: 5 }, { k: 'cannon', s: 1.0 });

  // ---- Voz (canto) ----
  P('v_papo', 'voice', 1, 12, { sing: 2 }, { k: 'sac', s: 0.8 });
  P('v_ressoador', 'voice', 2, 30, { sing: 3, pose: 1 }, { k: 'resonator', s: 1 });
  P('v_flautas', 'voice', 3, 65, { sing: 4 }, { k: 'flutes', s: 1 });
  P('v_coral', 'voice', 4, 115, { sing: 5 }, { k: 'choir', s: 1.1 });

  // ---- Adornos (encanto) ----
  P('d_topete', 'adorn', 1, 10, { charm: 1 }, { k: 'tuft' });
  P('d_crista', 'adorn', 2, 28, { charm: 2, pose: 1 }, { k: 'crest' });
  P('d_babados', 'adorn', 3, 60, { pose: 3, charm: 2 }, { k: 'frill' });
  P('d_plumas', 'adorn', 3, 65, { charm: 4, sense: 2 }, { k: 'plumes' });
  P('d_halo', 'adorn', 4, 110, { charm: 5 }, { k: 'halo' });

  const byId = {};
  for (const d of defs) byId[d.id] = d;

  const CATS = ['mouth', 'eyes', 'feet', 'arms', 'horn', 'tail', 'back', 'gland', 'voice', 'adorn'];
  const REQUIRED = { mouth: true, eyes: true, feet: true };
  const COMBAT = ['bite', 'charge', 'spit', 'strike'];
  const SOCIAL = ['sing', 'dance', 'charm', 'pose'];
  const MOVE = ['speed', 'jump', 'swim', 'sense', 'stealth', 'glide'];
  const LEVELED = COMBAT.concat(SOCIAL, MOVE);

  const Parts = FG.Parts = {
    defs, byId, CATS, REQUIRED, COMBAT, SOCIAL, MOVE,
    get: (id) => byId[id] || null,
    inCat: (cat) => defs.filter((d) => d.cat === cat),

    /** Custo total em DNA das partes de um genoma. */
    cost(g) {
      let c = 0;
      for (const cat of CATS) { const p = byId[g.parts[cat]]; if (p) c += p.cost; }
      return c;
    },

    /** Partes disponíveis desde o início: todas as de nível 1 baratas. */
    starterUnlocks() { return defs.filter((d) => d.tier === 1 && d.cost <= 12).map((d) => d.id); },

    /** Atributos derivados do genoma. `level` é o nível cerebral (aumenta a vida). */
    stats(g, level) {
      const st = { bite: 1, charge: 0, spit: 0, strike: 0, sing: 1, dance: 1, charm: 0, pose: 0,
        speed: 1, jump: 1, swim: 1, sense: 1, stealth: 0, glide: 0, thorns: 0, diet: 'O' };
      let hpBonus = 0;
      for (const cat of CATS) {
        const p = byId[g.parts[cat]];
        if (!p) continue;
        if (cat === 'feet' && g.legs.pairs === 0) continue;   // sem pernas, os pés não contam
        for (const k in p.st) {
          const v = p.st[k];
          if (k === 'diet') st.diet = v;
          else if (k === 'hp') hpBonus += v;
          else if (k === 'thorns') st.thorns += v;
          else if (v > st[k]) st[k] = v;
        }
      }
      if (g.legs.pairs === 0) { st.speed = 2; st.jump = 0; st.stealth = Math.max(st.stealth, 2); st.swim = Math.max(st.swim, 2); }
      for (const k of LEVELED) st[k] = U.clamp(st[k], 0, 5);
      const girth = (g.prof[0] + g.prof[1] * 2 + g.prof[2]) / 4;
      const bulk = Math.pow(g.size, 1.6) * girth * (0.6 + g.segs / 20);
      st.bulk = bulk;
      st.hp = Math.round((38 + 34 * bulk) * (1 + 0.14 * ((level || 1) - 1)) + hpBonus);
      const legF = g.legs.pairs === 0 ? 1 : 0.92 + 0.08 * g.legs.len;
      st.moveSpeed = Math.round((98 + 17 * st.speed) * legF * Math.pow(g.size, 0.25) * (girth > 1.25 ? 0.94 : 1));
      st.power = Math.pow(g.size, 0.5);   // multiplicador de dano pelo porte
      st.combat = st.bite + st.charge + st.spit + st.strike;
      st.social = st.sing + st.dance + st.charm + st.pose;
      return st;
    },

    /** Nicho ecológico sugerido pelos atributos (usado para o jogador). */
    nicheOf(st) {
      if (st.diet === 'H') {
        if (st.social >= 12) return 'cantor';
        if (st.hp >= 130) return 'ramoneador';
        if (st.jump >= 3) return 'frugivoro';
        return 'pastador';
      }
      if (st.diet === 'C') {
        if (st.hp >= 150 && st.combat >= 12) return 'apice';
        if (st.stealth >= 2) return 'emboscador';
        return 'matilha';
      }
      if (st.swim >= 3) return 'anfibio';
      if (st.social >= 12) return 'cantor';
      return 'oportunista';
    },

    /** Genoma inicial do jogador conforme a dieta escolhida. */
    starterGenome(diet, seed) {
      const r = U.rng(seed);
      const hue = diet === 'H' ? r.range(80, 160) : diet === 'C' ? r.range(340, 400) % 360 : r.range(25, 55);
      return {
        seed: seed >>> 0, size: 0.9, segs: 8, len: 1, prof: [0.95, 1.1, 0.9], tailLen: 0.32,
        head: { shape: diet === 'C' ? 'wedge' : diet === 'H' ? 'round' : 'long', size: 1.05 },
        eyePairs: 1, legs: { pairs: 2, len: 1 },
        parts: { mouth: diet === 'H' ? 'm_broto' : diet === 'C' ? 'm_dentilha' : 'm_miuda', eyes: 'e_conta', feet: diet === 'C' ? 'f_almofada' : 'f_coto',
          arms: null, horn: null, tail: null, back: null, gland: null, voice: null, adorn: null },
        skin: { pattern: r.pick(['spots', 'stripes', 'dorsal']), c1: [hue, 55, 52], c2: [(hue + 30) % 360, 60, 34], c3: [(hue + 180) % 360, 75, 60] },
      };
    },

    cloneGenome(g) { return JSON.parse(JSON.stringify(g)); },
  };
})(window.FG = window.FG || {});
