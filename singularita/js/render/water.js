// Animated sea: a Lambert surface displaced by a few travelling waves.
import * as THREE from 'three';

export function makeWater(size, level, center) {
  const geo = new THREE.PlaneGeometry(size, size, 96, 96);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color: 0x2a8fd6, transparent: true, opacity: 0.8, depthWrite: false });
  const uniforms = { uTime: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vWave;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float w = sin(wp.x * 0.25 + uTime * 1.1) * 0.12 + sin(wp.z * 0.31 - uTime * 0.9) * 0.1 + sin((wp.x + wp.z) * 0.6 + uTime * 2.0) * 0.04;
        transformed.y += w; vWave = w;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWave;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.95, 1.0), smoothstep(0.12, 0.24, vWave) * 0.55);');
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(center.x, level, center.z);
  mesh.renderOrder = 2;
  // Far ocean floor, so the horizon never shows the void.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1d4f7a }));
  floor.position.set(center.x, level - 7.5, center.z);
  const group = new THREE.Group();
  group.add(mesh, floor);
  return { group, uniforms, dispose() { geo.dispose(); mat.dispose(); floor.geometry.dispose(); floor.material.dispose(); } };
}
