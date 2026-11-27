// Água-Tinta — tint roles of the art (owner A). Pure data, no colour literals: values are AQ.TINT_ROLES names;
// the Colourful theme's palette (AQ.THEMES.colorido, js/core/ns.js) gives each role its colour. Every other theme
// draws every role in the ink. AQ.render registers these at load: a sprite / art frame then draws in its role by
// default (an explicit tint on the draw call still wins).
(function (AQ) {
  'use strict';

  AQ.TINTS = {
    // sprite keys (AQ.sprites): every species, the juvenile and the sightings
    sprites: {
      _alevino: 'silver',
      manjuba: 'silver', tainha: 'silver', siri: 'blue', camarao: 'pink', baiacu: 'yellow', arraia: 'brown',
      agulha: 'teal', cavalo: 'orange', ermitao: 'red', tipografo: 'white', palhaco: 'orange', cirurgiao: 'blue',
      papagaio: 'green', moreia: 'green', lagosta: 'red', leao: 'red', polvo: 'red', sargo: 'silver',
      cavalinha: 'teal', lula: 'pink', escorpiao: 'brown', congro: 'grey', garoupa: 'brown', aranha: 'orange',
      aguaviva: 'violet', voador: 'blue', dourado: 'yellow', atum: 'blue', caravela: 'purple', lua: 'silver',
      manta: 'grey', martelo: 'grey', marlim: 'blue', machado: 'silver', vibora: 'teal', isopode: 'grey',
      diabo: 'brown', vampira: 'red', atolla: 'red', pelicano: 'purple', celacanto: 'blue', tinteira: 'violet',
      baleia: 'grey', golfinhos: 'silver', tartaruga: 'green'
    },
    // art paths (AQ.art, dot-separated) → role
    art: {
      logo: 'accent',
      boat: 'wood', boats: 'wood', angler: 'skin', bottle: 'glass', birds: 'white',
      'decor.pedras': 'rock', 'decor.algas': 'plant', 'decor.coral': 'coral', 'decor.anemona': 'anemone',
      'decor.kelp': 'kelp', 'decor.gruta': 'rock', 'decor.castelo': 'sand', 'decor.ostra': 'white', 'decor.bau': 'gold',
      'decor.naufragio': 'wood', 'decor.ruina': 'grey', 'decor.farol': 'red',
      visitors: 'skin',
      'map.aquarium': 'glass', 'map.shop': 'wood', 'map.lighthouse': 'red', 'map.pier': 'wood',
      lamp: 'lantern', filter: 'glass', tentacle: 'violet', oyster: 'white',
      'terrain.seagrass': 'plant', 'terrain.rock': 'rock', 'terrain.coralHead': 'coral', 'terrain.kelp': 'kelp',
      'terrain.boulder': 'rock', 'terrain.cave': 'rock', 'terrain.vent': 'vent',
      icons: 'accent'
    },
    // particle kinds (AQ.fx) → role
    fx: {
      splash: 'foam', drop: 'foam', ripple: 'foam', bubble: 'bubble', pop: 'bubble', spark: 'gold', coin: 'gold',
      flake: 'food', dust: 'sand', text: 'accent', bloom: 'accent'
    }
  };
})(window.AQ);
