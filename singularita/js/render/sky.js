// Sky dome with a gradient and sun glow, stars at night, and the day/night light palette.
import * as THREE from 'three';
import { clamp, smoothstep } from '../core/math.js';

export class Sky {
  constructor(scene) {
    this.uniforms = {
      top: { value: new THREE.Color('#5aa8ff') }, horizon: { value: new THREE.Color('#cfe8ff') },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color('#fff1d6') },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; varying vec3 vDir;
        void main(){ float h = clamp(vDir.y, -0.2, 1.0); vec3 c = mix(horizon, top, pow(max(h, 0.0), 0.55));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          c += sunColor * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.25);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    const starPos = [];
    for (let i = 0; i < 700; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      if (u < 0.05) continue;
      starPos.push(Math.cos(a) * r * 280, u * 280, Math.sin(a) * r * 280);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);
  }
  setVisible(v) { this.dome.visible = v; this.stars.visible = v; }
  follow(cam) { this.dome.position.copy(cam.position); this.stars.position.copy(cam.position); }
  dispose() { this.dome.geometry.dispose(); this.dome.material.dispose(); this.stars.geometry.dispose(); this.stars.material.dispose(); }
}

// Keyframed palette by sun height (−1 midnight … +1 noon).
const KEYS = [
  { s: -1.0, top: '#060914', hor: '#141c38', sun: '#8fa6ff', sunI: 0.45, hemiS: '#3a4a7a', hemiG: '#141420', hemiI: 0.55 },
  { s: -0.15, top: '#0c1430', hor: '#2a2d55', sun: '#9ab0ff', sunI: 0.5, hemiS: '#45508a', hemiG: '#1a1a2a', hemiI: 0.6 },
  { s: 0.05, top: '#4a5aa8', hor: '#ff9f7a', sun: '#ff9a5a', sunI: 1.2, hemiS: '#ffc0a0', hemiG: '#4a3a3a', hemiI: 0.8 },
  { s: 0.25, top: '#4f98f0', hor: '#ffd9b0', sun: '#ffd9a8', sunI: 1.9, hemiS: '#cfe0ff', hemiG: '#6a5a3a', hemiI: 1.0 },
  { s: 1.0, top: '#3d8fff', hor: '#cfe8ff', sun: '#fff4e0', sunI: 2.3, hemiS: '#cde6ff', hemiG: '#7a6a48', hemiI: 1.15 },
];
const ca = new THREE.Color(), cb = new THREE.Color();
const lerpCol = (out, a, b, t) => out.copy(ca.set(a)).lerp(cb.set(b), t);

export function applyDayPalette(r, sky, sunHeight, progress, phase) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let k = 0; k < KEYS.length - 1; k++) if (sunHeight >= KEYS[k].s && sunHeight <= KEYS[k + 1].s) { a = KEYS[k]; b = KEYS[k + 1]; break; }
  const t = clamp((sunHeight - a.s) / (b.s - a.s || 1), 0, 1);
  lerpCol(sky.uniforms.top.value, a.top, b.top, t);
  lerpCol(sky.uniforms.horizon.value, a.hor, b.hor, t);
  lerpCol(r.sun.color, a.sun, b.sun, t);
  r.sun.intensity = a.sunI + (b.sunI - a.sunI) * t;
  lerpCol(r.hemi.color, a.hemiS, b.hemiS, t);
  lerpCol(r.hemi.groundColor, a.hemiG, b.hemiG, t);
  r.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * t;
  r.scene.fog.color.copy(sky.uniforms.horizon.value);
  // Sun by day, moon by night: both arc from east to west.
  const ang = progress * Math.PI;
  const dir = sky.uniforms.sunDir.value.set(Math.cos(ang), Math.max(0.15, Math.sin(ang)) , 0.35).normalize();
  sky.uniforms.sunColor.value.copy(r.sun.color).multiplyScalar(phase === 'day' ? 1 : 0.35);
  sky.stars.material.opacity = smoothstep(0.05, -0.3, sunHeight);
  return dir;
}

// Static cave lighting: dim hemisphere tinted by the layer, no sun.
export function applyCavePalette(r, pal) {
  r.hemi.color.set(pal.light); r.hemi.groundColor.set(pal.fog);
  r.hemi.intensity = pal.ambient * 2.8;
  r.sun.color.set(pal.light); r.sun.intensity = pal.ambient * 1.4;
  r.scene.fog.color.set(pal.fog);
}
