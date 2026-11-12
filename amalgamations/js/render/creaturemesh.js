// Amalgamations — creature models. A fused genome becomes one rigidly-skinned low-poly mesh
// (one draw call per material group) with a small skeleton, animated procedurally per posture.
// Geometry is cached per genome (+ equipment look) and shared between creatures of the same kind.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const R = AM.R || (AM.R = {});
  const PI = Math.PI;

  const EYE_WHITE = '#f6f4ec', PUPIL = '#15151a', TEETH = '#f6f2e6', BONE = '#eee4cc', DARK = '#2a2d33', TOAST = '#d9a05b';
  const RARITY_METAL = { common: '#9aa3ad', uncommon: '#6fb878', rare: '#5a9ee8', epic: '#a070e0', legendary: '#f0b030' };

  function buildModel(g, look) {
    const gb = new R.GeoBuilder(true);
    const bones = [];
    const boneIndex = {};
    const B = (name, parent, pos) => { boneIndex[name] = bones.length; bones.push({ name, parent: parent == null ? -1 : boneIndex[parent], pos: pos.slice() }); return boneIndex[name]; };
    const P = g.palette;
    const rng = AM.makeRng(AM.hashStr(g.key + ':look'));
    const body = g.body, head = g.head;
    const isBiped = g.posture === 'biped';
    const long = body.l >= body.h * 0.95;
    const metal = g.material === 'metal';
    const ghostBody = g.material === 'ethereal' ? 2 : 0;
    const ghostLimb = g.limbMaterial === 'ethereal' ? 2 : 0;
    const primary = P.primary, secondary = P.secondary, accent = P.accent;
    const limbCol = g.patchwork ? secondary : AM.shade(primary, -0.04);
    const darker = AM.shade(primary, -0.12);
    const hornCol = AM.mixColor(BONE, accent, 0.3);
    const headCol = g.pattern === 'hood' ? secondary : primary;

    // ---------- layout ----------
    const legLen = g.legs ? g.legs.len : 0;
    let by;
    if (g.posture === 'hover') by = g.hover + body.h / 2 + (g.legs ? Math.min(legLen * 0.5, 0.3) : 0);
    else if (g.posture === 'hop') by = (g.legs ? legLen * 0.55 : 0) + body.h / 2;
    else by = legLen + body.h / 2;
    const top = by + body.h / 2, bottom = by - body.h / 2;

    B('root', null, [0, 0, 0]);
    const bBody = B('body', 'root', [0, by, 0]);
    const add = (bone, o, pos, rot) => { o.m = R.mat(pos, rot); o.bone = bone; gb.box(o); };

    // ---------- body ----------
    const minD = Math.min(body.w, body.h, body.l);
    const shapeOpts = {
      box: { c: minD * 0.12 }, round: { c: minD * 0.32 }, barrel: { c: Math.min(body.w, body.h) * 0.3 }, flat: { c: minD * 0.1 },
      tall: { c: minD * 0.16 }, wedge: { c: minD * 0.1, tt: 0.62 }, cone: { c: minD * 0.22, tf: 0.22 }, chest: { c: minD * 0.05 },
      cage: { c: 0 }, drop: { c: minD * 0.32, tt: 0.72 }, blob: { c: minD * 0.4, tt: 0.72 }, orb: { c: minD * 0.4 },
    }[body.shape] || { c: minD * 0.12 };
    if (body.shape === 'cage') {
      // lantern: frame + glowing glass + caps
      const t = Math.min(body.w, body.l) * 0.09;
      add(bBody, { w: body.w * 0.86, h: body.h * 0.8, l: body.l * 0.86, c: 0, col: AM.mixColor(secondary, '#ffffff', 0.3), bucket: 2 }, [0, by, 0]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(bBody, { w: t, h: body.h * 0.86, l: t, col: primary }, [sx * body.w * 0.45, by, sz * body.l * 0.45]);
      add(bBody, { w: body.w * 1.04, h: body.h * 0.12, l: body.l * 1.04, c: body.h * 0.03, col: primary, tt: 0.7 }, [0, top - body.h * 0.04, 0]);
      add(bBody, { w: body.w * 1.04, h: body.h * 0.1, l: body.l * 1.04, c: body.h * 0.03, col: primary }, [0, bottom + body.h * 0.05, 0]);
    } else {
      add(bBody, Object.assign({ w: body.w, h: body.h, l: body.l, col: primary, bucket: ghostBody }, shapeOpts), [0, by, 0]);
    }
    if (body.shape === 'chest') {
      add(bBody, { w: body.w * 0.22, h: body.h * 0.4, l: 0.05, col: secondary }, [0, by + body.h * 0.12, body.l / 2 + 0.02]);
      add(bBody, { w: body.w * 0.08, h: body.h * 0.12, l: 0.04, col: DARK }, [0, by + body.h * 0.1, body.l / 2 + 0.05]);
      // teeth along the front rim (the lid is the upper jaw)
      for (let i = 0; i < 5; i++) add(bBody, { w: body.w * 0.09, h: 0.09, l: 0.06, tt: 0.15, col: TEETH }, [(-0.36 + i * 0.18) * body.w, top + 0.04, body.l / 2 - 0.04]);
    }
    if (body.shape === 'drop' && !g.legs) {
      for (let i = 0; i < 4; i++) add(bBody, { w: body.w * 0.24, h: body.h * 0.22, l: body.l * 0.24, c: 0.03, tt: 0.3, col: primary, bucket: ghostBody }, [(-0.36 + i * 0.24) * body.w, bottom - body.h * 0.06, (i % 2 ? 0.15 : -0.15) * body.l], [PI, 0, 0]);
    }
    // ---------- pattern ----------
    const over = (o, pos) => add(bBody, Object.assign({ bucket: ghostBody }, o), pos);
    // A band around the body: an octagonal prism matching the body's chamfer (and taper) at that height/length.
    const band = (axis, thick, at, col) => {
      let w = body.w * 1.03, h = body.h * 1.03, l = body.l * 1.03, cv = shapeOpts.c * 1.03;
      if (axis === 'y' && shapeOpts.tt) { const k = 1 + (shapeOpts.tt - 1) * ((at - bottom) / body.h); w *= k; l *= k; cv *= k; }
      if (axis === 'z' && shapeOpts.tf && at > 0) { const k = 1 + (shapeOpts.tf - 1) * (at / (body.l / 2)); w *= k; h *= k; cv *= k; }
      const o = { w, h: axis === 'y' ? thick : h, l: axis === 'z' ? thick : l, cv, axis, col, bucket: ghostBody, bone: bBody };
      o.m = R.mat(axis === 'y' ? [0, at, 0] : [0, by, at]);
      gb.prism(o);
    };
    const pat = g.pattern;
    if (pat === 'belly') {
      if (isBiped || !long) over({ w: body.w * 0.66, h: body.h * 0.72, l: 0.06, c: 0.02, col: secondary }, [0, by - body.h * 0.08, body.l / 2 + 0.01]);
      else over({ w: body.w * 1.02, h: body.h * 0.3, l: body.l * 0.9, c: shapeOpts.c * 0.5, col: secondary }, [0, bottom + body.h * 0.14, 0]);
    } else if (pat === 'stripes' || pat === 'rings') {
      const n = pat === 'rings' ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / (n + 1) - 0.5;
        if (isBiped || !long) band('y', body.h * 0.07, by + f * body.h * 0.9, secondary);
        else band('z', body.l * 0.07, f * body.l * 0.9, secondary);
      }
    } else if (pat === 'spots' || pat === 'patches' || pat === 'veins') {
      const n = pat === 'spots' ? 6 : pat === 'veins' ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const side = rng.next();
        const s = pat === 'patches' ? minD * 0.42 : minD * 0.2;
        const pw = pat === 'veins' ? s * 0.3 : s, pl = pat === 'veins' ? s * 2 : s;
        if (side < 0.5) over({ w: pw, h: 0.03, l: pl, col: secondary }, [rng.range(-0.35, 0.35) * body.w * (shapeOpts.tt || 1), top + 0.005 - (body.shape === 'orb' || body.shape === 'blob' ? body.h * 0.05 : 0), rng.range(-0.35, 0.35) * body.l * (shapeOpts.tt || 1)]);
        else { const sx = side < 0.75 ? 1 : -1; over({ w: 0.03, h: pw, l: pl, col: secondary }, [sx * (body.w / 2 + 0.005) * (body.shape === 'orb' ? 0.93 : 1), by + rng.range(-0.25, 0.25) * body.h, rng.range(-0.3, 0.3) * body.l]); }
      }
    } else if (pat === 'gradient') {
      if (body.shape === 'cone') over({ w: body.w * 0.52, h: body.h * 0.52, l: body.l * 0.3, c: 0.04, tf: 0.2, col: secondary }, [0, by, body.l * 0.36]);
      else if (isBiped || !long) { band('y', body.h * 0.16, top - body.h * 0.3, secondary); band('y', body.h * 0.12, top - body.h * 0.14, secondary); }
      else { band('z', body.l * 0.2, -body.l * 0.3, secondary); band('z', body.l * 0.12, -body.l * 0.13, secondary); }
    }

    // ---------- head ----------
    let headPos = null, faceZ = body.l / 2, faceY = by + body.h * 0.12, faceW = body.w, faceH = body.h, faceBone = bBody;
    if (head.shape === 'lid') {
      const hinge = [0, top, -body.l / 2];
      const bHead = B('head', 'body', hinge);
      headPos = [0, top + head.h / 2, 0];
      add(bHead, { w: head.w, h: head.h, l: head.l, c: head.h * 0.2, col: primary }, headPos);
      add(bHead, { w: head.w * 1.02, h: head.h * 0.35, l: head.l * 0.12, col: secondary }, [0, top + head.h * 0.3, head.l * 0.3]);
      add(bHead, { w: head.w * 1.02, h: head.h * 0.35, l: head.l * 0.12, col: secondary }, [0, top + head.h * 0.3, -head.l * 0.3]);
      for (let i = 0; i < 5; i++) add(bHead, { w: head.w * 0.08, h: 0.08, l: 0.06, tt: 0.15, col: TEETH }, [(-0.32 + i * 0.16) * head.w, top - 0.02, head.l / 2 - 0.05], [PI, 0, 0]);
      faceZ = head.l / 2; faceY = top + head.h * 0.55; faceW = head.w; faceH = head.h; faceBone = bHead;
    } else if (head.shape !== 'none') {
      let J, hc;
      if (isBiped || (!long && g.posture !== 'hop')) {
        J = [0, top - 0.02, body.l * 0.08];
        hc = [0, J[1] + g.neck * 0.8 + head.h / 2, J[2] + head.l * 0.12];
      } else if (g.posture === 'hop') {
        J = [0, by + body.h * 0.05, body.l / 2 * 0.75];
        hc = [0, J[1] + head.h * 0.15, J[2] + head.l / 2 - 0.02];
      } else {
        J = [0, by + body.h * 0.22, body.l / 2 - 0.04];
        hc = [0, J[1] + g.neck * 0.7 + head.h * 0.1, J[2] + g.neck * 0.75 + head.l / 2];
      }
      const bHead = B('head', 'body', J);
      if (g.neck > 0.08) {
        const nl = Math.hypot(hc[1] - J[1], hc[2] - J[2]);
        const ang = Math.atan2(hc[2] - J[2], hc[1] - J[1]);
        const nt = Math.min(head.w, body.w) * 0.5;
        add(bHead, { w: nt, h: nl, l: nt, c: nt * 0.2, col: headCol === secondary ? secondary : limbCol, bucket: ghostBody }, [0, (J[1] + hc[1]) / 2, (J[2] + hc[2]) / 2], [ang, 0, 0]);
      }
      const hOpts = { round: { c: Math.min(head.w, head.h) * 0.3 }, long: { c: Math.min(head.w, head.h) * 0.14, tf: 0.85 }, wedge: { c: Math.min(head.w, head.h) * 0.12, tf: 0.75, tt: 0.85 }, flat: { c: head.h * 0.2 }, box: { c: Math.min(head.w, head.h) * 0.12 } }[head.shape] || { c: 0.04 };
      add(bHead, Object.assign({ w: head.w, h: head.h, l: head.l, col: headCol, bucket: ghostBody }, hOpts), hc);
      headPos = hc;
      faceZ = hc[2] + head.l / 2; faceY = hc[1] + head.h * 0.12; faceW = head.w; faceH = head.h; faceBone = bHead;
      // snout and jaw
      const sn = head.snout;
      if (sn) {
        const sc = [0, hc[1] - head.h * 0.14, hc[2] + head.l / 2 + sn.l / 2 - 0.02];
        if (sn.shape === 'beak') {
          add(bHead, { w: sn.w, h: sn.h, l: sn.l, c: 0.01, tf: 0.15, col: accent }, sc, [0.25, 0, 0]);
        } else {
          const so = sn.shape === 'cone' ? { tf: 0.35, c: 0.03 } : { c: Math.min(sn.w, sn.h) * 0.18 };
          const upper = head.jaw ? 0.62 : 1;
          add(bHead, Object.assign({ w: sn.w, h: sn.h * upper, l: sn.l, col: headCol }, so), [0, sc[1] + sn.h * (1 - upper) / 2, sc[2]]);
          add(bHead, { w: sn.w * 0.5, h: sn.h * 0.22, l: 0.05, c: 0.01, col: PUPIL }, [0, sc[1] + sn.h * 0.25, sc[2] + sn.l / 2 + 0.005]);
          if (head.jaw) {
            const jHinge = [0, sc[1] - sn.h * 0.15, hc[2] + head.l * 0.2];
            const bJaw = B('jaw', 'head', jHinge);
            const jl = sn.l + head.l * 0.3;
            add(bJaw, Object.assign({ w: sn.w * 0.92, h: sn.h * 0.36, l: jl, col: g.pattern === 'belly' ? secondary : darker }, so), [0, jHinge[1] - sn.h * 0.12, jHinge[2] + jl / 2]);
            for (let i = 0; i < 2; i++) add(bJaw, { w: 0.05, h: 0.08, l: 0.05, tt: 0.1, col: TEETH }, [(i ? 1 : -1) * sn.w * 0.3, jHinge[1] + 0.02, jHinge[2] + jl - 0.06]);
            for (let i = 0; i < 2; i++) add(bHead, { w: 0.05, h: 0.08, l: 0.05, tt: 0.1, col: TEETH }, [(i ? 1 : -1) * sn.w * 0.34, sc[1] - sn.h * 0.2, sc[2] + sn.l / 2 - 0.05], [PI, 0, 0]);
          }
        }
        if (sn.shape !== 'beak') { /* eyes go above the snout */ }
      } else if (head.jaw) {
        // wide mouth (frog-like) without a snout
        const jHinge = [0, hc[1] - head.h * 0.15, hc[2] - head.l * 0.3];
        const bJaw = B('jaw', 'head', jHinge);
        add(bJaw, { w: head.w * 0.96, h: head.h * 0.3, l: head.l * 0.8, c: head.h * 0.08, col: g.pattern === 'belly' ? secondary : darker }, [0, jHinge[1] - head.h * 0.12, jHinge[2] + head.l * 0.4 + 0.02]);
        add(bHead, { w: head.w * 0.8, h: 0.03, l: 0.04, col: PUPIL }, [0, hc[1] - head.h * 0.12, hc[2] + head.l / 2 + 0.01]);
      }
    } else {
      B('head', 'body', [0, by + body.h * 0.2, body.l / 2]);
      if (body.shape === 'orb') { faceY = by + body.h * 0.02; }
      if (body.shape === 'tall' && isBiped) faceY = by + body.h * 0.22;
      // a little mouth on faceless bodies
      if (body.shape !== 'orb' && body.shape !== 'cage' && body.shape !== 'cone' && body.shape !== 'chest') {
        add(bBody, { w: Math.min(body.w * 0.25, 0.16), h: 0.035, l: 0.03, col: PUPIL }, [0, faceY - Math.min(body.h * 0.2, 0.14), body.l / 2 * (shapeOpts.tt ? (1 + shapeOpts.tt) / 2 * 0.98 : 1) + 0.005]);
      }
      if (body.shape === 'drop' || body.shape === 'blob' || body.shape === 'round') faceZ = body.l / 2 * (shapeOpts.tt ? 0.9 : 0.98);
    }
    const hb = boneIndex.head;

    // ---------- eyes ----------
    const E = g.eyes;
    const es = E.size;
    const eyeBone = faceBone === bBody ? bBody : hb;
    const snoutBack = head.shape !== 'none' && head.shape !== 'lid' && head.snout && head.snout.l > 0.12;
    const eyeAt = (x, y, z, side) => {
      const st = E.style;
      if (st === 'glow') { add(eyeBone, { w: es * 1.5, h: es, l: 0.04, col: P.eye, bucket: 1 }, [x, y, z]); return; }
      if (st === 'void') { add(eyeBone, { w: es * 1.3, h: es * 1.6, l: 0.04, c: 0.01, col: '#101018' }, [x, y, z]); add(eyeBone, { w: es * 0.35, h: es * 0.35, l: 0.02, col: '#9fb4ff', bucket: 1 }, [x, y, z + 0.025]); return; }
      if (st === 'dot') { add(eyeBone, { w: es, h: es, l: 0.04, col: P.eye === PUPIL ? PUPIL : P.eye }, [x, y, z]); add(eyeBone, { w: es * 0.5, h: es * 0.5, l: 0.02, col: PUPIL }, [x, y, z + 0.022]); return; }
      if (st === 'porthole') {
        add(eyeBone, { w: es * 2.3, h: es * 2.3, l: 0.05, c: es * 0.5, col: '#9aa3ad' }, [x, y, z]);
        add(eyeBone, { w: es * 1.7, h: es * 1.7, l: 0.04, c: es * 0.4, col: P.eye, bucket: 1 }, [x, y, z + 0.02]);
        return;
      }
      if (st === 'turret') {
        add(eyeBone, { w: es * 2, h: es * 2, l: es * 1.6, c: es * 0.4, tf: 0.75, col: headCol }, [x + side * es * 0.3, y, z - es * 0.2], [0, side * 0.5, 0]);
        add(eyeBone, { w: es * 0.8, h: es * 0.8, l: 0.03, col: P.eye }, [x + side * es * 0.75, y, z + es * 0.55], [0, side * 0.5, 0]);
        add(eyeBone, { w: es * 0.4, h: es * 0.4, l: 0.02, col: PUPIL }, [x + side * es * 0.78, y, z + es * 0.6], [0, side * 0.5, 0]);
        return;
      }
      if (st === 'bulge') {
        add(eyeBone, { w: es * 1.6, h: es * 1.6, l: es * 1.6, c: es * 0.4, col: headCol }, [x, y + es * 0.5, z - es * 0.6]);
        add(eyeBone, { w: es * 1.2, h: es * 1.2, l: 0.04, col: P.eye }, [x, y + es * 0.6, z + es * 0.2]);
        add(eyeBone, { w: es * 1.0, h: es * 0.35, l: 0.03, col: PUPIL }, [x, y + es * 0.6, z + es * 0.24]);
        return;
      }
      if (st === 'giant') {
        add(eyeBone, { w: es * 2.2, h: es * 2.2, l: 0.08, c: es * 0.45, col: EYE_WHITE }, [x, y, z]);
        add(eyeBone, { w: es * 1.3, h: es * 1.3, l: 0.04, c: es * 0.25, col: AM.mixColor(P.accent, P.eye, 0.3) }, [x, y, z + 0.05]);
        add(eyeBone, { w: es * 0.6, h: es * 0.6, l: 0.03, col: PUPIL }, [x, y, z + 0.075]);
        add(eyeBone, { w: es * 0.22, h: es * 0.22, l: 0.02, col: '#ffffff' }, [x + es * 0.3, y + es * 0.3, z + 0.085]);
        return;
      }
      // cute / big / slit
      const white = st === 'slit' ? P.eye : EYE_WHITE;
      add(eyeBone, { w: es * 1.25, h: es * (st === 'slit' ? 1 : 1.35), l: 0.04, c: es * 0.15, col: white }, [x, y, z]);
      if (st === 'slit') add(eyeBone, { w: es * 0.25, h: es * 0.9, l: 0.02, col: PUPIL }, [x, y, z + 0.022]);
      else {
        add(eyeBone, { w: es * 0.75, h: es * 0.85, l: 0.02, col: st === 'big' ? P.eye : PUPIL }, [x + side * es * 0.05, y - es * 0.08, z + 0.022]);
        if (st === 'big') add(eyeBone, { w: es * 0.4, h: es * 0.45, l: 0.02, col: PUPIL }, [x + side * es * 0.05, y - es * 0.08, z + 0.032]);
        add(eyeBone, { w: es * 0.28, h: es * 0.28, l: 0.02, col: '#ffffff' }, [x - side * es * 0.18, y + es * 0.2, z + 0.034]);
      }
    };
    {
      let ez = faceZ + 0.01, ey = faceY, spread = faceW * 0.27;
      if (snoutBack) { ez = headPos[2] + head.l * 0.38; ey = headPos[1] + head.h * 0.22; spread = faceW * 0.36; }
      if (E.style === 'porthole' && faceBone === bBody) {
        const k = shapeOpts.tf ? 1 + (shapeOpts.tf - 1) * 0.3 : 1;
        add(bBody, { w: es * 2.3, h: es * 2.3, l: 0.05, c: es * 0.5, col: '#9aa3ad' }, [0, by + body.h / 2 * k - 0.01, body.l * 0.15], [-1.1, 0, 0]);
        add(bBody, { w: es * 1.7, h: es * 1.7, l: 0.05, c: es * 0.4, col: P.eye, bucket: 1 }, [0, by + body.h / 2 * k + 0.01, body.l * 0.15 + 0.01], [-1.1, 0, 0]);
      } else if (E.count === 1) eyeAt(0, ey, ez, 1);
      else if (E.count === 2) { eyeAt(-spread, ey, ez, -1); eyeAt(spread, ey, ez, 1); }
      else if (E.count === 3) { eyeAt(0, ey + es * 0.9, ez, 1); eyeAt(-spread, ey - es * 0.2, ez, -1); eyeAt(spread, ey - es * 0.2, ez, 1); }
      else for (let i = 0; i < E.count; i++) eyeAt((i - (E.count - 1) / 2) * es * 1.8, ey + (i % 2 ? es * 0.4 : 0), ez, i < E.count / 2 ? -1 : 1);
    }

    // ---------- legs ----------
    const legs = [];
    if (g.legs) {
      const L = g.legs, n = L.count, t = L.thick;
      const perSide = n / 2;
      const hipY = bottom + Math.min(body.h * 0.15, 0.08);
      const dangle = g.posture === 'hover';
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
        let hx, hz;
        if (n === 2) { hx = side * body.w * 0.24; hz = isBiped ? 0 : 0; }
        else {
          hz = perSide === 1 ? 0 : AM.lerp(body.l / 2 * 0.72, -body.l / 2 * 0.72, k / (perSide - 1));
          hx = side * Math.max(body.w / 2 - t * 0.6, t * 0.6);
        }
        if (L.style === 'tentacle') { const a = (i / n) * PI * 2 + PI / n; hx = Math.cos(a) * body.w * 0.32; hz = Math.sin(a) * body.l * 0.32; }
        const len = dangle ? L.len * 0.8 : (g.posture === 'hop' ? legLen : by - body.h / 2 - 0 + (hipY - bottom));
        const hip = B('leg' + i, 'body', [hx, hipY, hz]);
        const leg = { bone: hip, side, k, idx: i, knee: null, style: L.style, tent: [] };
        const col = limbCol, bk = ghostLimb;
        if (L.style === 'jointed') {
          const out = Math.min(0.28, L.len * 0.7);
          const kneePos = [hx + side * out, hipY + 0.05, hz];
          add(hip, { w: out + t, h: t, l: t, c: t * 0.2, col, bucket: bk }, [hx + side * out / 2, hipY + 0.03, hz], [0, 0, side * -0.25]);
          const knee = B('knee' + i, 'leg' + i, kneePos);
          const ll = kneePos[1] + (dangle ? -L.len : 0);
          const lowerLen = dangle ? L.len : kneePos[1];
          add(knee, { w: t, h: lowerLen, l: t, c: t * 0.2, tt: 0.6, col, bucket: bk }, [kneePos[0] + side * 0.03, kneePos[1] - lowerLen / 2, kneePos[2]]);
          void ll;
          leg.knee = knee;
        } else if (L.style === 'tentacle') {
          const segs = 3, sl = (dangle ? L.len : hipY + 0.02) / segs;
          let parent = 'leg' + i, py = hipY;
          const dir = [hx, hz]; const dl = Math.hypot(dir[0], dir[1]) || 1;
          for (let s = 0; s < segs; s++) {
            const off = (s + 1) * sl * 0.35;
            const p = [hx + dir[0] / dl * off, py, hz + dir[1] / dl * off];
            const bn = s === 0 ? hip : B(`tent${i}_${s}`, parent, p);
            const tw = t * (1 - s * 0.22);
            add(bn, { w: tw, h: sl * 1.05, l: tw, c: tw * 0.25, col: s === segs - 1 ? AM.shade(col, 0.06) : col, bucket: bk }, [p[0] + dir[0] / dl * sl * 0.15, py - sl / 2, p[2] + dir[1] / dl * sl * 0.15]);
            leg.tent.push(bn);
            parent = s === 0 ? 'leg' + i : `tent${i}_${s}`;
            py -= sl;
          }
        } else if (L.style === 'hop') {
          const back = k > 0 || perSide === 1;
          const ll = back ? len * 1.25 : len;
          if (back) {
            add(hip, { w: t * 1.3, h: t * 1.2, l: ll * 0.62, c: t * 0.3, col, bucket: bk }, [hx + side * t * 0.3, hipY - t * 0.2, hz - ll * 0.12]);
            add(hip, { w: t, h: len, l: t, c: t * 0.25, col, bucket: bk }, [hx + side * t * 0.4, hipY - len / 2, hz - ll * 0.38]);
            add(hip, { w: t * 1.5, h: t * 0.4, l: t * 2, c: t * 0.1, col: AM.shade(col, -0.06), bucket: bk }, [hx + side * t * 0.4, t * 0.2, hz - ll * 0.3]);
          } else {
            add(hip, { w: t * 0.8, h: len, l: t * 0.8, c: t * 0.2, col, bucket: bk }, [hx, hipY - len / 2, hz]);
            add(hip, { w: t * 1.2, h: t * 0.35, l: t * 1.4, c: t * 0.08, col: AM.shade(col, -0.06), bucket: bk }, [hx, t * 0.17, hz + t * 0.2]);
          }
        } else {
          const lw = L.style === 'pillar' || L.style === 'hoof' ? t : t * (L.style === 'stub' ? 1.05 : 0.85);
          const lenS = dangle ? L.len * 0.8 : len;
          const yc = dangle ? hipY - lenS / 2 : hipY - lenS / 2;
          add(hip, { w: lw, h: lenS, l: lw, c: lw * 0.22, tt: L.style === 'claw' || L.style === 'paw' ? 0.82 : 1, col, bucket: bk }, [hx, yc, hz]);
          const footY = dangle ? hipY - lenS : 0;
          if (L.style === 'paw') add(hip, { w: lw * 1.2, h: lw * 0.45, l: lw * 1.5, c: lw * 0.15, col: AM.shade(col, -0.05), bucket: bk }, [hx, footY + lw * 0.22, hz + lw * 0.2]);
          else if (L.style === 'hoof') add(hip, { w: lw * 1.08, h: lw * 0.4, l: lw * 1.08, c: lw * 0.1, col: '#4a4038', bucket: bk }, [hx, footY + lw * 0.2, hz]);
          else if (L.style === 'claw') for (let c = -1; c <= 1; c++) add(hip, { w: 0.03, h: 0.03, l: lw * 0.9, tt: 0.4, col: hornCol }, [hx + c * lw * 0.3, footY + 0.02, hz + lw * 0.45]);
          else if (L.style === 'flipper') add(hip, { w: lw * 2, h: 0.04, l: lw * 1.2, col, bucket: bk }, [hx + side * lw * 0.4, footY + 0.03, hz]);
        }
        legs.push(leg);
      }
    }

    // ---------- arms ----------
    const arms = [];
    if (g.arms) {
      const A = g.arms, t = A.thick;
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        const front = !isBiped && g.posture !== 'hover';
        const sh = front ? [side * body.w * 0.36, by + body.h * 0.05, body.l / 2 - 0.02] : [side * (body.w / 2 + t * 0.35), by + body.h * 0.22, 0];
        const bA = B('arm' + i, 'body', sh);
        const col = limbCol, bk = ghostLimb;
        if (A.style === 'pincer') {
          const L = A.len;
          add(bA, { w: t * 0.8, h: t * 0.8, l: L * 0.6, c: t * 0.15, col }, [sh[0] + side * 0.05, sh[1], sh[2] + L * 0.3], [0, side * -0.3, 0]);
          const cx = sh[0] + side * 0.05 - side * L * 0.18, cz = sh[2] + L * 0.62;
          add(bA, { w: t * 1.3, h: t * 1.1, l: L * 0.35, c: t * 0.25, col: AM.shade(col, 0.05) }, [cx, sh[1], cz]);
          add(bA, { w: t * 0.45, h: t * 0.7, l: L * 0.32, tf: 0.3, col: accent }, [cx - side * t * 0.35, sh[1], cz + L * 0.28]);
          add(bA, { w: t * 0.45, h: t * 0.7, l: L * 0.28, tf: 0.3, col: accent }, [cx + side * t * 0.35, sh[1], cz + L * 0.24]);
        } else if (A.style === 'branch') {
          const out = A.len * 0.45, up = A.len * 0.7;
          add(bA, { w: out, h: t, l: t, c: t * 0.3, col, bucket: bk }, [sh[0] + side * out / 2, sh[1], sh[2]]);
          add(bA, { w: t, h: up, l: t, c: t * 0.3, col, bucket: bk }, [sh[0] + side * out, sh[1] + up / 2 - t / 2, sh[2]]);
        } else if (A.style === 'fist') {
          const L = A.len;
          add(bA, { w: t, h: L * 0.75, l: t, c: t * 0.2, col, bucket: bk }, [sh[0] + side * t * 0.2, sh[1] - L * 0.37, sh[2]]);
          add(bA, { w: t * 1.4, h: t * 1.3, l: t * 1.4, c: t * 0.25, col: AM.shade(col, -0.05), bucket: bk }, [sh[0] + side * t * 0.2, sh[1] - L * 0.8, sh[2]]);
        } else {
          const L = A.len;
          add(bA, { w: t, h: L, l: t, c: t * 0.3, col, bucket: bk }, [sh[0] + side * t * 0.15, sh[1] - L / 2 + t * 0.3, sh[2] + (front ? L * 0.2 : 0)], [front ? -0.6 : 0, 0, side * 0.15]);
        }
        arms.push({ bone: bA, side, style: A.style, front });
      }
    }

    // ---------- tail ----------
    const tail = [];
    if (g.tail) {
      const T = g.tail, st = T.style;
      const base = isBiped ? [0, by - body.h * 0.25, -body.l / 2 + 0.02] : [0, by + body.h * 0.1, -body.l / 2 + 0.02];
      if (st === 'handle') {
        const bT = B('tail0', 'body', base);
        const s = Math.min(body.h * 0.6, T.len), tk = Math.max(0.06, s * 0.18);
        add(bT, { w: tk, h: tk, l: s * 0.55, c: tk * 0.2, col: primary }, [0, base[1] + s * 0.4, base[2] - s * 0.27]);
        add(bT, { w: tk, h: s * 0.85, l: tk, c: tk * 0.2, col: primary }, [0, base[1], base[2] - s * 0.52]);
        add(bT, { w: tk, h: tk, l: s * 0.55, c: tk * 0.2, col: primary }, [0, base[1] - s * 0.4, base[2] - s * 0.27]);
        tail.push({ bone: bT, i: 0, style: st });
      } else if (st === 'jet') {
        const bT = B('tail0', 'body', base);
        const r = Math.min(body.w, body.h) * 0.55;
        add(bT, { w: r, h: r, l: T.len, c: r * 0.15, tf: 0.8, tb: 1.25, col: DARK }, [0, by, -body.l / 2 - T.len / 2 + 0.05]);
        const bF = B('flame', 'tail0', [0, by, -body.l / 2 - T.len]);
        add(bF, { w: r * 0.75, h: r * 0.75, l: r * 1.3, c: 0.02, tb: 0.15, col: '#ffb43a', bucket: 1 }, [0, by, -body.l / 2 - T.len - r * 0.6]);
        add(bF, { w: r * 0.42, h: r * 0.42, l: r * 0.9, c: 0.02, tb: 0.2, col: '#fff2a8', bucket: 1 }, [0, by, -body.l / 2 - T.len - r * 0.4]);
        tail.push({ bone: bT, i: 0, style: st });
      } else {
        const segs = T.segs, sl = T.len / segs;
        let pos = base.slice(), parent = 'body';
        let ang = st === 'stinger' ? 0.35 : st === 'curl' ? -0.15 : st === 'wisp' ? -0.35 : st === 'fan' ? -0.5 : -0.12;
        const thick0 = st === 'thin' ? Math.max(0.05, Math.min(body.w, body.h) * 0.12) : st === 'bushy' ? Math.min(body.w, body.h) * 0.38 : st === 'fin' ? Math.min(body.w, body.h) * 0.42 : Math.min(body.w, body.h) * (st === 'stinger' ? 0.48 : 0.36);
        for (let s = 0; s < segs; s++) {
          const bn = B('tail' + s, parent, pos);
          const dir = [0, Math.sin(ang), -Math.cos(ang)];
          const c = [pos[0], pos[1] + dir[1] * sl / 2, pos[2] + dir[2] * sl / 2];
          let th = thick0 * (1 - (s / segs) * (st === 'bushy' ? 0.1 : 0.55));
          if (st === 'bushy' && s === 0) th *= 0.7;
          const col = (st === 'bushy' && s === segs - 1) ? secondary : primary;
          const rot = [ang - PI / 2, 0, 0];
          if (st === 'fan') add(bn, { w: Math.max(0.3, body.w * 0.9), h: sl * 1.1, l: 0.05, c: 0.02, tt: 1.6, col: secondary }, c, rot);
          else add(bn, { w: th, h: sl * 1.08, l: th * (st === 'fin' ? 0.8 : 1), c: th * 0.25, col, bucket: st === 'wisp' ? 2 : ghostBody }, c, rot);
          if (st === 'spiked') add(bn, { w: 0.04, h: th * 0.9, l: th * 0.5, tt: 0.1, col: accent }, [c[0], c[1] + th * 0.55, c[2]]);
          tail.push({ bone: bn, i: s, style: st });
          pos = [pos[0], pos[1] + dir[1] * sl, pos[2] + dir[2] * sl];
          parent = 'tail' + s;
          if (st === 'stinger') ang += 0.55;
          else if (st === 'curl') ang -= 0.75;
          else if (st === 'wisp') ang += 0.1;
        }
        const last = 'tail' + (segs - 1);
        const lb = boneIndex[last];
        if (st === 'stinger') add(lb, { w: thick0 * 0.6, h: thick0 * 0.6, l: thick0 * 1.6, c: 0.01, tf: 0.12, col: accent }, [pos[0], pos[1] + 0.02, pos[2] + thick0 * 0.6], [0.6, 0, 0]);
        if (st === 'fin') {
          const fh = Math.max(0.3, body.h * 0.9);
          add(lb, { w: 0.05, h: fh * 0.55, l: fh * 0.35, tt: 0.2, sh: -0.5, col: primary }, [pos[0], pos[1] + fh * 0.25, pos[2] - 0.05]);
          add(lb, { w: 0.05, h: fh * 0.45, l: fh * 0.3, tt: 0.2, sh: -0.5, col: primary }, [pos[0], pos[1] - fh * 0.2, pos[2] - 0.05], [PI, 0, 0]);
        }
        if (st === 'club') add(lb, { w: thick0 * 2, h: thick0 * 2, l: thick0 * 2, c: thick0 * 0.4, col: accent }, pos);
      }
    }

    // ---------- wings ----------
    const wings = [];
    if (g.wings) {
      const Wg = g.wings, span = Wg.span / 2;
      if (Wg.style === 'jet') {
        const bW = B('wing0', 'body', [0, by, -body.l * 0.3]);
        const fs = Math.min(0.42, span * 0.6);
        for (let k = 0; k < 4; k++) {
          const a = k * PI / 2 + PI / 4;
          add(bW, { w: 0.05, h: fs, l: fs * 1.2, tt: 0.3, sh: -0.4, col: secondary }, [Math.cos(a) * (Math.min(body.w, body.h) * 0.45 + fs * 0.3), by + Math.sin(a) * (Math.min(body.w, body.h) * 0.45 + fs * 0.3), -body.l * 0.32], [0, 0, a - PI / 2]);
        }
        wings.push({ bone: bW, side: 0, style: 'jet' });
      } else {
        for (let i = 0; i < 2; i++) {
          const side = i ? 1 : -1;
          const root = [side * body.w * 0.42, isBiped ? by + body.h * 0.25 : top - body.h * 0.12, isBiped ? -body.l * 0.25 : body.l * 0.08];
          const bW = B('wing' + i, 'body', root);
          const chord = Math.max(0.3, Math.min(0.6, span * 0.42));
          if (Wg.style === 'bat') {
            add(bW, { w: span, h: 0.05, l: 0.06, c: 0.01, col: darker }, [root[0] + side * span / 2, root[1] + 0.04, root[2] + chord * 0.3]);
            add(bW, { w: span * 0.95, h: 0.03, l: chord, tf: 1, tt: 1, col: AM.shade(secondary, -0.08), bucket: ghostLimb }, [root[0] + side * span * 0.48, root[1], root[2] - chord * 0.15]);
            for (let f = 0; f < 3; f++) add(bW, { w: 0.03, h: 0.035, l: chord * 1.1, col: darker }, [root[0] + side * span * (0.35 + f * 0.25), root[1] + 0.01, root[2] - chord * 0.2]);
          } else {
            add(bW, { w: span * 0.6, h: 0.06, l: chord, c: 0.02, col: primary, bucket: ghostLimb }, [root[0] + side * span * 0.3, root[1], root[2]]);
            add(bW, { w: span * 0.5, h: 0.05, l: chord * 0.85, c: 0.02, col: secondary, bucket: ghostLimb }, [root[0] + side * span * 0.72, root[1] - 0.01, root[2] - chord * 0.08]);
            add(bW, { w: span * 0.25, h: 0.04, l: chord * 0.6, c: 0.01, tt: 1, col: AM.shade(secondary, -0.1) }, [root[0] + side * span * 0.95, root[1] - 0.015, root[2] - chord * 0.2]);
          }
          wings.push({ bone: bW, side, style: Wg.style });
        }
      }
    }

    // ---------- extras ----------
    const onHead = head.shape !== 'none' && headPos;
    const topBone = onHead ? hb : bBody;
    const topY = onHead ? (head.shape === 'lid' ? top + head.h : headPos[1] + head.h / 2) : top - (body.shape === 'orb' || body.shape === 'blob' || body.shape === 'drop' ? body.h * 0.05 : 0);
    const topZ = onHead ? (head.shape === 'lid' ? 0 : headPos[2]) : 0;
    const topW = onHead ? head.w : body.w * (shapeOpts.tt || 1);
    const topL = onHead ? head.l : body.l * (shapeOpts.tt || 1);
    let flamePos = null;
    for (const ex of g.extras) {
      const k = ex.kind;
      if (k === 'ears_pointy' || k === 'ears_bat' || k === 'ears_small') {
        const eh = k === 'ears_bat' ? topW * 0.75 : k === 'ears_small' ? topW * 0.22 : topW * 0.45;
        for (const s of [-1, 1]) {
          add(topBone, { w: topW * 0.26, h: eh, l: topW * 0.12, tt: 0.12, c: 0.01, col: primary }, [s * topW * 0.3, topY + eh / 2 - 0.02, topZ - topL * 0.1], [0, 0, s * -0.2]);
          add(topBone, { w: topW * 0.13, h: eh * 0.6, l: 0.02, tt: 0.2, col: AM.mixColor(secondary, '#f0a0a8', 0.4) }, [s * topW * 0.3, topY + eh * 0.32, topZ - topL * 0.1 + topW * 0.065], [0, 0, s * -0.2]);
        }
      } else if (k === 'ears_big') {
        for (const s of [-1, 1]) add(topBone, { w: 0.05, h: topW * 0.8, l: topW * 0.7, c: 0.015, col: AM.shade(primary, -0.05) }, [s * (topW / 2 + 0.06), topY - topW * 0.35, topZ - topL * 0.1], [0, s * 0.5, s * 0.15]);
      } else if (k === 'horns') {
        for (const s of [-1, 1]) {
          add(topBone, { w: topW * 0.13, h: topW * 0.4, l: topW * 0.13, c: 0.01, tt: 0.6, col: hornCol }, [s * topW * 0.26, topY + topW * 0.12, topZ - topL * 0.15], [-0.6, 0, s * -0.3]);
          add(topBone, { w: topW * 0.09, h: topW * 0.35, l: topW * 0.09, tt: 0.15, col: hornCol }, [s * topW * 0.32, topY + topW * 0.32, topZ - topL * 0.38], [-1.3, 0, s * -0.3]);
        }
      } else if (k === 'horn_nose') {
        const fz = onHead ? faceZ + (head.snout ? head.snout.l * 0.6 : 0) : body.l / 2;
        const fy = onHead ? headPos[1] + head.h * 0.1 : by + body.h * 0.25;
        add(topBone, { w: topW * 0.22, h: topW * 0.6, l: topW * 0.22, tt: 0.08, c: 0.01, col: hornCol }, [0, fy + topW * 0.22, fz - 0.08], [0.45, 0, 0]);
      } else if (k === 'trunk') {
        const fz = onHead ? faceZ : body.l / 2, fy = onHead ? headPos[1] - head.h * 0.1 : by;
        const tw = Math.min(topW * 0.32, 0.22);
        add(topBone, { w: tw, h: tw, l: tw * 1.6, c: tw * 0.2, col: headCol }, [0, fy, fz + tw * 0.6]);
        add(topBone, { w: tw * 0.85, h: tw * 2.2, l: tw * 0.85, c: tw * 0.2, col: headCol }, [0, fy - tw * 1.1, fz + tw * 1.35], [0.25, 0, 0]);
        add(topBone, { w: tw * 0.7, h: tw * 1.4, l: tw * 0.7, c: tw * 0.2, col: headCol }, [0, fy - tw * 2.6, fz + tw * 1.9], [0.7, 0, 0]);
        for (const s of [-1, 1]) add(topBone, { w: tw * 0.35, h: tw * 0.35, l: tw * 1.8, tf: 0.3, col: BONE }, [s * tw * 0.95, fy - tw * 0.6, fz + tw * 0.7], [0.5, 0, 0]);
      } else if (k === 'crest' || k === 'casque') {
        if (k === 'crest') for (let f = 0; f < 3; f++) add(topBone, { w: 0.04, h: topW * 0.35, l: 0.08, tt: 0.3, col: secondary }, [(f - 1) * 0.05, topY + topW * 0.1, topZ - topL * 0.35], [-0.9 - f * 0.1, 0, (f - 1) * 0.3]);
        else add(topBone, { w: topW * 0.3, h: topW * 0.45, l: topL * 0.6, tt: 0.3, sh: -0.5, col: accent }, [0, topY + topW * 0.15, topZ - topL * 0.15]);
      } else if (k === 'flower') {
        for (let f = 0; f < 5; f++) { const a = f / 5 * PI * 2; add(topBone, { w: 0.12, h: 0.04, l: 0.12, c: 0.02, col: accent }, [Math.cos(a) * 0.08, topY + 0.05, topZ + Math.sin(a) * 0.08]); }
        add(topBone, { w: 0.08, h: 0.06, l: 0.08, c: 0.02, col: '#ffd84a' }, [0, topY + 0.07, topZ]);
      } else if (k === 'cap') {
        const cw = Math.max(topW, topL) * (onHead ? 1.45 : 2.1), ch = cw * 0.38;
        add(topBone, { w: cw, h: ch, l: cw, c: ch * 0.45, tt: 0.55, col: secondary }, [0, topY + ch / 2 - 0.04, topZ]);
        add(topBone, { w: cw * 0.94, h: 0.04, l: cw * 0.94, col: AM.mixColor(primary, '#efe4cf', 0.5) }, [0, topY - 0.03, topZ]);
        for (let s = 0; s < 6; s++) { const a = s / 6 * PI * 2 + 0.3, rr = cw * (s % 2 ? 0.22 : 0.32); add(topBone, { w: cw * 0.13, h: 0.03, l: cw * 0.13, col: accent }, [Math.cos(a) * rr, topY + ch * (s % 2 ? 0.95 : 0.72) - 0.02, topZ + Math.sin(a) * rr]); }
      } else if (k === 'lid') {
        add(topBone, { w: topW * 0.6, h: 0.07, l: topL * 0.6, c: 0.02, col: secondary }, [0, topY + 0.03, topZ]);
        add(topBone, { w: 0.09, h: 0.08, l: 0.09, c: 0.02, col: accent }, [0, topY + 0.1, topZ]);
      } else if (k === 'ring_handle') {
        const rw = topW * 0.5, rt = 0.05;
        add(topBone, { w: rt, h: rw * 0.5, l: rt, col: '#3b3f46' }, [-rw / 2, topY + rw * 0.25, topZ]);
        add(topBone, { w: rt, h: rw * 0.5, l: rt, col: '#3b3f46' }, [rw / 2, topY + rw * 0.25, topZ]);
        add(topBone, { w: rw + rt, h: rt, l: rt, col: '#3b3f46' }, [0, topY + rw * 0.5, topZ]);
      } else if (k === 'brow') {
        add(topBone, { w: faceW * 0.7, h: 0.06, l: 0.12, c: 0.02, col: darker }, [0, faceY + es * 1.3 + 0.03, faceZ - 0.02], [0.3, 0, 0]);
      } else if (k === 'crystal_crown') {
        for (let f = 0; f < 3; f++) add(topBone, { w: 0.07, h: 0.16 + f % 2 * 0.06, l: 0.07, tt: 0.2, col: accent, bucket: 1 }, [(f - 1) * topW * 0.25, topY + 0.07, topZ], [0, 0, (f - 1) * 0.3]);
      } else if (k === 'shell') {
        const sw = body.w * 1.08, sl = body.l * 1.02, shh = Math.max(0.18, body.h * 0.62);
        const scol = AM.lightness(accent) < 0.75 ? accent : AM.shade(primary, -0.2);
        add(bBody, { w: sw, h: shh, l: sl, c: shh * 0.4, tt: 0.7, col: scol }, [0, top + shh * 0.3, -body.l * 0.02]);
        add(bBody, { w: sw * 0.55, h: 0.04, l: sl * 0.45, c: 0.02, col: AM.shade(scol, 0.1) }, [0, top + shh * 0.8 - 0.01, 0]);
        add(bBody, { w: sw * 1.03, h: shh * 0.18, l: sl * 1.03, c: 0.02, col: AM.shade(scol, -0.08) }, [0, top - shh * 0.1, -body.l * 0.02]);
      } else if (k === 'spikes') {
        const n = 4;
        for (let s = 0; s < n; s++) {
          const f = (s + 0.5) / n - 0.5;
          const sz = Math.max(0.1, minD * 0.32) * (1 - Math.abs(f) * 0.6);
          if (isBiped || !long) add(bBody, { w: sz * 0.6, h: sz, l: sz * 0.6, tt: 0.1, col: accent }, [0, by + f * body.h * 0.8, -body.l / 2 - sz * 0.3], [-PI / 2, 0, 0]);
          else add(bBody, { w: sz * 0.5, h: sz, l: sz * 0.7, tt: 0.1, col: accent }, [0, top + sz * 0.4, f * body.l * 0.8]);
        }
      } else if (k === 'fin_dorsal') {
        const fh = Math.max(0.28, minD * 0.75);
        add(bBody, { w: 0.06, h: fh, l: fh * 0.8, tt: 0.15, sh: -0.6, col: primary }, [0, top + fh / 2 - 0.04, -body.l * 0.05]);
      } else if (k === 'fins_side') {
        for (const s of [-1, 1]) add(bBody, { w: Math.max(0.25, body.w * 0.5), h: 0.04, l: Math.max(0.2, body.l * 0.18), tt: 1, c: 0.01, col: AM.shade(primary, -0.06) }, [s * (body.w / 2 + body.w * 0.18), by - body.h * 0.2, body.l * 0.15], [0, s * 0.4, s * -0.4]);
      } else if (k === 'crystals') {
        const ccol = AM.lightness(accent) > 0.45 ? accent : '#6fe3ff';
        for (let s = 0; s < 4; s++) {
          const ch = minD * (0.35 + (s % 2) * 0.2);
          const px = (isBiped || !long) ? (s - 1.5) * body.w * 0.2 : (s % 2 ? 0.12 : -0.12) * body.w;
          const pz = (isBiped || !long) ? -body.l / 2 - 0.02 : (s / 3 - 0.5) * body.l * 0.6;
          const py = (isBiped || !long) ? by + body.h * 0.2 + (s % 2) * 0.08 : top;
          add(bBody, { w: ch * 0.4, h: ch, l: ch * 0.4, tt: 0.15, col: ccol, bucket: 1 }, [px, py + ((isBiped || !long) ? 0 : ch * 0.35), pz], (isBiped || !long) ? [-1.2, 0, (s - 1.5) * 0.3] : [0, 0, (s % 2 ? 0.3 : -0.3)]);
        }
      } else if (k === 'toaster_slots') {
        const sw = Math.min(body.w * 0.3, 0.26), sl2 = body.l * 0.62;
        for (const s of [-1, 1]) {
          add(bBody, { w: sw, h: 0.03, l: sl2, col: DARK }, [s * body.w * 0.2, top + 0.005, 0]);
          add(bBody, { w: sw * 0.75, h: 0.16, l: sl2 * 0.8, c: 0.04, col: TOAST }, [s * body.w * 0.2, top + 0.05, 0]);
        }
      } else if (k === 'lever') {
        add(bBody, { w: 0.05, h: 0.18, l: 0.05, col: DARK }, [body.w / 2 + 0.03, by + body.h * 0.1, body.l * 0.1]);
        add(bBody, { w: 0.12, h: 0.06, l: 0.08, c: 0.02, col: accent }, [body.w / 2 + 0.07, by + body.h * 0.2, body.l * 0.1]);
      } else if (k === 'spout') {
        const sl3 = Math.max(0.3, body.h * 0.6);
        add(bBody, { w: 0.12, h: sl3, l: 0.12, c: 0.03, tt: 0.65, col: primary, bucket: ghostBody }, [body.w / 2 + sl3 * 0.18, by + sl3 * 0.05, body.l * 0.05], [0, 0, -0.75]);
      } else if (k === 'tongue') {
        const fz = onHead ? faceZ : body.l / 2;
        add(faceBone === bBody ? bBody : hb, { w: 0.14, h: 0.04, l: 0.28, c: 0.02, col: AM.lightness(accent) < 0.6 ? accent : '#c0304a' }, [0, (head.shape === 'lid' ? top : faceY - 0.12), fz + 0.1], [0.4, 0, 0]);
      } else if (k === 'flame') {
        flamePos = body.shape === 'cage' ? [0, by - body.h * 0.1, 0] : [0, top + 0.12, -body.l * 0.15];
      } else if (k === 'wisps') {
        for (let s = 0; s < 3; s++) { const a = s * 2.1; add(bBody, { w: 0.1, h: 0.1, l: 0.1, c: 0.03, col: AM.shade(primary, 0.05), bucket: 2 }, [Math.cos(a) * body.w * 0.75, by + Math.sin(a * 1.7) * body.h * 0.3, Math.sin(a) * body.l * 0.75]); }
      } else if (k === 'core') {
        add(bBody, { w: minD * 0.3, h: minD * 0.3, l: minD * 0.3, c: minD * 0.08, col: AM.lightness(accent) > 0.5 ? accent : '#b8ff8a', bucket: 1 }, [0, top + 0.01, 0]);
      }
    }
    if (flamePos) {
      const bF = B('flame', 'body', flamePos);
      add(bF, { w: 0.2, h: 0.32, l: 0.2, c: 0.04, tt: 0.15, col: '#ff9b2f', bucket: 1 }, [flamePos[0], flamePos[1] + 0.12, flamePos[2]]);
      add(bF, { w: 0.11, h: 0.2, l: 0.11, c: 0.02, tt: 0.2, col: '#fff2a8', bucket: 1 }, [flamePos[0], flamePos[1] + 0.09, flamePos[2]]);
    }

    // ---------- equipment look (player) ----------
    if (look && look.helmet) {
      const mc = RARITY_METAL[look.helmet] || '#9aa3ad';
      add(topBone, { w: topW * 1.08, h: Math.max(0.1, topW * 0.35), l: topL * 0.9, c: 0.04, tt: 0.8, col: mc }, [0, topY + 0.02, topZ - topL * 0.05]);
      add(topBone, { w: 0.06, h: topW * 0.3, l: topL * 0.5, tt: 0.4, col: AM.shade(mc, 0.15) }, [0, topY + topW * 0.25, topZ - topL * 0.1]);
    }
    if (look && look.armor) {
      const mc = RARITY_METAL[look.armor] || '#9aa3ad';
      if (isBiped || !long) add(bBody, { w: body.w * 0.9, h: body.h * 0.5, l: 0.08, c: 0.03, col: mc }, [0, by + body.h * 0.08, body.l / 2 + 0.03]);
      else add(bBody, { w: body.w * 1.06, h: body.h * 0.22, l: body.l * 0.6, c: 0.04, col: mc }, [0, top + 0.02, body.l * 0.05]);
      for (const s of [-1, 1]) add(bBody, { w: 0.06, h: body.h * 0.4, l: body.l * 0.35, c: 0.02, col: AM.shade(mc, -0.08) }, [s * (body.w / 2 + 0.025), by + body.h * 0.05, body.l * 0.1]);
    }

    const geometry = gb.build();
    // a generous bounding sphere, since bones move the parts
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, g.height / 2, 0), Math.max(body.l, body.h + legLen, (g.wings ? g.wings.span : 0) / 2 + 0.2, 1) * 0.9 + 0.5);
    return { geometry, bones, boneIndex, legs, arms, tail, wings, by, tris: gb.triCount };
  }

  const cache = new Map();
  function modelFor(g, look) {
    const key = g.key + (look ? `|${look.helmet || ''}|${look.armor || ''}` : '');
    let m = cache.get(key);
    if (!m) { m = buildModel(g, look); cache.set(key, m); }
    return m;
  }

  // A live creature: SkinnedMesh with its own skeleton (geometry shared through the cache).
  function createCreature(g, opts) {
    opts = opts || {};
    const model = modelFor(g, opts.look);
    const mats = R.materials();
    const bones = model.bones.map((d) => { const b = new THREE.Bone(); b.name = d.name; return b; });
    model.bones.forEach((d, i) => {
      const pp = d.parent >= 0 ? model.bones[d.parent].pos : [0, 0, 0];
      bones[i].position.set(d.pos[0] - pp[0], d.pos[1] - pp[1], d.pos[2] - pp[2]);
      if (d.parent >= 0) bones[d.parent].add(bones[i]);
    });
    const mesh = new THREE.SkinnedMesh(model.geometry, opts.material || mats.set);
    mesh.add(bones[0]);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.boundingSphere = model.geometry.boundingSphere;
    mesh.castShadow = opts.shadow !== false;
    mesh.receiveShadow = false;
    const holder = new THREE.Group();
    holder.add(mesh);
    const bi = model.boneIndex;
    const rig = {
      g, holder, mesh, bones, model,
      body: bones[bi.body], head: bi.head != null ? bones[bi.head] : null, jaw: bi.jaw != null ? bones[bi.jaw] : null,
      flame: bi.flame != null ? bones[bi.flame] : null,
      legs: model.legs.map((l) => ({ b: bones[l.bone], knee: l.knee != null ? bones[l.knee] : null, side: l.side, k: l.k, idx: l.idx, style: l.style, tent: l.tent.map((t) => bones[t]) })),
      arms: model.arms.map((a) => ({ b: bones[a.bone], side: a.side, style: a.style, front: a.front })),
      tail: model.tail.map((t) => ({ b: bones[t.bone], i: t.i, style: t.style })),
      wings: model.wings.map((w) => ({ b: bones[w.bone], side: w.side, style: w.style })),
      phase: Math.random() * 10, t: Math.random() * 10, by: model.by, squash: 0, flashT: 0, flashMat: null, baseMat: mesh.material,
    };
    return rig;
  }

  // st: { move (0..1), attack (-1 or 0..1 progress), attackKind, dead (0..1), airborne }
  function animateCreature(rig, st, dt) {
    rig.t += dt;
    const t = rig.t, g = rig.g, mv = st.move || 0;
    rig.phase += dt * (3 + mv * 9) * (g.posture === 'hop' ? 0.6 : 1);
    const ph = rig.phase;
    const atk = st.attack != null && st.attack >= 0 ? Math.sin(Math.min(1, st.attack) * PI) : 0;
    const body = rig.body;
    let bob = 0, pitch = 0;
    if (g.posture === 'hover') { bob = Math.sin(t * 2.4) * 0.07; pitch = -mv * 0.12; }
    else if (g.posture === 'hop') { bob = mv > 0.05 ? Math.abs(Math.sin(ph)) * 0.35 * Math.min(1, mv * 1.5) : 0; pitch = mv > 0.05 ? -Math.cos(ph) * 0.15 : 0; }
    else bob = Math.abs(Math.sin(ph)) * 0.035 * mv + Math.sin(t * 2) * 0.008;
    body.position.y = rig.by + bob + (st.lift || 0);
    body.position.z = atk * (st.attackKind === 'slam' ? 0.05 : 0.22);
    body.rotation.x = pitch + (st.attackKind === 'slam' ? -atk * 0.35 : atk * 0.1);
    body.rotation.z = g.posture === 'hover' ? Math.sin(t * 1.7) * 0.04 : 0;
    // squash on hit
    if (rig.squash > 0) { rig.squash = Math.max(0, rig.squash - dt * 5); }
    const sq = rig.squash;
    body.scale.set(1 + sq * 0.18, 1 - sq * 0.2 + (g.posture !== 'hover' ? Math.sin(t * 2.2) * 0.012 : 0), 1 + sq * 0.18);
    if (rig.head) {
      rig.head.rotation.x = Math.sin(ph * 2) * 0.05 * mv + (st.attackKind === 'bite' || st.attackKind === 'peck' ? atk * 0.35 : 0) + (st.attackKind === 'ram' ? atk * 0.4 : 0);
      rig.head.rotation.y = mv < 0.1 ? Math.sin(t * 0.6) * 0.25 : 0;
      if (g.head.shape === 'lid') rig.head.rotation.x = -(0.08 + Math.max(0, Math.sin(t * 1.3)) * 0.1 + atk * 0.7);
    }
    if (rig.jaw) rig.jaw.rotation.x = atk * 0.6 + (mv < 0.1 ? Math.max(0, Math.sin(t * 0.9)) * 0.05 : 0);
    // legs
    const n = rig.legs.length;
    for (const L of rig.legs) {
      let sw = 0;
      if (L.style === 'tentacle') {
        const s1 = Math.sin(t * 2.6 + L.idx * 0.9) * 0.18 + Math.sin(ph + L.idx) * 0.3 * mv;
        L.b.rotation.x = s1; L.b.rotation.z = Math.cos(t * 2.1 + L.idx) * 0.12;
        for (let k = 0; k < L.tent.length; k++) if (k > 0) { L.tent[k].rotation.x = s1 * 0.6; L.tent[k].rotation.z = Math.sin(t * 3 + L.idx + k) * 0.15; }
        continue;
      }
      if (g.posture === 'hover') { L.b.rotation.x = 0.35 + Math.sin(t * 2 + L.idx) * 0.1; continue; }
      if (g.posture === 'hop') {
        const back = L.k > 0 || n <= 2;
        L.b.rotation.x = mv > 0.05 ? (back ? -Math.max(0, Math.sin(ph)) * 0.8 : Math.sin(ph) * 0.3) : 0;
        continue;
      }
      if (n === 2) sw = Math.sin(ph + (L.side > 0 ? PI : 0));
      else if (n === 4) sw = Math.sin(ph + ((L.k + (L.side > 0 ? 1 : 0)) % 2 ? PI : 0));
      else sw = Math.sin(ph + ((L.k + (L.side > 0 ? 1 : 0)) % 2 ? PI : 0) + L.k * 0.3);
      if (L.knee) { L.b.rotation.y = sw * 0.35 * mv; L.knee.rotation.z = -L.side * Math.max(0, -sw) * 0.3 * mv; L.b.rotation.z = L.side * Math.max(0, sw) * 0.15 * mv; }
      else L.b.rotation.x = sw * 0.62 * mv;
    }
    // arms
    for (const A of rig.arms) {
      if (A.style === 'pincer') { A.b.rotation.y = -A.side * (0.15 + atk * 0.4) + Math.sin(t * 1.5 + A.side) * 0.05; continue; }
      if (A.style === 'branch') { A.b.rotation.z = Math.sin(t * 1.2 + A.side) * 0.05; continue; }
      const sw = g.posture === 'biped' ? Math.sin(ph + (A.side > 0 ? 0 : PI)) * 0.5 * mv : Math.sin(t * 1.8 + A.side) * 0.1;
      A.b.rotation.x = sw - atk * 1.4 * (st.attackKind === 'slam' ? 1 : 0.6);
    }
    // tail
    for (const T of rig.tail) {
      if (T.style === 'handle') continue;
      if (T.style === 'jet') { if (rig.flame) { const f = 0.85 + Math.random() * 0.3 + mv * 0.4; rig.flame.scale.set(1, 1, f); } continue; }
      const amp = T.style === 'fin' ? 0.4 : T.style === 'stinger' ? 0.12 : 0.22;
      T.b.rotation.y = Math.sin(t * (T.style === 'fin' ? 5 : 3) - T.i * 0.7) * amp * (1 + mv * 0.8);
      if (T.style === 'stinger') T.b.rotation.x = -atk * 0.5;
    }
    if (rig.flame && rig.tail.every((T) => T.style !== 'jet')) { const f = 0.9 + Math.sin(t * 13) * 0.08 + Math.random() * 0.08; rig.flame.scale.set(f, f * 1.1, f); }
    // wings
    for (const W of rig.wings) {
      if (W.style === 'jet') continue;
      const flying = g.posture === 'hover';
      const flap = flying ? Math.sin(t * 11) * 0.65 : mv > 0.6 ? Math.sin(t * 8) * 0.35 : Math.sin(t * 1.5) * 0.06 + 0.15;
      W.b.rotation.z = W.side * flap;
      W.b.rotation.y = flying ? 0 : W.side * 0.25;
    }
    // death: tip over and sink
    if (st.dead > 0) {
      rig.holder.rotation.z = Math.min(1, st.dead * 2) * PI / 2 * 0.95;
      const s = Math.max(0.01, 1 - Math.max(0, st.dead - 0.5) * 2);
      rig.mesh.scale.setScalar(s);
    }
    // hit flash
    if (rig.flashT > 0) {
      rig.flashT -= dt;
      if (rig.flashT <= 0) rig.mesh.material = rig.baseMat;
    }
  }
  function flash(rig, red) {
    const m = R.materials();
    rig.mesh.material = red ? m.flashRedSet : m.flashSet;
    rig.flashT = 0.07;
    rig.squash = 1;
  }
  function disposeCreature(rig) {
    if (rig.mesh.skeleton) rig.mesh.skeleton.dispose();
    if (rig.holder.parent) rig.holder.parent.remove(rig.holder);
  }

  Object.assign(R, { buildCreatureModel: buildModel, creatureModel: modelFor, createCreature, animateCreature, flashCreature: flash, disposeCreature, RARITY_METAL });
})(typeof window !== 'undefined' ? window : globalThis);
