// Niryk — art for the second content wave: the Mirror Knight without a shield, the creatures and bosses of the
// Pântano Sombrio, Cavernas de Gelo and Caldeira Vulcânica, Kazan's ability icons, new weapons, equipment,
// projectiles and scenery props. Same cel-shaded volume technique as sprites.js.
'use strict';
(function () {
  const N = window.N, S = N.S, { Painter } = N, { mix, sp, eyes, M, D } = N.ART;
  const two = (fn) => [fn(0), fn(1)];
  const out = (P) => P.out();

  // ================================================================ Mirror Knight (no shield, greatsword)
  S.en.cavaleiro = two((f) => {
    const P = new Painter(36, 46), a = f ? 1 : 0;
    P.layer(M.steel, (q) => q.poly([[26, 2], [30, 2], [30, 30], [26, 30]], '#fff'), { r: 2, rim: '#ffffff' });
    P.layer(M.gold, (q) => { q.rect(22, 29, 12, 3, '#fff'); q.rect(26, 31, 4, 8, '#fff'); }, { r: 2 });
    P.layer(M.dsteel, (q) => { q.rect(11, 33 + a, 5, 12 - a, '#fff'); q.rect(18, 33 - a, 5, 12 + a, '#fff'); }, { r: 3 });
    P.layer(['#3a2a5a', '#5a3a8a', '#7a5ab8', '#a88aff'], (q) => q.poly([[9, 18], [25, 18], [27, 35], [7, 35]], '#fff'), { r: 4 });
    P.layer(M.steel, (q) => { q.poly([[9, 17], [25, 17], [24, 29], [10, 29]], '#fff'); q.ell(8, 19, 4.5, 4, '#fff'); q.ell(26, 19, 4.5, 4, '#fff'); }, { r: 5, rim: '#c8b8ff' });
    P.rect(10, 28, 14, 2, '#d0a840');
    P.layer(M.steel, (q) => { q.ell(27, 30, 3, 3, '#fff'); }, { r: 2 });
    P.layer(M.steel, (q) => { q.ell(17, 10, 7, 8, '#fff'); q.rect(10, 10, 14, 6, '#fff'); }, { r: 5, rim: '#c8b8ff' });
    P.rect(13, 11, 10, 2, '#120818').px(17, 12, '#d05aff').px(21, 12, '#d05aff');
    P.layer(M.pink, (q) => q.stroke([[13, 3], [8, 1], [3, 4], [1, 9]], 4, 1.5, '#fff'), { r: 2 });
    return out(P);
  });

  // ================================================================ Pântano Sombrio
  const E = S.en;
  const toad = ['#24401a', '#44702a', '#6e9e3a', '#c0dc7a'];
  E.sapo = two((f) => {
    const P = new Painter(32, 26), s = f ? 2 : 0;
    P.layer(toad, (q) => { q.ell(16, 17 + s * 0.3, 12.5 + s * 0.5, 7.5 - s * 0.5, '#fff'); q.ell(6, 21, 4, 3, '#fff'); q.ell(26, 21, 4, 3, '#fff'); }, { r: 6, rim: '#d8ff8a' });
    P.layer(['#8a7a3a', '#c8b860', '#e8d890', '#fff4c0'], (q) => q.ell(16, 20 + s * 0.3, 7, 3, '#fff'), { r: 3 });
    P.layer(toad, (q) => { q.circ(10.5, 10 + s, 4, '#fff'); q.circ(21.5, 10 + s, 4, '#fff'); }, { r: 3 });
    eyes(P, [[11, 9.5 + s], [22, 9.5 + s]], '#ffe066', 1.8);
    P.rect(10, 9 + s, 2, 1, '#120a12').rect(21, 9 + s, 2, 1, '#120a12');
    for (const [x, y] of [[7, 15], [24, 14], [13, 13], [19, 16], [27, 18]]) P.rect(x, y, 2, 2, '#2e5a1e');
    P.line(9, 17, 23, 17, '#1a2a10');
    return out(P);
  });
  E.sanguessuga = two((f) => {
    const P = new Painter(38, 20), w = f ? 1.5 : -1.5;
    const segs = [[6, 12 + w, 4.5], [12, 11 - w, 5.5], [19, 11 + w * 0.6, 6], [26, 11 - w * 0.6, 5.5], [32, 11, 4.8]];
    P.layer(['#2a0e1a', '#4a1a2e', '#6e2a42', '#a8506a'], (q) => { for (const [x, y, r] of segs) q.circ(x, y, r, '#fff'); }, { r: 5, rim: '#ff8ab0' });
    for (const [x, y] of segs.slice(1, 4)) P.line(x, y - 4, x, y + 4, '#2a0a14');
    P.circ(35, 11, 2.6, '#1a0408').ring(35, 11, 2.6, '#e8b0c0', 1);
    P.px(31, 8, '#ffe066').px(31, 13, '#ffe066');
    return out(P);
  });
  E.mosquito = two((f) => {
    const P = new Painter(28, 22), w = f ? 3 : 0;
    P.layer(['#6a90b0', '#a8d0ec', '#dcf0ff', '#ffffff'], (q) => { q.ell(10, 6 + w * 0.5, 7, 3, '#fff'); q.ell(16, 6 - w * 0.3, 6, 2.6, '#fff'); }, { r: 2 });
    P.layer(['#1a1210', '#3a2620', '#5a3a2a', '#7a5a40'], (q) => { q.ell(12, 13, 6, 3.4, '#fff'); q.circ(19, 11, 3.2, '#fff'); }, { r: 3 });
    for (let i = 0; i < 4; i++) P.rect(10 + i * 2, 11, 1, 5, '#c8a050');
    P.line(21, 12, 28, 15, '#e8dcc8');
    P.circ(20, 10, 1.6, '#ff4a3a');
    for (const x of [9, 12, 15]) P.line(x, 16, x - 2, 21, '#2a1a10');
    return out(P);
  });
  E.jacare = two((f) => {
    const P = new Painter(36, 40), a = f ? 1 : 0;
    P.layer(['#1a3a24', '#2e5a34', '#4a8048', '#86b870'], (q) => q.stroke([[8, 30], [4, 34], [1, 38]], 5, 2, '#fff'), { r: 2 });
    P.layer(['#1a3a24', '#2e5a34', '#4a8048', '#86b870'], (q) => { q.rect(11, 30 + a, 5, 10 - a, '#fff'); q.rect(18, 30 - a, 5, 10 + a, '#fff'); }, { r: 3 });
    P.layer(['#1e3a26', '#36603a', '#56884e', '#92c07a'], (q) => q.poly([[8, 16], [26, 16], [25, 32], [9, 32]], '#fff'), { r: 6, rim: '#b0e090' });
    P.layer(['#8a7a3a', '#c8b860', '#e8d890', '#fff4c0'], (q) => q.poly([[12, 18], [22, 18], [21, 31], [13, 31]], '#fff'), { r: 3 });
    for (let y = 20; y < 31; y += 3) P.line(13, y, 21, y, '#a89848');
    P.layer(['#1e3a26', '#36603a', '#56884e', '#92c07a'], (q) => { q.ell(17, 10, 7, 6, '#fff'); q.poly([[20, 7], [36, 9], [35, 14], [20, 14]], '#fff'); }, { r: 5 });
    for (let x = 23; x < 35; x += 3) P.rect(x, 14, 1, 2, '#ffffff');
    P.line(20, 12, 35, 12, '#0e1a10');
    eyes(P, [[19, 6]], '#ffd23a', 1.3);
    P.layer(M.wood, (q) => q.stroke([[27, 18], [31, 26], [32, 34]], 3, 5, '#fff'), { r: 2 });
    return out(P);
  });
  E.bruxa = two((f) => {
    const P = new Painter(34, 44), b = f ? 1 : 0;
    P.layer(M.wood, (q) => q.line(28, 12, 29, 43, '#fff', 2), { r: 2 });
    P.layer(M.bone, (q) => q.circ(28, 9, 3.6, '#fff'), { r: 2 });
    P.circ(28, 9, 1.6, '#9aff4a').px(27, 8, '#ffffff');
    P.layer(['#14261a', '#223e28', '#345a38', '#4e7a4a'], (q) => q.poly([[16, 16], [3, 43], [27, 43]], '#fff'), { r: 7 });
    for (const [x, y] of [[9, 34], [18, 30], [14, 40]]) P.rect(x, y, 3, 3, '#5a3a24');
    P.layer(M.skinG, (q) => { q.ell(16, 15, 6, 6, '#fff'); q.poly([[20, 14], [26, 17], [20, 18]], '#fff'); }, { r: 4 });
    eyes(P, [[18, 13]], '#ff5a3a', 1);
    P.layer(['#14261a', '#223e28', '#345a38', '#4e7a4a'], (q) => { q.ell(15, 10, 11, 2.6, '#fff'); q.poly([[9, 10], [17, 0 + b], [21, 10]], '#fff'); }, { r: 3 });
    P.layer(M.red, (q) => q.ell(16, 4 + b, 2.6, 1.6, '#fff'), { r: 2 });
    P.line(10, 20, 6, 34, '#cfcfa0').line(22, 20, 24, 30, '#cfcfa0');
    return out(P);
  });
  E.planta = two((f) => {
    const P = new Painter(34, 36), o = f ? 2 : 0;
    P.layer(M.green, (q) => { q.poly([[3, 36], [10, 22], [15, 36]], '#fff'); q.poly([[19, 36], [24, 22], [31, 36]], '#fff'); q.rect(15, 18, 4, 18, '#fff'); }, { r: 3 });
    P.layer(M.red, (q) => { q.ell(17, 11, 12, 9 - o * 0.5, '#fff'); }, { r: 7, rim: '#ff9a8a' });
    for (const [x, y] of [[9, 7], [24, 8], [14, 4], [20, 15]]) P.rect(x, y, 2, 2, '#fff4c0');
    P.ell(17, 13 - o * 0.3, 7, 3 + o, '#2a0808');
    for (let x = 11; x < 24; x += 3) { P.poly([[x, 10 + o * 0.2], [x + 1, 13], [x + 2, 10 + o * 0.2]], '#ffffff'); P.poly([[x + 1, 16 + o], [x + 2, 13], [x + 3, 16 + o]], '#ffffff'); }
    return out(P);
  });

  // ================================================================ Cavernas de Gelo
  const ice = ['#2a5878', '#4a8ab0', '#8ac4e4', '#e8f8ff'], snow = ['#8aa4c0', '#c8dcec', '#eef6fc', '#ffffff'];
  E.yeti = two((f) => {
    const P = new Painter(38, 36), a = f ? -2 : 0;
    P.layer(snow, (q) => { q.rect(10, 26, 7, 10, '#fff'); q.rect(21, 26, 7, 10, '#fff'); }, { r: 3 });
    P.layer(snow, (q) => { q.ell(5, 20 + a, 5, 8, '#fff'); q.ell(33, 20 + a, 5, 8, '#fff'); }, { r: 4, rim: '#bfe8ff' });
    P.layer(snow, (q) => q.ell(19, 18, 14, 13, '#fff'), { r: 9, rim: '#bfe8ff' });
    P.layer(['#2a4a7a', '#3e68a8', '#5a8ad0', '#a0c4ff'], (q) => q.ell(19, 15, 7, 6, '#fff'), { r: 4 });
    P.layer(M.bone, (q) => { q.stroke([[11, 7], [8, 3], [7, 0]], 3, 1, '#fff'); q.stroke([[27, 7], [30, 3], [31, 0]], 3, 1, '#fff'); }, { r: 2 });
    eyes(P, [[16, 13], [22, 13]], '#ffe066', 1.1);
    P.rect(16, 18, 6, 1, '#10203a').px(17, 19, '#fff').px(20, 19, '#fff');
    return out(P);
  });
  E.golem_gelo = two((f) => {
    const P = new Painter(48, 48), a = f ? -3 : 0;
    P.layer(ice, (q) => { q.rect(13, 36, 8, 12, '#fff'); q.rect(27, 36, 8, 12, '#fff'); }, { r: 4 });
    P.layer(ice, (q) => { q.poly([[0, 22 + a], [10, 16 + a], [12, 36 + a], [2, 38 + a]], '#fff'); q.poly([[48, 22 + a], [38, 16 + a], [36, 36 + a], [46, 38 + a]], '#fff'); }, { r: 5, rim: '#ffffff' });
    P.layer(ice, (q) => q.poly([[9, 14], [39, 12], [37, 38], [11, 38]], '#fff'), { r: 9, rim: '#ffffff' });
    P.layer(['#123a5a', '#1e5a86', '#2e7ab0', '#5aa8d8'], (q) => q.ell(24, 26, 6, 6, '#fff'), { r: 4 });
    P.circ(24, 26, 2.6, '#bff0ff');
    P.layer(ice, (q) => q.poly([[16, 2], [32, 0], [31, 14], [17, 15]], '#fff'), { r: 5 });
    P.rect(19, 7, 10, 3, '#0a1e30').rect(20, 8, 3, 1, '#7af0ff').rect(25, 8, 3, 1, '#7af0ff');
    for (let i = 0; i < 4; i++) P.line(12 + i * 7, 16, 14 + i * 6, 34, '#c8ecff');
    return out(P);
  });
  E.nevasca = two((f) => {
    const P = new Painter(34, 32), o = f ? 1 : 0;
    P.layer(snow, (q) => { for (const [x, y, r] of [[10, 16, 7], [17, 12, 9], [25, 16, 7], [17, 20, 7], [7, 21, 4], [27, 21, 4]]) q.circ(x + (r > 6 ? o : -o), y, r, '#fff'); }, { r: 7, rim: '#bfe8ff' });
    P.rect(11, 13, 4, 3, '#1a2a4a').rect(19, 13, 4, 3, '#1a2a4a').rect(12, 14, 2, 1, '#7af0ff').rect(20, 14, 2, 1, '#7af0ff');
    P.ell(17, 21, 3, 1.6 + o * 0.4, '#1a2a4a');
    for (let i = 0; i < 6; i++) P.px(4 + i * 5, 28 + (i % 2) * 2, '#ffffff');
    return out(P);
  });
  E.pinguim = two((f) => {
    const P = new Painter(30, 32), a = f ? 1 : 0;
    P.layer(M.steel, (q) => { q.line(25, 2, 25, 30, '#fff', 1.6); q.poly([[23, 4], [25, -1], [27, 4]], '#fff'); }, { r: 2 });
    P.layer(['#0e1220', '#1c2234', '#2c344c', '#46506c'], (q) => q.ell(14, 18, 9, 12, '#fff'), { r: 7 });
    P.layer(snow, (q) => q.ell(15.5, 20, 6, 9, '#fff'), { r: 5 });
    P.layer(['#0e1220', '#1c2234', '#2c344c', '#46506c'], (q) => q.circ(14, 8, 6.5, '#fff'), { r: 5 });
    P.layer(M.steel, (q) => q.ell(13, 4.5, 6.5, 3, '#fff'), { r: 2 });
    eyes(P, [[16, 8]], '#ffffff', 1);
    P.layer(M.ember, (q) => { q.poly([[19, 9], [24, 10], [19, 12]], '#fff'); q.ell(11, 30 + a, 3, 1.5, '#fff'); q.ell(18, 30 - a, 3, 1.5, '#fff'); }, { r: 2 });
    P.layer(['#0e1220', '#1c2234', '#2c344c', '#46506c'], (q) => q.ell(22, 18, 2.4, 5, '#fff'), { r: 2 });
    return out(P);
  });
  E.morcego_gelo = two((f) => {
    const P = new Painter(38, 22), m = ['#1a3a5a', '#2e5a86', '#4a86b8', '#9ad0f4'];
    if (f) P.layer(m, (q) => { q.poly([[14, 9], [0, 16], [5, 20], [13, 14]], '#fff'); q.poly([[24, 9], [38, 16], [33, 20], [25, 14]], '#fff'); }, { r: 3 });
    else P.layer(m, (q) => { q.poly([[14, 10], [0, 0], [2, 9], [5, 8], [7, 14]], '#fff'); q.poly([[24, 10], [38, 0], [36, 9], [33, 8], [31, 14]], '#fff'); }, { r: 3 });
    P.layer(snow, (q) => { q.ell(19, 11, 6, 6, '#fff'); q.poly([[14, 7], [14, 0], [17, 5]], '#fff'); q.poly([[24, 7], [24, 0], [21, 5]], '#fff'); }, { r: 4, rim: '#bfe8ff' });
    P.px(16, 10, '#2a7ad8').px(17, 10, '#2a7ad8').px(21, 10, '#2a7ad8').px(22, 10, '#2a7ad8');
    return out(P);
  });
  E.cristal_vivo = two((f) => {
    const P = new Painter(36, 44);
    P.layer(['#1a2a3a', '#2e4256', '#465e78', '#6a86a0'], (q) => q.poly([[2, 44], [34, 44], [28, 34], [8, 34]], '#fff'), { r: 4 });
    P.layer(ice, (q) => { q.poly([[6, 38], [9, 14], [14, 38]], '#fff'); q.poly([[22, 38], [27, 12], [31, 38]], '#fff'); }, { r: 4, rim: '#ffffff' });
    P.layer(['#2a6a9a', '#5aa8d8', '#a8e4ff', '#ffffff'], (q) => q.poly([[11, 38], [18, 0], [25, 38]], '#fff'), { r: 6, rim: '#ffffff' });
    P.circ(18, 22, 4.6, '#0a1e30').circ(18, 22, 3, f ? '#ffffff' : '#7af0ff').px(17, 21, '#ffffff');
    return out(P);
  });

  // ================================================================ Caldeira Vulcânica
  const lava = ['#7a1a08', '#c8420e', '#ff8a2a', '#ffe08a'], basalt = ['#120c0c', '#241818', '#3a2826', '#5a403a'];
  E.salamandra = two((f) => {
    const P = new Painter(44, 22), o = f ? 2 : 0;
    P.layer(lava, (q) => q.stroke([[2, 10], [8, 12], [14, 12]], 2, 6, '#fff'), { r: 3 });
    for (const [x, k] of [[14, 1], [20, -1], [26, 1], [31, -1]]) P.layer(['#4a1a0a', '#7a2a10', '#a8401a', '#d0602a'], (q) => q.poly([[x, 14], [x + 3, 14], [x + 2 + k * o, 21], [x - 1 + k * o, 21]], '#fff'), { r: 2 });
    P.layer(['#8a2010', '#d04a18', '#ff7a2a', '#ffc070'], (q) => { q.ell(22, 12, 11, 4.6, '#fff'); q.ell(36, 11, 6, 4, '#fff'); q.poly([[38, 9], [44, 11], [38, 13]], '#fff'); }, { r: 4, rim: '#ffe08a' });
    P.layer(M.fire, (q) => { for (let x = 14; x < 32; x += 4) q.poly([[x, 9], [x + 2, 3 - (x % 8 ? o : 0)], [x + 4, 9]], '#fff'); }, { r: 2 });
    eyes(P, [[38, 9]], '#fff2a0', 1);
    return out(P);
  });
  E.magma = two((f) => {
    const P = new Painter(32, 26), s = f ? 1.6 : 0;
    P.layer(basalt, (q) => q.ell(16, 17 + s * 0.4, 14 + s, 8.5 - s), { r: 7 });
    P.line(6, 15, 14, 19, '#ff7a1a', 1.2).line(14, 19, 20, 14, '#ff7a1a', 1.2).line(20, 14, 27, 18, '#ff7a1a', 1.2).line(11, 11, 17, 13, '#ffb03a');
    P.circ(10, 13 + s, 2.4, '#ffd060').circ(22, 13 + s, 2.4, '#ffd060').rect(10, 13 + s, 1, 2, '#3a0a04').rect(22, 13 + s, 1, 2, '#3a0a04');
    return out(P);
  });
  E.cinzas = two((f) => {
    const P = new Painter(34, 34), w = f ? 3 : 0;
    P.layer(['#141012', '#262022', '#3a3234', '#5a5052'], (q) => { q.poly([[11, 16], [0, 6 + w], [2, 22]], '#fff'); q.poly([[23, 16], [34, 6 + w], [32, 22]], '#fff'); }, { r: 3 });
    P.layer(['#201a1c', '#3a3234', '#585052', '#807678'], (q) => { q.ell(17, 22, 7, 8, '#fff'); q.ell(17, 12, 7.5, 7, '#fff'); }, { r: 5, rim: '#ff8a5a' });
    P.layer(M.ember, (q) => { q.stroke([[12, 7], [9, 2], [7, 0]], 3, 1, '#fff'); q.stroke([[22, 7], [25, 2], [27, 0]], 3, 1, '#fff'); }, { r: 2 });
    P.ell(14, 12, 1.8, 1.3, '#ffb03a').ell(21, 12, 1.8, 1.3, '#ffb03a').px(14, 12, '#fff2a0').px(21, 12, '#fff2a0');
    P.rect(14, 16, 7, 1, '#ff6a1a');
    for (const [x, y] of [[12, 24], [20, 26], [16, 20]]) P.px(x, y, '#ff8a2a');
    return out(P);
  });
  E.obsidiana = two((f) => {
    const P = new Painter(40, 40), a = f ? -2 : 0;
    const ob = ['#0c0812', '#1c1426', '#30223e', '#7a5aa8'];
    P.layer(ob, (q) => { q.rect(11, 30, 7, 10, '#fff'); q.rect(22, 30, 7, 10, '#fff'); }, { r: 3 });
    P.layer(ob, (q) => { q.poly([[2, 16 + a], [9, 12 + a], [10, 28 + a], [3, 30 + a]], '#fff'); q.poly([[38, 16 + a], [31, 12 + a], [30, 28 + a], [37, 30 + a]], '#fff'); }, { r: 4, rim: '#c8a0ff' });
    P.layer(ob, (q) => q.poly([[8, 10], [20, 2], [32, 10], [30, 32], [10, 32]], '#fff'), { r: 9, rim: '#c8a0ff' });
    P.line(14, 8, 20, 24, '#a080d0').line(26, 8, 22, 20, '#a080d0');
    P.rect(15, 13, 10, 3, '#1a0606').rect(16, 14, 3, 1, '#ff6a1a').rect(21, 14, 3, 1, '#ff6a1a');
    return out(P);
  });
  E.elemental = two((f) => {
    const P = new Painter(32, 40), o = f ? 2 : 0;
    P.layer(M.fire, (q) => q.poly([[16, 0 + o], [26, 12], [28, 26], [22, 38], [16, 32], [10, 38], [4, 26], [6, 12]], '#fff'), { r: 8 });
    P.layer(['#e0561a', '#ffa030', '#ffe080', '#ffffff'], (q) => q.poly([[16, 10 + o], [22, 20], [20, 32], [16, 28], [12, 32], [10, 20]], '#fff'), { r: 5 });
    P.rect(12, 18, 3, 3, '#5a1006').rect(18, 18, 3, 3, '#5a1006').px(13, 19, '#ffffff').px(19, 19, '#ffffff');
    return out(P);
  });
  E.morteiro = two((f) => {
    const P = new Painter(38, 42);
    P.layer(basalt, (q) => q.poly([[2, 42], [36, 42], [26, 8], [12, 8]], '#fff'), { r: 9, rim: '#ff8a5a' });
    P.layer(basalt, (q) => q.ell(19, 9, 8, 3.5, '#fff'), { r: 3 });
    P.ell(19, 9, 5.5, 2.2, f ? '#ffe08a' : '#ff8a2a');
    P.line(12, 30, 16, 16, '#ff6a1a', 1.2).line(26, 34, 23, 20, '#ff6a1a', 1.2);
    for (const [x, y] of [[8, 38], [28, 38]]) P.rect(x, y, 3, 2, '#ff8a2a');
    return out(P);
  });

  // ================================================================ BOSSES
  S.boss.gorgulho = two((f) => {
    const P = new Painter(108, 88), m = f ? 3 : 0;
    P.layer(toad, (q) => { q.ell(54, 56, 46, 28, '#fff'); q.ell(14, 76, 14, 10, '#fff'); q.ell(94, 76, 14, 10, '#fff'); }, { r: 16, rim: '#d8ff8a' });
    P.layer(['#8a7a3a', '#c8b860', '#e8d890', '#fff4c0'], (q) => q.ell(54, 68, 28, 14, '#fff'), { r: 8 });
    P.layer(toad, (q) => { q.circ(34, 28, 13, '#fff'); q.circ(74, 28, 13, '#fff'); }, { r: 8 });
    eyes(P, [[35, 26], [75, 26]], '#ffd23a', 6);
    P.rect(32, 25, 7, 3, '#120a12').rect(72, 25, 7, 3, '#120a12');
    for (let i = 0; i < 16; i++) P.rect(16 + ((i * 29) % 76), 42 + ((i * 17) % 22), 3, 3, '#2e5a1e');
    P.ell(54, 52 + m, 30, 4 + m * 2, '#1a0a0e');
    if (f) P.layer(M.pink, (q) => q.stroke([[54, 54], [56, 66], [52, 78]], 7, 4, '#fff'), { r: 3 });
    P.layer(M.green, (q) => { for (let i = 0; i < 7; i++) q.poly([[38 + i * 5, 18], [40 + i * 5, 2 + (i % 2) * 4], [42 + i * 5, 18]], '#fff'); }, { r: 3 });
    P.layer(M.gold, (q) => q.rect(37, 14, 34, 5, '#fff'), { r: 2 });
    return out(P);
  });
  S.boss.glacia = two((f) => {
    const P = new Painter(74, 100), arm = f ? -6 : 0;
    P.layer(['#2a5878', '#4a8ab0', '#8ac4e4', '#e8f8ff'], (q) => q.poly([[37, 38], [6, 98], [68, 98]], '#fff'), { r: 14, rim: '#ffffff' });
    P.layer(['#3a6a90', '#6aa8d0', '#a8dcf4', '#ffffff'], (q) => q.poly([[37, 44], [22, 98], [52, 98]], '#fff'), { r: 8 });
    P.layer(snow, (q) => { q.stroke([[28, 40], [16, 52 + arm], [10, 44 + arm * 2]], 5, 3, '#fff'); q.stroke([[46, 40], [58, 52 + arm], [64, 44 + arm * 2]], 5, 3, '#fff'); }, { r: 3 });
    P.layer(ice, (q) => q.poly([[28, 34], [46, 34], [48, 50], [26, 50]], '#fff'), { r: 5 });
    P.layer(['#c8d8e8', '#e8f0f8', '#ffffff', '#ffffff'], (q) => { q.poly([[24, 20], [16, 60], [30, 40]], '#fff'); q.poly([[50, 20], [58, 60], [44, 40]], '#fff'); }, { r: 4 });
    P.layer(['#8aa8c8', '#c8dcf0', '#eaf4ff', '#ffffff'], (q) => q.ell(37, 24, 9, 10, '#fff'), { r: 6 });
    P.ell(33, 24, 1.8, 1.4, '#2a7ad8').ell(41, 24, 1.8, 1.4, '#2a7ad8').rect(35, 30, 4, 1, '#5a7aa0');
    P.layer(['#4a8ab0', '#8ac4e4', '#e0f8ff', '#ffffff'], (q) => { for (let i = 0; i < 5; i++) q.poly([[27 + i * 5, 14], [29.5 + i * 5, 0 + Math.abs(2 - i) * 3], [32 + i * 5, 14]], '#fff'); }, { r: 3, rim: '#ffffff' });
    P.circ(37, 6, 2.4, '#7af0ff');
    return out(P);
  });
  S.boss.ignavar = two((f) => {
    const P = new Painter(126, 92), w = f ? -6 : 0;
    const scale = ['#3a0a0a', '#6e1a12', '#a02a16', '#d0502a'];
    P.layer(['#2a0606', '#4a0e0c', '#6e1a14', '#9a3020'], (q) => { q.poly([[40, 40], [10, 4 + w], [4, 30 + w], [20, 54]], '#fff'); q.poly([[78, 40], [110, 4 + w], [122, 30 + w], [100, 54]], '#fff'); }, { r: 8 });
    P.line(10, 4 + w, 34, 44, '#1a0404', 2).line(110, 4 + w, 86, 44, '#1a0404', 2);
    P.layer(scale, (q) => q.stroke([[22, 70], [12, 78], [4, 88]], 10, 3, '#fff'), { r: 4 });
    P.layer(scale, (q) => { q.ell(60, 58, 28, 20, '#fff'); q.rect(38, 70, 10, 20, '#fff'); q.rect(72, 70, 10, 20, '#fff'); }, { r: 12, rim: '#ffb070' });
    P.layer(lava, (q) => q.ell(60, 64, 16, 10, '#fff'), { r: 6 });
    P.layer(scale, (q) => { q.ell(64, 30, 10, 14, '#fff'); q.ell(66, 16, 16, 12, '#fff'); q.poly([[70, 12], [94, 16], [92, 26], [70, 26]], '#fff'); }, { r: 9, rim: '#ffb070' });
    P.layer(M.bone, (q) => { q.stroke([[58, 8], [50, 2], [42, 0]], 5, 1, '#fff'); q.stroke([[66, 6], [62, 0], [56, -2]], 4, 1, '#fff'); }, { r: 3 });
    P.rect(70, 12, 5, 3, '#1a0404').rect(71, 12, 3, 2, '#ffe060');
    for (let x = 76; x < 92; x += 4) P.rect(x, 24, 2, 3, '#ffffff');
    P.line(44, 54, 56, 70, '#ff8a2a', 1.4).line(76, 50, 66, 68, '#ff8a2a', 1.4).line(58, 44, 60, 56, '#ffd060');
    if (f) { P.circ(94, 21, 4, '#ffe08a'); P.circ(96, 21, 2, '#ffffff'); }
    return out(P);
  });

  // ================================================================ PROJECTILES
  const PR = S.proj, pj = (w, h, fn, o) => { const P = new Painter(w, h); fn(P); return P.out(o); };
  PR.fan = pj(20, 20, (P) => { P.layer(M.steel, (q) => q.poly([[10, 10], [0, 2], [6, 0], [14, 0], [20, 2]], '#fff'), { r: 3, rim: '#ffffff' }); for (let i = 0; i < 4; i++) P.line(10, 10, 2 + i * 5.5, 1, '#3a4256'); P.circ(10, 10, 2, '#d04040'); });
  PR.harpoon = pj(30, 8, (P) => { P.line(0, 4, 22, 4, '#e8dcc8', 2); P.poly([[20, 0], [30, 4], [20, 8]], '#fff4e0'); P.line(22, 1, 25, 4, '#8a7a64').line(22, 7, 25, 4, '#8a7a64'); });
  PR.chakram = pj(18, 18, (P) => { P.layer(M.crystal, (q) => { q.ring(9, 9, 8, '#fff', 3.5); for (let i = 0; i < 4; i++) q.poly([[9 + Math.cos(i * 1.57) * 6, 9 + Math.sin(i * 1.57) * 6], [9 + Math.cos(i * 1.57 + 0.5) * 9, 9 + Math.sin(i * 1.57 + 0.5) * 9], [9 + Math.cos(i * 1.57 + 0.6) * 6, 9 + Math.sin(i * 1.57 + 0.6) * 6]], '#fff'); }, { r: 3 }); }, '#0a3050');
  PR.cannon = pj(16, 16, (P) => { P.layer(M.dsteel, (q) => q.circ(8, 8, 7, '#fff'), { r: 5 }); P.circ(6, 6, 1.6, '#c8d0e0'); });
  PR.firearrow = pj(26, 8, (P) => { P.line(0, 4, 18, 4, '#5a3020', 1.5); P.poly([[16, 0], [26, 4], [16, 8]], '#ffd060'); P.poly([[0, 0], [5, 4], [0, 8]], '#ff6a1a'); P.circ(20, 4, 2, '#fff2a0'); }, '#5a1006');
  PR.wisp = S.misc.wisp;
  S.misc.lavaBomb = pj(16, 16, (P) => { P.layer(basalt, (q) => q.circ(8, 8, 7, '#fff'), { r: 5 }); P.line(3, 8, 8, 4, '#ff8a2a').line(8, 4, 12, 10, '#ff8a2a'); });
  S.misc.meteor = S.misc.lavaBomb;
  S.misc.iceSpike = sp(16, 26, (P) => P.layer(ice, (q) => q.poly([[0, 26], [8, 0], [16, 26]], '#fff'), { r: 4, rim: '#ffffff' }));

  // ================================================================ WEAPONS (pointing right; grip = hand point)
  const WD = {
    katana_escaldante: [44, 10, [4, 5], (P) => {
      P.layer(M.dark, (q) => q.rect(0, 3, 9, 4, '#fff'), { r: 2 });
      for (let x = 1; x < 9; x += 3) P.px(x, 4, '#e8c050').px(x + 1, 5, '#e8c050');
      P.layer(M.gold, (q) => q.ell(10, 5, 1.5, 4, '#fff'), { r: 2 });
      P.layer(['#6a2a18', '#c8501e', '#ff9a4a', '#fff0c0'], (q) => q.poly([[12, 3], [38, 2], [44, 3], [38, 6], [12, 7]], '#fff'), { r: 2 });
      P.line(12, 3, 40, 2, '#fff6d0');
    }],
    leque: [24, 20, [3, 16], (P) => { P.layer(M.dark, (q) => q.rect(0, 15, 6, 3, '#fff'), { r: 2 }); P.layer(M.steel, (q) => q.poly([[4, 16], [8, 0], [16, 0], [24, 6], [24, 12]], '#fff'), { r: 4, rim: '#ffffff' }); for (let i = 0; i < 5; i++) P.line(4, 16, 9 + i * 3.6, 1 + i * 2.2, '#3a4256'); P.circ(4, 16, 1.6, '#d04040'); }],
    arpao: [50, 12, [12, 6], (P) => { P.layer(M.bone, (q) => q.rect(0, 5, 40, 3, '#fff'), { r: 2 }); P.layer(M.bone, (q) => q.poly([[38, 1], [50, 6], [38, 11]], '#fff'), { r: 3 }); P.line(40, 3, 44, 6, '#8a7a64').line(40, 9, 44, 6, '#8a7a64'); P.rect(6, 4, 4, 5, '#5a3a24'); }],
    tridente: [52, 20, [14, 10], (P) => { P.layer(M.wood, (q) => q.rect(0, 9, 38, 3, '#fff'), { r: 2 }); P.layer(M.teal, (q) => { q.rect(36, 2, 3, 17, '#fff'); q.poly([[38, 2], [50, 0], [50, 4], [38, 5]], '#fff'); q.poly([[38, 9], [52, 10.5], [38, 12]], '#fff'); q.poly([[38, 15], [50, 16], [50, 20], [38, 18]], '#fff'); }, { r: 3, rim: '#a8fff0' }); }],
    lanterna_fatuo: [34, 18, [5, 9], (P) => { P.layer(M.dwood, (q) => { q.rect(0, 8, 24, 3, '#fff'); q.rect(22, 0, 3, 10, '#fff'); }, { r: 2 }); P.layer(M.dark, (q) => q.rect(24, 4, 10, 14, '#fff'), { r: 3 }); P.rect(26, 6, 6, 10, '#0e2a2a'); P.circ(29, 11, 2.6, '#5fe3d6').px(29, 10, '#ffffff'); }],
    chakram: [22, 22, [3, 11], (P) => { P.layer(M.crystal, (q) => { q.ring(13, 11, 9, '#fff', 4); for (let i = 0; i < 6; i++) q.poly([[13 + Math.cos(i) * 8, 11 + Math.sin(i) * 8], [13 + Math.cos(i + 0.4) * 11, 11 + Math.sin(i + 0.4) * 11], [13 + Math.cos(i + 0.5) * 8, 11 + Math.sin(i + 0.5) * 8]], '#fff'); }, { r: 3, rim: '#ffffff' }); P.layer(M.leather, (q) => q.rect(0, 9, 6, 4, '#fff'), { r: 2 }); }],
    canhao: [40, 20, [9, 12], (P) => { P.layer(M.wood, (q) => q.poly([[0, 10], [14, 8], [16, 18], [2, 18]], '#fff'), { r: 3 }); P.layer(M.dsteel, (q) => { q.rect(12, 4, 24, 12, '#fff'); q.rect(34, 2, 6, 16, '#fff'); }, { r: 5 }); P.layer(M.gold, (q) => { q.rect(18, 3, 3, 14, '#fff'); q.rect(28, 3, 3, 14, '#fff'); }, { r: 2 }); }],
    foice: [42, 34, [6, 28], (P) => { P.layer(M.dwood, (q) => q.line(2, 32, 30, 4, '#fff', 3), { r: 2 }); P.layer(['#2a1a40', '#5a3a8a', '#a07ae0', '#f0e0ff'], (q) => q.poly([[28, 2], [42, 8], [40, 22], [34, 12], [26, 8]], '#fff'), { r: 4, rim: '#ffffff' }); P.line(30, 4, 40, 18, '#f0e0ff'); }],
    arco_vulcanico: [18, 38, [12, 19], (P) => { P.layer(basalt, (q) => q.stroke([[2, 1], [9, 5], [13, 13], [14, 19], [13, 25], [9, 33], [2, 37]], 2.6, 3.4, '#fff'), { r: 2 }); P.line(9, 5, 13, 13, '#ff7a1a').line(13, 25, 9, 33, '#ff7a1a'); P.line(2, 1, 2, 37, '#ffd060'); P.layer(lava, (q) => q.rect(11, 16, 5, 7, '#fff'), { r: 2 }); }],
  };
  for (const k in WD) { const [w, h, grip, fn] = WD[k]; const P = new Painter(w, h); fn(P); S.wp[k] = P.out(); S.wp[k].grip = [grip[0] + 1, grip[1] + 1]; }

  // ================================================================ EQUIPMENT ICONS (24x24)
  const QD = {
    mascara_oni: (P) => { P.layer(M.red, (q) => q.ell(12, 13, 9.5, 10, '#fff'), { r: 7 }); P.layer(M.bone, (q) => { q.stroke([[5, 6], [3, 2], [2, 0]], 3, 1, '#fff'); q.stroke([[19, 6], [21, 2], [22, 0]], 3, 1, '#fff'); }, { r: 2 }); P.rect(6, 10, 4, 3, '#1a0606').rect(14, 10, 4, 3, '#1a0606').px(7, 11, '#ffd060').px(15, 11, '#ffd060'); P.rect(7, 17, 10, 3, '#1a0606'); for (const x of [8, 15]) P.rect(x, 16, 1, 3, '#ffffff'); },
    sino_vento: (P) => { P.line(12, 0, 12, 4, '#8a5a34', 1.4); P.layer(M.gold, (q) => q.poly([[5, 18], [7, 6], [12, 3], [17, 6], [19, 18]], '#fff'), { r: 6 }); P.layer(M.teal, (q) => q.circ(12, 20, 2.4, '#fff'), { r: 2 }); P.stroke([[1, 10], [4, 12], [2, 15]], 1.4, 1, '#cfe2ff'); P.stroke([[23, 10], [20, 12], [22, 15]], 1.4, 1, '#cfe2ff'); },
    escama: (P) => { P.layer(M.red, (q) => q.poly([[12, 0], [22, 8], [18, 22], [6, 22], [2, 8]], '#fff'), { r: 7, rim: '#ffb070' }); P.line(12, 3, 12, 19, '#6e1426').line(6, 10, 12, 16).line(18, 10, 12, 16); },
    bussola: (P) => { P.layer(M.gold, (q) => q.circ(12, 12, 11, '#fff'), { r: 7 }); P.circ(12, 12, 8, '#1a1424'); P.poly([[12, 4], [14, 12], [10, 12]], '#ff4a5e'); P.poly([[12, 20], [14, 12], [10, 12]], '#e8e0d0'); P.circ(12, 12, 1.4, '#ffd060'); for (const [x, y] of [[12, 1], [23, 12], [12, 23], [1, 12]]) P.px(x, y, '#fff4c0'); },
    gema_sangue: (P) => { P.layer(M.gold, (q) => q.ring(12, 12, 10, '#fff', 3), { r: 2 }); P.layer(M.red, (q) => q.poly([[12, 4], [19, 10], [12, 21], [5, 10]], '#fff'), { r: 5, rim: '#ffb0b0' }); P.px(10, 8, '#ffffff'); },
    sandalias: (P) => { P.layer(M.leather, (q) => q.ell(12, 18, 9, 4, '#fff'), { r: 3 }); P.line(6, 16, 14, 12, '#5a3420', 1.5).line(18, 16, 12, 12, '#5a3420', 1.5); P.layer(M.white, (q) => { q.poly([[2, 14], [0, 4], [8, 10]], '#fff'); q.poly([[22, 14], [24, 4], [16, 10]], '#fff'); }, { r: 3 }); },
    pergaminho: (P) => { P.layer(M.cloth, (q) => q.rect(4, 4, 16, 16, '#fff'), { r: 5 }); P.layer(M.wood, (q) => { q.rect(2, 2, 20, 4, '#fff'); q.rect(2, 18, 20, 4, '#fff'); }, { r: 2 }); for (let y = 8; y < 17; y += 3) P.line(7, y, 17, y, '#7a5a3a'); P.circ(17, 15, 2, '#c8463c'); },
    raiz_vital: (P) => { P.layer(M.wood, (q) => { q.stroke([[12, 23], [12, 12]], 4, 2, '#fff'); q.stroke([[12, 18], [5, 22]], 2, 1, '#fff'); q.stroke([[12, 18], [19, 22]], 2, 1, '#fff'); }, { r: 2 }); P.layer(M.red, (q) => { q.circ(9.5, 7, 4, '#fff'); q.circ(14.5, 7, 4, '#fff'); q.poly([[5.5, 8], [12, 15], [18.5, 8]], '#fff'); }, { r: 4 }); P.layer(M.leaf, (q) => q.ell(17, 13, 3, 1.6, '#fff'), { r: 2 }); },
    orbe_tempestade: (P) => { P.layer(M.blue, (q) => q.circ(12, 12, 10.5, '#fff'), { r: 7, rim: '#cfe2ff' }); P.stroke([[14, 3], [9, 12], [15, 12], [10, 21]], 2, 2, '#ffe066'); P.px(7, 6, '#ffffff'); },
    adaga_veneno: (P) => { P.layer(M.dark, (q) => q.rect(2, 17, 7, 4, '#fff'), { r: 2 }); P.layer(M.gold, (q) => q.rect(7, 14, 3, 10, '#fff'), { r: 2 }); P.layer(M.steel, (q) => q.poly([[9, 17], [21, 4], [23, 2], [21, 8], [10, 20]], '#fff'), { r: 3 }); P.layer(M.slime, (q) => { q.circ(19, 9, 2.4, '#fff'); q.circ(17, 14, 1.6, '#fff'); }, { r: 2 }); },
  };
  for (const k in QD) { const P = new Painter(24, 24); QD[k](P); S.eq[k] = P.out(); }

  // ================================================================ KAZAN'S ABILITY ICONS (ink brush)
  const ink = '#f4efe6';
  const AB = {
    iai: (P) => { P.stroke([[2, 22], [16, 15], [30, 8]], 1, 4, ink); P.stroke([[2, 14], [10, 12]], 1, 2, ink); P.stroke([[4, 28], [14, 24]], 1, 2, ink); P.poly([[24, 6], [31, 6], [28, 12]], ink); },
    postura: (P) => { P.ring(16, 16, 11, ink, 3); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P.stroke([[16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12], [16 + Math.cos(a) * 15, 16 + Math.sin(a) * 15]], 2.4, 1, ink); } P.stroke([[16, 3], [16, 28]], 3, 2, ink); P.rect(12, 21, 8, 2, ink); },
    milcortes: (P) => { P.stroke([[3, 6], [27, 26]], 1, 3.4, ink); P.stroke([[4, 24], [28, 6]], 1, 3.4, ink); P.stroke([[2, 15], [30, 15]], 1, 3, ink); P.stroke([[14, 2], [18, 30]], 1, 2.4, ink); },
    areia: (P) => { P.stroke([[3, 16], [12, 16]], 3, 2, ink); for (let i = 0; i < 14; i++) { const a = -0.6 + (i % 5) * 0.3, d = 12 + (i * 7) % 16; P.circ(4 + Math.cos(a) * d, 16 + Math.sin(a) * d, 1.2 + (i % 3) * 0.4, ink); } },
  };
  for (const k in AB) {
    const P = new Painter(36, 36), r = N.makeRng(k.length * 31 + 7);
    for (let a = 0; a < 6.3; a += 0.05) { const rr = 16.4 + (r() - 0.5) * 1.6; P.line(18, 18, 18 + Math.cos(a) * rr, 18 + Math.sin(a) * rr, '#0c0a0e'); }
    P.circ(18, 18, 15.5, '#0c0a0e');
    const g = new Painter(32, 32); AB[k](g); P.x.drawImage(g.c, 2, 2);
    S.ab[k] = P.done();
  }

  // ================================================================ SCENERY for the new worlds
  D.mangue = sp(40, 46, (P) => { P.layer(['#1a120c', '#2e2016', '#463020', '#5e442c'], (q) => { q.rect(16, 10, 8, 26, '#fff'); q.stroke([[16, 30], [8, 38], [4, 46]], 4, 2, '#fff'); q.stroke([[24, 30], [32, 38], [36, 46]], 4, 2, '#fff'); q.stroke([[20, 34], [20, 46]], 4, 3, '#fff'); }, { r: 4 }); P.layer(['#0c201a', '#163428', '#22503a', '#3a7050'], (q) => { q.circ(12, 10, 9, '#fff'); q.circ(28, 10, 9, '#fff'); q.circ(20, 4, 8, '#fff'); }, { r: 7, rim: '#6ab090' }); });
  D.juncos = sp(22, 30, (P) => { for (let i = 0; i < 6; i++) { const x = 3 + i * 3.4; P.layer(M.green, (q) => q.stroke([[x, 30], [x + (i % 2 ? 2 : -2), 12 + (i % 3) * 3]], 2, 1, '#fff'), { r: 1 }); if (i % 2) P.layer(M.leather, (q) => q.ell(x + 1.5, 10 + (i % 3) * 3, 1.6, 3.5, '#fff'), { r: 2 }); } });
  D.lanternaPantano = sp(20, 46, (P) => { P.layer(M.dwood, (q) => { q.rect(8, 10, 4, 36, '#fff'); q.rect(4, 4, 12, 3, '#fff'); }, { r: 2 }); P.layer(['#2a6a3a', '#4aa85a', '#9aff6a', '#f0ffd0'], (q) => q.ell(10, 14, 5, 5.5, '#fff'), { r: 3 }); P.line(5, 13, 15, 13, '#1a3a1a'); });
  D.cogumelosAzuis = sp(26, 24, (P) => { for (const [x, y, s] of [[7, 14, 5], [17, 10, 6], [21, 17, 4]]) { P.layer(M.cloth, (q) => q.rect(x - 1, y, 3, s + 2, '#fff'), { r: 2 }); P.layer(['#1a3a6a', '#2e5aa8', '#5a8ae8', '#bfe0ff'], (q) => q.ell(x, y, s, s * 0.6, '#fff'), { r: 2 }); } });
  D.cristalGelo = sp(34, 46, (P) => { P.layer(ice, (q) => { q.poly([[6, 46], [9, 20], [14, 46]], '#fff'); q.poly([[22, 46], [27, 14], [31, 46]], '#fff'); }, { r: 4, rim: '#ffffff' }); P.layer(['#2a6a9a', '#5aa8d8', '#a8e4ff', '#ffffff'], (q) => q.poly([[12, 46], [17, 0], [24, 46]], '#fff'), { r: 5, rim: '#ffffff' }); P.line(17, 4, 18, 42, '#ffffff'); });
  D.pilarGelo = sp(30, 62, (P) => { P.layer(['#1a3858', '#2a5478', '#4a7ca0', '#8ab8d8'], (q) => { q.rect(3, 54, 24, 8, '#fff'); q.rect(6, 10, 18, 46, '#fff'); }, { r: 6, rim: '#e0f6ff' }); P.layer(snow, (q) => { q.ell(15, 10, 11, 4, '#fff'); q.ell(15, 54, 13, 3, '#fff'); }, { r: 3 }); for (const x of [10, 15, 20]) P.line(x, 14, x, 52, '#c8ecff'); });
  D.monteNeve = sp(34, 22, (P) => P.layer(snow, (q) => { q.ell(10, 15, 9, 7, '#fff'); q.ell(23, 15, 10, 7, '#fff'); q.ell(16, 9, 8, 7, '#fff'); }, { r: 7, rim: '#bfe8ff' }));
  D.obsidianaPico = sp(30, 52, (P) => { P.layer(['#0c0812', '#1c1426', '#30223e', '#7a5aa8'], (q) => { q.poly([[2, 52], [10, 10], [16, 52]], '#fff'); q.poly([[12, 52], [20, 0], [28, 52]], '#fff'); }, { r: 5, rim: '#c8a0ff' }); P.line(20, 4, 22, 44, '#a080d0'); });
  D.ventLava = sp(32, 22, (P) => { P.layer(basalt, (q) => q.ell(16, 13, 15, 8, '#fff'), { r: 6 }); P.ell(16, 12, 9, 4.6, '#c8420e').ell(16, 11.5, 6.5, 3, '#ff8a2a').ell(16, 11, 3.5, 1.6, '#ffe08a'); });
  D.cranios = sp(30, 22, (P) => { for (const [x, y] of [[8, 14], [20, 15], [14, 7]]) P.layer(M.bone, (q) => { q.circ(x, y, 5.4, '#fff'); q.rect(x - 3, y + 2, 6, 4, '#fff'); }, { r: 3 }); for (const [x, y] of [[6, 13], [10, 13], [18, 14], [22, 14], [12, 6], [16, 6]]) P.rect(x, y, 2, 2, '#2a1a10'); });
})();
