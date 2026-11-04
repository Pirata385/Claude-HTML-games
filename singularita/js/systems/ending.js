// The ending: what you asked Singularita to remember, and the records of the journey. Pure.

export const ENDINGS = {
  mend: {
    label: 'Mend it', lore: 'lore_mend', title: 'Mender of Vael',
    ask: 'Remember Vael whole: every isle, every shore, as one land.',
    epilogue: [
      'You ask it to remember Vael whole. It is quiet for a long time, the way a sea is quiet before the tide turns. Then it begins, very slowly, the way coral grows.',
      'The isles do not crash together. They lean. Their shores warm, their currents run toward each other, and at night their lights line up across the sea like a road.',
      'On Dawnreach, Lume watches the horizon from the beacon and, for the first time in nine hundred and twelve years, counts ships.',
    ],
  },
  end: {
    label: 'End it', lore: 'lore_end', title: 'Who Let It Rest',
    ask: 'Stop remembering. Let the world be the shape it is now.',
    epilogue: [
      'You ask it to stop remembering. It does, all at once, the way a held breath ends.',
      'The dimensions go quiet. Their doors still open, but nothing behind them is angry any more: the Gaol stops growing, the twins stop arguing, the king finally sleeps.',
      'The isles stay where they are. They were always going to. On Dawnreach the beacon burns on anyway, because Lume likes the light.',
    ],
  },
};

// Records the choice. Throws on an unknown one.
export function chooseEnding(p, choice) {
  const e = ENDINGS[choice];
  if (!e) throw new Error(`No ending "${choice}".`);
  p.ending = choice;
  p.endings = { ...(p.endings || {}), [choice]: ((p.endings || {})[choice] || 0) + 1 };
  if (!p.lore.includes(e.lore)) p.lore.push(e.lore);
  (p.flags ||= {}).finished = true;
  return { lore: e.lore, title: e.title };
}

export function recordsOf(p) {
  const dims = p.dims || {};
  const fastest = Object.fromEntries(Object.entries(dims).filter(([, r]) => r.bestTime != null).map(([id, r]) => [id, r.bestTime]));
  return {
    bestFloor: dims.dim_dungeon?.bestFloor || 0,
    fastest,
    endings: { ...(p.endings || {}) },
    cycle: p.cycle || 0,
    bosses: Object.values(p.stats?.bosses || {}).reduce((a, n) => a + n, 0),
    deaths: p.stats?.deaths || 0,
    playTime: p.playTime || 0,
  };
}
