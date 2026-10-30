// Skill definitions. Behaviour lives in js/combat/kits/<class>.js, keyed by id;
// numbers here are the tuning knobs (dmg = multiplier of weapon power × class scaling).

const S = (cls, id, o) => ({ id, cls, kind: 'skill', cost: 0, cd: 0, status: [], ...o });

const LIST = [
  // Swordsman ------------------------------------------------------------
  S('swordsman', 'sw_combo', { kind: 'basic', name: 'Blade Combo', icon: '⚔', unlock: 1, dmg: [1.0, 1.1, 1.6], range: 2.6, arc: 120,
    desc: 'Three-hit combo. The finisher knocks foes back.' }),
  S('swordsman', 'sw_guard', { kind: 'alt', name: 'Guard', icon: '⛨', unlock: 1, block: 0.6, parryWindow: 0.25, cost: 12, status: ['stun'],
    desc: 'Hold to block 60% of frontal damage (costs Stamina per blow). Raise it just before a hit to parry: no damage, the attacker is stunned and takes the blow back.' }),
  S('swordsman', 'sw_lunge', { name: 'Lunge', icon: '➹', unlock: 1, cost: 20, cd: 5, dmg: 1.4, range: 7,
    desc: 'Dash forward, striking every foe in your path.' }),
  S('swordsman', 'sw_whirl', { name: 'Whirlwind', icon: '✺', unlock: 4, cost: 30, cd: 9, dmg: 0.6, radius: 3.2, duration: 1.2,
    desc: 'Spin for a moment, hitting everything around you several times.' }),
  S('swordsman', 'sw_sunder', { name: 'Sunder', icon: '⚒', unlock: 10, cost: 25, cd: 8, dmg: 2.6, range: 2.8, arc: 70, status: ['sunder'],
    desc: 'A heavy overhead blow that cracks armour: the target takes far more damage for 6 s.' }),
  S('swordsman', 'sw_warcry', { name: 'War Cry', icon: '☈', unlock: 18, cost: 0, cd: 20, radius: 10, duration: 6, status: ['taunt', 'guarded'],
    desc: 'Taunt nearby foes and steel yourself: 30% less damage taken and faster Stamina for 6 s.' }),
  S('swordsman', 'sw_earth', { name: 'Earthsplitter', icon: '⚡', unlock: 28, cost: 35, cd: 12, dmg: 2.2, range: 11, width: 2.2, status: ['stun'],
    desc: 'Drive your blade into the ground: a shockwave races forward, staggering all in its line.' }),
  S('swordsman', 'sw_dance', { name: 'Blade Dance', icon: '❖', unlock: 40, cost: 50, cd: 24, dmg: 1.3, hits: 6, range: 9,
    desc: 'Flash between up to six nearby foes, striking each. You cannot be hit while dancing.' }),

  // Archer ---------------------------------------------------------------
  S('archer', 'ar_shot', { kind: 'basic', name: 'Charged Shot', icon: '➶', unlock: 1, dmg: [0.8, 2.3], chargeTime: 0.9, speed: 40,
    desc: 'Tap to loose, hold to charge. A full charge pierces through foes. Arrows deal less at point blank.' }),
  S('archer', 'ar_aim', { kind: 'alt', name: 'Steady Aim', icon: '◎', unlock: 1,
    desc: 'Hold to aim: the camera tightens, spread shrinks and you move slower.' }),
  S('archer', 'ar_volley', { name: 'Volley', icon: '⋔', unlock: 1, cost: 25, cd: 6, dmg: 0.7, count: 5, spread: 40,
    desc: 'Fire five arrows in a fan.' }),
  S('archer', 'ar_roll', { name: 'Roll Shot', icon: '↺', unlock: 4, cost: 15, cd: 7, dmg: 1.3, range: 5,
    desc: 'Roll away from danger and loose a quick arrow at your target.' }),
  S('archer', 'ar_pin', { name: 'Pinning Arrow', icon: '⇥', unlock: 10, cost: 20, cd: 10, dmg: 1.3, duration: 2.5, status: ['root'],
    desc: 'An arrow that pins its target in place for 2.5 s.' }),
  S('archer', 'ar_blast', { name: 'Blast Arrow', icon: '✹', unlock: 18, cost: 30, cd: 9, dmg: 2.0, radius: 3.5,
    desc: 'An explosive arrow that bursts on impact and throws foes back.' }),
  S('archer', 'ar_rain', { name: 'Arrow Rain', icon: '☔', unlock: 28, cost: 40, cd: 14, dmg: 0.35, radius: 5, duration: 2.5, range: 18, status: ['slow'],
    desc: 'Arrows fall over an area ahead of you for 2.5 s, wounding and slowing.' }),
  S('archer', 'ar_hawk', { name: 'Hawk Eye', icon: '◉', unlock: 40, cost: 30, cd: 25, duration: 8, status: ['hawkeye'],
    desc: 'For 8 s: +25% critical chance, +50% critical damage, and every arrow pierces.' }),

  // Mage -----------------------------------------------------------------
  S('mage', 'mg_bolt', { kind: 'basic', name: 'Arcane Bolt', icon: '✦', unlock: 1, cost: 4, dmg: 1.0, speed: 24,
    desc: 'A homing bolt of raw arcana.' }),
  S('mage', 'mg_channel', { kind: 'alt', name: 'Channel', icon: '❂', unlock: 1,
    desc: 'Hold while standing still to draw Mana three times faster.' }),
  S('mage', 'mg_flame', { name: 'Flame Burst', icon: '♨', unlock: 1, cost: 20, cd: 6, dmg: 1.6, radius: 3.5, range: 15, cast: 0.35, status: ['burn'],
    desc: 'Fire erupts at the target spot, setting foes ablaze.' }),
  S('mage', 'mg_nova', { name: 'Frost Nova', icon: '❄', unlock: 4, cost: 25, cd: 9, dmg: 1.0, radius: 5, status: ['chill', 'freeze'],
    desc: 'A ring of frost around you. Chilled foes are slowed; chilling them twice freezes them solid.' }),
  S('mage', 'mg_chain', { name: 'Chain Lightning', icon: 'ϟ', unlock: 10, cost: 25, cd: 7, dmg: 1.35, bounces: 5, range: 7, status: ['shock'],
    desc: 'Lightning leaps between up to five foes and shocks them. Shocking a chilled foe shatters it for bonus damage.' }),
  S('mage', 'mg_blink', { name: 'Blink', icon: '⇝', unlock: 18, cost: 15, cd: 6, range: 8,
    desc: 'Teleport a short distance in the direction you are moving.' }),
  S('mage', 'mg_barrier', { name: 'Arcane Barrier', icon: '◈', unlock: 28, cost: 35, cd: 18, duration: 8, status: ['shield'],
    desc: 'A barrier that absorbs damage for 8 s. It grows with Intelligence.' }),
  S('mage', 'mg_meteor', { name: 'Meteor', icon: '☄', unlock: 40, cost: 60, cd: 22, dmg: 4.5, radius: 5, range: 18, delay: 1.4, status: ['burn'],
    desc: 'Call down a meteor on the target spot after a short delay. Devastating and burning.' }),

  // Assassin -------------------------------------------------------------
  S('assassin', 'as_stab', { kind: 'basic', name: 'Twin Stab', icon: '⚚', unlock: 1, dmg: [0.6, 0.6, 0.9], range: 2.0, arc: 90, backstab: 2.0,
    desc: 'Rapid dagger strikes. Strikes from behind deal double damage.' }),
  S('assassin', 'as_mark', { kind: 'alt', name: 'Mark', icon: '⌖', unlock: 1, cost: 10, cd: 3, duration: 8, status: ['marked'],
    desc: 'Mark the target: it takes 30% more damage from you for 8 s.' }),
  S('assassin', 'as_shadowstep', { name: 'Shadowstep', icon: '⟲', unlock: 1, cost: 20, cd: 6, range: 11,
    desc: 'Step through the shadows to appear behind your target. Your next strike is a backstab.' }),
  S('assassin', 'as_smoke', { name: 'Smoke Veil', icon: '☁', unlock: 4, cost: 25, cd: 14, duration: 3, status: ['invisible', 'empower'],
    desc: 'Vanish for 3 s: foes lose track of you, and your next hit is a guaranteed critical.' }),
  S('assassin', 'as_fan', { name: 'Fan of Knives', icon: '✳', unlock: 10, cost: 25, cd: 8, dmg: 0.6, count: 12, status: ['bleed'],
    desc: 'Twelve knives in every direction, leaving foes bleeding.' }),
  S('assassin', 'as_venom', { name: 'Venom Edge', icon: '☠', unlock: 18, cost: 20, cd: 16, duration: 8, status: ['venom', 'poison'],
    desc: 'For 8 s, every strike adds a stack of poison (up to five).' }),
  S('assassin', 'as_exec', { name: 'Execution', icon: '⚰', unlock: 28, cost: 30, cd: 10, dmg: 3.0, range: 2.4, execute: 0.3,
    desc: 'A killing blow: 2.5× damage to foes under 30% health. A kill refunds half the cooldown.' }),
  S('assassin', 'as_dashcut', { name: 'Dash Cut', icon: '⤳', unlock: 40, cost: 25, cd: 9, dmg: 1.8, range: 9, status: ['bleed'],
    desc: 'Dash through foes, cutting everything in your path. You cannot be hit during the dash.' }),

  // Stardust -------------------------------------------------------------
  S('stardust', 'sd_mote', { kind: 'basic', name: 'Star Mote', icon: '✧', unlock: 1, dmg: 0.45, speed: 26, astralDmg: [0.55, 0.55, 0.85],
    desc: 'Without your Astral: a weak mote of starlight. With it manifested: your Astral strikes your target in rapid combos.' }),
  S('stardust', 'sd_manifest', { kind: 'alt', name: 'Manifest', icon: '✪', unlock: 1,
    desc: 'Call or dismiss your Astral. It drains Spirit while manifested; Spirit refills while it rests.' }),
  S('stardust', 'sd_comet', { name: 'Comet Dive', icon: '☄', unlock: 1, cost: 15, cd: 6, dmg: 1.6, range: 10,
    desc: 'Your Astral dives in a straight line, battering and throwing back all it passes.' }),
  S('stardust', 'sd_orbit', { name: 'Orbit Guard', icon: '◌', unlock: 4, cost: 25, cd: 14, dmg: 0.4, duration: 6,
    desc: 'Your Astral circles you for 6 s, intercepting projectiles and grazing foes.' }),
  S('stardust', 'sd_gravity', { name: 'Gravity Well', icon: '◍', unlock: 10, cost: 30, cd: 14, dmg: 0.3, radius: 6, range: 15, duration: 2.5, status: ['slow'],
    desc: 'Collapse a star at the target spot: foes are dragged toward its heart for 2.5 s.' }),
  S('stardust', 'sd_sentinel', { name: 'Sentinel', icon: '⛯', unlock: 18, cost: 20, cd: 18, range: 16, duration: 10,
    desc: 'Post your Astral at a spot beyond its leash for 10 s. It guards that ground on its own, tougher than usual.' }),
  S('stardust', 'sd_starfall', { name: 'Starfall', icon: '✶', unlock: 28, cost: 40, cd: 16, dmg: 1.2, count: 8, radius: 6, range: 18,
    desc: 'Eight stars fall over the target area.' }),
  S('stardust', 'sd_link', { name: 'Constellation Link', icon: '⁂', unlock: 40, cost: 35, cd: 20, range: 10, duration: 8, status: ['linked'],
    desc: 'Bind up to three foes into a constellation for 8 s: half of the damage one takes is dealt to the others.' }),
];

export const SKILLS = Object.fromEntries(LIST.map((s) => [s.id, s]));
export const skillsOf = (cls) => LIST.filter((s) => s.cls === cls);
export const defaultHotbar = (cls) => skillsOf(cls).filter((s) => s.kind === 'skill').slice(0, 4).map((s) => s.id);
