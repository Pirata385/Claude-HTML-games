import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occludes } from '../js/render/occlusion.js';

// Camera 6 m behind the player, who faces +z from (0, 0).
const cam = { x: 0, z: -6 }, pl = { x: 0, z: 0 };
const hides = (nx, nz) => occludes(cam.x, cam.z, pl.x, pl.z, nx, nz);

test('a tree in front of the player stays visible', () => {
  assert.equal(hides(0, 1.6), false);
  assert.equal(hides(0.5, 2.2), false);
  assert.equal(hides(0, 6), false);
});

test('a tree right beside the player stays visible', () => {
  assert.equal(hides(1.5, 0), false);
  assert.equal(hides(-1.2, -0.8), false);
});

test('a tree between the camera and the player is hidden', () => {
  assert.equal(hides(0, -3.5), true);
  assert.equal(hides(1.2, -4), true);
});

test('a tree just behind the player, on the line of sight, is hidden (the camera would sit in its canopy)', () => {
  assert.equal(hides(0, -1.3), true);
  assert.equal(hides(0.6, -1.6), true);
});

test('a tree around the camera is hidden, one far behind it is not', () => {
  assert.equal(hides(0.5, -6.3), true);
  assert.equal(hides(-1, -7), true);
  assert.equal(hides(0, -10), false);
});

test('a tree off to the side of the view stays visible', () => {
  assert.equal(hides(3, -3), false);
});
