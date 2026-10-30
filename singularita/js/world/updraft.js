// Updraft vents on the Galeforge Spires: a scripted arc carries you from one pad to its partner.
export const FLIGHT_TIME = 1.8;

export function updraftArc(u, t) {
  const a = u.to;
  const peak = Math.max(u.h, a.h) + 6 + Math.hypot(a.x - u.x, a.z - u.z) * 0.08;
  // A quadratic through the start, the peak at the middle, and the landing.
  const y0 = u.h, y1 = a.h, ym = peak;
  const y = (1 - t) * (1 - 2 * t) * y0 + 4 * t * (1 - t) * ym + t * (2 * t - 1) * y1;
  return { x: u.x + (a.x - u.x) * t, y: Math.max(Math.min(u.h, a.h), y), z: u.z + (a.z - u.z) * t };
}
