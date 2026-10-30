// Full screen for phones and tablets. Browsers only allow it from a tap, so it is entered on the
// first tap of a session (when the setting is on) and from the ⛶ buttons. Where the browser has no
// full screen (iPhone Safari), "Add to Home Screen" opens the game without any browser bars.
const doc = document;

export const fullscreenSupported = () => !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
export const isFullscreen = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);
// Already running as a home-screen app: nothing to hide. (Chrome also reports display-mode
// fullscreen while the full screen API is active, so that case does not count.)
export const isStandalone = () => navigator.standalone === true || (!isFullscreen() && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);

export function enterFullscreen() {
  const el = doc.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || isFullscreen()) return Promise.resolve(isFullscreen());
  try { return Promise.resolve(req.call(el, { navigationUI: 'hide' })).then(() => true, () => false); } catch { return Promise.resolve(false); }
}

export function exitFullscreen() {
  const ex = doc.exitFullscreen || doc.webkitExitFullscreen;
  if (!ex || !isFullscreen()) return Promise.resolve(false);
  try { return Promise.resolve(ex.call(doc)).then(() => true, () => false); } catch { return Promise.resolve(false); }
}

export const HOME_SCREEN_TIP = 'This browser cannot hide its bars. To play full screen, use Share → Add to Home Screen and open Singularita from there.';

// Toggles full screen; returns a message to show when it cannot be done.
export async function toggleFullscreen() {
  if (isStandalone()) return null;
  if (!fullscreenSupported()) return HOME_SCREEN_TIP;
  if (isFullscreen()) await exitFullscreen(); else await enterFullscreen();
  return null;
}

// The first tap of a session enters full screen when the setting asks for it. Taps keep trying
// until one succeeds; after that, leaving full screen is the player's choice and is respected.
let armed = false;
export function armAutoFullscreen(enabled) {
  if (armed || !fullscreenSupported() || isStandalone()) return;
  armed = true;
  const done = () => { removeEventListener('pointerup', go, true); removeEventListener('touchend', go, true); };
  // Taps on a ⛶ button toggle full screen themselves.
  const go = (e) => { if (e.target?.closest?.('.fs-toggle') || !enabled() || isFullscreen()) return; enterFullscreen().then((ok) => { if (ok || isFullscreen()) done(); }); };
  addEventListener('pointerup', go, true);
  addEventListener('touchend', go, true);
}
