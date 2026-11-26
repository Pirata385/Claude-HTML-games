// Água-Tinta — fishing strings (owner C): fish.* (in-canvas HUD labels, escape reasons, misses, tips, events, map).
// English only (owner decision; overrides the bilingual plan in DESIGN.md).
(function (AQ) {
  'use strict';

  AQ.i18n.add('en', {
    fish: {
      hud: {
        tension: 'TENSION',
        stamina: 'STAMINA',
        rod: 'ROD',
        keepMiddle: 'keep it in the middle',
        power: 'POWER',
        depth: '{n}m',
        lineEnd: 'end of line'
      },
      escape: {
        snap: 'The line snapped — too much tension. Let go of the reel when the meter reaches !!!.',
        slack: 'It shook free — the line went slack. Keep some tension, even while it shakes.',
        thrown: 'It threw the hook mid-jump — let go of the reel when it jumps.',
        tear: 'The hook tore out — a soft body. Reel gently and keep the tension low.',
        fray: 'The line frayed on its den — steer away from cover and reel hard.',
        spooled: 'Out of line — it is too short for this fight. A better line reaches farther.',
        loose: 'It got bored and swam off — reel in now and then.',
        slip: 'It slipped off — the hook is too small for a fish this size.'
      },
      miss: {
        early: 'Too early — it only nibbled. Wait for the bite (!).',
        late: 'Too late — strike as soon as the ! shows.'
      },
      tip: {
        run: 'It is about to run! Pull the rod the other way.',
        dive: 'Diving! Ease off, then reel when it rises.',
        jump: 'It is going to jump! Let go of the reel while it is airborne.',
        shake: 'It is shaking — keep the line tight, in pulses.',
        burrow: 'It wants to hide! Rod away from cover and reel hard.',
        grip: 'It is gripping the floor — wait it out, then reel steadily.',
        ink: 'Ink! Follow the line angle and the meter.',
        inflate: 'It puffed up! Reel very slowly.',
        soft: 'Soft body — always keep the tension low.'
      },
      hookSmall: 'Hook too small — it may slip off.',
      lineShort: 'End of the line: {m} m. The bottom is out of reach.',
      dark: 'Too dark down here — a lantern helps you see the fish.',
      bottle: {
        found: 'A bottle! There is a note inside.',
        coins: 'An empty bottle — with coins inside: {coins}'
      },
      frenzy: {
        start: 'Feeding frenzy! The fish bite at anything.',
        end: 'The frenzy is over.'
      },
      legendary: {
        near: 'Something huge passes far below…',
        back: 'The shadow is circling your bait again.'
      },
      tinteira: {
        tentacles: 'Tentacles grip the line!',
        rises: 'She is rising…'
      },
      map: {
        aquarium: 'AQUA-',
        aquarium2: 'RIUM',
        shop: 'SHOP',
        pier: 'pier',
        forecast: 'Forecast: {list}',
        locked: '?????',
        species: '{n}/{total}',
        requires: '[{item}]',
        boat: 'Boat {n}',
        hint: 'Tap a water to fish',
        hintKeys: '← → choose · Enter to fish',
        new: 'new!'
      }
    }
  });
})(window.AQ);
