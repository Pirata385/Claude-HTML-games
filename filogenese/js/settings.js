/* Filogênese — configurações persistentes. */
(function (FG) {
  'use strict';
  const KEY = 'filogenese.settings.v1';
  const defaults = {
    lang: 'auto',        // auto | pt | en
    master: 0.8, music: 0.5, sfx: 0.8, ambience: 0.6,
    quality: 'auto',     // auto | low | medium | high
    particles: true, shadows: true, weather: true, shake: true,
    showFps: false,
    zoom: 1,             // multiplicador de zoom da câmera
    uiScale: 1,          // tamanho da interface
    btnScale: 1,         // tamanho dos botões de toque
    joySide: 'left',     // lado do direcional virtual
    touchUi: 'auto',     // auto | on | off
    vibration: true,
    autoTarget: true,
    hints: true,         // dicas e destaque do botão pedido no modo social
    dmgNumbers: true,
    autosave: true,
    holdSprint: true,    // correr segurando (false = alternar)
    colorblind: false,   // ícones de relação com formas, não só cores
  };
  const S = FG.Settings = {
    data: Object.assign({}, defaults),
    defaults,
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) { const d = JSON.parse(raw); for (const k in defaults) if (k in d && typeof d[k] === typeof defaults[k]) S.data[k] = d[k]; }
      } catch (e) { /* armazenamento indisponível: segue com os padrões */ }
      return S.data;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(S.data)); } catch (e) { /* ignora */ } },
    get(k) { return S.data[k]; },
    set(k, v) { S.data[k] = v; S.save(); FG.bus.emit('setting', k, v); },
    reset() { S.data = Object.assign({}, defaults); S.save(); FG.bus.emit('setting', '*'); },
  };
})(window.FG = window.FG || {});
