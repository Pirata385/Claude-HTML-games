/* Perspective projection of world slices toward a vanishing point on the horizon. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const View = {
    persp(k) { return 1 / (1 + C.SLICE_K * Math.max(k, -1.6)); },
    /** Projection of slice at depth offset k (= z - cam.z): screen = (ox + wx*scale, oy + wy*scale). */
    slice(k, cam, W, H) {
      const s = View.persp(k);
      const vpx = W / 2, vpy = H * C.HORIZON, ax = W / 2, ay = H * C.ANCHOR_Y;
      const scale = cam.zoom * s;
      return { scale, ox: vpx + (ax - cam.x * cam.zoom - vpx) * s, oy: vpy + (ay - cam.y * cam.zoom - vpy) * s, s, k };
    },
    levelOf(k) { return k <= -0.5 ? -1 : Math.round(k); },
    toWorld(sx, sy, p) { return { x: (sx - p.ox) / p.scale, y: (sy - p.oy) / p.scale }; },
    toScreen(wx, wy, p) { return { x: p.ox + wx * p.scale, y: p.oy + wy * p.scale }; },
  };
  PA.View = View;
  if (typeof module !== 'undefined' && module.exports) module.exports = View;
})(typeof window !== 'undefined' ? window : globalThis);
