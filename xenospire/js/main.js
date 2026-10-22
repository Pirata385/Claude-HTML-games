// Temporary preview (replaced by the full game boot in a later step).
(function (XS) {
  'use strict';
  const params = new URLSearchParams(location.search);
  const seed = XS.codeToSeed(params.get('seed') || 'xenospire');
  let floor = Number(params.get('floor') || 1);
  const canvas = document.getElementById('view');
  const screen = new XS.Screen(canvas);
  let arena, terrain, bg;
  const beings = [];
  function build() {
    arena = XS.Arena.generate(seed, floor, { fighters: 2 });
    terrain = new XS.Terrain(arena.world);
    bg = new XS.Background(arena.theme, XS.hash(seed, floor));
    bg.resize(screen.W, screen.H);
    bg.buildTower(arena);
    beings.length = 0;
    const count = Number(params.get('n') || 6);
    for (let i = 0; i < count; i++) {
      const g = XS.Creature.generate(XS.hash(seed, i, floor), params.get('arch') ? { archetype: params.get('arch') } : {});
      beings.push({ g, rig: new XS.Rig(g), a: (i / count) * Math.PI * 2, r: 7 + (i % 2) * 3 });
    }
  }
  function resize() { screen.resize(innerWidth, innerHeight, Number(params.get('short') || 215)); if (bg) { bg.sky = null; bg.resize(screen.W, screen.H); } }
  resize();
  build();
  addEventListener('resize', resize);
  const cam = () => ({ x: XS.isoX(arena.center.x, arena.center.y), y: XS.isoY(arena.center.x, arena.center.y, 3) });
  let last = 0;
  const walk = params.get('walk') !== '0';
  if (params.get('gallery')) {
    const cells = [];
    const N = Number(params.get('n') || 12);
    for (let i = 0; i < N; i++) {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      const g = XS.Creature.generate(XS.hash(seed, i), params.get('arch') ? { archetype: params.get('arch') } : {});
      cells.push({ p: new XS.Portrait(cv, g, { bg: '#1a1530' }), g });
    }
    const loop = () => {
      const ctx = screen.ctx;
      ctx.fillStyle = '#0b0918'; ctx.fillRect(0, 0, screen.W, screen.H);
      const cols = Math.floor(screen.W / 66);
      cells.forEach((c, i) => {
        c.p.update(1 / 60);
        const x = (i % cols) * 66 + 1, y = Math.floor(i / cols) * 74 + 1;
        ctx.drawImage(c.p.canvas, x, y);
        XS.gfx.text(ctx, c.g.archetype.slice(0, 8), x + 1, y + 66, '#ffffff');
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return;
  }
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    const ctx = screen.ctx, c = cam();
    const ox = Math.round(screen.W / 2 - c.x), oy = Math.round(screen.H / 2 - c.y);
    arena.world.update(dt);
    bg.draw(ctx, c.x, c.y, t / 1000);
    bg.drawTower(ctx, ox, oy);
    terrain.update();
    const buckets = new Map();
    for (const b of beings) {
      const sp = walk ? 0.35 : 0;
      b.a += dt * sp;
      const x = arena.center.x + Math.cos(b.a) * b.r, y = arena.center.y + Math.sin(b.a) * b.r;
      const vx = walk ? -Math.sin(b.a) * b.r * sp : 0, vy = walk ? Math.cos(b.a) * b.r * sp : 0;
      const z = Math.max(3, arena.world.groundAt(x, y, 8, 0));
      b.state = { x, y, z, facing: walk ? Math.atan2(vy, vx) : 0.78, vx, vy, aimAngle: walk ? Math.atan2(vy, vx) : 0.78 };
      b.rig.update(dt, b.state);
      const d = Math.min(terrain.bands.length - 1, Math.floor(x + b.g.stats.radius) + Math.floor(y + b.g.stats.radius));
      if (!buckets.has(d)) buckets.set(d, []);
      buckets.get(d).push(b);
    }
    for (let d = 0; d < terrain.bands.length; d++) {
      terrain.drawBand(ctx, d, ox, oy);
      for (const b of buckets.get(d) || []) {
        XS.drawShadow(ctx, b.state.x, b.state.y, b.state.z, b.g.stats.radius, ox, oy);
        XS.drawRig(ctx, b.rig, ox, oy);
      }
    }
    XS.gfx.text(ctx, arena.theme.name, 4, 4, '#ffffff', 'left', '#000000');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})(globalThis.XS);
