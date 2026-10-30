// A creature instance. Stats come from data scaled by level; behaviour lives in ai/behaviors.js.
import { Entity } from './entity.js';
import { enemyHp, enemyDmg } from '../systems/scaling.js';
import { ELITE, ELITE_AFFIXES } from '../data/enemies.js';
import { makePose } from '../render/rigs.js';

const HEIGHT = { slime: 0.9, zombie: 1.9, bat: 0.6, crab: 0.9, beetle: 0.7, crawler: 0.8, puff: 1.0, slug: 0.8, wraith: 1.8, golem: 2.2, lurker: 2.4, sentry: 2.4,
  harpy: 1.3, serpent: 0.7, wisp: 0.8, jelly: 1.2, hound: 1.1, imp: 1.4, tortoise: 1.4, lasher: 3.0 };

export class Enemy extends Entity {
  constructor(def, level, o = {}) {
    super({ team: 'enemy' });
    this.def = def;
    this.level = level;
    this.elite = !!o.elite;
    this.affixes = {};
    let hpMul = 1, dmgMul = 1;
    if (this.elite) {
      hpMul = ELITE.hp; dmgMul = ELITE.dmg;
      for (const id of o.affixes || []) this.affixes[id] = ELITE_AFFIXES[id];
    }
    this.maxHp = this.hp = Math.round(enemyHp(def.hp, level) * hpMul);
    this.dmg = enemyDmg(def.dmg, level) * dmgMul;
    this.defense = (2 + level * 1.4) * (this.affixes.armoured ? 1.5 : 1);
    this.speed = def.speed * (this.affixes.swift ? ELITE_AFFIXES.swift.speed : 1);
    this.scale = def.scale * (this.elite ? ELITE.scale : 1);
    this.radius = def.radius * (this.elite ? 1.15 : 1);
    this.height = HEIGHT[def.model] || 1.5;
    this.flying = def.flags.includes('flying');
    this.horde = !!o.horde; this.ambient = !!o.ambient; this.summoned = !!o.summoned;
    this.kbRes = def.role === 'tank' ? 0.6 : 0;
    this.ai = { state: 'idle', t: 0, cd: 0.5 + Math.random(), phase: Math.random() * 6, hop: 0, aux: 0 };
    this.anim = { t: Math.random() * 10, move: 0, phase: 0, atk: 0, wind: 0, squash: 0 };
    this.hitT = 99;
    this.dormantT = 0;
    this.tier = 'active';
    this.accum = 0;
    this.spawnT = 0.6;
    this.dyingT = 0;
    this.alpha = 1;
    this.yOff = 0;
    this.slot = -1;
    this.pose = null;
    this.bloodColor = def.color;
    this.tag = this.elite ? `${Object.values(this.affixes).map((a) => a.name).join(' ')} ${def.name}` : def.name;
    this.tints = { a: def.color, b: def.cloth || def.color, c: def.cloth ? shadeHex(def.cloth, 0.7) : def.color };
    if (this.elite) this.tints.a = def.color;
  }
  initPose(n) { this.pose = makePose(n); }
}

function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
