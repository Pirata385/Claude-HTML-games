/* Planolândia — salvamento em 3 espaços (localStorage) e configurações. Funciona mesmo sem armazenamento. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  const mem = {};
  function get(k) {
    try { const v = root.localStorage && root.localStorage.getItem(k); return v === null || v === undefined ? (k in mem ? mem[k] : null) : v; } catch (e) { return k in mem ? mem[k] : null; }
  }
  function set(k, v) {
    mem[k] = v;
    try { root.localStorage && root.localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: fica na memória */ }
  }
  function del(k) {
    delete mem[k];
    try { root.localStorage && root.localStorage.removeItem(k); } catch (e) { /* idem */ }
  }

  const DEFAULT_SETTINGS = { music: 0.6, sfx: 0.8, shake: true, flashes: true, preset: 'wasd', touchOpacity: 0.55, touchScale: 1, touchDepth: 'joystick', economy: false, showFps: false };

  const Save = {
    KEY: 'planolandia.save.v1.',
    SKEY: 'planolandia.settings.v1',
    SLOTS: 3,

    fresh() {
      return {
        v: 1,
        room: 'borda_chegada',
        pos: null,
        bench: null,
        lados: 5, maxLados: 5,
        geo: 0, vert: 0,
        abilities: { dash: false, garra: false, eco: false, profunda: false, ponto: false, reflexao: false, giro: false },
        frags: 0,
        teoremas: {},
        equip: [],
        postulados: 3,
        mapas: {},
        flags: {},
        visited: {},
        contorno: null,
        time: 0,
        deaths: 0,
      };
    },

    load(slot) {
      const raw = get(Save.KEY + slot);
      if (!raw) return null;
      try {
        const st = JSON.parse(raw);
        // completa campos novos de versões futuras
        const base = Save.fresh();
        for (const k in base) if (!(k in st)) st[k] = base[k];
        st.abilities = Object.assign(base.abilities, st.abilities || {});
        return st;
      } catch (e) { return null; }
    },

    write(slot, st) {
      if (slot === null || slot === undefined || slot < 0) return;
      set(Save.KEY + slot, JSON.stringify(st));
    },

    remove(slot) { del(Save.KEY + slot); },

    // Fragmento de Lado: a cada 4, um Lado a mais
    addFrag(st) {
      st.frags++;
      const n = st.frags % 4;
      if (n === 0) { st.maxLados++; st.lados = st.maxLados; }
      return { n: n === 0 ? 4 : n, complete: n === 0 };
    },

    summary(slot) {
      const st = Save.load(slot);
      if (!st) return null;
      const defs = PL.World && PL.World.defs;
      const roomDef = defs && defs[st.bench ? st.bench.room : st.room];
      const regions = PL.REGIONS || {};
      const region = roomDef && regions[roomDef.region] ? regions[roomDef.region].nome : 'Borda do Plano';
      const ab = Object.values(st.abilities).filter(Boolean).length;
      return { time: st.time, vert: st.vert, region, place: roomDef ? roomDef.name : '', abilities: ab, lados: st.maxLados };
    },

    settings() {
      const raw = get(Save.SKEY);
      let s = {};
      if (raw) { try { s = JSON.parse(raw); } catch (e) { s = {}; } }
      return Object.assign({}, DEFAULT_SETTINGS, s);
    },
    saveSettings(s) { set(Save.SKEY, JSON.stringify(s)); },

    fmtTime(sec) {
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
      return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
    },
  };

  PL.Save = Save;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
