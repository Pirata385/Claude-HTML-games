// items.js — the catalogue of things you can own: tools, feed, gear, hats, lab supplies and loot.
// No DOM. kind: tool (counted), equip (owned once), feed, gear, hat, lab, loot.
(function () {
  'use strict';
  const RB = globalThis.RB;

  const ITEMS = {
    net: { name: 'Net', kind: 'tool', price: 30, desc: 'Throw it to catch a creature. A catch uses it up.' },
    bignet: { name: 'Heavy net', kind: 'tool', price: 90, desc: 'Holds big, strong creatures that tear a plain net.' },
    shovel: { name: 'Shovel', kind: 'tool', price: 50, uses: 10, desc: 'Good for 10 holes.' },
    seed: { name: 'Seed bag', kind: 'tool', price: 12, desc: 'Scatter to lure birds in close.' },
    detector: { name: 'Metal detector', kind: 'equip', price: 450, desc: 'Beeps faster near buried metal.' },
    launcher: { name: 'Net launcher', kind: 'equip', price: 700, desc: 'Nets fly much further.' },
    lantern: { name: 'Lantern', kind: 'equip', price: 150, desc: 'See further at night.' },
    silvernet: { name: 'Silver net', kind: 'equip', price: 0, prize: true, desc: 'Old Bira\'s prize. Holds just like a plain net, and it never runs out.' },
    goldshovel: { name: 'Golden shovel', kind: 'equip', price: 0, prize: true, desc: 'Dona Zefa\'s prize. Digs ten holes a day, every day, and never wears out.' },

    grain: { name: 'Grain', kind: 'feed', price: 4, desc: 'Plain feed. Fill the feeder or hand it out.' },
    worm: { name: 'Worms', kind: 'feed', price: 6, desc: 'A treat. Feeds a bird and it trusts you more.' },
    chili: { name: 'Chili', kind: 'feed', price: 25, desc: 'Next bout: much more aggressive.' },
    tonic: { name: 'Tonic', kind: 'feed', price: 60, desc: 'Restores vigour: a worn-out bird can fight again today. Does not heal wounds.' },
    gromash: { name: 'Gro-Mash', kind: 'feed', price: 45, desc: 'A growing bird ages one day at once.' },
    loveseed: { name: 'Love seeds', kind: 'feed', price: 70, desc: 'Next nesting is much more likely to give an egg.' },
    mushroom: { name: 'Odd mushroom', kind: 'feed', price: 40, desc: 'Scrambles a few genes. Who knows.' },
    isotope: { name: 'Glowing isotope', kind: 'feed', price: 300, desc: 'Scrambles a lot of genes.' },
    elixir: { name: 'Youth elixir', kind: 'feed', price: 1800, desc: 'Takes three days off a bird\'s age.' },

    spurs: { name: 'Steel spurs', kind: 'gear', price: 350, desc: 'Kicks hit a fifth harder.' },
    helmet: { name: 'Tin helmet', kind: 'gear', price: 300, desc: 'Blows to the head hurt a quarter less.' },
    scarf: { name: 'Lucky scarf', kind: 'gear', price: 200, desc: 'Starts every bout in high spirits.' },
    anklets: { name: 'Training weights', kind: 'gear', price: 250, desc: 'Training works half again as well.' },

    tophat: { name: 'Top hat', kind: 'hat', price: 120, desc: 'Distinguished.' },
    cowboy: { name: 'Cowboy hat', kind: 'hat', price: 90, desc: 'Yee-haw.' },
    party: { name: 'Party hat', kind: 'hat', price: 40, desc: 'Every day is somebody\'s birthday.' },
    bandana: { name: 'Bandana', kind: 'hat', price: 60, desc: 'Means business.' },
    crown: { name: 'Crown', kind: 'hat', price: 900, desc: 'For champions and pretenders.' },
    bucket: { name: 'BFC bucket', kind: 'hat', price: 0, desc: 'A loyalty reward. Worn upside down, with pride.' },

    beaker: { name: 'Empty beaker', kind: 'lab', price: 40, desc: 'Holds one extracted gene.' },
    enzyme: { name: 'Cas enzyme', kind: 'lab', price: 90, desc: 'One CRISPR edit.' },
    fuse: { name: 'Fuse', kind: 'lab', price: 250, desc: 'The lab generator needs three.' },

    cap: { name: 'Bottle cap', kind: 'loot', price: 2, desc: 'Someone collects these.' },
    boot: { name: 'Old boot', kind: 'loot', price: 1, desc: 'Just the one.' },
    shard: { name: 'Pottery shard', kind: 'loot', price: 30, desc: 'Old. Somebody will pay for it.' },
    oldspur: { name: 'Antique spur', kind: 'loot', price: 150, desc: 'From a champion long gone.' },
    idol: { name: 'Gold idol', kind: 'loot', price: 400, desc: 'A small golden rooster.' },
  };
  for (const id of Object.keys(ITEMS)) ITEMS[id].id = id;

  // What each shop sells. Coop and vehicle upgrades are handled by their own shops.
  const STOCK = {
    tools: ['net', 'bignet', 'shovel', 'seed', 'lantern', 'detector', 'launcher', 'fuse'],
    feed: ['grain', 'worm', 'chili', 'tonic', 'gromash', 'loveseed'],
    hatter: ['party', 'bandana', 'cowboy', 'tophat', 'crown', 'scarf', 'anklets', 'helmet', 'spurs'],
    market: ['mushroom', 'isotope', 'elixir', 'fuse', 'bignet'],
  };
  // Upgrades: [id, name, levels as prices, description]
  const UPGRADES = {
    engine: { name: 'Tuned engine', prices: [400, 1300], at: 'garage', desc: 'Drive faster.' },
    tires: { name: 'Mud tyres', prices: [600], at: 'garage', desc: 'No slowing in swamp or sand.' },
    coop: { name: 'Coop extension', prices: [250, 800, 2200], at: 'feed', desc: 'Room for more birds.' },
    nest: { name: 'Nest box', prices: [300, 900], at: 'feed', desc: 'One more breeding pair.' },
    incubator: { name: 'Incubator', prices: [500], at: 'feed', desc: 'Eggs hatch a day sooner.' },
    dummy: { name: 'Training dummy', prices: [280], at: 'feed', desc: 'Train a bird once a day.' },
  };
  // the truck carries as many creatures as you can catch
  const CAGE = [Infinity, Infinity, Infinity, Infinity], COOP = [6, 10, 16, 24];

  // Fossil sets for the lab's fossil bench: four fragments rebuild one.
  const FOSSILS = { dodo: 'Dodo', terror: 'Terror bird', moa: 'Moa', archaeo: 'Archaeopteryx', raptor: 'Raptor' };

  RB.items = { ITEMS, STOCK, UPGRADES, CAGE, COOP, FOSSILS, sellPrice: (id) => Math.max(1, Math.floor(ITEMS[id].price * 0.5)) };
})();
