// Player settings, stored separately from saves. Unknown or invalid values fall back to defaults.
export const GRAPHICS_PRESETS = {
  low: { renderScale: 0.7, shadows: false, viewDistance: 70, particles: 0.4, grass: false, maxEnemies: 24 },
  medium: { renderScale: 1, shadows: true, viewDistance: 110, particles: 0.75, grass: true, maxEnemies: 32 },
  high: { renderScale: 1.25, shadows: true, viewDistance: 150, particles: 1, grass: true, maxEnemies: 40 },
};

export const DEFAULT_BINDINGS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dodge: 'ShiftLeft',
  interact: 'KeyF', lock: 'KeyQ', tonic: 'KeyR', skill1: 'Digit1', skill2: 'Digit2', skill3: 'Digit3', skill4: 'Digit4',
  menu: 'Tab', inventory: 'KeyI', craft: 'KeyC', character: 'KeyK', skills: 'KeyL', map: 'KeyM', journal: 'KeyJ', recall: 'KeyB',
};

export const DEFAULT_SETTINGS = {
  audio: { master: 0.8, music: 0.55, sfx: 0.8, ambient: 0.6, ui: 0.7 },
  graphics: { preset: 'medium', ...GRAPHICS_PRESETS.medium, dynamicRes: true, fov: 62 },
  camera: { sensX: 1, sensY: 1, invertY: false, distance: 6.5, shake: true },
  controls: { bindings: { ...DEFAULT_BINDINGS } },
  touch: { size: 1, opacity: 0.8, leftHanded: false },
  ui: { damageNumbers: true, hints: true },
};

function mergeInto(def, raw) {
  const out = {};
  for (const [k, dv] of Object.entries(def)) {
    const rv = raw && typeof raw === 'object' ? raw[k] : undefined;
    if (dv && typeof dv === 'object' && !Array.isArray(dv)) out[k] = mergeInto(dv, rv);
    else if (rv !== undefined && typeof rv === typeof dv && !(typeof rv === 'number' && !Number.isFinite(rv))) out[k] = rv;
    else out[k] = dv;
  }
  return out;
}

export function mergeSettings(raw) {
  const s = mergeInto(DEFAULT_SETTINGS, raw);
  if (!GRAPHICS_PRESETS[s.graphics.preset] && s.graphics.preset !== 'custom') s.graphics.preset = DEFAULT_SETTINGS.graphics.preset;
  return s;
}

export function applyPreset(settings, preset) {
  settings.graphics = { ...settings.graphics, preset, ...GRAPHICS_PRESETS[preset] };
  return settings;
}

export function loadSettings(storage, isTouch) {
  let raw = null;
  try { raw = JSON.parse(storage.getItem('singularita.settings') || 'null'); } catch { raw = null; }
  const s = mergeSettings(raw);
  if (!raw && isTouch) applyPreset(s, 'low');
  return s;
}
export function saveSettings(storage, settings) {
  try { storage.setItem('singularita.settings', JSON.stringify(settings)); } catch { /* storage may be blocked */ }
}
