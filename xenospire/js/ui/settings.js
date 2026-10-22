// Settings model (defaults, persistence) and the settings panel.
(function (XS) {
  'use strict';

  const DEFAULTS = {
    master: 0.8, music: 0.6, sfx: 0.8,
    quality: 1, pixel: 1, fps: 60, showFps: false,
    difficulty: 1, aimAssist: true, damageNumbers: true, shake: 1, hitstop: true, xray: true,
    leftHanded: false, joystick: 0, buttonSize: 1, buttonOpacity: 0.85, vibration: true,
    reduceFlash: false, reduceMotion: false, elementCodes: false, bigText: false,
  };
  const PIXEL_SHORT = [400, 330, 270]; // target short side (buffer px) for Menor / Auto / Maior

  function load() {
    const s = Object.assign({}, DEFAULTS, XS.store.load('settings', {}));
    if (typeof s.quality !== 'number') s.quality = 1;
    return s;
  }
  const save = (s) => XS.store.save('settings', s);

  // Panel description: [section, [[key, type, label, extra]]]
  function layout() {
    const S = XS.S.set;
    return [
      [S.audio, [['master', 'range', S.master], ['music', 'range', S.music], ['sfx', 'range', S.sfx]]],
      [S.video, [['quality', 'choice', S.quality, S.qualityOpts], ['pixel', 'choice', S.pixelScale, S.pixelOpts], ['fps', 'choice', S.fps, ['30', '60'], [30, 60]], ['showFps', 'toggle', S.showFps]]],
      [S.game, [['difficulty', 'choice', S.difficulty, S.difficultyOpts], ['aimAssist', 'toggle', S.aimAssist], ['damageNumbers', 'toggle', S.damageNumbers], ['shake', 'range', S.shake], ['hitstop', 'toggle', S.hitstop], ['xray', 'toggle', S.fadeWalls]]],
      [S.controls, [['leftHanded', 'toggle', S.leftHanded], ['joystick', 'choice', S.joystick, S.joystickOpts], ['buttonSize', 'range', S.buttonSize, null, [0.75, 1.35]], ['buttonOpacity', 'range', S.buttonOpacity, null, [0.3, 1]], ['vibration', 'toggle', S.vibration]]],
      [S.access, [['reduceFlash', 'toggle', S.reduceFlash], ['reduceMotion', 'toggle', S.reduceMotion], ['elementCodes', 'toggle', S.elementSymbols], ['bigText', 'toggle', S.bigText]]],
    ];
  }

  // Builds the settings panel; onChange(key) is called after every change.
  function panel(settings, onChange, onErase) {
    const root = document.createElement('div');
    root.className = 'settings';
    for (const [title, rows] of layout()) {
      const sec = document.createElement('section');
      sec.innerHTML = `<h3>${title}</h3>`;
      for (const [key, type, label, opts, extra] of rows) {
        const row = document.createElement('label');
        row.className = 'set-row';
        const name = document.createElement('span');
        name.textContent = label;
        row.appendChild(name);
        if (type === 'range') {
          const [min, max] = extra || [0, 1];
          const input = document.createElement('input');
          input.type = 'range'; input.min = min; input.max = max; input.step = 0.05; input.value = settings[key];
          input.addEventListener('input', () => { settings[key] = Number(input.value); onChange(key); });
          row.appendChild(input);
        } else if (type === 'toggle') {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'toggle' + (settings[key] ? ' on' : '');
          btn.textContent = settings[key] ? XS.S.set.on : XS.S.set.off;
          btn.setAttribute('aria-pressed', String(!!settings[key]));
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            settings[key] = !settings[key];
            btn.classList.toggle('on', settings[key]);
            btn.textContent = settings[key] ? XS.S.set.on : XS.S.set.off;
            btn.setAttribute('aria-pressed', String(settings[key]));
            onChange(key);
          });
          row.appendChild(btn);
        } else if (type === 'choice') {
          const values = extra || opts.map((_, i) => i);
          const group = document.createElement('div');
          group.className = 'choice';
          opts.forEach((txt, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = txt;
            b.className = settings[key] === values[i] ? 'on' : '';
            b.addEventListener('click', (e) => {
              e.preventDefault();
              settings[key] = values[i];
              [...group.children].forEach((c, j) => c.classList.toggle('on', j === i));
              onChange(key);
            });
            group.appendChild(b);
          });
          row.appendChild(group);
        }
        sec.appendChild(row);
      }
      root.appendChild(sec);
    }
    const data = document.createElement('section');
    data.innerHTML = `<h3>${XS.S.set.data}</h3>`;
    const erase = document.createElement('button');
    erase.type = 'button';
    erase.className = 'btn danger';
    erase.textContent = XS.S.set.erase;
    erase.addEventListener('click', onErase);
    data.appendChild(erase);
    root.appendChild(data);
    return root;
  }

  XS.Settings = { DEFAULTS, PIXEL_SHORT, load, save, panel };
})(globalThis.XS = globalThis.XS || {});
