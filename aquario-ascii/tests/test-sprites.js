// Água-Tinta — creature sprites and art (owner B). §6.6, §15.11.
'use strict';
module.exports = function (T) {
  function sameDims(frames) {
    const h = frames[0].length, w = frames[0][0].length;
    return frames.every((f) => f.length === h && f.every((l) => l.length === w));
  }
  // tight bbox over the union of frames: no blank first/last row or column
  function tight(frames) {
    const h = frames[0].length, w = frames[0][0].length;
    const rowUsed = (r) => frames.some((f) => f[r].trim() !== '');
    const colUsed = (c) => frames.some((f) => f.some((l) => l[c] !== ' '));
    return rowUsed(0) && rowUsed(h - 1) && colUsed(0) && colUsed(w - 1);
  }
  function allFrames(sd) {
    const out = sd.frames.slice();
    for (const k of Object.keys(sd.extra || {})) out.push(...sd.extra[k]);
    return out;
  }

  T.test('every species and sighting has a sprite with ≥ 2 frames of equal size', () => {
    const { AQ } = T.load();
    const ids = AQ.species.list.map((s) => s.sprite).concat(AQ.sightings.list.map((s) => s.sprite), ['_alevino']);
    const bad = [];
    for (const id of ids) {
      const sd = AQ.sprites[id];
      if (!sd || !sd.frames) { bad.push(id + ' missing'); continue; }
      if (sd.frames.length < 2) bad.push(id + ' frames');
      if (!sameDims(sd.frames)) bad.push(id + ' dims');
      if (!tight(sd.frames)) bad.push(id + ' bbox');
      if (!(sd.fps > 0) || !AQ.ENUM.DEFORM.includes(sd.deform)) bad.push(id + ' fps/deform');
    }
    T.eq(bad, []);
  });

  T.test('sizes within SIZE_MAX for the species size class', () => {
    const { AQ } = T.load();
    const bad = [];
    for (const s of AQ.species.list.concat(AQ.sightings.list)) {
      const f = AQ.sprites[s.sprite].frames[0], max = AQ.ENUM.SIZE_MAX[s.size];
      if (f[0].length > max[0] || f.length > max[1]) bad.push(s.id + ' ' + f[0].length + 'x' + f.length + ' > ' + max);
    }
    const a = AQ.sprites._alevino.frames[0];
    if (a[0].length > 6 || a.length > 2) bad.push('_alevino');
    T.ok(AQ.sprites.baleia.frames[0].length <= 12, 'baleia ≤ 12 rows');
    T.eq(bad, []);
  });

  T.test('charset whitelist, no tabs, mirror(mirror(x)) === x, no directional letters', () => {
    const { AQ } = T.load();
    const bad = [];
    for (const k of AQ.sprites.keys()) {
      const frames = allFrames(AQ.sprites[k]);
      for (const f of frames) {
        const bc = AQ.textart.badChars(f);
        if (bc.length) bad.push(k + ' chars ' + bc.join(''));
        if (f.some((l) => l.indexOf('\t') >= 0)) bad.push(k + ' tab');
        T.eq(AQ.textart.mirror(AQ.textart.mirror(f)), AQ.textart.pad(f), k + ' mirror');
        if (k !== 'tipografo' && f.some((l) => /[ceszSZJL]/.test(l))) bad.push(k + ' directional letter');
        if (f.some((l) => /x/.test(l))) bad.push(k + " 'x' (dead eye)");
      }
      for (const name of Object.keys(AQ.sprites[k].extra)) if (!sameDims(AQ.sprites[k].extra[name])) bad.push(k + '.' + name + ' dims');
    }
    T.eq(bad, []);
  });

  T.test('masks match frame sizes and use only x / .', () => {
    const { AQ } = T.load();
    const bad = [];
    for (const k of AQ.sprites.keys()) {
      const sd = AQ.sprites[k];
      if (!sd.masks) continue;
      if (sd.masks.length !== sd.frames.length) bad.push(k + ' count');
      sd.masks.forEach((m, i) => {
        const f = sd.frames[i];
        if (m.length !== f.length || m.some((l) => l.length !== f[0].length)) bad.push(k + ' dims ' + i);
        if (m.some((l) => /[^x.]/.test(l))) bad.push(k + ' chars ' + i);
      });
    }
    T.ok(AQ.sprites.aguaviva.masks, 'jelly has explicit masks');
    T.eq(bad, []);
  });

  T.test('glow, buried and lure cells point at glyphs inside the frame', () => {
    const { AQ } = T.load();
    const bad = [];
    for (const k of AQ.sprites.keys()) {
      const sd = AQ.sprites[k], f = sd.frames[0];
      for (const list of [sd.glow, sd.buried, sd.lure ? [sd.lure] : null]) {
        if (!list) continue;
        for (const [c, r] of list) if (!(r >= 0 && r < f.length && c >= 0 && c < f[0].length)) bad.push(k + ' ' + c + ',' + r);
      }
    }
    for (const id of ['machado', 'vibora', 'diabo', 'vampira', 'atolla', 'pelicano', 'aguaviva']) if (!AQ.sprites[id].glow) bad.push(id + ' no glow');
    T.ok(AQ.sprites.arraia.buried && AQ.sprites.arraia.buried.length >= 2, 'arraia buried cells');
    T.ok(AQ.sprites.diabo.lure, 'diabo lure');
    T.ok(AQ.sprites.baiacu.extra.inflate && AQ.sprites.polvo.extra.ink && AQ.sprites.lula.extra.jet &&
      AQ.sprites.ermitao.extra.hide && AQ.sprites.isopode.extra.roll, 'extra frames (§6.3)');
    T.eq(bad, []);
  });

  T.test('sprites.get falls back to a placeholder', () => {
    const { AQ } = T.load({ fresh: true, console: { warn() {}, log() {}, error() {} } });
    const p = AQ.sprites.get('does-not-exist');
    T.ok(p && p.frames.length >= 2);
    T.eq(AQ.sprites.get('manjuba'), AQ.sprites.manjuba);
  });

  T.test('logo widths 64 and 27/32', () => {
    const { AQ } = T.load();
    const L = AQ.art.logo;
    T.ok(L.wide.every((l) => l.length === 64) && L.wide.length === 5, 'wide 64×5');
    T.eq(L.tall.length, 2);
    T.ok(L.tall[0].every((l) => l.length === 27), 'ÁGUA 27');
    T.ok(L.tall[1].every((l) => l.length === 32), 'TINTA 32');
  });

  T.test('every art item: frames, equal sizes, charset, mirror-safe', () => {
    const { AQ } = T.load();
    const A = AQ.art, bad = [];
    let n = 0;
    (function walk(o, p) {
      if (!o || typeof o !== 'object') return;
      if (o.frames) {
        n++;
        if (!o.frames.length || !sameDims(o.frames)) bad.push(p + ' dims');
        else if (!tight(o.frames)) bad.push(p + ' bbox');
        for (const f of allFrames(o)) {
          if (AQ.textart.badChars(f).length) bad.push(p + ' chars');
          if (JSON.stringify(AQ.textart.mirror(AQ.textart.mirror(f))) !== JSON.stringify(AQ.textart.pad(f))) bad.push(p + ' mirror');
        }
        return;
      }
      for (const k of Object.keys(o)) walk(o[k], p + '.' + k);
    })(A, 'art');
    T.ok(n >= 30, 'art items: ' + n);
    for (const k of ['boat', 'bottle', 'birds', 'lamp', 'filter', 'tentacle']) if (!A[k] || A[k].frames.length < 2) bad.push(k + ' needs 2 frames');
    T.eq(Object.keys(A.decor).sort(), AQ.ENUM.DECOR.slice().sort());
    for (const k of Object.keys(A.decor)) {
      const f = A.decor[k].frames[0];
      if (f[0].length > 10 || f.length > 6) bad.push('decor.' + k + ' > 10×6');
    }
    T.ok(['algas', 'kelp', 'anemona'].every((k) => A.decor[k].deform === 'sway'), 'plants sway');
    T.eq(A.visitors.length, 4);
    for (const v of A.visitors) if (v.frames.length !== 2 || v.frames[0].length !== 3) bad.push('visitor ' + v.key);
    for (const k of ['aquarium', 'shop', 'lighthouse', 'pier']) if (!A.map[k]) bad.push('map.' + k);
    for (const b of AQ.ENUM.BAITS) if (typeof A.baitGlyph[b] !== 'string' || !A.baitGlyph[b]) bad.push('baitGlyph.' + b);
    T.eq(bad, []);
  });

  T.test('angler poses share one size; rod tips inside', () => {
    const { AQ } = T.load();
    const a = AQ.art.angler;
    const poses = [a.idle, a.windup, a.cast, a.cheer].concat(a.reel);
    T.eq(a.reel.length, 3);
    T.ok(poses.every((p) => p.length === a.h && p.every((l) => l.length === a.w)), 'sizes');
    const tips = [a.tip.idle, a.tip.windup, a.tip.cast].concat(a.tip.reel);
    const ps = [a.idle, a.windup, a.cast].concat(a.reel);
    tips.forEach((t, i) => T.ok(ps[i][t[1]][t[0]] !== ' ', 'tip on a glyph ' + i));
  });
};
