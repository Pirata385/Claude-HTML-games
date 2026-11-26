// Água-Tinta — fishing strings (owner C): fish.* (in-canvas HUD labels, escape reasons, misses, tips, events, map).
// Each entry is [pt-BR, en]; both languages always have the same keys.
(function (AQ) {
  'use strict';

  var S = {
    hud: {
      tension: ['TENSÃO', 'TENSION'],
      stamina: ['FÔLEGO', 'STAMINA'],
      rod: ['VARA', 'ROD'],
      keepMiddle: ['mantenha no meio', 'keep it in the middle'],
      power: ['FORÇA', 'POWER'],
      depth: ['{n}m', '{n}m'],
      lineEnd: ['fim da linha', 'end of line']
    },
    escape: {
      snap: ['A linha partiu — tensão alta demais. Solte o molinete quando o medidor chegar no !!!.',
        'The line snapped — too much tension. Let go of the reel when the meter reaches !!!.'],
      slack: ['Ele se soltou — a linha ficou frouxa. Mantenha alguma tensão, mesmo quando ele sacode.',
        'It shook free — the line went slack. Keep some tension, even while it shakes.'],
      thrown: ['Ele se soltou no salto — solte o molinete quando ele pular.',
        'It threw the hook mid-jump — let go of the reel when it jumps.'],
      tear: ['O anzol rasgou — corpo delicado. Recolha com a mão leve, tensão baixa.',
        'The hook tore out — a soft body. Reel gently and keep the tension low.'],
      fray: ['A linha esgarçou na toca — puxe a vara para longe do abrigo e recolha firme.',
        'The line frayed on its den — steer away from cover and reel hard.'],
      spooled: ['Acabou a linha — ela é curta demais para esta briga. Uma linha melhor alcança mais longe.',
        'Out of line — it is too short for this fight. A better line reaches farther.'],
      loose: ['Ele cansou de esperar e foi embora — recolha de vez em quando.',
        'It got bored and swam off — reel in now and then.'],
      slip: ['Escapou do anzol — anzol pequeno demais para um peixe desse tamanho.',
        'It slipped off — the hook is too small for a fish this size.']
    },
    miss: {
      early: ['Cedo demais — ele só beliscou. Espere o ! da mordida.', 'Too early — it only nibbled. Wait for the bite (!).'],
      late: ['Tarde demais — fisgue logo que aparecer o !', 'Too late — strike as soon as the ! shows.']
    },
    tip: {
      run: ['Ele vai correr! Puxe a vara para o lado contrário.', 'It is about to run! Pull the rod the other way.'],
      dive: ['Mergulho! Alivie o molinete e recolha quando ele subir.', 'Diving! Ease off, then reel when it rises.'],
      jump: ['Vai saltar! Solte o molinete enquanto ele estiver no ar.', 'It is going to jump! Let go of the reel while it is airborne.'],
      shake: ['Está sacudindo — mantenha a linha esticada, em pulsos.', 'It is shaking — keep the line tight, in pulses.'],
      burrow: ['Quer se esconder! Vara para longe do abrigo e recolha firme.', 'It wants to hide! Rod away from cover and reel hard.'],
      grip: ['Agarrou no fundo — espere ele soltar e recolha devagar.', 'It is gripping the floor — wait it out, then reel steadily.'],
      ink: ['Tinta! Siga o ângulo da linha e o medidor.', 'Ink! Follow the line angle and the meter.'],
      inflate: ['Inflou! Recolha bem devagar.', 'It puffed up! Reel very slowly.'],
      soft: ['Corpo delicado — tensão sempre baixa.', 'Soft body — always keep the tension low.']
    },
    hookSmall: ['Anzol pequeno demais — ele pode escapar.', 'Hook too small — it may slip off.'],
    lineShort: ['Fim da linha: {m} m. O fundo está fora de alcance.', 'End of the line: {m} m. The bottom is out of reach.'],
    dark: ['Escuro demais aqui embaixo — uma lanterna ajuda a ver os peixes.', 'Too dark down here — a lantern helps you see the fish.'],
    bottle: {
      found: ['Uma garrafa! Há um bilhete dentro.', 'A bottle! There is a note inside.'],
      coins: ['Garrafa vazia — com moedas dentro: {coins}', 'An empty bottle — with coins inside: {coins}']
    },
    frenzy: {
      start: ['Frenesi! Os peixes estão mordendo tudo.', 'Feeding frenzy! The fish bite at anything.'],
      end: ['O frenesi passou.', 'The frenzy is over.']
    },
    legendary: {
      near: ['Algo enorme passa lá embaixo…', 'Something huge passes far below…'],
      back: ['A sombra voltou a rondar a isca.', 'The shadow is circling your bait again.']
    },
    tinteira: {
      tentacles: ['Os tentáculos agarram a linha!', 'Tentacles grip the line!'],
      rises: ['Ela está subindo…', 'She is rising…']
    },
    map: {
      aquarium: ['AQUÁ-', 'AQUA-'],
      aquarium2: ['RIO', 'RIUM'],
      shop: ['LOJA', 'SHOP'],
      pier: ['cais', 'pier'],
      forecast: ['Previsão: {list}', 'Forecast: {list}'],
      locked: ['?????', '?????'],
      species: ['{n}/{total}', '{n}/{total}'],
      requires: ['[{item}]', '[{item}]'],
      boat: ['Barco {n}', 'Boat {n}'],
      hint: ['Toque numa água para pescar', 'Tap a water to fish'],
      hintKeys: ['← → escolher · Enter pescar', '← → choose · Enter to fish'],
      new: ['novo!', 'new!']
    }
  };

  function split(src, idx) {
    var out = {};
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var v = src[k];
      out[k] = Array.isArray(v) ? v[idx] : split(v, idx);
    }
    return out;
  }

  AQ.i18n.add('pt-BR', { fish: split(S, 0) });
  AQ.i18n.add('en', { fish: split(S, 1) });
})(window.AQ);
