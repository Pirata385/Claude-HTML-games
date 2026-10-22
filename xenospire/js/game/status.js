// Status effects carried by fighters (burn, poison, chill/freeze, stun, mark,
// time slow, shields and self buffs from auras).
(function (XS) {
  'use strict';

  function fresh() {
    return {
      burn: null, poison: null, chill: 0, chillT: 0, freeze: 0, stun: 0, mark: 0, timeslow: 0,
      haste: 0, armor: 0, lifesteal: 0, regen: 0, regenHps: 0, shield: 0, shieldT: 0,
      immuneFreeze: 0, immuneStun: 0, dotAcc: 0, dotSrc: null, dotTick: 0,
    };
  }

  // power: the damage of the hit that applied the status.
  function apply(battle, target, type, power, src) {
    const s = target.st;
    switch (type) {
      case 'burn': {
        const dps = (power * 0.5) / 3;
        s.burn = { t: 3, dps: Math.min((s.burn ? s.burn.dps : 0) + dps, dps * 3), src };
        break;
      }
      case 'poison': {
        const dps = (power * 0.6) / 4;
        s.poison = { t: 4, dps: Math.min((s.poison ? s.poison.dps : 0) + dps, dps * 5), src };
        break;
      }
      case 'chill':
        if (s.freeze > 0) break;
        s.chill = Math.min(4, s.chill + 1);
        s.chillT = 2.5;
        if (s.chill >= 4 && s.immuneFreeze <= 0) {
          s.freeze = 1.1; s.chill = 0; s.immuneFreeze = 3.5;
          battle.events.emit('status', { f: target, type: 'freeze' });
        }
        break;
      case 'shock':
        if (s.immuneStun <= 0) { s.stun = 0.35; s.immuneStun = 1.6; battle.events.emit('status', { f: target, type: 'stun' }); }
        break;
      case 'mark': s.mark = 4; break;
      case 'timeslow': s.timeslow = 2; break;
      case 'drain':
        if (src && src.alive) battle.heal(src, power * 0.35);
        break;
      case 'shard':
        if (src && src.alive) {
          src.st.shield = Math.min(src.maxHp * 0.3, src.st.shield + power * 0.3);
          src.st.shieldT = 4;
        }
        break;
      // 'pull' and 'stagger' act at the moment of impact (see game/powers.js).
    }
  }

  function update(battle, f, dt) {
    const s = f.st;
    let dps = 0;
    if (s.burn) { dps += s.burn.dps; s.dotSrc = s.burn.src; if ((s.burn.t -= dt) <= 0) s.burn = null; }
    if (s.poison) { dps += s.poison.dps; s.dotSrc = s.poison.src; if ((s.poison.t -= dt) <= 0) s.poison = null; }
    if (dps > 0) {
      s.dotAcc += dps * dt;
      s.dotTick -= dt;
      if (s.dotTick <= 0 && s.dotAcc >= 1) {
        const amt = Math.floor(s.dotAcc);
        s.dotAcc -= amt;
        s.dotTick = 0.5;
        battle.damage(f, amt, { src: s.dotSrc, dot: true, element: s.burn ? 'plasma' : 'bio' });
      }
    } else { s.dotAcc = 0; }
    if (s.regen > 0) { battle.heal(f, s.regenHps * dt, true); s.regen -= dt; }
    if (s.chillT > 0 && (s.chillT -= dt) <= 0) s.chill = 0;
    for (const k of ['freeze', 'stun', 'mark', 'timeslow', 'haste', 'armor', 'lifesteal', 'immuneFreeze', 'immuneStun']) {
      if (s[k] > 0) s[k] = Math.max(0, s[k] - dt);
    }
    if (s.shieldT > 0 && (s.shieldT -= dt) <= 0) s.shield = 0;
  }

  const speedMult = (f) => {
    const s = f.st;
    if (s.freeze > 0 || s.stun > 0) return 0;
    return (1 - 0.13 * s.chill) * (s.timeslow > 0 ? 0.65 : 1) * (s.haste > 0 ? 1.3 : 1);
  };
  const cooldownRate = (f) => (f.st.timeslow > 0 ? 0.7 : 1) * (f.st.haste > 0 ? 1.3 : 1);
  const canAct = (f) => f.st.freeze <= 0 && f.st.stun <= 0;
  const damageTakenMult = (f) => (f.st.mark > 0 ? 1.25 : 1) * (f.st.armor > 0 ? 0.7 : 1);

  // Short labels shown over fighters (and used by the HUD).
  function labels(f) {
    const s = f.st, out = [];
    if (s.freeze > 0) out.push('freeze');
    else if (s.chill > 0) out.push('chill');
    if (s.stun > 0) out.push('stun');
    if (s.burn) out.push('burn');
    if (s.poison) out.push('poison');
    if (s.mark > 0) out.push('mark');
    if (s.timeslow > 0) out.push('timeslow');
    if (s.shield > 0) out.push('shield');
    if (s.haste > 0) out.push('haste');
    return out;
  }

  XS.Status = { fresh, apply, update, speedMult, cooldownRate, canAct, damageTakenMult, labels };
})(globalThis.XS = globalThis.XS || {});
