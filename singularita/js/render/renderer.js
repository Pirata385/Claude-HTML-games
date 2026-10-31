// WebGL renderer, scene, camera and lights, plus quality settings and dynamic resolution.
import * as THREE from 'three';

export class Renderer {
  constructor(container) {
    this.container = container;
    this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.gl.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
    this.scene.fog = new THREE.Fog(0xbfe0ff, 40, 160);

    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6a5a3a, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.playerLight = new THREE.PointLight(0xffd8a0, 0, 16, 1.6);
    this.scene.add(this.playerLight);
    // Lights that follow the nearest bosses at night. Always in the scene (dark by day), so turning
    // them on never recompiles the materials.
    this.bossLights = [0, 1].map(() => { const l = new THREE.PointLight(0xffffff, 0, 18, 1.4); this.scene.add(l); return l; });

    this.scale = 1;
    this.dynScale = 1;
    this.frameTimes = [];
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  applyQuality(g) {
    this.quality = g;
    this.scale = g.renderScale;
    this.gl.shadowMap.enabled = g.shadows;
    this.sun.castShadow = g.shadows;
    const size = g.renderScale >= 1.2 ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    const ext = g.renderScale >= 1.2 ? 46 : 36;
    Object.assign(this.sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.camera.fov = g.fov;
    this.camera.far = g.viewDistance + 60;
    this.camera.updateProjectionMatrix();
    this.resize();
    // Materials must recompile when shadows are toggled.
    this.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.gl.setPixelRatio(Math.max(0.4, dpr * this.scale * this.dynScale));
    this.gl.setSize(w, h, false);
    this.gl.domElement.style.width = w + 'px';
    this.gl.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Lowers the resolution when frames run long and restores it when there is headroom.
  updateDynamicResolution(dt) {
    if (!this.quality?.dynamicRes) { if (this.dynScale !== 1) { this.dynScale = 1; this.resize(); } return; }
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 45) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    const target = this.quality.renderScale <= 0.7 ? 1 / 30 : 1 / 55;
    let next = this.dynScale;
    if (avg > target * 1.15) next = Math.max(0.55, this.dynScale - 0.1);
    else if (avg < target * 0.8) next = Math.min(1, this.dynScale + 0.05);
    if (next !== this.dynScale) { this.dynScale = next; this.resize(); }
  }

  render() { this.gl.render(this.scene, this.camera); }

  stats() {
    const i = this.gl.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures };
  }
}
