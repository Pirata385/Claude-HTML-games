// Terrain mesher: block columns in 32×32 chunks. Top faces merge along rows, side faces
// only where a neighbour is lower. A small shader adds per-block colour noise and block edges.
import * as THREE from 'three';
import { F, SURF, isWalled } from '../world/grid.js';

export const CHUNK = 32;

const ISLAND_TOP = {
  [SURF.SAND]: '#e6d29a', [SURF.GRASS]: '#66bb5c', [SURF.FOREST]: '#3f914c', [SURF.ROCK]: '#8e9199', [SURF.PATH]: '#c9a874',
  [SURF.DIRT]: '#8d6040', [SURF.BASE]: '#bba98a', [SURF.SNOW]: '#eef3f6', [SURF.ARENA]: '#8fd06c', [SURF.SEABED]: '#b8a774',
};
const DIRT = '#8a5a3a';

// The elemental isles reuse the island surfaces with their own palette, plus their own ground.
function isleColors(pal) {
  return {
    [SURF.SAND]: pal.ash || pal.sand || ISLAND_TOP[SURF.SAND], [SURF.GRASS]: pal.grass || ISLAND_TOP[SURF.GRASS], [SURF.FOREST]: pal.grass || ISLAND_TOP[SURF.FOREST],
    [SURF.ROCK]: pal.rock || ISLAND_TOP[SURF.ROCK], [SURF.PATH]: pal.ash ? '#6a5048' : ISLAND_TOP[SURF.PATH], [SURF.DIRT]: pal.ground || ISLAND_TOP[SURF.DIRT],
    [SURF.ARENA]: '#d8d0c0', [SURF.SEABED]: pal.ash ? '#2a1e1c' : ISLAND_TOP[SURF.SEABED],
    [SURF.LAVA]: '#ff6a1a', [SURF.BASALT]: '#3a3236', [SURF.ROOT]: '#7a5434', [SURF.CORAL]: '#ff8aa8', [SURF.BRIDGE]: '#9a6a3a',
  };
}

function isleSide(s, top, pal) {
  switch (s) {
    case SURF.GRASS: case SURF.FOREST: return { body: pal.mesa || DIRT, strip: top };
    case SURF.BRIDGE: return { body: '#7a5232', strip: null };
    case SURF.ROOT: return { body: '#5a3a22', strip: top };
    case SURF.LAVA: return { body: '#5a1a10', strip: null };
    case SURF.PATH: return { body: pal.mesa || pal.ground || DIRT, strip: null };
    default: return { body: top, strip: null };
  }
}

function islandSide(s) {
  switch (s) {
    case SURF.GRASS: case SURF.FOREST: case SURF.ARENA: return { body: DIRT, strip: ISLAND_TOP[s] };
    case SURF.SNOW: return { body: '#8e9199', strip: '#eef3f6' };
    case SURF.PATH: return { body: DIRT, strip: null };
    case SURF.BASE: return { body: '#958670', strip: null };
    default: return { body: ISLAND_TOP[s], strip: null };
  }
}

export function makeTerrainMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVoxWorld;\nvarying vec3 vVoxNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVoxWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvVoxNormal = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVoxWorld;\nvarying vec3 vVoxNormal;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 bp = floor(vVoxWorld - vVoxNormal * 0.02 + 0.0001);
        float hsh = fract(sin(dot(bp, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        diffuseColor.rgb *= 0.93 + hsh * 0.13;
        vec3 fw = fract(vVoxWorld);
        vec3 an = abs(vVoxNormal);
        vec2 uv = an.y > 0.5 ? fw.xz : (an.x > 0.5 ? fw.zy : fw.xy);
        vec2 e = min(uv, 1.0 - uv);
        diffuseColor.rgb *= mix(0.84, 1.0, smoothstep(0.0, 0.045, min(e.x, e.y)));`);
  };
  return m;
}

const _c = new THREE.Color();

class QuadBuilder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; }
  quad(a, b, c, d, n, color, k = 1) {
    _c.set(color).multiplyScalar(k);
    const base = this.pos.length / 3;
    for (const p of [a, b, c, d]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.col.push(_c.r, _c.g, _c.b); }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build() {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// Builds every chunk of a zone. Returns { group, chunks: [{ mesh, cx, cz }] }.
export function buildTerrain(zone, material) {
  const g = zone.grid, cave = isWalled(zone), isle = !cave && zone.type !== 'island';
  const pal = zone.def.palette;
  const isleTop = isle ? isleColors(pal) : null;
  // Split layers: the first half uses the HOT surface, the second the COLD one (dawn and dusk in the Core).
  const sideFloors = pal.sides || ['#5a3428', '#33465e'], sideWalls = pal.sideWalls || ['#5a3a34', '#3a4a60'];
  const floorCol = (s) => (s === SURF.HOT ? sideFloors[0] : s === SURF.COLD ? sideFloors[1] : pal.floor);
  const topColor = (i, j) => {
    const k = g.idx(i, j), s = g.surf[k];
    if (cave) return g.flags[k] & F.WALL ? _hex(pal.wall, 0.55) : floorCol(s);
    if (isle) return isleTop[s] || '#ff00ff';
    return ISLAND_TOP[s] || '#ff00ff';
  };
  const sideStyle = (i, j) => {
    const k = g.idx(i, j), s = g.surf[k];
    if (cave) return { body: g.flags[k] & F.WALL ? (s === SURF.WALL && zone.split ? (i < g.w / 2 ? sideWalls[0] : sideWalls[1]) : pal.wall) : floorCol(s), strip: null };
    if (isle) return isleSide(s, isleTop[s], pal);
    return islandSide(s);
  };
  const top = (i, j) => (g.inside(i, j) ? g.top(i, j) : cave ? 999 : g.seaLevel - 7);

  const group = new THREE.Group();
  const chunks = [];
  for (let cz = 0; cz < g.d; cz += CHUNK) for (let cx = 0; cx < g.w; cx += CHUNK) {
    const qb = new QuadBuilder();
    const i1 = Math.min(g.w, cx + CHUNK), j1 = Math.min(g.d, cz + CHUNK);
    // Top faces, merged along x.
    for (let j = cz; j < j1; j++) {
      let i = cx;
      while (i < i1) {
        // The void below the spires has no ground to draw.
        if (g.flags[g.idx(i, j)] & F.VOID) { i++; continue; }
        const t = top(i, j), col = topColor(i, j);
        let run = 1;
        while (i + run < i1 && !(g.flags[g.idx(i + run, j)] & F.VOID) && top(i + run, j) === t && topColor(i + run, j) === col) run++;
        qb.quad([i, t, j + 1], [i + run, t, j + 1], [i + run, t, j], [i, t, j], [0, 1, 0], col);
        i += run;
      }
    }
    // Side faces toward lower neighbours, merged along the face direction.
    const sides = [
      { di: 0, dj: 1, n: [0, 0, 1], along: 'i' }, { di: 0, dj: -1, n: [0, 0, -1], along: 'i' },
      { di: 1, dj: 0, n: [1, 0, 0], along: 'j' }, { di: -1, dj: 0, n: [-1, 0, 0], along: 'j' },
    ];
    for (const sd of sides) {
      const outer = sd.along === 'i' ? [cz, j1] : [cx, i1];
      const inner = sd.along === 'i' ? [cx, i1] : [cz, j1];
      for (let o = outer[0]; o < outer[1]; o++) {
        let p = inner[0];
        while (p < inner[1]) {
          const i = sd.along === 'i' ? p : o, j = sd.along === 'i' ? o : p;
          const t = top(i, j), nt = top(i + sd.di, j + sd.dj);
          if (nt >= t) { p++; continue; }
          const st = sideStyle(i, j);
          let run = 1;
          for (;;) {
            const q = p + run;
            if (q >= inner[1]) break;
            const ii = sd.along === 'i' ? q : o, jj = sd.along === 'i' ? o : q;
            const s2 = sideStyle(ii, jj);
            if (top(ii, jj) !== t || top(ii + sd.di, jj + sd.dj) !== nt || s2.body !== st.body || s2.strip !== st.strip) break;
            run++;
          }
          emitSide(qb, sd, i, j, run, nt, t, st);
          p += run;
        }
      }
    }
    const geo = qb.build();
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.castShadow = cave;
    mesh.userData.center = new THREE.Vector3(cx + CHUNK / 2, 0, cz + CHUNK / 2);
    group.add(mesh);
    chunks.push({ mesh, cx, cz });
  }
  return { group, chunks };
}

function emitSide(qb, sd, i, j, run, y0, y1, st) {
  const k = sd.n[0] || sd.n[2] < 0 ? 0.92 : 1;
  const face = (a, b, col) => {
    let x0, x1, z0, z1;
    if (sd.along === 'i') { x0 = i; x1 = i + run; z0 = z1 = sd.dj > 0 ? j + 1 : j; }
    else { z0 = j; z1 = j + run; x0 = x1 = sd.di > 0 ? i + 1 : i; }
    // Winding so the face points along its normal.
    if (sd.along === 'i') {
      if (sd.dj > 0) qb.quad([x0, a, z0], [x1, a, z0], [x1, b, z0], [x0, b, z0], sd.n, col, k);
      else qb.quad([x1, a, z0], [x0, a, z0], [x0, b, z0], [x1, b, z0], sd.n, col, k);
    } else if (sd.di > 0) qb.quad([x0, a, z1], [x0, a, z0], [x0, b, z0], [x0, b, z1], sd.n, col, k);
    else qb.quad([x0, a, z0], [x0, a, z1], [x0, b, z1], [x0, b, z0], sd.n, col, k);
  };
  if (st.strip && y1 - y0 > 0.3) { face(y0, y1 - 0.22, st.body); face(y1 - 0.22, y1, st.strip); }
  else face(y0, y1, st.body);
}

function _hex(color, k) { return '#' + _c.set(color).multiplyScalar(k).getHexString(); }

// Show only chunks within view distance of the camera.
export function cullChunks(chunks, x, z, dist) {
  const d2 = (dist + CHUNK) * (dist + CHUNK);
  for (const c of chunks) {
    const dx = c.cx + CHUNK / 2 - x, dz = c.cz + CHUNK / 2 - z;
    c.mesh.visible = dx * dx + dz * dz < d2;
  }
}
