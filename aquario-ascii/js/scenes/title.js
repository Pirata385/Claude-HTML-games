// STUB created by A (phase 0). Owner E replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  // Placeholder title: one line of text in ink on the bg, plus a wave row on the bg grid (engine smoke test).
  AQ.scenes.register('title', {
    enter: function (params) {},
    exit: function () {},
    update: function (dt) {},
    drawBg: function (grid, t) {
      var r = Math.floor(grid.viewRows * 0.62);
      for (var c = 0; c < grid.cols; c++) {
        var v = AQ.util.noise2(c * 0.15 + t * 0.6, t * 0.3);
        grid.put(c, r, AQ.render.ramp('wave', v), 4);
      }
    },
    draw: function (t) {
      var D = AQ.display;
      AQ.render.text('Água-Tinta · v' + AQ.VERSION, Math.floor(D.cols / 2), Math.floor(D.rows / 2) - 1, 14, { align: 'center' });
      AQ.render.sprite(['><°>'], D.cols / 2 + Math.sin(t * 0.5) * D.cols * 0.3, (Math.floor(D.rows / 2) + 3) * AQ.ASPECT,
                       { level: 10, deform: 'swim', t: t, flip: Math.cos(t * 0.5) < 0 });
    }
  });
})(window.AQ);
