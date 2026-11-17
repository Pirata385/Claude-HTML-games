// props.js — flat vector scenery shared by the coop and the map: the truck, the buildings (with
// the BFC and its Coronel Galo), yard furniture and plants. Everything is drawn around a base
// point on the ground, y-down, in world units.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { TAU } = RB.core;
  const C = { ink: '#23314a', cream: '#f6ead2', paper: '#fffaf0', teal: '#2a9d8f', mustard: '#e9b44c', coral: '#e76f51', plum: '#6d4c7d', leaf: '#7fb069', brick: '#b5523b',
    wood: '#b98a5a', woodD: '#96693f', grey: '#8b97a8', red: '#d7372f', white: '#ffffff', glass: '#bfe6ef', straw: '#e6c66a' };
  const props = { C };
  const R = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const P = (ctx, col, pts) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); };
  const O = (ctx, x, y, rx, ry, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry === undefined ? rx : ry, 0, 0, TAU); ctx.fill(); };
  function label(ctx, text, x, y, size, col) { ctx.font = '800 ' + size + 'px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(text, x, y); }
  props.label = label;

  // The truck, side on, facing f. n caged creatures show as a count; slots = cage size.
  // The truck, side on, facing f. o.len is the length of the caged bed behind the cab (80 by
  // default; it grows to carry more). props.truckBack draws the bed and the cage behind whoever is
  // riding in it, props.truckFront the cab, the front rail and the wheels over them.
  props.truckBack = function (ctx, x, y, f, o) {
    o = o || {};
    const len = o.len || 80, x0 = 18 - len;
    ctx.save(); ctx.translate(x, y - (o.bob || 0)); ctx.scale(f, 1);
    R(ctx, x0, -46, len, 30, C.woodD);                                     // bed
    R(ctx, x0 + 2, -84, len - 4, 40, 'rgba(35,49,74,0.14)');               // cage back
    ctx.fillStyle = C.ink;
    const n = Math.max(2, Math.round((len - 4) / 12.4));
    for (let i = 0; i <= n; i++) ctx.fillRect(x0 + 2 + i * (len - 6.4) / n, -84, 2.4, 40);
    R(ctx, x0, -86, len, 4, C.ink);
    ctx.restore();
  };
  props.truckFront = function (ctx, x, y, f, o) {
    o = o || {};
    const len = o.len || 80, x0 = 18 - len, bob = o.bob || 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    ctx.translate(0, -bob);
    R(ctx, x0, -48, len, 4, C.ink);                                        // front rail
    R(ctx, x0, -86, 3, 40, C.ink); R(ctx, 15, -86, 3, 40, C.ink);          // corner posts
    P(ctx, o.col || C.coral, [18, -46, 18, -74, 40, -74, 56, -52, 66, -48, 66, -16, 18, -16]);
    R(ctx, x0, -20, len, 4, C.woodD);
    P(ctx, C.glass, [24, -68, 38, -68, 49, -52, 24, -52]);
    R(ctx, 56, -30, 10, 5, C.mustard);
    ctx.translate(0, bob);
    const wheels = [40, x0 + 24];
    for (let wx = x0 + 24 + 110; wx < 0; wx += 110) wheels.push(wx);
    for (const wx of wheels) { O(ctx, wx, -12, 13, 13, C.ink); O(ctx, wx, -12, 5.5, 5.5, C.grey); }
    ctx.restore();
  };
  props.truck = function (ctx, x, y, f, o) { props.truckBack(ctx, x, y, f, o); props.truckFront(ctx, x, y, f, o); };
  // The speedboat kit: in water the truck rides on a hull, with the cage on deck (drawn by
  // props.truckBack) and an outboard motor. o: { len, bob, t }
  props.boatBack = function (ctx, x, y, f, o) {
    o = o || {};
    const len = o.len || 80, x0 = 18 - len, t = o.t || 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    // the wake and the bow wave
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 4; i++) { const k = (t * 1.6 + i / 4) % 1; O(ctx, x0 - 30 - k * 120, -4 + Math.sin(i) * 3, 18 + k * 30, 5 + k * 3, 'rgba(255,255,255,' + (0.6 * (1 - k)).toFixed(2) + ')'); }
    ctx.restore();
  };
  props.boatFront = function (ctx, x, y, f, o) {
    o = o || {};
    const len = o.len || 80, x0 = 18 - len, bob = o.bob || 0;
    ctx.save(); ctx.translate(x, y - bob); ctx.scale(f, 1);
    P(ctx, C.paper, [x0 - 6, -44, 70, -44, 96, -40, 76, -6, x0 + 4, -6]);            // hull
    R(ctx, x0 - 2, -30, 82 - x0, 6, C.teal);                                          // stripe
    P(ctx, C.glass, [22, -44, 36, -66, 44, -66, 44, -44]);                              // windscreen
    R(ctx, x0 - 16, -56, 10, 30, C.ink); R(ctx, x0 - 20, -60, 16, 10, C.coral);       // outboard motor
    R(ctx, x0, -48, len, 4, C.ink);                                                     // front rail of the cage
    R(ctx, x0, -86, 3, 40, C.ink); R(ctx, 15, -86, 3, 40, C.ink);
    ctx.restore();
    O(ctx, x + f * 60, y - 4, 26, 4, 'rgba(255,255,255,0.7)');                          // spray at the bow
  };

  // Yard furniture
  props.house = function (ctx, x, y) {
    R(ctx, x - 90, y - 120, 180, 120, C.cream); P(ctx, C.brick, [x - 108, y - 118, x, y - 196, x + 108, y - 118]);
    R(ctx, x - 22, y - 70, 44, 70, C.woodD); O(ctx, x + 12, y - 36, 3, 3, C.mustard);
    R(ctx, x + 38, y - 92, 34, 30, C.glass); R(ctx, x - 72, y - 92, 34, 30, C.glass);
    R(ctx, x + 54, y - 92, 2, 30, C.cream); R(ctx, x - 56, y - 92, 2, 30, C.cream);
    R(ctx, x + 50, y - 186, 18, 44, C.brick);
  };
  props.feeder = function (ctx, x, y, level) {
    R(ctx, x - 34, y - 14, 5, 14, C.woodD); R(ctx, x + 29, y - 14, 5, 14, C.woodD);
    P(ctx, C.wood, [x - 44, y - 30, x + 44, y - 30, x + 36, y - 12, x - 36, y - 12]);
    if (level > 0) { const h = Math.min(12, 3 + level * 1.2); P(ctx, C.mustard, [x - 40, y - 30, x + 40, y - 30, x + 30, y - 30 - h, x - 30, y - 30 - h]); }
  };
  props.nest = function (ctx, x, y) {
    R(ctx, x - 5, y - 46, 10, 46, C.woodD);
    R(ctx, x - 62, y - 118, 124, 76, C.wood); P(ctx, C.brick, [x - 72, y - 116, x, y - 150, x + 72, y - 116]);
    R(ctx, x - 52, y - 108, 104, 60, '#5c4630');
    P(ctx, C.straw, [x - 52, y - 48, x + 52, y - 48, x + 46, y - 66, x - 46, y - 66]);
  };
  props.nestFront = function (ctx, x, y) { P(ctx, C.straw, [x - 54, y - 46, x + 54, y - 46, x + 50, y - 58, x - 50, y - 58]); R(ctx, x - 62, y - 48, 124, 6, C.woodD); };
  props.dummy = function (ctx, x, y, hit) {
    ctx.save(); ctx.translate(x, y); ctx.rotate((hit || 0) * 0.25);
    R(ctx, -4, -70, 8, 70, C.woodD); R(ctx, -26, -52, 52, 6, C.woodD);
    O(ctx, 0, -78, 20, 24, C.straw); O(ctx, 0, -78, 11, 13, C.coral); O(ctx, 0, -78, 4.5, 5.5, C.paper);
    O(ctx, 0, -110, 12, 12, C.straw);
    ctx.restore();
  };
  props.fence = function (ctx, x0, x1, y) {
    ctx.fillStyle = C.wood;
    ctx.fillRect(x0, y - 34, x1 - x0, 5); ctx.fillRect(x0, y - 18, x1 - x0, 5);
    for (let x = x0; x <= x1; x += 60) ctx.fillRect(x - 3, y - 44, 6, 44);
  };
  // The BFC pick-up box in the yard.
  props.bfcBox = function (ctx, x, y) {
    R(ctx, x - 44, y - 62, 88, 62, C.white);
    for (let i = 0; i < 4; i++) R(ctx, x - 44 + i * 24, y - 62, 12, 62, C.red);
    R(ctx, x - 50, y - 70, 100, 10, C.red);
    O(ctx, x, y - 32, 19, 19, C.white); label(ctx, 'BFC', x, y - 31, 13, C.red);
  };
  // A bucket, the BFC sign.
  props.bucket = function (ctx, x, y, s, spin) {
    const w = Math.cos(spin || 0);
    P(ctx, C.white, [x - 26 * s, y - 50 * s, x + 26 * s, y - 50 * s, x + 19 * s, y, x - 19 * s, y]);
    for (let i = -1; i <= 1; i++) { const sx = x + (i * 15 + w * 5) * s; P(ctx, C.red, [sx - 4 * s, y - 50 * s, sx + 4 * s, y - 50 * s, sx + 3 * s, y, sx - 3 * s, y]); }
    R(ctx, x - 29 * s, y - 56 * s, 58 * s, 8 * s, C.red);
    O(ctx, x - 8 * s, y - 60 * s, 9 * s, 6 * s, '#c98a3a'); O(ctx, x + 9 * s, y - 62 * s, 10 * s, 7 * s, '#d59a48'); O(ctx, x + 1 * s, y - 66 * s, 8 * s, 6 * s, '#c98a3a');
  };
  // Coronel Galo, the BFC mascot: a rooster in a white suit and a string tie.
  props.coronel = function (ctx, x, y, s) {
    O(ctx, x, y - 18 * s, 22 * s, 20 * s, C.white);                         // suit
    P(ctx, C.ink, [x - 2 * s, y - 34 * s, x + 2 * s, y - 34 * s, x + 5 * s, y - 14 * s, x, y - 8 * s, x - 5 * s, y - 14 * s]); // string tie
    O(ctx, x, y - 48 * s, 14 * s, 14 * s, C.paper);                         // head
    for (let i = 0; i < 3; i++) O(ctx, x - 7 * s + i * 7 * s, y - 62 * s - (i === 1 ? 3 * s : 0), 5 * s, 5 * s, C.red);
    P(ctx, C.mustard, [x + 10 * s, y - 52 * s, x + 26 * s, y - 46 * s, x + 10 * s, y - 42 * s]);
    O(ctx, x + 9 * s, y - 36 * s, 4 * s, 7 * s, C.red);
    P(ctx, C.white, [x - 2 * s, y - 38 * s, x + 6 * s, y - 38 * s, x + 2 * s, y - 28 * s]);    // goatee
    O(ctx, x + 3 * s, y - 51 * s, 2.4 * s, 2.4 * s, C.ink);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.3 * s; ctx.beginPath(); ctx.arc(x + 3 * s, y - 51 * s, 4.6 * s, 0, TAU); ctx.stroke(); // spectacles
  };

  // ---- buildings on the map. kind picks the look; t is time for small animations.
  function base(ctx, x, y, w, h, wall, roof, roofH) {
    R(ctx, x - w / 2, y - h, w, h, wall);
    P(ctx, roof, [x - w / 2 - 12, y - h + 2, x, y - h - roofH, x + w / 2 + 12, y - h + 2]);
    R(ctx, x - 16, y - 54, 32, 54, C.woodD);
  }
  props.building = function (ctx, site, t, o) {
    o = o || {};
    const x = site.x, y = site.y + 60, k = site.look || site.id;
    ctx.save();
    if (o.closed) ctx.globalAlpha = 0.72;
    if (site.kind === 'house') { base(ctx, x, y, 130, 86, C.cream, o.roof || C.brick, 56); R(ctx, x + 28, y - 62, 24, 22, C.glass); R(ctx, x - 52, y - 62, 24, 22, C.glass); }
    else if (k === 'home') { base(ctx, x, y, 170, 100, C.cream, C.brick, 70); R(ctx, x + 40, y - 74, 30, 26, C.glass); R(ctx, x - 70, y - 74, 30, 26, C.glass); props.fence(ctx, x + 96, x + 280, y); props.fence(ctx, x - 280, x - 96, y); }
    else if (k === 'bfc') {
      R(ctx, x - 100, y - 96, 200, 96, C.white);
      for (let i = 0; i < 7; i++) R(ctx, x - 100 + i * 30, y - 96, 15, 96, C.red);
      R(ctx, x - 108, y - 110, 216, 22, C.red); label(ctx, 'BFC', x, y - 98, 19, C.white);
      R(ctx, x - 22, y - 58, 44, 58, C.ink); R(ctx, x + 40, y - 70, 44, 34, C.glass); R(ctx, x - 84, y - 70, 44, 34, C.glass);
      R(ctx, x + 132, y - 170, 7, 170, C.grey); props.bucket(ctx, x + 136, y - 168, 1.15, t * 1.4);
      props.coronel(ctx, x - 62, y - 36, 0.55);
    } else if (site.kind === 'arena') {
      const col = k === 'grand' ? C.mustard : k === 'cellar' ? C.plum : k === 'city' ? C.teal : k === 'county' ? C.coral : C.wood;
      O(ctx, x, y - 30, 120, 34, C.woodD); O(ctx, x, y - 38, 108, 28, '#e3c98a');
      ctx.fillStyle = col; for (let i = 0; i < 9; i++) ctx.fillRect(x - 112 + i * 26.5, y - 84, 12, 50);
      R(ctx, x - 118, y - 90, 236, 9, col);
      P(ctx, col, [x - 3, y - 150, x + 40, y - 136, x - 3, y - 122]); R(ctx, x - 5, y - 152, 4, 66, C.ink);
      if (k === 'grand') { O(ctx, x - 80, y - 98, 9, 9, C.mustard); O(ctx, x + 80, y - 98, 9, 9, C.mustard); }
    } else if (k === 'lab') {
      R(ctx, x - 90, y - 70, 180, 70, C.paper);
      ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(x, y - 70, 70, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.glass; ctx.beginPath(); ctx.arc(x, y - 70, 46, Math.PI, 0); ctx.closePath(); ctx.fill();
      R(ctx, x - 18, y - 52, 36, 52, C.ink); R(ctx, x + 62, y - 176, 5, 60, C.grey);
      O(ctx, x + 64, y - 180, 8, 8, o.power ? C.mustard : C.grey);
      if (o.power && Math.sin(t * 6) > 0) O(ctx, x + 64, y - 180, 14, 14, 'rgba(233,180,76,0.35)');
    } else if (k === 'garage') { base(ctx, x, y, 170, 80, C.grey, C.ink, 30); R(ctx, x - 70, y - 64, 60, 64, '#5a6472'); for (let i = 0; i < 4; i++) R(ctx, x - 70, y - 60 + i * 15, 60, 3, C.grey); O(ctx, x + 50, y - 96, 16, 16, C.mustard); }
    else if (k === 'vet') { base(ctx, x, y, 140, 86, C.paper, C.teal, 44); R(ctx, x + 30, y - 78, 34, 10, C.coral); R(ctx, x + 42, y - 90, 10, 34, C.coral); }
    else if (k === 'bank') { R(ctx, x - 80, y - 90, 160, 90, C.cream); P(ctx, C.plum, [x - 94, y - 88, x, y - 134, x + 94, y - 88]); for (let i = 0; i < 4; i++) R(ctx, x - 66 + i * 40, y - 86, 14, 86, C.paper); O(ctx, x, y - 106, 11, 11, C.mustard); R(ctx, x - 14, y - 50, 28, 50, C.ink); }
    else if (k === 'carnival') {
      P(ctx, C.coral, [x - 110, y, x, y - 150, x + 110, y]);
      for (let i = -2; i <= 2; i += 2) P(ctx, C.paper, [x + i * 22 - 11, y, x + i * 8, y - 128, x + i * 22 + 11, y]);
      P(ctx, C.ink, [x - 18, y, x, y - 46, x + 18, y]); P(ctx, C.mustard, [x - 2, y - 172, x + 28, y - 162, x - 2, y - 152]); R(ctx, x - 3, y - 174, 3, 28, C.ink);
    } else if (k === 'roost') { // Sunset Roost: a cottage with a porch, a rocking chair, a garden and a setting-sun sign
      base(ctx, x, y, 156, 84, '#f3dfc0', C.coral, 52);
      R(ctx, x - 64, y - 66, 30, 26, C.glass); R(ctx, x + 34, y - 66, 30, 26, C.glass);
      R(ctx, x - 98, y - 40, 196, 6, C.woodD); R(ctx, x - 94, y - 34, 5, 34, C.woodD); R(ctx, x + 89, y - 34, 5, 34, C.woodD);
      const rock = Math.sin(t * 1.6) * 0.12;                                   // the rocking chair on the porch
      ctx.save(); ctx.translate(x + 56, y - 2); ctx.rotate(rock);
      R(ctx, -12, -30, 4, 26, C.wood); R(ctx, -12, -10, 22, 4, C.wood); R(ctx, 6, -10, 4, 10, C.wood);
      ctx.strokeStyle = C.woodD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-1, -26, 20, 1.1, 2.05); ctx.stroke();
      ctx.restore();
      props.fence(ctx, x + 104, x + 230, y);
      for (let i = 0; i < 7; i++) O(ctx, x + 112 + i * 18, y - 6 - (i % 2) * 4, 5, 5, i % 3 ? C.coral : C.mustard);
      R(ctx, x - 150, y - 74, 6, 74, C.woodD);                                // the sign: half a sun
      ctx.fillStyle = C.mustard; ctx.beginPath(); ctx.arc(x - 147, y - 76, 22, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.coral; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) { const a = Math.PI + (i + 0.5) * Math.PI / 5; ctx.beginPath(); ctx.moveTo(x - 147 + Math.cos(a) * 27, y - 76 + Math.sin(a) * 27); ctx.lineTo(x - 147 + Math.cos(a) * 35, y - 76 + Math.sin(a) * 35); ctx.stroke(); }
      R(ctx, x - 172, y - 78, 50, 5, C.woodD);
    } else if (site.kind === 'isle') { // your field station: a hut on stilts with a flag, and a warning sign once the place is hot
      R(ctx, x - 50, y - 18, 6, 18, C.woodD); R(ctx, x + 44, y - 18, 6, 18, C.woodD);
      R(ctx, x - 56, y - 70, 112, 54, C.wood); P(ctx, C.teal, [x - 66, y - 68, x, y - 108, x + 66, y - 68]);
      R(ctx, x - 12, y - 52, 24, 36, C.woodD); R(ctx, x + 22, y - 58, 22, 18, C.glass);
      R(ctx, x + 70, y - 120, 4, 120, C.ink); P(ctx, C.mustard, [x + 74, y - 120, x + 112, y - 110, x + 74, y - 100]);
      if ((o.rad || 0) > 0.15) {
        O(ctx, x - 90, y - 50, 18, 18, C.mustard); ctx.fillStyle = C.ink;
        for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - Math.PI / 2; ctx.beginPath(); ctx.moveTo(x - 90, y - 50); ctx.arc(x - 90, y - 50, 15, a - 0.5, a + 0.5); ctx.closePath(); ctx.fill(); }
        O(ctx, x - 90, y - 50, 4, 4, C.mustard); R(ctx, x - 92, y - 32, 4, 32, C.ink);
      }
    } else if (site.kind === 'quarry') { // the Bone Quarry: a canvas tent, a sign with a big bone, a wheelbarrow
      P(ctx, '#c9b07a', [x - 80, y, x, y - 80, x + 80, y]); P(ctx, '#b39a63', [x, y, x, y - 80, x + 80, y]);
      P(ctx, C.ink, [x - 16, y, x, y - 34, x + 16, y]);
      R(ctx, x - 120, y - 70, 5, 70, C.woodD); R(ctx, x - 150, y - 92, 66, 26, C.paper);
      O(ctx, x - 137, y - 79, 7, 7, C.cream); O(ctx, x - 97, y - 79, 7, 7, C.cream); R(ctx, x - 135, y - 82, 36, 6, C.cream);
      R(ctx, x + 96, y - 22, 34, 14, C.grey); O(ctx, x + 100, y - 6, 7, 7, C.ink); R(ctx, x + 128, y - 26, 22, 3, C.woodD);
    } else if (site.kind === 'exotic') { // the Curio Aviary: a striped menagerie tent with a strange bird on its sign
      P(ctx, C.plum, [x - 100, y, x - 70, y - 96, x + 70, y - 96, x + 100, y]);
      for (let i = 0; i < 5; i++) P(ctx, i % 2 ? C.plum : C.mustard, [x - 70 + i * 28, y - 96, x - 42 + i * 28, y - 96, x - 52 + i * 34 - 10, y, x - 86 + i * 34, y]);
      P(ctx, C.ink, [x - 18, y, x, y - 50, x + 18, y]);
      P(ctx, C.plum, [x - 80, y - 96, x, y - 140, x + 80, y - 96]);
      R(ctx, x - 2, y - 168, 4, 30, C.ink);
      O(ctx, x, y - 176, 16, 12, C.teal); O(ctx, x - 9, y - 188, 5, 5, C.coral); O(ctx, x + 9, y - 188, 5, 5, C.coral); // two heads
      const glow = 0.4 + 0.3 * Math.sin(t * 3);
      O(ctx, x, y - 176, 26, 20, 'rgba(233,180,76,' + glow.toFixed(2) + ')');
    } else if (k === 'market') { R(ctx, x - 80, y - 60, 6, 60, C.woodD); R(ctx, x + 74, y - 60, 6, 60, C.woodD); for (let i = 0; i < 6; i++) P(ctx, i % 2 ? C.plum : C.paper, [x - 90 + i * 30, y - 62, x - 60 + i * 30, y - 62, x - 64 + i * 30, y - 92, x - 86 + i * 30, y - 92]); R(ctx, x - 74, y - 30, 148, 30, C.wood); }
    else { // a shop
      const roof = k === 'feed' ? C.leaf : k === 'tools' ? C.teal : k === 'hatter' ? C.plum : C.brick;
      base(ctx, x, y, 150, 86, C.cream, roof, 46);
      R(ctx, x + 26, y - 66, 38, 30, C.glass); R(ctx, x - 64, y - 66, 38, 30, C.glass);
      for (let i = 0; i < 5; i++) P(ctx, i % 2 ? roof : C.paper, [x - 75 + i * 30, y - 82, x - 45 + i * 30, y - 82, x - 49 + i * 30, y - 68, x - 71 + i * 30, y - 68]);
    }
    ctx.restore();
  };

  // ---- plants and rocks
  props.decor = function (ctx, d, t) {
    const x = d.x, y = d.y, s = d.s, sway = Math.sin(t * 1.3 + x * 0.01) * 2 * s;
    switch (d.kind) {
      case 'tree': R(ctx, x - 5 * s, y - 44 * s, 10 * s, 44 * s, C.woodD); O(ctx, x + sway, y - 70 * s, 38 * s, 34 * s, '#5f9a52'); O(ctx, x - 16 * s + sway, y - 56 * s, 22 * s, 20 * s, '#6cab5c'); break;
      case 'bush': O(ctx, x, y - 14 * s, 24 * s, 16 * s, '#6cab5c'); O(ctx, x + 14 * s, y - 9 * s, 14 * s, 10 * s, '#5f9a52'); break;
      case 'hay': O(ctx, x, y - 20 * s, 26 * s, 22 * s, C.straw); O(ctx, x, y - 20 * s, 12 * s, 10 * s, '#d4b250'); break;
      case 'flower': R(ctx, x - 1, y - 12 * s, 2, 12 * s, '#5f9a52'); O(ctx, x, y - 14 * s, 5 * s, 5 * s, d.s > 1.05 ? C.coral : d.s > 0.92 ? C.mustard : C.paper); break;
      case 'reed': ctx.fillStyle = '#6f9a5a'; for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 6 * s + sway * 0.4, y - 38 * s, 2.5 * s, 38 * s); O(ctx, x - 6 * s + sway * 0.4, y - 40 * s, 3 * s, 8 * s, '#8a5a3a'); O(ctx, x + 6 * s + sway * 0.4, y - 36 * s, 3 * s, 8 * s, '#8a5a3a'); break;
      case 'willow': R(ctx, x - 5 * s, y - 50 * s, 10 * s, 50 * s, C.woodD); O(ctx, x + sway, y - 62 * s, 40 * s, 28 * s, '#7bae6a'); ctx.fillStyle = '#6a9d5c'; for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 11 * s + sway, y - 62 * s, 4 * s, 40 * s); break;
      case 'acacia': R(ctx, x - 4 * s, y - 56 * s, 8 * s, 56 * s, C.woodD); O(ctx, x, y - 62 * s, 52 * s, 13 * s, '#8fa858'); O(ctx, x + 18 * s, y - 70 * s, 28 * s, 9 * s, '#9db865'); break;
      case 'drybush': ctx.strokeStyle = '#a8894f'; ctx.lineWidth = 2 * s; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + i * 9 * s, y - 20 * s); ctx.stroke(); } break;
      case 'rock': P(ctx, C.grey, [x - 20 * s, y, x - 12 * s, y - 16 * s, x + 8 * s, y - 20 * s, x + 22 * s, y]); break;
      case 'boulder': P(ctx, '#7c8798', [x - 34 * s, y, x - 22 * s, y - 34 * s, x + 12 * s, y - 42 * s, x + 36 * s, y]); P(ctx, C.grey, [x - 6 * s, y, x + 4 * s, y - 30 * s, x + 12 * s, y - 42 * s, x + 36 * s, y]); break;
      case 'mound': P(ctx, '#b98a5a', [x - 16 * s, y, x - 6 * s, y - 40 * s, x + 4 * s, y - 34 * s, x + 16 * s, y]); break;
      case 'pine': R(ctx, x - 4 * s, y - 20 * s, 8 * s, 20 * s, C.woodD); P(ctx, '#3f7a5a', [x - 26 * s, y - 16 * s, x, y - 62 * s, x + 26 * s, y - 16 * s]); P(ctx, '#4b8a66', [x - 19 * s, y - 42 * s, x, y - 84 * s, x + 19 * s, y - 42 * s]); break;
      case 'palm': ctx.strokeStyle = C.woodD; ctx.lineWidth = 7 * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10 * s, y - 40 * s, x + 4 * s + sway, y - 74 * s); ctx.stroke();
        ctx.fillStyle = '#5f9a52'; for (let i = 0; i < 5; i++) { const a = -2.6 + i * 0.52; ctx.beginPath(); ctx.ellipse(x + 4 * s + sway + Math.cos(a) * 20 * s, y - 74 * s + Math.sin(a) * 12 * s + 6 * s, 24 * s, 7 * s, a, 0, TAU); ctx.fill(); } break;
      case 'shell': O(ctx, x, y - 4 * s, 7 * s, 5 * s, '#f1c9b8'); break;
      case 'bigleaf': R(ctx, x - 6 * s, y - 50 * s, 12 * s, 50 * s, '#7a5a3a'); O(ctx, x + sway, y - 74 * s, 44 * s, 30 * s, '#2f7d4a'); O(ctx, x - 22 * s + sway, y - 58 * s, 26 * s, 18 * s, '#3b8f57'); O(ctx, x + 24 * s + sway, y - 56 * s, 24 * s, 16 * s, '#3b8f57'); break;
      case 'fern': ctx.fillStyle = '#3b8f57'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(x + i * 8 * s, y - 12 * s, 5 * s, 16 * s, i * 0.35, 0, TAU); ctx.fill(); } break;
      case 'lily': O(ctx, x, y, 14 * s, 7 * s, '#6fae6a'); O(ctx, x + 4 * s, y - 2 * s, 4 * s, 3 * s, '#f2a7c0'); break;
      // island lands: tundra, volcanic, desert
      case 'snowpine': R(ctx, x - 4 * s, y - 20 * s, 8 * s, 20 * s, C.woodD); P(ctx, '#4b7a6a', [x - 26 * s, y - 16 * s, x, y - 64 * s, x + 26 * s, y - 16 * s]); P(ctx, '#f6fafc', [x - 14 * s, y - 40 * s, x, y - 64 * s, x + 14 * s, y - 40 * s]); break;
      case 'snowrock': P(ctx, '#aab6c4', [x - 22 * s, y, x - 12 * s, y - 18 * s, x + 10 * s, y - 22 * s, x + 24 * s, y]); P(ctx, '#f6fafc', [x - 12 * s, y - 18 * s, x + 10 * s, y - 22 * s, x + 4 * s, y - 14 * s]); break;
      case 'drift': O(ctx, x, y - 5 * s, 30 * s, 9 * s, '#f6fafc'); break;
      case 'lavarock': P(ctx, '#3f3a45', [x - 24 * s, y, x - 10 * s, y - 20 * s, x + 12 * s, y - 24 * s, x + 26 * s, y]); ctx.fillStyle = '#e76f51'; ctx.fillRect(x - 4 * s, y - 14 * s, 9 * s, 2.5 * s); break;
      case 'deadtree': ctx.strokeStyle = '#3f3a45'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 46 * s); ctx.moveTo(x, y - 30 * s); ctx.lineTo(x - 16 * s, y - 44 * s); ctx.moveTo(x, y - 36 * s); ctx.lineTo(x + 14 * s, y - 52 * s); ctx.stroke(); break;
      case 'fumarole': O(ctx, x, y - 3 * s, 16 * s, 6 * s, '#3f3a45'); for (let i = 0; i < 3; i++) { const k = (t * 0.4 + i / 3) % 1; O(ctx, x + Math.sin(k * 5 + i) * 6 * s, y - 10 * s - k * 60 * s, (8 + k * 16) * s, (6 + k * 12) * s, 'rgba(230,230,235,' + (0.5 * (1 - k)).toFixed(2) + ')'); } break;
      case 'cactus': R(ctx, x - 6 * s, y - 52 * s, 12 * s, 52 * s, '#5f9a52'); R(ctx, x - 20 * s, y - 34 * s, 8 * s, 18 * s, '#5f9a52'); R(ctx, x - 20 * s, y - 20 * s, 16 * s, 6 * s, '#5f9a52'); R(ctx, x + 12 * s, y - 42 * s, 8 * s, 16 * s, '#5f9a52'); R(ctx, x + 4 * s, y - 30 * s, 16 * s, 6 * s, '#5f9a52'); break;
      case 'dune': O(ctx, x, y - 6 * s, 42 * s, 12 * s, '#e2c579'); O(ctx, x - 8 * s, y - 9 * s, 28 * s, 7 * s, '#efd593'); break;
      default: break;
    }
  };

  RB.props = props;
})();
