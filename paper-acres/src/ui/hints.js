/* First-time hints and festival contests. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const HINTS = [
    ['start', () => true, () => (PA.Touch.isTouch() ? 'Stick: walk; flick it up to step into the page (toward the horizon), down to step back out. Buttons: jump, use (drag to aim), act, draw. [=] opens your notebook.' : 'A/D walk, Space jump. W steps into the page (toward the horizon), S steps back out. E acts, J or click uses the selected item, Q draws, Tab opens your notebook.')],
    ['bed', (g) => g.map.id === 'house', 'Step back (S) near the middle of the room to go outside. Your bed (W or E beside it) ends the day.'],
    ['field', (g) => g.map.kind === 'overworld' && g.player.z >= 2 && g.player.z <= 5 && g.player.x / C.CELL_W > 38 && g.player.x / C.CELL_W < 134, 'Each slice of the field is one crop row. Clear weeds (scythe), till (hoe), plant seeds, then water every day.'],
    ['creek', (g) => g.map.kind === 'overworld' && g.player.z >= 7 && g.player.x / C.CELL_W < 165, 'The creek is too deep to climb out of. Draw a raft or a plank to float on it, or mend the Spring Page in town.'],
    ['town', (g) => g.map.kind === 'overworld' && g.player.x / C.CELL_W > 186 && g.player.x / C.CELL_W < 334, 'Marginton! Walk up to a door and press W to go in. The board by the fountain has requests.'],
    ['mine', (g) => g.map.kind === 'mine', 'Swing your sword with J / click (aim with the mouse). Pickaxe the rocks for ore. E at the ladder goes deeper.'],
  ];
  PA.Hints = {
    t: 0,
    step(game, dt) {
      const s = game.state;
      if (!s || !PA.settings.hints || PA.Input.blocked) return;
      this.t -= dt; if (this.t > 0) return;
      s.flags.hints = s.flags.hints || {};
      for (const [id, when, text] of HINTS) {
        if (s.flags.hints[id] || !when(game)) continue;
        s.flags.hints[id] = true; PA.UI.toast(typeof text === 'function' ? text() : text, 7000); this.t = 7500; return;
      }
    },
  };
  /** Festival contests run by the mayor during the festival hours. */
  PA.Contest = {
    offer(game, actor) {
      const s = game.state, f = PA.Festivals.today(s);
      if (!f || actor.n.id !== 'quill' || s.time < f.from - 30 || s.time > f.to) return false;
      if (s.flags['fest' + s.year + s.season]) { PA.UI.toast('Thank you for joining the ' + f.name + '!'); return true; }
      if (f.kind === 'draw') {
        PA.UI.confirm(f.name + ': draw anything you like in your sketchpad; the town judges it. Ready?', ['Draw', 'Later']).then((i) => {
          if (i) return;
          PA.Sketch.open(game);
          PA.Sketch.contest = (strokes) => {
            const mine = PA.Festivals.judge(strokes), rivals = [44, 51, 58].map((v) => v + Math.floor(Math.random() * 14));
            const place = 1 + rivals.filter((r) => r > mine).length;
            const prize = [0, 1000, 500, 250, 50][place];
            s.gold += prize; s.flags['fest' + s.year + s.season] = true;
            for (const n of PA.NPC_DATA) PA.Dialogue.rel(s, n.id).pts += place === 1 ? 60 : 25;
            PA.UI.confirm('The judges give your drawing ' + mine + ' points. You place #' + place + '! Prize: ' + prize + 'g.', ['Hooray']);
          };
        });
      } else if (f.kind === 'weigh') {
        const best = game.inv.slots.filter((q) => q && PA.Items.get(q.id).cat === 'crop').sort((a, b) => PA.Items.get(b.id).price - PA.Items.get(a.id).price)[0];
        if (!best) { PA.UI.toast('Bring a crop to weigh!'); return true; }
        const score = PA.Items.get(best.id).price, place = score >= 250 ? 1 : score >= 120 ? 2 : score >= 60 ? 3 : 4, prize = [0, 1200, 600, 300, 80][place];
        game.inv.remove(best.id, 1); s.gold += prize; s.flags['fest' + s.year + s.season] = true;
        PA.UI.confirm('Your ' + PA.Items.get(best.id).name + ' takes place #' + place + '! Prize: ' + prize + 'g.', ['Wonderful']);
      } else {
        s.flags['fest' + s.year + s.season] = true;
        for (const n of PA.NPC_DATA) PA.Dialogue.rel(s, n.id).pts += 60;
        PA.UI.confirm('Paper lanterns rise over the lake, one for every page of Marginton. Everyone feels a little closer.', ['Beautiful']);
      }
      return true;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
