// Boot: settings, renderer, the title and slot screens, then the game loop.
import { Renderer } from './render/renderer.js';
import { Game, getZone } from './game.js';
import { SaveStore, newProfile } from './systems/save.js';
import { loadSettings, saveSettings } from './systems/settings.js';
import { installGameplay } from './gameplay.js';
import { TitleScreen } from './ui/screens.js';
import { installSession } from './session.js';
import { AudioEngine } from './audio/audio.js';
import { Input } from './core/input.js';
import { armAutoFullscreen } from './ui/fullscreen.js';

const storage = (() => { try { const k = '__sg_probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; } })();
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const settings = loadSettings(storage, isTouch);
const store = new SaveStore(storage);
// Phones and tablets go full screen on the first tap, unless turned off in Settings.
if (isTouch) armAutoFullscreen(() => settings.touch.fullscreen);

const loading = document.getElementById('loading');
const fill = document.getElementById('loading-fill');
const msg = document.getElementById('loading-msg');
const setLoading = (p, text) => { fill.style.width = `${Math.round(p * 100)}%`; if (text) msg.textContent = text; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

let renderer;
try {
  renderer = new Renderer(document.getElementById('viewport'));
  renderer.applyQuality(settings.graphics);
} catch (err) {
  console.error(err);
  msg.textContent = 'WebGL is not available in this browser, so Singularita cannot start.';
  throw err;
}

let game = null;
const audio = new AudioEngine(settings);
const input = new Input(renderer.gl.domElement, settings.controls.bindings);

async function startGame(profile) {
  loading.hidden = false;
  setLoading(0.1, 'Raising Dawnreach from the sea…');
  await nextFrame();
  getZone('island');
  setLoading(0.5, 'Lighting the beacon…');
  await nextFrame();
  if (profile.zone !== 'island') getZone(profile.zone);
  setLoading(0.8, 'Waking the creatures…');
  await nextFrame();
  game = new Game({ renderer, settings, store, profile, input, hooks: { saveSettings: () => saveSettings(storage, settings), quitToTitle } });
  installGameplay(game);
  installSession(game, { audio });
  const pos = profile.pos && profile.zone ? { x: profile.pos[0], z: profile.pos[1] } : null;
  game.enterZone(profile.zone || 'island', pos);
  setLoading(1, 'Ready.');
  await nextFrame();
  loading.hidden = true;
  if (params.has('debug')) window.__SG = game;
  game.bus.emit('started', { first: profile.playTime < 1 });
}

function quitToTitle() {
  if (game) { game.hooks.save?.(); game.dispose?.(); game = null; }
  renderer.gl.clear();
  showTitle();
}

function showTitle() {
  loading.hidden = true;
  new TitleScreen(document.getElementById('screens'), { store, settings, storage, renderer, input, onPlay: startGame, saveSettings: () => { saveSettings(storage, settings); audio.applyVolumes(); input.setBindings(settings.controls.bindings); } }).show();
}

// Main loop with a clamped delta.
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (game) {
    try { game.frame(dt); } catch (err) { console.error(err); }
    renderer.updateDynamicResolution(dt);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

if (params.has('quickstart')) {
  // Testing aid: jump straight into a fresh character (?quickstart=archer).
  const cls = params.get('quickstart') || 'swordsman';
  startGame(newProfile({ name: 'Tester', classId: ['swordsman', 'archer', 'mage', 'assassin', 'stardust'].includes(cls) ? cls : 'swordsman', slot: 2, seed: 4242 }));
} else {
  showTitle();
}
