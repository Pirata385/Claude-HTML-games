// Test Room panels: the Tear (free weaving with filters), the being terminal,
// the test-battle portal and the room options. Each returns a modal card.
(function (XS) {
  'use strict';

  const { el, button, esc, powerCard, beingCard, kitRow } = XS.Cards;
  const S = XS.S;

  // A row of toggle chips. multi: several can be on (none on = any).
  function chipRow(options, selected, onChange, multi) {
    const row = el('div', 'chip-row');
    const sync = () => row.querySelectorAll('.chip-btn').forEach((b, i) => b.classList.toggle('on', selected.includes(options[i].v)));
    options.forEach((o) => {
      const b = el('button', 'chip-btn', esc(o.l));
      b.type = 'button';
      if (o.c) b.style.setProperty('--c', o.c);
      b.addEventListener('click', () => {
        if (multi) {
          const i = selected.indexOf(o.v);
          if (i >= 0) selected.splice(i, 1); else selected.push(o.v);
        } else { selected.length = 0; selected.push(o.v); }
        sync();
        onChange(selected);
      });
      row.appendChild(b);
    });
    sync();
    return row;
  }

  function slider(label, min, max, value, onInput) {
    const w = el('label', 'lab-slider', `<span>${esc(label(value))}</span><input type="range" min="${min}" max="${max}" step="1" value="${value}">`);
    const input = w.querySelector('input'), span = w.querySelector('span');
    input.addEventListener('input', () => { span.textContent = label(+input.value); onInput(+input.value); });
    return w;
  }

  function section(title) { return el('div', 'lab-sec', `<h5>${esc(title)}</h5>`); }

  // ---------------------------------------------------------------- Tear
  function tear(app) {
    const lab = app.lab, t = lab.tear;
    const m = el('div', 'modal-card wide lab-panel');
    m.appendChild(el('h3', '', S.lab.tear));
    m.appendChild(el('p', 'muted', S.lab.tearHint));

    const tierSec = section(S.lab.rarity);
    const tierSel = [t.tier];
    tierSec.appendChild(chipRow([{ v: -1, l: S.lab.anyTier }, ...S.tier.map((l, i) => ({ v: i, l }))], tierSel, (sel) => { t.tier = sel[0]; XS.Lab.save(lab); }, false));
    m.appendChild(tierSec);

    const formSec = section(S.lab.forms);
    formSec.appendChild(chipRow(Object.keys(XS.Power.FORMS).map((k) => ({ v: k, l: XS.Power.FORMS[k].nouns[0][0] })), t.forms, () => XS.Lab.save(lab), true));
    m.appendChild(formSec);

    const elSec = section(S.lab.elements);
    elSec.appendChild(chipRow(Object.keys(XS.Power.ELEMENTS).map((k) => ({ v: k, l: XS.Power.ELEMENTS[k].name, c: XS.Power.ELEMENTS[k].ramp[2] })), t.elements, () => XS.Lab.save(lab), true));
    m.appendChild(elSec);

    const ctl = el('div', 'lab-controls');
    ctl.appendChild(slider((v) => XS.t('lab.strength', { n: v }), 1, 50, t.floor, (v) => { t.floor = v; XS.Lab.save(lab); }));
    const seed = el('label', 'lab-seed', `<span>${S.seed}</span><input type="text" maxlength="24" spellcheck="false" autocomplete="off" placeholder="${S.lab.random}" value="${esc(t.seed || '')}">`);
    const seedInput = seed.querySelector('input');
    seedInput.addEventListener('change', () => { t.seed = seedInput.value.trim(); XS.Lab.save(lab); });
    ctl.appendChild(seed);
    m.appendChild(ctl);

    const results = el('div', 'cards three lab-results');
    const kit = el('div', 'lab-kit');
    const drawKit = () => { kit.innerHTML = ''; kit.appendChild(el('span', 'muted', S.lab.kit)); kit.appendChild(kitRow(lab.kit.map(XS.Lab.powerOf), (d) => app.showPower(d))); };
    const doWeave = () => {
      const filters = { forms: t.forms.slice(), elements: t.elements.slice() };
      const defs = XS.Lab.weave(lab, seedInput.value.trim());
      app.sound.play('loom');
      results.innerHTML = '';
      for (const def of defs) {
        const card = powerCard(def, { compact: true });
        const row = el('div', 'row slot-buttons');
        for (let slot = 0; slot < 3; slot++) {
          row.appendChild(button(XS.t('lab.equip', { n: slot + 1 }), 'small', () => {
            app.labEquip(slot, XS.Lab.specOf(def, filters));
            drawKit();
          }));
        }
        card.appendChild(row);
        results.appendChild(card);
      }
    };
    const bar = el('div', 'row wrap');
    bar.appendChild(button('🧵 ' + S.lab.weave, 'primary', doWeave));
    bar.appendChild(button(S.close, 'ghost', () => app.closeModal()));
    m.appendChild(bar);
    m.appendChild(results);
    drawKit();
    m.appendChild(kit);
    doWeave();
    return m;
  }

  // -------------------------------------------------------------- beings
  function being(app) {
    const m = el('div', 'modal-card wide lab-panel');
    m.appendChild(el('h3', '', S.lab.being));
    const seedRow = el('div', 'seed-row', `<label>${S.seed} <input type="text" maxlength="24" spellcheck="false" autocomplete="off" aria-label="${S.seed}" title="${S.seedHint}"></label>`);
    const input = seedRow.querySelector('input');
    const cards = el('div', 'cards three');
    const roll = (base) => {
      cards.innerHTML = '';
      for (let k = 0; k < 3; k++) {
        const gseed = XS.hash(base, 'labbeing', k);
        cards.appendChild(beingCard(XS.Creature.generate(gseed), { action: [S.choose, () => app.labBeing(gseed)] }));
      }
    };
    input.addEventListener('change', () => roll(XS.codeToSeed(input.value)));
    seedRow.appendChild(button('🎲 ' + S.lab.reroll, 'small', () => roll(XS.randomSeed())));
    m.appendChild(seedRow);
    m.appendChild(cards);
    m.appendChild(button(S.close, 'ghost', () => app.closeModal()));
    roll(XS.randomSeed());
    return m;
  }

  // -------------------------------------------------------- test battles
  function battle(app) {
    const lab = app.lab, t = lab.test;
    const m = el('div', 'modal-card lab-panel');
    m.appendChild(el('h3', '', S.lab.battle));
    m.appendChild(el('p', 'muted', S.lab.battleHint));
    const foes = section(S.lab.opponents);
    foes.appendChild(chipRow([1, 2, 3].map((n) => ({ v: n, l: String(n) })), [t.foes], (sel) => { t.foes = sel[0]; XS.Lab.save(lab); }, false));
    m.appendChild(foes);
    const diff = section(S.set.difficulty);
    diff.appendChild(chipRow(S.set.difficultyOpts.map((l, i) => ({ v: i, l })), [t.difficulty], (sel) => { t.difficulty = sel[0]; XS.Lab.save(lab); }, false));
    m.appendChild(diff);
    m.appendChild(slider((v) => XS.t('floor', { n: v }), 1, 50, t.floor, (v) => { t.floor = v; XS.Lab.save(lab); }));
    m.appendChild(kitRow(lab.kit.map(XS.Lab.powerOf), (d) => app.showPower(d)));
    const row = el('div', 'row');
    row.appendChild(button(S.fight, 'primary', () => app.labTest()));
    row.appendChild(button(S.close, 'ghost', () => app.closeModal()));
    m.appendChild(row);
    return m;
  }

  // ------------------------------------------------------------- options
  function options(app) {
    const lab = app.lab;
    const m = el('div', 'modal-card small lab-panel');
    m.appendChild(el('h3', '', S.lab.options));
    const toggle = (key, label) => {
      const b = button('', 'toggle', () => { lab[key] = !lab[key]; XS.Lab.save(lab); paint(); });
      const paint = () => { b.innerHTML = `${esc(label)}: <b>${lab[key] ? S.set.on : S.set.off}</b>`; b.classList.toggle('on', !!lab[key]); };
      paint();
      return b;
    };
    m.appendChild(toggle('noCd', S.lab.noCd));
    m.appendChild(toggle('invuln', S.lab.invuln));
    m.appendChild(button('♻ ' + S.lab.restore, '', () => app.enterLab()));
    m.appendChild(button(S.settings, '', () => app.openSettings(true)));
    m.appendChild(button(S.lab.leave, 'danger', () => { app.closeModal(); app.go('title'); }));
    m.appendChild(button(S.close, 'ghost', () => app.closeModal()));
    return m;
  }

  XS.LabUI = { tear, being, battle, options };
})(globalThis.XS = globalThis.XS || {});
