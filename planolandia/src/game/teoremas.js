/* Planolândia — Teoremas: amuletos equipados em Postulados (encaixes), trocados só nos Pontos Fixos. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  // efeito(m) altera o objeto de modificadores
  const TEOREMAS = {
    angulo_reto: { nome: 'Ângulo Reto', custo: 1, desc: 'Golpes mais rápidos: a Aresta volta 28% antes.', efeito: (m) => { m.atkCd *= 0.72; } },
    ima: { nome: 'Ímã de Vértices', custo: 1, desc: 'Vértices são atraídos de bem mais longe.', efeito: (m) => { m.magnet = 120; } },
    pitagoras: { nome: 'Pitágoras', custo: 2, desc: 'O quadrado da hipotenusa… alcança mais longe: golpe 9 px maior.', efeito: (m) => { m.reach += 9; } },
    paralelas: { nome: 'Postulado das Paralelas', custo: 1, desc: 'Deslize na profundidade 40% mais rápido.', efeito: (m) => { m.depth *= 1.4; } },
    lema_foco: { nome: 'Lema do Foco', custo: 2, desc: 'O Foco cura em bem menos tempo.', efeito: (m) => { m.focusT *= 0.65; } },
    bissetriz: { nome: 'Bissetriz', custo: 3, desc: 'O golpe corta também um pouco à frente e atrás: atinge até 12 de profundidade.', efeito: (m) => { m.atkDepth = 12; } },
  };

  const round = (v) => Math.round(v * 1000) / 1000;

  const Teoremas = {
    used(st) { return st.equip.reduce((s, id) => s + (TEOREMAS[id] ? TEOREMAS[id].custo : 0), 0); },
    // equipa/desequipa; devolve true se mudou
    toggle(st, id) {
      const t = TEOREMAS[id];
      if (!t || !st.teoremas[id]) return false;
      const i = st.equip.indexOf(id);
      if (i >= 0) { st.equip.splice(i, 1); return true; }
      if (Teoremas.used(st) + t.custo > st.postulados) return false;
      st.equip.push(id);
      return true;
    },
    mods(st) {
      const m = { atkCd: 1, reach: 0, magnet: 44, depth: 1, focusT: 1, atkDepth: 0 };
      for (const id of (st.equip || [])) if (TEOREMAS[id] && st.teoremas && st.teoremas[id]) TEOREMAS[id].efeito(m);
      for (const k in m) m[k] = round(m[k]);
      return m;
    },
  };

  PL.TEOREMAS = TEOREMAS;
  PL.Teoremas = Teoremas;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
